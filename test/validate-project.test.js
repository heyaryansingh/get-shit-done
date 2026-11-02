const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'bin', 'validate-project.js');

test('progress is 0% (not NaN%) when phases exist but have no plans', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-vp-'));
  fs.mkdirSync(path.join(root, '.planning', 'phases', '01-x'), { recursive: true });
  const out = spawnSync(process.execPath, [script, root], { encoding: 'utf8' }).stdout;
  assert.match(out, /Progress:\s+0%/);
  fs.rmSync(root, { recursive: true, force: true });
});
