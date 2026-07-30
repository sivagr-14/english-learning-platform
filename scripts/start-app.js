#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const envPath = path.join(repoRoot, '.env.local');
const envExamplePath = path.join(repoRoot, '.env.example');
const args = new Set(process.argv.slice(2));
const quick = args.has('--quick');
const doctorOnly = args.has('--doctor');
const noOpen = args.has('--no-open') || doctorOnly;
const help = args.has('--help') || args.has('-h');
const backendUrl = 'http://127.0.0.1:5001/health';
const frontendUrl = 'http://localhost:3000';
const isWindows = process.platform === 'win32';

process.chdir(repoRoot);

function heading(message) {
  process.stdout.write(`\n==> ${message}\n`);
}

function fail(message, details = '') {
  const error = new Error(message);
  error.details = details;
  throw error;
}

function commandAvailable(command, versionArgs = ['--version']) {
  return spawnSync(command, versionArgs, { stdio: 'ignore' }).status === 0;
}

function executableAvailable(command) {
  const locator = isWindows ? 'where' : 'which';
  return spawnSync(locator, [command], { stdio: 'ignore' }).status === 0;
}

function packageManager() {
  const yarn = isWindows ? 'yarn.cmd' : 'yarn';
  if (commandAvailable(yarn)) {
    return { command: yarn, prefix: [] };
  }

  const corepack = isWindows ? 'corepack.cmd' : 'corepack';
  if (commandAvailable(corepack)) {
    return { command: corepack, prefix: ['yarn'] };
  }

  fail(
    'Yarn is unavailable.',
    'Install Node.js 20+, then run: corepack enable && corepack prepare yarn@1.22.22 --activate',
  );
}

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: repoRoot,
    env: process.env,
    stdio: options.quiet ? 'pipe' : 'inherit',
    encoding: 'utf8',
  });

  if (result.error) {
    fail(`Could not run ${command}.`, result.error.message);
  }
  if (result.status !== 0) {
    const output = options.quiet
      ? [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
      : '';
    fail(`Command failed: ${command} ${commandArgs.join(' ')}`, output);
  }

  return result;
}

function runYarn(commandArgs, options) {
  const manager = packageManager();
  return run(manager.command, [...manager.prefix, ...commandArgs], options);
}

function ensureSupportedNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (!Number.isFinite(major) || major < 20) {
    fail(
      `Node.js ${process.versions.node} is unsupported.`,
      'Install Node.js 20 or newer and run this command again.',
    );
  }
  console.log(`Node.js ${process.versions.node}: OK`);
}

function secureLocalEnvironment() {
  if (!fs.existsSync(envExamplePath)) {
    fail('.env.example is missing.');
  }

  let content;
  let created = false;
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  } else {
    content = fs.readFileSync(envExamplePath, 'utf8');
    created = true;
  }

  const jwtMatch = content.match(/^JWT_SECRET=(.*)$/m);
  const insecureJwtValues = new Set([
    '',
    'your-super-secret-jwt-key-change-in-production',
    'replace-with-openssl-rand-hex-32',
    'dev-secret-key-change-in-production',
  ]);

  if (!jwtMatch) {
    content += `\nJWT_SECRET=${crypto.randomBytes(32).toString('hex')}\n`;
  } else if (insecureJwtValues.has(jwtMatch[1].trim())) {
    content = content.replace(
      /^JWT_SECRET=.*$/m,
      `JWT_SECRET=${crypto.randomBytes(32).toString('hex')}`,
    );
  }

  // A bare "sk-" is the old example placeholder, not a usable API key.
  content = content.replace(/^OPENAI_API_KEY=sk-\s*$/m, 'OPENAI_API_KEY=');
  fs.writeFileSync(envPath, content, { mode: 0o600 });

  console.log(
    created
      ? '.env.local: created with a secure local JWT secret'
      : '.env.local: present and checked',
  );
}

function ensureDependencies() {
  const required = [
    path.join(repoRoot, 'node_modules', '.bin', isWindows ? 'knex.cmd' : 'knex'),
    path.join(repoRoot, 'node_modules', '.bin', isWindows ? 'tsc.cmd' : 'tsc'),
  ];
  const nextCandidates = [
    path.join(repoRoot, 'node_modules', '.bin', isWindows ? 'next.cmd' : 'next'),
    path.join(
      repoRoot,
      'packages',
      'frontend',
      'node_modules',
      '.bin',
      isWindows ? 'next.cmd' : 'next',
    ),
  ];

  if (
    required.every((dependency) => fs.existsSync(dependency)) &&
    nextCandidates.some((dependency) => fs.existsSync(dependency))
  ) {
    console.log('Dependencies: OK');
    return;
  }

  heading('Installing project dependencies');
  runYarn(['install', '--frozen-lockfile']);
}

