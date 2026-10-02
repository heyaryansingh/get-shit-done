const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const script = path.join(__dirname, '..', 'bin', 'context-switch-tracker.js');

test('stats ignores a negative --days value and falls back to 7 days', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-cs-'));
  const env = { ...process.env, HOME: home, USERPROFILE: home };
  const run = (...args) => spawnSync(process.execPath, [script, ...args], { env, encoding: 'utf8' });

  run('log', 'taskA');
  const out = run('stats', '--days', '-3').stdout;
  assert.match(out, /last 7 days/);
  assert.match(out, /Total switches:\s+1/);
  fs.rmSync(home, { recursive: true, force: true });
});
