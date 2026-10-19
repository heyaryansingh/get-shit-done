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
