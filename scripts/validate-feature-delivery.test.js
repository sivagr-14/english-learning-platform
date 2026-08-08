const assert = require('node:assert/strict');
const test = require('node:test');
const {
  isProductPath,
  pathCovered,
} = require('./validate-feature-delivery');

test('validation files under scripts are product paths and can cover themselves', () => {
  const file = 'scripts/control-server.test.js';
  assert.equal(isProductPath(file), true);
  assert.equal(pathCovered(file, file), true);
});

test('directory declarations cover nested implementation and validation files', () => {
  assert.equal(
    pathCovered('packages/backend/src/index.ts', 'packages/backend/'),
    true,
  );
  assert.equal(pathCovered('scripts/control-server.test.js', 'scripts/'), true);
  assert.equal(pathCovered('docs/runbook.md', 'scripts/'), false);
});
