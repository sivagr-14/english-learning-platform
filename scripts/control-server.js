#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
const controlHost = '127.0.0.1';
const controlPort = Number(process.env.CONTROL_PORT || 3000);
const frontendHost = '127.0.0.1';
const frontendPort = Number(process.env.FRONTEND_INTERNAL_PORT || 3001);
const frontendUrl = `http://${frontendHost}:${frontendPort}`;
const backendUrl = 'http://127.0.0.1:5001/health';
const envPath = path.join(repoRoot, '.env.local');
const envExamplePath = path.join(repoRoot, '.env.example');
const controlHeader = 'x-english-mastery-control';

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

function commandAvailable(command) {
  const result = commandResult(command, ['--version']);
  return result.status === 0;
}

function resolvePackageManager() {
  if (commandAvailable('yarn')) return { command: 'yarn', prefix: [] };
  if (commandAvailable('corepack')) {
    return { command: 'corepack', prefix: ['yarn'] };
  }
  throw new Error(
    'Yarn is unavailable. Install Node.js 20+, then enable Corepack once.',
  );
}

function run(command, args, onOutput) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => onOutput(chunk.toString()));
    child.stderr.on('data', (chunk) => onOutput(chunk.toString()));
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed: ${command} ${args.join(' ')}`));
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
  content = content.replace(/^OPENAI_API_KEY=sk-\s*$/m, 'OPENAI_API_KEY=');
  fs.writeFileSync(envPath, content, { mode: 0o600 });
  Object.assign(process.env, parseEnvironment(content));
}

class ControlManager {
  constructor() {
    this.phase = 'idle';
    this.currentStep = 'Ready to validate and start';
    this.error = null;
    this.startedAt = null;
    this.logs = [];
    this.services = null;
    this.servicesStopping = false;
    this.startPromise = null;
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

  async snapshot() {
    const [frontend, backend] = await Promise.all([
      this.frontendReady(true),
      urlHealthy(backendUrl),
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
      path.join(repoRoot, 'node_modules', 'ts-node-dev', 'lib', 'bin.js'),
      path.join(repoRoot, 'node_modules', 'knex', 'bin', 'cli.js'),
    ];
    if (required.every((file) => fs.existsSync(file))) return;
    const manager = resolvePackageManager();
    await run(
      manager.command,
      [...manager.prefix, 'install', '--frozen-lockfile'],
      (output) => this.log(output),
    );
  }

  async ensureDocker() {
    if (!commandAvailable('docker')) {
      throw new Error('Docker Desktop is not installed.');
    }
    if (commandResult('docker', ['info']).status === 0) return;
    if (process.platform !== 'darwin') {
      throw new Error('Docker is installed, but its engine is not running.');
    }
    this.log('Opening Docker Desktop…');
    const opened = commandResult('open', ['-a', 'Docker']);
    if (opened.status !== 0) throw new Error('Docker Desktop could not be opened.');
    for (let attempt = 0; attempt < 60; attempt += 1) {
      if (commandResult('docker', ['info']).status === 0) return;
      await delay(2000);
    }
    throw new Error('Docker Desktop did not become ready within two minutes.');
  }

  async waitForDockerCommand(args, label) {
    for (let attempt = 0; attempt < 45; attempt += 1) {
      if (commandResult('docker', args).status === 0) return;
      await delay(2000);
    }
    throw new Error(`${label} did not become ready.`);
  }

  async startInfrastructure() {
    await run(
      'docker',
      ['compose', 'up', '-d', 'postgres', 'redis'],
      (output) => this.log(output),
    );
    await Promise.all([
      this.waitForDockerCommand(
        [
          'compose',
          'exec',
          '-T',
          'postgres',
          'pg_isready',
          '-U',
          process.env.DB_USER || 'postgres',
          '-d',
          process.env.DB_NAME || 'english_learning',
        ],
        'PostgreSQL',
      ),
      this.waitForDockerCommand(
        ['compose', 'exec', '-T', 'redis', 'redis-cli', 'ping'],
        'Redis',
      ),
    ]);
  }

  async migrate() {
    await run(
      process.execPath,
      [
        path.join(repoRoot, 'node_modules', 'knex', 'bin', 'cli.js'),
        '--knexfile',
        path.join(repoRoot, 'knexfile.js'),
        'migrate:latest',
      ],
      (output) => this.log(output),
    );
  }

  spawnServices() {
    const nextBin = path.join(repoRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
    const backendBin = path.join(
      repoRoot,
      'node_modules',
      'ts-node-dev',
      'lib',
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
        args: [
          backendBin,
          '--respawn',
          '--transpile-only',
          path.join(repoRoot, 'packages', 'backend', 'src', 'index.ts'),
        ],
      },
      {
        name: 'frontend',
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
    this.services = definitions.map(({ name, args }) => {
      const child = spawn(process.execPath, args, {
        cwd: repoRoot,
        env: childEnvironment,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => this.log(`[${name}] ${chunk}`));
      child.stderr.on('data', (chunk) => this.log(`[${name}] ${chunk}`));
      child.once('error', (error) => {
        this.phase = 'error';
        this.error = `${name} could not start: ${error.message}`;
      });
      child.once('exit', (code, signal) => {
        if (this.phase === 'idle' || this.servicesStopping) return;
        this.phase = 'error';
        this.currentStep = `${name} stopped`;
        this.error = `${name} exited (${signal || code || 'unknown reason'}).`;
        this.stopServices();
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
    for (let attempt = 0; attempt < 75; attempt += 1) {
      const [backend, frontend] = await Promise.all([
        urlHealthy(backendUrl),
        this.frontendReady(true),
      ]);
      if (backend && frontend) return;
      if (this.services?.some((child) => child.exitCode !== null)) {
        throw new Error('A web service stopped before the app became ready.');
      }
      await delay(2000);
    }
    throw new Error('The app did not become ready within two and a half minutes.');
  }

  start() {
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.runStart().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  async runStart() {
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

      this.step('Checking project dependencies');
      await this.ensureDependencies();

      this.step('Checking Docker Desktop');
      await this.ensureDocker();

      this.step('Starting and validating PostgreSQL and Redis');
      await this.startInfrastructure();

      this.step('Checking and applying database migrations');
      await this.migrate();

      this.step('Checking existing web services');
      const [backend, frontend] = await Promise.all([
        urlHealthy(backendUrl),
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
    button { width: 100%; margin-top: 18px; border: 0; border-radius: 14px; padding: 15px 18px; background: #4058cf; color: white; font: inherit; font-weight: 750; cursor: pointer; box-shadow: 0 10px 24px rgba(64,88,207,.24); }
    button:hover { background: #344abb; }
    button:focus-visible { outline: 3px solid #aebcff; outline-offset: 3px; }
    button:disabled { cursor: wait; opacity: .65; }
    .errorText { color: #ad2d2d; background: #fff3f3; border: 1px solid #f7d4d4; padding: 12px 14px; border-radius: 12px; margin: 15px 0 0; }
    details { margin-top: 20px; border-top: 1px solid #e8ebf3; padding-top: 16px; }
    summary { cursor: pointer; color: #526078; font-weight: 650; }
    pre { white-space: pre-wrap; max-height: 230px; overflow: auto; margin: 13px 0 0; padding: 14px; border-radius: 12px; background: #172033; color: #e9edff; font: .78rem/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
    .note { margin: 20px 0 0; color: #788195; font-size: .84rem; text-align: center; }
    @keyframes pulse { 50% { transform: scale(.74); opacity: .62; } }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Local learning workspace</div>
    <h1>English Mastery</h1>
    <p class="intro">Validate the local database and application services, then start your learning workspace here.</p>
    <section id="status" class="status idle" aria-live="polite">
      <div class="dot" aria-hidden="true"></div>
      <div><strong id="phase">Ready to start</strong><span id="step">No services have been started yet.</span></div>
    </section>
    <p id="error" class="errorText" hidden></p>
    <button id="start" type="button">Validate and start app</button>
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
        startButton.textContent = state.phase === 'error' ? 'Validate and try again' : 'Validate and start app';
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
    if (await manager.frontendReady()) return proxyRequest(request, response);
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
  const shutdown = () => {
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
  parseEnvironment,
};
