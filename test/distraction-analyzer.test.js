const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'bin', 'distraction-analyzer.js');

function run(args, home) {
  return spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });
}

test('log rejects negative and non-numeric durations without saving', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-distract-'));
  for (const bad of ['-5', 'abc']) {
    const r = run(['log', 'slack', '--duration', bad], home);
    assert.strictEqual(r.status, 1, bad);
  }
  assert.ok(!fs.existsSync(path.join(home, '.gsd', 'distractions.json')));
});

test('log accepts fractional minutes; analyze rejects unknown period', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-distract-'));
  assert.strictEqual(run(['log', 'slack', '--duration', '2.5'], home).status, 0);
  const saved = JSON.parse(fs.readFileSync(path.join(home, '.gsd', 'distractions.json'), 'utf8'));
  assert.strictEqual(saved.distractions[0].duration, 2.5);
  assert.strictEqual(run(['analyze', '--period', 'year'], home).status, 1);
  assert.strictEqual(run(['analyze', '--period', 'all'], home).status, 0);
});
