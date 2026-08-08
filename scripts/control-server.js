#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const controlHost = '127.0.0.1';
const controlPort = Number(process.env.CONTROL_PORT || 3000);
const frontendHost = '127.0.0.1';
const frontendPort = Number(process.env.FRONTEND_INTERNAL_PORT || 3001);
const frontendUrl = `http://${frontendHost}:${frontendPort}`;
const frontendDirectory = path.join(repoRoot, 'packages', 'frontend');
const backendDirectory = path.join(repoRoot, 'packages', 'backend');
const backendUrl = 'http://127.0.0.1:5001/health';
const envPath = path.join(repoRoot, '.env.local');
const envExamplePath = path.join(repoRoot, '.env.example');
const controlHeader = 'x-english-mastery-control';
const localPostgresUser = 'postgres';
const localPostgresDatabase = 'english_learning';
const yarnVersion = '1.22.22';
const backupsDirectory = path.join(repoRoot, 'backups');
const contentInboxBranch = 'chatgpt-content-inbox';
const contentInboxRef = `origin/${contentInboxBranch}`;

process.chdir(repoRoot);

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function urlHealthy(url, timeout = 2500) {
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
    });
    return response.status >= 200 && response.status < 500;
  } catch {
    return false;
  }
}

function commandResult(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: options.quiet === false ? 'inherit' : 'pipe',
    encoding: 'utf8',
  });
}

function commandOutput(result) {
  return [result.stdout, result.stderr]
    .filter(Boolean)
    .join('\n')
    .trim();
}

function commandAvailable(command) {
  const result = commandResult(command, ['--version']);
  return result.status === 0;
}

function resolvePackageManager() {
  if (commandAvailable('yarn')) return { command: 'yarn', prefix: [] };
  if (commandAvailable('corepack')) {
    return { command: 'corepack', prefix: ['yarn'] };
  }
  if (commandAvailable('npx')) {
    return { command: 'npx', prefix: ['--yes', `yarn@${yarnVersion}`] };
  }
  throw new Error('Yarn is unavailable. Install Node.js 20+ with npm.');
}

function run(command, args, onOutput) {
  return new Promise((resolve, reject) => {
    let capturedOutput = '';
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const capture = (chunk) => {
      const output = chunk.toString();
      capturedOutput += output;
      onOutput(output);
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve(capturedOutput);
      else {
        const detail = capturedOutput
          .trim()
          .split(/\r?\n/)
          .slice(-12)
          .join('\n');
        reject(
          new Error(
            `Command failed: ${command} ${args.join(' ')}${
              detail ? `\n${detail}` : ''
            }`,
          ),
        );
      }
    });
  });
}

function parseEnvironment(content) {
  const values = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    values[key] = value;
  }
  return values;
}

function parseContainerState(output) {
  const [status = 'unknown', health = 'none', exitCode = ''] = output
    .trim()
    .split('|');
  return {
    status: status || 'unknown',
    health: health || 'none',
    exitCode: exitCode === '' ? null : Number(exitCode),
  };
}

function secureLocalEnvironment() {
  if (!fs.existsSync(envExamplePath)) {
    throw new Error('.env.example is missing.');
  }
  let content = fs.existsSync(envPath)
    ? fs.readFileSync(envPath, 'utf8')
    : fs.readFileSync(envExamplePath, 'utf8');
  const match = content.match(/^JWT_SECRET=(.*)$/m);
  const insecureValues = new Set([
    '',
    'your-super-secret-jwt-key-change-in-production',
    'replace-with-openssl-rand-hex-32',
    'dev-secret-key-change-in-production',
  ]);
  if (!match) {
    content += `\nJWT_SECRET=${crypto.randomBytes(32).toString('hex')}\n`;
  } else if (insecureValues.has(match[1].trim())) {
    content = content.replace(
      /^JWT_SECRET=.*$/m,
      `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`,
    );
  }
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  Object.assign(process.env, parseEnvironment(content));
}

class ControlManager {
  constructor({
    execute = commandResult,
    runAsync = run,
    spawnChild = spawn,
    wait = delay,
  } = {}) {
    this.execute = execute;
    this.runAsync = runAsync;
    this.spawnChild = spawnChild;
    this.wait = wait;
    this.phase = 'idle';
    this.currentStep = 'Ready to validate and start';
    this.error = null;
    this.startedAt = null;
    this.logs = [];
    this.services = null;
    this.servicesStopping = false;
    this.serviceFailure = null;
    this.serviceOutput = { backend: [], worker: [], frontend: [] };
    this.startPromise = null;
    this.updatePromise = null;
    this.contentSyncPromise = null;
    this.readyCache = { value: false, checkedAt: 0 };
  }