function dockerReady() {
  return spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function ensureDocker() {
  if (!commandAvailable('docker')) {
    fail(
      'Docker is not installed.',
      'Install Docker Desktop for Mac, open it, and run this command again.',
    );
  }

  if (dockerReady()) {
    console.log('Docker Engine: running');
    return;
  }

  if (process.platform !== 'darwin' || !executableAvailable('open')) {
    fail(
      'Docker is installed, but the Docker Engine is not running.',
      'Start Docker Desktop and run this command again.',
    );
  }

  console.log('Docker Engine is stopped. Opening Docker Desktop...');
  const opened = spawnSync('open', ['-a', 'Docker'], { stdio: 'ignore' });
  if (opened.status !== 0) {
    fail('Docker Desktop could not be opened automatically.');
  }

  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (dockerReady()) {
      console.log('Docker Engine: running');
      return;
    }
    await delay(2000);
  }

  fail(
    'Docker Desktop did not become ready within two minutes.',
    'Open Docker Desktop, wait until it says Engine running, and retry.',
  );
}

async function waitForCommand(checkArgs, label, attempts = 45) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const result = spawnSync('docker', checkArgs, {
      cwd: repoRoot,
      stdio: 'ignore',
    });
    if (result.status === 0) {
      console.log(`${label}: ready`);
      return;
    }
    await delay(2000);
  }
  fail(`${label} did not become ready.`, 'Run: docker compose ps');
}

async function startInfrastructure() {
  run('docker', ['compose', 'up', '-d', 'postgres', 'redis']);

  await Promise.all([
    waitForCommand(
      [
        'compose',
        'exec',
        '-T',
        'postgres',
        'pg_isready',
        '-U',
        'postgres',
        '-d',
        'english_learning',
      ],
      'PostgreSQL',
    ),
    waitForCommand(
      ['compose', 'exec', '-T', 'redis', 'redis-cli', 'ping'],
      'Redis',
    ),
  ]);
}

async function urlHealthy(url) {
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForWebApp(child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      fail(
        'The app services stopped before becoming ready.',
        'Review the [backend] and [frontend] error immediately above.',
      );
    }

    const [backendReady, frontendReady] = await Promise.all([
      urlHealthy(backendUrl),
      urlHealthy(frontendUrl),
    ]);

    if (backendReady && frontendReady) return;
    await delay(2000);
  }

  child.kill('SIGINT');
  fail(
    'The app did not become ready within two minutes.',
    `Check ${backendUrl} and review the startup output above.`,
  );
}

function openBrowser() {
  if (noOpen || process.platform !== 'darwin') return;
  const child = spawn('open', [frontendUrl], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function printHelp() {
  console.log(`
English Mastery local launcher

Usage:
  yarn app:start:legacy    Validate everything, migrate, and start in Terminal
  yarn app:start:quick     Skip tests/build, migrate, and start the app
  yarn app:doctor          Validate everything without starting the web servers
  node scripts/start-app.js --no-open

The launcher starts PostgreSQL and Redis through Docker. Press Control+C to stop
the frontend and backend; the database containers remain available.
`.trim());
}

async function main() {
  if (help) {
    printHelp();
    return;
  }

  heading('Checking local prerequisites');
  ensureSupportedNode();
  secureLocalEnvironment();
  ensureDependencies();
  await ensureDocker();

  heading('Starting PostgreSQL and Redis');
  await startInfrastructure();

  heading('Applying pending database migrations');
  runYarn(['run', 'db:migrate']);

  if (!quick) {
    heading('Validating backend and frontend');
    runYarn(['run', 'validate']);
  } else {
    console.log('Quick mode: tests, type-checks, and production builds skipped.');
  }

  if (doctorOnly) {
    heading('All checks passed');
    console.log('The app is ready to start with: yarn app:start:quick');
    return;
  }

  const [backendAlreadyReady, frontendAlreadyReady] = await Promise.all([
    urlHealthy(backendUrl),
    urlHealthy(frontendUrl),
  ]);

  if (backendAlreadyReady || frontendAlreadyReady) {
    if (backendAlreadyReady && frontendAlreadyReady) {
      heading('App is already running');
      console.log(`App:     ${frontendUrl}`);
      console.log(`Backend: ${backendUrl}`);
      openBrowser();
      return;
    }

    fail(
      'Only part of the app is already running, so the ports cannot be started safely.',
      'Stop the old yarn dev process with Control+C, then run this command again.',
    );
  }

  heading('Starting English Mastery');
  const child = spawn(process.execPath, [path.join('scripts', 'dev.js')], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  const forwardSignal = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on('SIGINT', () => forwardSignal('SIGINT'));
  process.on('SIGTERM', () => forwardSignal('SIGTERM'));

  await waitForWebApp(child);

  heading('App is ready');
  console.log(`App:     ${frontendUrl}`);
  console.log(`Backend: ${backendUrl}`);
  console.log('Press Control+C to stop the frontend and backend.');
  openBrowser();

  await new Promise((resolve, reject) => {
    child.once('exit', (code, signal) => {
      if (signal === 'SIGINT' || signal === 'SIGTERM' || code === 0) {
        resolve();
      } else {
        reject(new Error(`Development services exited with code ${code}.`));
      }
    });
  });
}

main().catch((error) => {
  console.error(`\nStartup failed: ${error.message}`);
  if (error.details) console.error(error.details);
  console.error('\nDiagnostic commands:');
  console.error('  docker compose ps');
  console.error('  docker compose logs postgres redis');
  console.error('  yarn app:doctor');
  process.exit(1);
});
