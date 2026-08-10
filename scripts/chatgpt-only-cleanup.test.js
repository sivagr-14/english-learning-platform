const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('retired provider configuration and benchmark commands stay removed', () => {
  const environment = read('.env.example');
  const packageDocument = JSON.parse(read('package.json'));
  for (const marker of ['GEMINI_ENABLED', 'PRIMARY_AI_PROVIDER', 'OLLAMA_ENABLED', 'ENABLE_BATCH_PROCESSING'])
    assert.equal(environment.includes(marker), false, `${marker} must remain retired`);
  assert.equal(packageDocument.scripts['benchmark:providers'], undefined);
  assert.equal(packageDocument.scripts['test:phase4'], undefined);
});
