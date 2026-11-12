const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-goal-'));
process.env.HOME = process.env.USERPROFILE = home;
const { completeMilestone } = require('../bin/goal-tracker');

test('completeMilestone rejects a non-numeric index instead of crashing', () => {
  fs.writeFileSync(
    path.join(home, '.gsd-goals.json'),
    JSON.stringify({ goals: [{ id: 'g1', name: 'g', progress: 0, status: 'in-progress', milestones: [{ name: 'm', completed: false }] }] })
  );
  const log = console.log;
  console.log = () => {};
  try {
    assert.strictEqual(completeMilestone('g', 'abc'), false);
    assert.strictEqual(completeMilestone('g', '1.5'), false);
    assert.strictEqual(completeMilestone('g', '1'), true);
  } finally {
    console.log = log;
  }
});
