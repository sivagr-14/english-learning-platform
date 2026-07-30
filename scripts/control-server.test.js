const assert = require('node:assert/strict');
const test = require('node:test');
const { controlPage, createControlServer, parseEnvironment } = require('./control-server');

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

test('control API requires the local control header before starting', async (context) => {
  let starts = 0;
  const manager = {
    snapshot: async () => ({
      phase: 'idle',
      currentStep: 'Ready',
      error: null,
      logs: [],
      frontend: false,
      backend: false,
    }),
    frontendReady: async () => false,
    start: () => {
      starts += 1;
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
});
