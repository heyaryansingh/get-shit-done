const { test } = require('node:test');
const assert = require('node:assert');
const { getTemplate, createFromTemplate } = require('../bin/task-templates');

test('getTemplate ignores inherited Object.prototype keys', () => {
  assert.strictEqual(getTemplate('constructor'), null);
  assert.strictEqual(getTemplate('toString'), null);
  assert.strictEqual(getTemplate('__proto__'), null);
  assert.strictEqual(getTemplate('bug-fix').name, 'bug-fix');
  assert.throws(() => createFromTemplate('constructor'), /not found/);
});

test('CLI create keeps "=" inside --title value', () => {
  const { execFileSync } = require('node:child_process');
  const out = execFileSync(process.execPath, [require.resolve('../bin/task-templates'), 'create', 'bug-fix', '--title=Fix a=b crash']);
  assert.strictEqual(JSON.parse(out).title, 'Fix a=b crash');
});
