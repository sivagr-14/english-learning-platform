const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const path = require('node:path');
const test = require('node:test');
const {
  ControlManager,
  commandOutput,
  controlPage,
  createControlServer,
  parseContainerState,
  parseEnvironment,
} = require('./control-server');

test('control page presents the browser-based startup action', () => {
  const page = controlPage();
  assert.match(page, /Validate and start app/);
  assert.match(page, /\/__control\/start/);
  assert.match(page, /same address/);
});

test('environment parser ignores comments and preserves URLs', () => {
  assert.deepEqual(
    parseEnvironment('# comment\nPORT=5001\nDATABASE_URL=postgresql://local/db\nEMPTY=\n'),
    {
      PORT: '5001',
      DATABASE_URL: 'postgresql://local/db',
      EMPTY: '',
    },
  );
});

test('command output combines captured stdout and stderr for browser diagnostics', () => {
  assert.equal(
    commandOutput({
      stdout: 'container status\n',
      stderr: 'database error\n',
    }),
    'container status\n\ndatabase error',
  );
});

test('container state parser returns Docker status, health, and exit code', () => {
  assert.deepEqual(parseContainerState('running|healthy|0'), {
    status: 'running',
    health: 'healthy',
    exitCode: 0,
  });
  assert.deepEqual(parseContainerState('exited|none|137'), {
    status: 'exited',
    health: 'none',
    exitCode: 137,
  });
});

test('mock startup validates PostgreSQL and Redis containers used by main', async () => {
  const commands = [];
  const execute = (command, args) => {
    commands.push([command, ...args]);
    if (args[0] === 'inspect') {
      return { status: 0, stdout: 'running|healthy|0\n', stderr: '' };
    }
    if (args[0] === 'exec') {
      return {
        status: 0,
        stdout: args[1] === 'english_learning_redis' ? 'PONG\n' : 'accepting connections\n',
        stderr: '',
      };
    }
    return { status: 0, stdout: '', stderr: '' };
  };
  const runCalls = [];
  const manager = new ControlManager({
    execute,
    runAsync: async (command, args) => {
      runCalls.push([command, ...args]);
    },
    wait: async () => {},
  });

  await manager.startInfrastructure();

  assert.deepEqual(runCalls, [
    ['docker', 'compose', 'up', '-d', 'postgres', 'redis'],
  ]);
  assert.ok(
    commands.some(
      (args) =>
        args.join(' ') ===
        'docker exec english_learning_postgres pg_isready -U postgres -d english_learning',
    ),
  );
  assert.ok(
    commands.some(
      (args) =>
        args.join(' ') ===
        'docker exec english_learning_redis redis-cli ping',
    ),
  );
});