  log(message) {
    const lines = message
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of lines) {
      const entry = `${new Date().toLocaleTimeString()}  ${line}`;
      this.logs.push(entry);
      console.log(entry);
    }
    this.logs = this.logs.slice(-80);
  }

  step(message) {
    this.currentStep = message;
    this.log(message);
  }

  async frontendReady(force = false) {
    const now = Date.now();
    if (!force && now - this.readyCache.checkedAt < 1000) {
      return this.readyCache.value;
    }
    const value = await urlHealthy(frontendUrl);
    this.readyCache = { value, checkedAt: now };
    return value;
  }

  async backendReady() {
    return urlHealthy(backendUrl);
  }

  async appReady() {
    const [frontend, backend] = await Promise.all([
      this.frontendReady(true),
      this.backendReady(),
    ]);
    return frontend && backend;
  }

  async snapshot() {
    const [frontend, backend] = await Promise.all([
      this.frontendReady(true),
      this.backendReady(),
    ]);
    if (frontend && backend && this.phase !== 'starting') {
      this.phase = 'ready';
      this.currentStep = 'English Mastery is running';
    } else if (this.phase === 'ready' && (!frontend || !backend)) {
      this.phase = 'error';
      this.currentStep = 'A service stopped unexpectedly';
      this.error = 'Click Start to validate the services and try again.';
    }
    return {
      phase: this.phase,
      currentStep: this.currentStep,
      error: this.error,
      startedAt: this.startedAt,
      frontend,
      backend,
      logs: this.logs,
    };
  }

  async ensureDependencies() {
    const required = [
      path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next'),
      path.join(repoRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'),
      path.join(repoRoot, 'node_modules', 'knex', 'bin', 'cli.js'),
    ];
    if (required.every((file) => fs.existsSync(file))) return;
    const manager = resolvePackageManager();
    await this.runAsync(
      manager.command,
      [...manager.prefix, 'install', '--frozen-lockfile'],
      (output) => this.log(output),
    );
  }

  async installDependencies() {
    const manager = resolvePackageManager();
    await this.runAsync(
      manager.command,
      [...manager.prefix, 'install', '--frozen-lockfile'],
      (output) => this.log(output),
    );
  }

  async ensureDocker() {
    if (!commandAvailable('docker')) {
      throw new Error('Docker Desktop is not installed.');
    }
    if (this.execute('docker', ['info']).status === 0) return;
    if (process.platform !== 'darwin') {
      throw new Error('Docker is installed, but its engine is not running.');
    }
    this.log('Opening Docker Desktop…');
    const opened = this.execute('open', ['-a', 'Docker']);
    if (opened.status !== 0) throw new Error('Docker Desktop could not be opened.');
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (this.execute('docker', ['info']).status === 0) return;
      await this.wait(2000);
    }
    throw new Error('Docker Desktop did not become ready within two minutes.');
  }

  infrastructureDiagnostics(service) {
    const status = this.execute('docker', [
      'compose',
      'ps',
      '--all',
      service,
    ]);
    const logs = this.execute('docker', [
      'compose',
      'logs',
      '--no-color',
      '--tail',
      '40',
      service,
    ]);
    const output = [
      `${service} container status:`,
      commandOutput(status) || '(status unavailable)',
      `${service} recent logs:`,
      commandOutput(logs) || '(logs unavailable)',
    ].join('\n');
    this.log(output);
    return output;
  }

  async waitForContainer({
    containerName,
    label,
    probeArgs,
    service,
  }) {
    let lastOutput = '';
    for (let attempt = 0; attempt < 45; attempt += 1) {
      const inspected = this.execute('docker', [
        'inspect',
        '--format',
        '{{.State.Status}}|{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}|{{.State.ExitCode}}',
        containerName,
      ]);
      if (inspected.status !== 0) {
        this.infrastructureDiagnostics(service);
        throw new Error(
          `${label} container was not created or cannot be inspected: ${
            commandOutput(inspected) || containerName
          }`,
        );
      }

      const state = parseContainerState(commandOutput(inspected));
      if (['dead', 'exited', 'removing'].includes(state.status)) {
        this.infrastructureDiagnostics(service);
        throw new Error(
          `${label} container stopped${
            state.exitCode === null ? '' : ` with exit code ${state.exitCode}`
          }. Open Startup details for its logs.`,
        );
      }
      if (state.health === 'unhealthy') {
        this.infrastructureDiagnostics(service);
        throw new Error(
          `${label} container is unhealthy. Open Startup details for its logs.`,
        );
      }

      if (state.status === 'running') {
        const result = this.execute('docker', [
          'exec',
          containerName,
          ...probeArgs,
        ]);
        if (result.status === 0) {
          this.log(`${label}: ready`);
          return;
        }
        lastOutput = commandOutput(result);
      }
      await this.wait(2000);
    }
    this.infrastructureDiagnostics(service);
    throw new Error(
      `${label} container is running but its readiness probe failed for 90 seconds.${
        lastOutput ? ` Last probe: ${lastOutput}` : ''
      }`,
    );
  }

  async startInfrastructure() {
    await this.runAsync(
      'docker',
      ['compose', 'up', '-d', 'postgres', 'redis'],
      (output) => this.log(output),
    );
    await Promise.all([
      this.waitForContainer({
        containerName: 'english_learning_postgres',
        label: 'PostgreSQL',
        probeArgs: [
          'pg_isready',
          '-U',
          localPostgresUser,
          '-d',
          localPostgresDatabase,
        ],
        service: 'postgres',
      }),
      this.waitForContainer({
        containerName: 'english_learning_redis',
        label: 'Redis',
        probeArgs: ['redis-cli', 'ping'],
        service: 'redis',
      }),
    ]);
  }

  async migrate() {
    await this.runAsync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'knex', 'bin', 'cli.js'),
        '--knexfile',
        path.join(repoRoot, 'knexfile.js'),
        '--env',
        'development',
        'migrate:latest',
      ],
      (output) => this.log(output),
    );
  }

  async verifyMigrations() {
    const output = await this.runAsync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'knex', 'bin', 'cli.js'),
        '--knexfile',
        path.join(repoRoot, 'knexfile.js'),
        '--env',
        'development',
        'migrate:status',
      ],
      (value) => this.log(value),
    );
    if (/Found\s+[1-9]\d*\s+Pending Migration/i.test(output)) {
      throw new Error(
        'Database migration verification found pending migrations after migrate:latest.',
      );
    }
    await this.verifyStartupSchema();
  }

  async verifyStartupSchema() {
    const verifyScript = path.join(backendDirectory, 'src', 'scripts', 'verify-startup-schema.ts');
    await this.runAsync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'),
        '--transpile-only',
        '--project',
        path.join(backendDirectory, 'tsconfig.json'),
        verifyScript,
      ],
      (output) => this.log(output),
    );
  }

  async synchronizeBuiltInContent() {
    const syncScript = path.join(
      backendDirectory,
      'src',
      'scripts',
      'sync-starter-samples.ts',
    );
    if (!fs.existsSync(syncScript)) return;
    await this.runAsync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'),
        '--transpile-only',
        '--project',
        path.join(backendDirectory, 'tsconfig.json'),
        syncScript,
      ],
      (output) => this.log(output),
    );
  }

  synchronizeChatGPTContent() {
    if (this.contentSyncPromise) return this.contentSyncPromise;
    this.contentSyncPromise = this.runChatGPTContentSync().finally(() => {
      this.contentSyncPromise = null;
    });
    return this.contentSyncPromise;
  }

  async runChatGPTContentSync() {
    const fetched = this.execute('git', [
      'fetch',
      'origin',
      `refs/heads/${contentInboxBranch}:refs/remotes/origin/${contentInboxBranch}`,
      '--depth=1',
    ]);
    if (fetched.status !== 0) {
      const detail = commandOutput(fetched);
      this.log(
        detail.includes("couldn't find remote ref")
          ? 'ChatGPT content inbox is not initialized yet.'
          : `ChatGPT content sync skipped: ${detail || 'GitHub fetch failed.'}`,
      );
      return { available: false };
    }
    const syncScript = path.join(
      backendDirectory,
      'src',
      'scripts',
      'sync-content-packs.ts',
    );
    if (!fs.existsSync(syncScript)) return { available: false };
    const syncOutput = await this.runAsync(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'),
        '--transpile-only',
        '--project',
        path.join(backendDirectory, 'tsconfig.json'),
        syncScript,
        '--git-ref',
        contentInboxRef,
      ],
      (output) => this.log(output),
    );
    const syncResult = this.parseLastJsonObject(syncOutput);
    const cleanup = await this.cleanupVerifiedContentPacks(
      syncResult.cleanupEligible || [],
      syncScript,
    );
    return { available: true, cleanup };
  }

  parseLastJsonObject(output = '') {
    const lines = String(output).trim().split(/\r?\n/);
    for (let start = 0; start < lines.length; start += 1) {
      const candidate = lines.slice(start).join('\n');
      try {
        return JSON.parse(candidate);
      } catch {}
    }
    return {};
  }

  async cleanupVerifiedContentPacks(manifestIds, syncScript) {
    const cleaned = [];
    const alreadyAbsent = [];
    const failed = [];
    for (const manifestId of [...new Set(manifestIds)]) {
      if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,119}$/.test(manifestId)) {
        failed.push({ manifestId, error: 'Unsafe manifest ID.' });
        continue;
      }
      const folder = `content-packs/inbox/${manifestId}`;
      const exists = this.execute('git', ['cat-file', '-e', `${contentInboxRef}:${folder}`]);
      if (exists.status !== 0) {
        const currentSha = commandOutput(this.execute('git', ['rev-parse', contentInboxRef]));
        await this.runAsync(
          process.execPath,
          [path.join(repoRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--transpile-only', '--project', path.join(backendDirectory, 'tsconfig.json'), syncScript, '--mark-cleaned', manifestId, currentSha],
          (output) => this.log(output),
        );
        alreadyAbsent.push(manifestId);
        continue;
      }
      const expectedSha = commandOutput(this.execute('git', ['rev-parse', contentInboxRef]));
      const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'english-content-cleanup-'));
      try {
        let result = this.execute('git', ['worktree', 'add', '--detach', worktree, contentInboxRef]);
        if (result.status !== 0) throw new Error(commandOutput(result) || 'Could not create cleanup worktree.');
        fs.rmSync(path.join(worktree, ...folder.split('/')), { recursive: true, force: true });
        result = this.execute('git', ['-C', worktree, 'add', '-A', '--', folder]);
        if (result.status !== 0) throw new Error(commandOutput(result) || 'Could not stage inbox cleanup.');
        result = this.execute('git', ['-C', worktree, '-c', 'user.name=English Mastery', '-c', 'user.email=local@english-mastery.invalid', 'commit', '-m', `Archive completed content pack ${manifestId}`]);
        if (result.status !== 0) throw new Error(commandOutput(result) || 'Could not commit inbox cleanup.');
        const cleanupSha = commandOutput(this.execute('git', ['-C', worktree, 'rev-parse', 'HEAD']));
        result = this.execute('git', ['-C', worktree, 'push', 'origin', `HEAD:refs/heads/${contentInboxBranch}`, `--force-with-lease=refs/heads/${contentInboxBranch}:${expectedSha}`]);
        if (result.status !== 0) throw new Error(commandOutput(result) || 'Inbox changed concurrently; cleanup deferred.');
        result = this.execute('git', ['update-ref', `refs/remotes/origin/${contentInboxBranch}`, cleanupSha, expectedSha]);
        if (result.status !== 0) throw new Error(commandOutput(result) || 'Could not update the local inbox reference.');
        await this.runAsync(
          process.execPath,
          [path.join(repoRoot, 'node_modules', 'ts-node', 'dist', 'bin.js'), '--transpile-only', '--project', path.join(backendDirectory, 'tsconfig.json'), syncScript, '--mark-cleaned', manifestId, cleanupSha],
          (output) => this.log(output),
        );
        cleaned.push(manifestId);
      } catch (error) {
        failed.push({ manifestId, error: error instanceof Error ? error.message : String(error) });
      } finally {
        this.execute('git', ['worktree', 'remove', '--force', worktree]);
        fs.rmSync(worktree, { recursive: true, force: true });
      }
    }
    return { cleaned, alreadyAbsent, failed };
  }

  verifyUpdateWorkspace() {
    const branch = commandOutput(this.execute('git', ['branch', '--show-current']));
    if (branch !== 'main') {
      throw new Error(`Updates require the main branch; this checkout is on ${branch || 'an unknown branch'}.`);
    }
    const status = commandOutput(
      this.execute('git', ['status', '--porcelain', '--untracked-files=normal']),
    );
    if (status) {
      throw new Error(
        'The local repository has uncommitted changes. Preserve or commit them before using Update & restart.',
      );
    }
  }

  async backupDatabase() {
    fs.mkdirSync(backupsDirectory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const containerFile = `/tmp/english-learning-${stamp}.dump`;
    const localFile = path.join(backupsDirectory, `english-learning-${stamp}.dump`);
    const dump = this.execute('docker', [
      'exec',
      'english_learning_postgres',
      'pg_dump',
      '-U',
      localPostgresUser,
      '-d',
      localPostgresDatabase,
      '-Fc',
      '-f',
      containerFile,
    ]);
    if (dump.status !== 0) {
      throw new Error(`PostgreSQL backup failed: ${commandOutput(dump)}`);
    }
    const copied = this.execute('docker', [
      'cp',
      `english_learning_postgres:${containerFile}`,
      localFile,
    ]);
    this.execute('docker', [
      'exec',
      'english_learning_postgres',
      'rm',
      '-f',
      containerFile,
    ]);
    if (copied.status !== 0) {
      throw new Error(`PostgreSQL backup could not be copied: ${commandOutput(copied)}`);
    }
    this.log(`Database backup: ${localFile}`);
  }

  spawnServices() {
    const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
    const backendBin = path.join(
      repoRoot,
      'node_modules',
      'ts-node',
      'dist',
      'bin.js',
    );
    const childEnvironment = {
      ...process.env,
      NODE_ENV: 'development',
      HOST: '127.0.0.1',
      PORT: '5001',
      NEXT_PUBLIC_API_URL: 'http://127.0.0.1:5001',
    };
    const definitions = [
      {
        name: 'backend',
        cwd: backendDirectory,
        args: [
          backendBin,
          '--transpile-only',
          '--project',
          path.join(backendDirectory, 'tsconfig.json'),
          path.join(backendDirectory, 'src', 'index.ts'),
        ],
      },
      {
        name: 'worker',
        cwd: backendDirectory,
        args: [
          backendBin,
          '--transpile-only',
          '--project',
          path.join(backendDirectory, 'tsconfig.json'),
          path.join(backendDirectory, 'src', 'worker.ts'),
        ],
      },
      {
        name: 'frontend',
        cwd: frontendDirectory,
        args: [
          nextBin,
          'dev',
          '-H',
          frontendHost,
          '-p',
          String(frontendPort),
        ],
      },
    ];
    this.servicesStopping = false;
    this.serviceFailure = null;
    this.serviceOutput = { backend: [], worker: [], frontend: [] };
    this.services = definitions.map(({ name, args, cwd }) => {
      const recentOutput = this.serviceOutput[name];
      const child = this.spawnChild(process.execPath, args, {
        cwd,
        env: childEnvironment,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const capture = (chunk) => {
        const output = chunk.toString();
        this.log(`[${name}] ${output}`);
        recentOutput.push(
          ...output
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean),
        );
        if (recentOutput.length > 12) recentOutput.splice(0, recentOutput.length - 12);
      };
      const failService = (message) => {
        const detail = recentOutput.length
          ? ` Last output: ${recentOutput.slice(-6).join(' | ')}`
          : '';
        this.serviceFailure = new Error(`${message}${detail}`);
        this.phase = 'error';
        this.currentStep = `${name} stopped`;
        this.error = this.serviceFailure.message;
        this.stopServices();
      };
      child.stdout.on('data', capture);
      child.stderr.on('data', capture);
      child.once('error', (error) => {
        failService(`${name} could not start: ${error.message}.`);
      });
      child.once('exit', (code, signal) => {
        if (this.phase === 'idle' || this.servicesStopping) return;
        const reason = signal
          ? `signal ${signal}`
          : `exit code ${code === null ? 'unknown' : code}`;
        failService(`${name} exited with ${reason}.`);
      });
      return child;
    });
  }

  stopServices() {
    this.servicesStopping = true;
    for (const child of this.services || []) {
      if (!child.killed && child.exitCode === null) child.kill('SIGTERM');
    }
    this.services = null;
  }

  async waitForServices() {
    let lastBackend = false;
    let lastFrontend = false;
    for (let attempt = 0; attempt < 75; attempt += 1) {
      if (this.serviceFailure) throw this.serviceFailure;
      [lastBackend, lastFrontend] = await Promise.all([
        this.backendReady(),
        this.frontendReady(true),
      ]);
      if (lastBackend && lastFrontend) return;
      if (this.services?.some((child) => child.exitCode !== null)) {
        throw new Error('A web service stopped before the app became ready.');
      }
      await this.wait(2000);
    }
    const unavailable = [
      !lastBackend && 'backend',
      !lastFrontend && 'frontend',
    ].filter(Boolean);
    const diagnostics = unavailable
      .map((name) => {
        const output = this.serviceOutput[name] || [];
        return output.length
          ? `${name} last output: ${output.slice(-6).join(' | ')}`
          : `${name} produced no output`;
      })
      .join(' ');
    throw new Error(
      `${unavailable.join(' and ')} did not become ready within two and a half minutes. ${diagnostics}`,
    );
  }

  start() {
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.runStart().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  restart() {
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.runRestart().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  updateAndRestart() {
    if (this.updatePromise) return this.updatePromise;
    if (this.startPromise) return this.startPromise;
    this.updatePromise = this.runUpdateAndRestart().finally(() => {
      this.updatePromise = null;
    });
    return this.updatePromise;
  }

  async runUpdateAndRestart() {
    this.phase = 'starting';
    this.error = null;
    this.logs = [];
    this.startedAt = new Date().toISOString();
    try {
      this.step('Checking Node.js and local configuration');
      const major = Number(process.versions.node.split('.')[0]);
      if (!Number.isFinite(major) || major < 20) {
        throw new Error(`Node.js ${process.versions.node} is unsupported; install 20+.`);
      }
      secureLocalEnvironment();

      this.step('Checking the local Git workspace');
      this.verifyUpdateWorkspace();

      this.step('Checking GitHub main for updates');
      await this.runAsync('git', ['fetch', 'origin', 'main', '--prune'], (output) =>
        this.log(output),
      );
      const local = commandOutput(this.execute('git', ['rev-parse', 'HEAD']));
      const remote = commandOutput(
        this.execute('git', ['rev-parse', 'origin/main']),
      );

      this.step('Checking Docker Desktop and PostgreSQL');
      await this.ensureDocker();
      await this.startInfrastructure();

      if (local !== remote) {
        const ancestor = this.execute('git', [
          'merge-base',
          '--is-ancestor',
          local,
          remote,
        ]);
        if (ancestor.status !== 0) {
          throw new Error('Local main cannot be fast-forwarded safely to GitHub main.');
        }
        this.step('Backing up PostgreSQL before the update');
        await this.backupDatabase();
        this.step('Downloading the validated main version');
        await this.runAsync('git', ['merge', '--ff-only', 'origin/main'], (output) =>
          this.log(output),
        );
        this.step('Installing locked project dependencies');
        await this.installDependencies();
      } else {
        this.log('Local main already matches GitHub main.');
        this.step('Checking locked project dependencies');
        await this.ensureDependencies();
      }

      this.step('Stopping the current backend and frontend');
      this.stopServices();
      for (let attempt = 0; attempt < 30; attempt += 1) {
        const [backend, frontend] = await Promise.all([
          this.backendReady(),
          this.frontendReady(true),
        ]);
        if (!backend && !frontend) break;
        if (attempt === 29) {
          throw new Error(
            'The old web services did not stop. Stop any separate app Terminal process and try again.',
          );
        }
        await this.wait(250);
      }

      this.step('Applying database migrations');
      await this.migrate();
      this.step('Verifying database migration status');
      await this.verifyMigrations();
      this.step('Synchronizing ChatGPT content inbox');
      await this.synchronizeChatGPTContent();
      this.step('Synchronizing built-in vocabulary');
      await this.synchronizeBuiltInContent();
      this.step('Starting the updated backend and frontend');
      this.spawnServices();
      await this.waitForServices();

      this.phase = 'ready';
      this.currentStep =
        local === remote
          ? 'Current version restarted and content synchronized'
          : 'GitHub update installed and synchronized';
      this.log('Update & restart completed.');
    } catch (error) {
      this.stopServices();
      this.phase = 'error';
      this.currentStep = 'Update stopped safely';
      this.error = error instanceof Error ? error.message : String(error);
      this.log(`Update failed: ${this.error}`);
    }
  }

  async runRestart() {
    this.phase = 'starting';
    this.error = null;
    this.logs = [];
    this.startedAt = new Date().toISOString();
    try {
      this.step('Stopping the current backend and frontend');
      this.stopServices();

      let backend = false;
      let frontend = false;
      for (let attempt = 0; attempt < 30; attempt += 1) {
        [backend, frontend] = await Promise.all([
          this.backendReady(),
          this.frontendReady(true),
        ]);
        if (!backend && !frontend) break;
        await this.wait(250);
      }
      if (backend || frontend) {
        throw new Error(
          'The old web services did not stop. They may be running from a separate Terminal process; stop that process and try again.',
        );
      }

      await this.runStart({ preserveLogs: true, preserveStartedAt: true });
    } catch (error) {
      this.stopServices();
      this.phase = 'error';
      this.currentStep = 'Restart stopped';
      this.error = error instanceof Error ? error.message : String(error);
      this.log(`Restart failed: ${this.error}`);
    }
  }

  async runStart({ preserveLogs = false, preserveStartedAt = false } = {}) {
    this.phase = 'starting';
    this.error = null;
    this.serviceFailure = null;
    if (!preserveLogs) this.logs = [];
    if (!preserveStartedAt) this.startedAt = new Date().toISOString();
    try {
      this.step('Checking Node.js and local configuration');
      const major = Number(process.versions.node.split('.')[0]);
      if (!Number.isFinite(major) || major < 20) {
        throw new Error(`Node.js ${process.versions.node} is unsupported; install 20+.`);
      }
      secureLocalEnvironment();

      this.step('Checking project dependencies');
      await this.ensureDependencies();

      this.step('Checking Docker Desktop');
      await this.ensureDocker();

      this.step('Starting and validating PostgreSQL and Redis');
      await this.startInfrastructure();

      this.step('Checking and applying database migrations');
      await this.migrate();
      this.step('Verifying database migration status');
      await this.verifyMigrations();

      this.step('Synchronizing ChatGPT content inbox');
      await this.synchronizeChatGPTContent();

      this.step('Synchronizing built-in vocabulary');
      await this.synchronizeBuiltInContent();

      this.step('Checking existing web services');
      const [backend, frontend] = await Promise.all([
        this.backendReady(),
        this.frontendReady(true),
      ]);
      if (backend !== frontend) {
        throw new Error(
          'Only part of the old app is running. Stop the old Terminal process, then retry.',
        );
      }
      if (!backend && !frontend) {
        this.step('Starting backend and frontend');
        this.spawnServices();
      }

      this.step('Waiting for application health checks');
      await this.waitForServices();

      this.phase = 'ready';
      this.currentStep = 'English Mastery is ready';
      this.log('Open http://localhost:3000');
    } catch (error) {
      this.stopServices();
      this.phase = 'error';
      this.currentStep = 'Startup stopped';
      this.error = error instanceof Error ? error.message : String(error);
      this.log(`Startup failed: ${this.error}`);
    }
  }

  shutdown() {
    this.phase = 'idle';
    this.stopServices();
  }
}

function json(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function controlPage() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>English Mastery</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; color: #172033; background: radial-gradient(circle at 20% 10%, #e6edff, transparent 38%), linear-gradient(145deg, #f8faff, #eef2ff); }
    main { width: min(680px, 100%); border: 1px solid #dce3f3; border-radius: 24px; background: rgba(255,255,255,.94); box-shadow: 0 24px 70px rgba(47,65,120,.13); padding: clamp(26px,5vw,46px); }
    .eyebrow { color: #5269d8; font-size: .78rem; font-weight: 800; letter-spacing: .14em; text-transform: uppercase; }
    h1 { margin: 10px 0 10px; font-size: clamp(2rem,6vw,3.3rem); letter-spacing: -.045em; line-height: 1; }
    .intro { color: #5e687d; font-size: 1.03rem; line-height: 1.65; margin: 0 0 28px; }
    .status { display: flex; align-items: center; gap: 12px; border: 1px solid #e2e7f2; border-radius: 16px; padding: 16px; background: #fafbff; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: #8390a8; box-shadow: 0 0 0 6px #edf0f5; flex: 0 0 auto; }
    .starting .dot { background: #eaa727; box-shadow: 0 0 0 6px #fff1cf; animation: pulse 1.2s infinite; }
    .ready .dot { background: #1aa56d; box-shadow: 0 0 0 6px #dff7ed; }
    .error .dot { background: #d34747; box-shadow: 0 0 0 6px #fde5e5; }
    .status strong, .status span { display: block; }
    .status span { margin-top: 3px; color: #6c7588; font-size: .9rem; }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 18px; }
    button { width: 100%; border: 0; border-radius: 14px; padding: 15px 18px; background: #4058cf; color: white; font: inherit; font-weight: 750; cursor: pointer; box-shadow: 0 10px 24px rgba(64,88,207,.24); }
    button.secondary { color: #3145a6; background: #edf1ff; box-shadow: none; border: 1px solid #d6defe; }
    button:hover { background: #344abb; }
    button:focus-visible { outline: 3px solid #aebcff; outline-offset: 3px; }
    button:disabled { cursor: wait; opacity: .65; }
    .errorText { color: #ad2d2d; background: #fff3f3; border: 1px solid #f7d4d4; padding: 12px 14px; border-radius: 12px; margin: 15px 0 0; }
    details { margin-top: 20px; border-top: 1px solid #e8ebf3; padding-top: 16px; }
    summary { cursor: pointer; color: #526078; font-weight: 650; }
    pre { white-space: pre-wrap; max-height: 230px; overflow: auto; margin: 13px 0 0; padding: 14px; border-radius: 12px; background: #172033; color: #e9edff; font: .78rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .note { margin: 20px 0 0; color: #788195; font-size: .84rem; text-align: center; }
    @media (max-width: 560px) { .actions { grid-template-columns: 1fr; } }
    @keyframes pulse { 50% { transform: scale(.74); opacity: .62; } }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Local learning workspace</div>
    <h1>English Mastery</h1>
    <p class="intro">Update from GitHub main or start the installed version. The app checks configuration, dependencies, Docker, PostgreSQL, Redis, migrations, content and web-service health for you.</p>
    <section id="status" class="status idle" aria-live="polite">
      <div class="dot" aria-hidden="true"></div>
      <div><strong id="phase">Ready to start</strong><span id="step">No services have been started yet.</span></div>
    </section>
    <p id="error" class="errorText" hidden></p>
    <div class="actions">
      <button id="update" type="button">Update from GitHub &amp; start</button>
      <button id="start" class="secondary" type="button">Start installed version</button>
    </div>
    <details id="details">
      <summary>Startup details</summary>
      <pre id="logs">Waiting for Start…</pre>
    </details>
    <p class="note">This page remains available on port 3000. When startup completes, the learning app opens at the same address.</p>
  </main>
  <script>
    const statusBox = document.getElementById('status');
    const phase = document.getElementById('phase');
    const step = document.getElementById('step');
    const errorBox = document.getElementById('error');
    const startButton = document.getElementById('start');
    const updateButton = document.getElementById('update');
    const logs = document.getElementById('logs');
    let wasStarting = false;

    function title(value) {
      return ({ idle: 'Ready to start', starting: 'Starting…', ready: 'App ready', error: 'Needs attention' })[value] || value;
    }

    async function refresh() {
      try {
        const response = await fetch('/__control/status', { cache: 'no-store' });
        const state = await response.json();
        statusBox.className = 'status ' + state.phase;
        phase.textContent = title(state.phase);
        step.textContent = state.currentStep;
        errorBox.hidden = !state.error;
        errorBox.textContent = state.error || '';
        logs.textContent = state.logs.length ? state.logs.join('\\n') : 'Waiting for Start…';
        logs.scrollTop = logs.scrollHeight;
        startButton.disabled = state.phase === 'starting';
        updateButton.disabled = state.phase === 'starting';
        startButton.textContent = state.phase === 'error' ? 'Retry installed version' : 'Start installed version';
        updateButton.textContent = state.phase === 'error' ? 'Retry update & start' : 'Update from GitHub & start';
        if (state.phase === 'starting') wasStarting = true;
        if (state.phase === 'ready' && (wasStarting || state.frontend)) {
          window.location.replace('/?started=' + Date.now());
          return;
        }
      } catch (error) {
        statusBox.className = 'status error';
        phase.textContent = 'Control service unavailable';
        step.textContent = error.message;
      }
      window.setTimeout(refresh, 1000);
    }

    startButton.addEventListener('click', async () => {
      startButton.disabled = true;
      wasStarting = true;
      await fetch('/__control/start', {
        method: 'POST',
        headers: { '${controlHeader}': '1' },
      });
      refresh();
    });
    updateButton.addEventListener('click', async () => {
      if (!window.confirm('Fetch and safely fast-forward local main, back up PostgreSQL when code changes, validate everything, and start the app?')) return;
      updateButton.disabled = true;
      startButton.disabled = true;
      wasStarting = true;
      await fetch('/__control/update-restart', {
        method: 'POST',
        headers: { '${controlHeader}': '1' },
      });
      refresh();
    });
    refresh();
  </script>
</body>
</html>`;
}

function proxyRequest(request, response) {
  const headers = {
    ...request.headers,
    host: `${frontendHost}:${frontendPort}`,
    'x-forwarded-host': request.headers.host || `localhost:${controlPort}`,
    'x-forwarded-proto': 'http',
  };
  const upstream = http.request(
    {
      hostname: frontendHost,
      port: frontendPort,
      path: request.url,
      method: request.method,
      headers,
    },
    (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    },
  );
  upstream.on('error', () => {
    if (!response.headersSent) response.writeHead(502);
    response.end('The learning app is temporarily unavailable.');
  });
  request.pipe(upstream);
}

function createControlServer(manager = new ControlManager()) {
  const server = http.createServer(async (request, response) => {
    const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (url.pathname === '/__control/status' && request.method === 'GET') {
      return json(response, 200, await manager.snapshot());
    }
    if (url.pathname === '/__control/start' && request.method === 'POST') {
      if (request.headers[controlHeader] !== '1') {
        return json(response, 403, { error: 'Local control header required.' });
      }
      manager.start();
      return json(response, 202, { accepted: true });
    }
    if (url.pathname === '/__control/restart' && request.method === 'POST') {
      if (request.headers[controlHeader] !== '1') {
        return json(response, 403, { error: 'Local control header required.' });
      }
      manager.restart();
      return json(response, 202, { accepted: true });
    }
    if (url.pathname === '/__control/update-restart' && request.method === 'POST') {
      if (request.headers[controlHeader] !== '1') {
        return json(response, 403, { error: 'Local control header required.' });
      }
      manager.updateAndRestart();
      return json(response, 202, { accepted: true });
    }
    if (url.pathname === '/__control/sync-content' && request.method === 'POST') {
      if (request.headers[controlHeader] !== '1') {
        return json(response, 403, { error: 'Local control header required.' });
      }
      try {
        const result = await manager.synchronizeChatGPTContent();
        return json(response, 200, { synchronized: true, ...result });
      } catch (error) {
        return json(response, 500, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    if (url.pathname.startsWith('/__control')) {
      const body = controlPage();
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': Buffer.byteLength(body),
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
        'X-Frame-Options': 'DENY',
      });
      return response.end(body);
    }
    if (await manager.appReady()) return proxyRequest(request, response);
    const body = controlPage();
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': Buffer.byteLength(body),
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'self'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'",
      'X-Frame-Options': 'DENY',
    });
    return response.end(body);
  });

  server.on('upgrade', (request, socket, head) => {
    const upstream = http.request({
      hostname: frontendHost,
      port: frontendPort,
      path: request.url,
      method: request.method,
      headers: { ...request.headers, host: `${frontendHost}:${frontendPort}` },
    });
    upstream.on('upgrade', (response, upstreamSocket, upstreamHead) => {
      socket.write(
        `HTTP/1.1 101 Switching Protocols\r\n${Object.entries(response.headers)
          .map(([key, value]) => `${key}: ${value}`)
          .join('\r\n')}\r\n\r\n`,
      );
      if (head.length) upstreamSocket.write(head);
      if (upstreamHead.length) socket.write(upstreamHead);
      upstreamSocket.pipe(socket);
      socket.pipe(upstreamSocket);
    });
    upstream.on('error', () => socket.destroy());
    upstream.end();
  });

  return { server, manager };
}

if (require.main === module) {
  const { server, manager } = createControlServer();
  server.once('error', (error) => {
    console.error(`Control server failed: ${error.message}`);
    process.exit(1);
  });
  server.listen(controlPort, controlHost, () => {
    console.log(`English Mastery control page: http://localhost:${controlPort}`);
  });
  const contentSyncTimer = setInterval(() => {
    void manager.synchronizeChatGPTContent().catch((error) =>
      manager.log(`Periodic ChatGPT content sync failed: ${error.message}`),
    );
  }, 5 * 60 * 1000);
  contentSyncTimer.unref();
  const shutdown = () => {
    clearInterval(contentSyncTimer);
    manager.shutdown();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = {
  ControlManager,
  controlPage,
  createControlServer,
  commandOutput,
  parseContainerState,
  parseEnvironment,
};
