const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  ControlManager,
  classifyGitFailure,
  validateContentSyncResult,
  commandOutput,
  controlPage,
  createControlServer,
  parseContainerState,
  parseEnvironment,
  useLocalServiceHosts,
} = require('./control-server');

test('control page presents the browser-based startup action', () => {
  const page = controlPage();
  assert.match(page, /Update from GitHub &amp; start/);
  assert.match(page, /Start installed version/);
  assert.match(page, /\/__control\/start/);
  assert.match(page, /\/__control\/update-restart/);
  assert.match(page, /same address/);
});

test('migration verification rejects remaining pending migrations', async () => {
  const manager = new ControlManager({
    runAsync: async () =>
      'Found 20 Completed Migration file/files.\nFound 1 Pending Migration file/files.',
  });

  await assert.rejects(
    manager.verifyMigrations(),
    /found pending migrations/i,
  );
});

test('migration verification accepts a fully applied schema', async () => {
  const calls = [];
  const manager = new ControlManager({
    runAsync: async (command, args) => {
      calls.push([command, ...args]);
      return 'Found 21 Completed Migration file/files.\nNo Pending Migration files found.';
    },
  });

  await manager.verifyMigrations();
  assert.ok(calls[0].includes('development'));
  assert.ok(calls.some((call) => call.some((arg) => /verify-startup-schema\.ts$/.test(arg))));
});