test('mock startup reports an exited PostgreSQL container immediately with logs', async () => {
  let waits = 0;
  const manager = new ControlManager({
    execute: (command, args) => {
      if (args[0] === 'inspect') {
        return { status: 0, stdout: 'exited|none|1\n', stderr: '' };
      }
      if (args[0] === 'compose' && args[1] === 'ps') {
        return {
          status: 0,
          stdout: 'english_learning_postgres exited (1)\n',
          stderr: '',
        };
      }
      if (args[0] === 'compose' && args[1] === 'logs') {
        return {
          status: 0,
          stdout: 'database files are incompatible\n',
          stderr: '',
        };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
    wait: async () => {
      waits += 1;
    },
  });

  await assert.rejects(
    manager.waitForContainer({
      containerName: 'english_learning_postgres',
      label: 'PostgreSQL',
      probeArgs: ['pg_isready'],
      service: 'postgres',
    }),
    /PostgreSQL container stopped with exit code 1/,
  );
  assert.equal(waits, 0);
  assert.ok(
    manager.logs.some((line) => line.includes('database files are incompatible')),
  );
});

test('web services start from their own workspaces and preserve clean-exit diagnostics', async () => {
  const launches = [];
  const spawnChild = (command, args, options) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.killed = false;
    child.exitCode = null;
    child.kill = () => {
      child.killed = true;
    };
    launches.push({ command, args, options, child });
    return child;
  };
  const manager = new ControlManager({ spawnChild });
  manager.phase = 'starting';

  manager.spawnServices();

  const frontend = launches.find((launch) =>
    launch.args.some((arg) => arg.endsWith(path.join('next', 'dist', 'bin', 'next'))),
  );
  const backend = launches.find((launch) =>
    launch.args.some((arg) => arg.endsWith(path.join('ts-node', 'dist', 'bin.js'))),
  );
  assert.ok(backend);
  assert.equal(
    backend.options.cwd,
    path.join(__dirname, '..', 'packages', 'backend'),
  );
  assert.ok(
    backend.args.some((arg) =>
      arg.endsWith(path.join('packages', 'backend', 'tsconfig.json')),
    ),
  );
  assert.ok(frontend);
  assert.equal(
    frontend.options.cwd,
    path.join(__dirname, '..', 'packages', 'frontend'),
  );

  frontend.child.stderr.emit(
    'data',
    Buffer.from('simulated frontend diagnostic\n'),
  );
  frontend.child.emit('exit', 0, null);

  assert.match(manager.error, /frontend exited with exit code 0/);
  assert.match(manager.error, /simulated frontend diagnostic/);
  await assert.rejects(
    manager.waitForServices(),
    /frontend exited with exit code 0/,
  );
});

test('control API requires the local control header before starting', async (context) => {
  let starts = 0;
  let restarts = 0;
  let updates = 0;
  let contentSyncs = 0;
  const manager = {
    snapshot: async () => ({
      phase: 'idle',
      currentStep: 'Ready',
      error: null,
      logs: [],
      frontend: false,
      backend: false,
    }),
    appReady: async () => false,
    start: () => {
      starts += 1;
    },
    restart: () => {
      restarts += 1;
    },
    updateAndRestart: () => {
      updates += 1;
    },
    synchronizeChatGPTContent: async () => {
      contentSyncs += 1;
      return { available: true };
    },
    shutdown: () => {},
  };
  const { server } = createControlServer(manager);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Validate and start app/);

  const status = await fetch(`${base}/__control/status`);
  assert.equal(status.status, 200);
  assert.equal((await status.json()).phase, 'idle');

  const denied = await fetch(`${base}/__control/start`, { method: 'POST' });
  assert.equal(denied.status, 403);
  assert.equal(starts, 0);

  const accepted = await fetch(`${base}/__control/start`, {
    method: 'POST',
    headers: { 'x-english-mastery-control': '1' },
  });
  assert.equal(accepted.status, 202);
  assert.equal(starts, 1);

  const deniedRestart = await fetch(`${base}/__control/restart`, {
    method: 'POST',
  });
  assert.equal(deniedRestart.status, 403);
  assert.equal(restarts, 0);

  const acceptedRestart = await fetch(`${base}/__control/restart`, {
    method: 'POST',
    headers: { 'x-english-mastery-control': '1' },
  });
  assert.equal(acceptedRestart.status, 202);
  assert.equal(restarts, 1);

  const deniedUpdate = await fetch(`${base}/__control/update-restart`, {
    method: 'POST',
  });
  assert.equal(deniedUpdate.status, 403);
  assert.equal(updates, 0);

  const acceptedUpdate = await fetch(`${base}/__control/update-restart`, {
    method: 'POST',
    headers: { 'x-english-mastery-control': '1' },
  });
  assert.equal(acceptedUpdate.status, 202);
  assert.equal(updates, 1);

  const deniedContentSync = await fetch(`${base}/__control/sync-content`, {
    method: 'POST',
  });
  assert.equal(deniedContentSync.status, 403);
  assert.equal(contentSyncs, 0);

  const acceptedContentSync = await fetch(`${base}/__control/sync-content`, {
    method: 'POST',
    headers: { 'x-english-mastery-control': '1' },
  });
  assert.equal(acceptedContentSync.status, 200);
  assert.equal((await acceptedContentSync.json()).available, true);
  assert.equal(contentSyncs, 1);
});

test('ChatGPT content sync fetches only the dedicated inbox ref and runs the importer', async () => {
  const commands = [];
  const runCalls = [];
  const manager = new ControlManager({
    execute: (command, args) => {
      commands.push([command, ...args]);
      return { status: 0, stdout: '', stderr: '' };
    },
    runAsync: async (command, args) => {
      runCalls.push([command, ...args]);
    },
  });

  const result = await manager.synchronizeChatGPTContent();

  assert.deepEqual(result, { available: true });
  assert.ok(
    commands.some((command) =>
      command.join(' ').includes(
        'refs/heads/chatgpt-content-inbox:refs/remotes/origin/chatgpt-content-inbox',
      ),
    ),
  );
  assert.ok(
    runCalls.some(
      (command) =>
        command.includes('--git-ref') &&
        command.includes('origin/chatgpt-content-inbox'),
    ),
  );
});

test('restart stops owned web services before running the validated startup flow', async () => {
  let stopped = false;
  let startupOptions = null;
  const manager = new ControlManager({ wait: async () => {} });
  manager.stopServices = () => {
    stopped = true;
  };
  manager.backendReady = async () => false;
  manager.frontendReady = async () => false;
  manager.runStart = async (options) => {
    assert.equal(stopped, true);
    startupOptions = options;
    manager.phase = 'ready';
  };

  await manager.restart();

  assert.deepEqual(startupOptions, {
    preserveLogs: true,
    preserveStartedAt: true,
  });
  assert.equal(manager.phase, 'ready');
});
