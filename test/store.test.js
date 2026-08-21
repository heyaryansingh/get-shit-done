const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { readJson, writeJson } = require('../bin/store');

function tempFile(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-store-'));
  return path.join(dir, name);
}

test('readJson returns the fallback when the file does not exist', () => {
  assert.deepStrictEqual(readJson(tempFile('missing.json'), { goals: [] }), { goals: [] });
});

test('writeJson then readJson round-trips the value', () => {
  const file = tempFile('state.json');

  assert.strictEqual(writeJson(file, { goals: [{ id: 'a' }] }), true);
  assert.deepStrictEqual(readJson(file, null), { goals: [{ id: 'a' }] });
});

test('writeJson creates missing parent directories', () => {
  const file = path.join(tempFile('unused.json'), '..', 'nested', 'deep', 'state.json');

  assert.strictEqual(writeJson(file, [1, 2, 3]), true);
  assert.deepStrictEqual(readJson(file, null), [1, 2, 3]);
});

test('writeJson leaves no temporary file behind', () => {
  const file = tempFile('state.json');
  writeJson(file, { a: 1 });

  const leftovers = fs.readdirSync(path.dirname(file)).filter((n) => n.endsWith('.tmp'));
  assert.deepStrictEqual(leftovers, []);
});

test('writeJson replaces the previous contents completely', () => {
  const file = tempFile('state.json');
  writeJson(file, { entries: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  writeJson(file, { entries: [] });

  assert.deepStrictEqual(readJson(file, null), { entries: [] });
});

test('writeJson reports failure instead of throwing', () => {
  // A directory can never be replaced by a file rename.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-store-'));
  const target = path.join(dir, 'occupied');
  fs.mkdirSync(target);

  assert.strictEqual(writeJson(target, { a: 1 }), false);
});

test('a corrupt file is moved aside rather than silently discarded', () => {
  const file = tempFile('state.json');
  fs.writeFileSync(file, '{ this is not json');

  assert.deepStrictEqual(readJson(file, { goals: [] }), { goals: [] });

  const backups = fs
    .readdirSync(path.dirname(file))
    .filter((n) => n.startsWith('state.json.corrupt-'));
  assert.strictEqual(backups.length, 1, 'expected the damaged file to be preserved');
  assert.strictEqual(
    fs.readFileSync(path.join(path.dirname(file), backups[0]), 'utf8'),
    '{ this is not json'
  );
  assert.strictEqual(fs.existsSync(file), false);
});

test('a corrupt file is not re-read after being moved aside', () => {
  const file = tempFile('state.json');
  fs.writeFileSync(file, 'nope');

  readJson(file, { goals: [] });
  writeJson(file, { goals: ['recovered'] });

  assert.deepStrictEqual(readJson(file, null), { goals: ['recovered'] });
});

test('readJson preserves falsy JSON values', () => {
  const file = tempFile('state.json');
  writeJson(file, 0);

  assert.strictEqual(readJson(file, 'fallback'), 0);
});
