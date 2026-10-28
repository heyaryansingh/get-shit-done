const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { getCacheFiles, pruneCache } = require('../bin/cache-manager');

function tmpCache() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cache-'));
}

function writeAged(dir, name, bytes, daysOld) {
  const p = path.join(dir, name);
  fs.writeFileSync(p, Buffer.alloc(bytes));
  const t = new Date(Date.now() - daysOld * 86400000);
  fs.utimesSync(p, t, t);
}

test('subdirectories are skipped instead of crashing unlink', () => {
  const dir = tmpCache();
  fs.mkdirSync(path.join(dir, 'nested'));
  writeAged(dir, 'old.json', 10, 60);
  assert.deepStrictEqual(getCacheFiles(dir).map(f => f.name), ['old.json']);
  assert.strictEqual(pruneCache(dir).removed, 1);
  assert.ok(fs.existsSync(path.join(dir, 'nested')));
});

test('prune evicts oldest entries until under the size cap', () => {
  const dir = tmpCache();
  const mb = 1024 * 1024;
  writeAged(dir, 'a', mb, 3);
  writeAged(dir, 'b', mb, 2);
  writeAged(dir, 'c', mb, 1);
  const { removed } = pruneCache(dir, 30, 2);
  assert.strictEqual(removed, 1);
  assert.deepStrictEqual(getCacheFiles(dir).map(f => f.name), ['c', 'b']);
});