test('migration commands always use source migrations despite inherited NODE_ENV', async () => {
  const calls = [];
  const manager = new ControlManager({
    runAsync: async (command, args) => calls.push([command, ...args]),
  });
  await manager.migrate();
  assert.deepEqual(calls[0].slice(-3), ['--env', 'development', 'migrate:latest']);
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

test('local GUI services replace Docker-only hostnames with loopback', () => {
  const environment = useLocalServiceHosts({
    DB_HOST: 'postgres',
    DB_PORT: '5544',
    DB_NAME: 'custom_db',
    DB_PASSWORD: 'secret',
    REDIS_URL: 'redis://redis:6379',
  });
  assert.equal(environment.DB_HOST, '127.0.0.1');
  assert.equal(environment.DB_PORT, '5544');
  assert.equal(environment.REDIS_URL, 'redis://127.0.0.1:6379');
  assert.equal(environment.DB_NAME, 'custom_db');
  assert.equal(environment.DB_PASSWORD, 'secret');
});

test('service readiness does not depend on the retired generation worker', async () => {
  const manager = new ControlManager({ wait: async () => {} });
  manager.backendReady = async () => true;
  manager.frontendReady = async () => true;
  manager.workerReady = async () => {
    throw new Error('retired worker must not be probed');
  };

  await manager.waitForServices();
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

test('command output preserves spawn-level errors, exit status, and signal', () => {
  assert.equal(
    commandOutput({
      error: new Error('spawn git ENOENT'),
      stdout: '',
      stderr: '',
      status: null,
      signal: 'SIGTERM',
    }),
    'spawn git ENOENT\nSignal: SIGTERM',
  );
});

test('Git failures distinguish missing branch, authentication, and network errors', () => {
  assert.deepEqual(
    classifyGitFailure({ status: 128, stderr: "fatal: couldn't find remote ref refs/heads/chatgpt-content-inbox" }),
    {
      synchronized: false,
      available: false,
      stage: 'fetch',
      code: 'BRANCH_MISSING',
      error: 'The ChatGPT content inbox branch does not exist yet.',
      technicalDetail: "fatal: couldn't find remote ref refs/heads/chatgpt-content-inbox\nExit status: 128",
      retryable: false,
      httpStatus: 404,
    },
  );
  assert.equal(
    classifyGitFailure({ status: 128, stderr: 'fatal: Authentication failed' }).code,
    'AUTHENTICATION_FAILED',
  );
  assert.equal(
    classifyGitFailure({ status: 128, stderr: 'fatal: Could not resolve host: github.com' }).code,
    'NETWORK_FAILED',
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

test('normal startup supervises only the ChatGPT import backend and frontend', () => {
  const spawned = [];
  const fakeChild = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.killed = false;
    child.exitCode = null;
    child.kill = () => { child.killed = true; };
    return child;
  };
  const manager = new ControlManager({
    spawnChild: (_command, args, options) => {
      spawned.push({ args, cwd: options.cwd });
      return fakeChild();
    },
  });

  manager.spawnServices();

  assert.equal(spawned.length, 2);
  assert.ok(!spawned.some(({ args }) => args.some((arg) => /src\/worker\.ts$/.test(arg))));
  assert.ok(spawned.some(({ args }) => args.some((arg) => /src\/index\.ts$/.test(arg))));
  assert.ok(spawned.some(({ args }) => args.includes('dev')));
  manager.stopServices();
});

test('failed update identifies its exact stage and gives non-destructive recovery', async () => {
  const manager = new ControlManager();
  manager.verifyUpdateWorkspace = () => {
    throw new Error('working tree is not clean');
  };
  await manager.runUpdateAndRestart();
  assert.match(manager.currentStep, /Checking the local Git workspace/);
  assert.match(manager.error, /not clean/);
  assert.match(manager.recovery, /No destructive rollback.*Durable queued\/active jobs/s);
});

test('controller updates finish startup without a launchd handoff', async () => {
  const runCalls = [];
  let reloaded = 0;
  const completed = [];
  const manager = new ControlManager({
    execute: (_command, args) => {
      if (args[0] === 'rev-parse' && args[1] === 'HEAD') {
        return { status: 0, stdout: 'a'.repeat(40), stderr: '' };
      }
      if (args[0] === 'rev-parse' && args[1] === 'origin/main') {
        return { status: 0, stdout: 'b'.repeat(40), stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
    runAsync: async (command, args) => {
      runCalls.push([command, ...args]);
      return '';
    },
    reloadControl: async () => { reloaded += 1; },
    markControlResume: () => {
      throw new Error('a resume handoff must not be created');
    },
    wait: async () => {},
  });
  manager.verifyUpdateWorkspace = () => {};
  manager.ensureDocker = async () => {};
  manager.startInfrastructure = async () => {};
  manager.backupDatabase = async () => {};
  manager.installDependencies = async () => {};
  manager.backendReady = async () => false;
  manager.frontendReady = async () => false;
  manager.migrate = async () => { completed.push('migrate'); };
  manager.verifyMigrations = async () => { completed.push('verify'); };
  manager.synchronizeChatGPTContent = async () => { completed.push('content'); };
  manager.synchronizeBuiltInContent = async () => { completed.push('built-in'); };
  manager.spawnServices = () => { completed.push('services'); };
  manager.waitForServices = async () => { completed.push('ready'); };

  await manager.runUpdateAndRestart();

  assert.equal(reloaded, 0);
  assert.ok(runCalls.some((call) => call.includes('--ff-only')));
  assert.deepEqual(completed, [
    'migrate',
    'verify',
    'content',
    'built-in',
    'services',
    'ready',
  ]);
  assert.equal(manager.phase, 'ready');
  assert.match(manager.currentStep, /GitHub update installed and synchronized/);
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
  let contentCleanups = 0;
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
    cleanupChatGPTContent: async (manifestIds) => {
      contentCleanups += 1;
      return { cleaned: manifestIds, alreadyAbsent: [], failed: [] };
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
  assert.match(await page.text(), /Update from GitHub &amp; start/);

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

  const deniedCleanup = await fetch(
    `${base}/__control/cleanup-content?manifestId=pack-001`,
    { method: 'POST' },
  );
  assert.equal(deniedCleanup.status, 403);
  assert.equal(contentCleanups, 0);

  const acceptedCleanup = await fetch(
    `${base}/__control/cleanup-content?manifestId=pack-001`,
    {
      method: 'POST',
      headers: { 'x-english-mastery-control': '1' },
    },
  );
  assert.equal(acceptedCleanup.status, 200);
  assert.deepEqual((await acceptedCleanup.json()).cleaned, ['pack-001']);
  assert.equal(contentCleanups, 1);
});

test('ChatGPT content sync fetches the dedicated ref without writing PostgreSQL', async () => {
  const commands = [];
  let runCalls = 0;
  const manager = new ControlManager({
    execute: (command, args) => {
      commands.push([command, ...args]);
      return {
        status: 0,
        stdout: args.includes('rev-parse')
          ? `${'a'.repeat(40)}\n`
          : args.includes('ls-tree')
            ? 'content-packs/inbox/pack-001/manifest.json\ncontent-packs/inbox/pack-001/batch-1.json\n'
            : '',
        stderr: '',
      };
    },
    runAsync: async () => {
      runCalls += 1;
      return '';
    },
  });

  const result = await manager.synchronizeChatGPTContent();

  assert.deepEqual(result, {
    synchronized: true,
    available: true,
    fetchedCommit: 'a'.repeat(40),
    result: {
      documents: 2,
      documentPaths: [
        'content-packs/inbox/pack-001/manifest.json',
        'content-packs/inbox/pack-001/batch-1.json',
      ],
      errors: [],
      cleanupEligible: [],
    },
  });
  assert.ok(
    commands.some((command) =>
      command.join(' ').includes(
        'refs/heads/chatgpt-content-inbox:refs/remotes/origin/chatgpt-content-inbox',
      ),
    ),
  );
  assert.ok(commands.some((command) => command.includes('--force')));
  assert.ok(commands.some((command) => command.includes('ls-tree')));
  assert.equal(runCalls, 0);
});

test('ChatGPT content sync returns the real spawn failure instead of an initialization state', async () => {
  const manager = new ControlManager({
    execute: () => ({
      status: null,
      stdout: '',
      stderr: '',
      error: new Error('spawnSync git ENOENT'),
    }),
  });

  const result = await manager.synchronizeChatGPTContent();

  assert.equal(result.available, true);
  assert.equal(result.code, 'GIT_UNAVAILABLE');
  assert.match(result.technicalDetail, /ENOENT/);
});

test('ChatGPT content sync rejects importer validation errors instead of reporting success', () => {
  const result = validateContentSyncResult({
    documents: 3,
    errors: [{ path: 'pack/batch-1.json', message: 'Manifest hash mismatch.' }],
    cleanupEligible: [],
  });

  assert.equal(result.code, 'CONTENT_PACK_REJECTED');
  assert.equal(result.httpStatus, 422);
  assert.match(result.technicalDetail, /batch-1\.json: Manifest hash mismatch/);
});

test('verified content cleanup deletes only its inbox folder and records the commit', async () => {
  const commands = [];
  const marked = [];
  const manager = new ControlManager({
    execute: (command, args) => {
      commands.push([command, ...args]);
      if (args[0] === 'worktree' && args[1] === 'add') {
        const worktree = args[3];
        assert.match(path.basename(worktree), /^english-content-cleanup-/);
        fs.mkdirSync(
          path.join(worktree, 'content-packs', 'inbox', 'pack-001'),
          { recursive: true },
        );
        fs.writeFileSync(
          path.join(worktree, 'content-packs', 'inbox', 'pack-001', 'manifest.json'),
          '{}',
        );
      }
      if (args.includes('rev-parse') && args.includes('HEAD')) {
        return { status: 0, stdout: 'b'.repeat(40), stderr: '' };
      }
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: 'a'.repeat(40), stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
    runAsync: async (_command, args) => {
      marked.push(args);
      return '{}';
    },
  });

  const result = await manager.cleanupVerifiedContentPacks(
    ['pack-001'],
    '/repo/sync-content-packs.ts',
  );

  assert.deepEqual(result, {
    cleaned: ['pack-001'],
    alreadyAbsent: [],
    failed: [],
  });
  assert.ok(
    commands.some((command) =>
      command.includes(
        '--force-with-lease=refs/heads/chatgpt-content-inbox:' + 'a'.repeat(40),
      ),
    ),
  );
  assert.ok(marked[0].includes('--mark-cleaned'));
});

test('verified content cleanup records an already-absent folder without deleting data', async () => {
  const marked = [];
  const manager = new ControlManager({
    execute: (_command, args) => {
      if (args[0] === 'cat-file') return { status: 1, stdout: '', stderr: '' };
      if (args[0] === 'rev-parse') {
        return { status: 0, stdout: 'c'.repeat(40), stderr: '' };
      }
      return { status: 0, stdout: '', stderr: '' };
    },
    runAsync: async (_command, args) => {
      marked.push(args);
      return '{}';
    },
  });

  const result = await manager.cleanupVerifiedContentPacks(
    ['pack-removed'],
    '/repo/sync-content-packs.ts',
  );

  assert.deepEqual(result, {
    cleaned: [],
    alreadyAbsent: ['pack-removed'],
    failed: [],
  });
  assert.ok(marked[0].includes('--mark-cleaned'));
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


test('control server has no reload handoff state', () => {
  const source = require('node:fs').readFileSync(
    require.resolve('./control-server'),
    'utf8',
  );
  assert.doesNotMatch(source, /Reloading the updated control service/);
  assert.doesNotMatch(source, /controlResumePath|reloadControl|markControlResume/);
});
