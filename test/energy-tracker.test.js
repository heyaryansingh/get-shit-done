const test = require('node:test');
const assert = require('node:assert');

const EnergyTracker = require('../bin/energy-tracker');

/** Tracker over an in-memory log, without touching ~/.gsd. */
function trackerWith(entries) {
  const tracker = Object.create(EnergyTracker.prototype);
  tracker.energyLog = entries;
  return tracker;
}

test('requiring the module does not run the CLI', () => {
  assert.strictEqual(typeof EnergyTracker, 'function');
});

test('corrupt entries are ignored instead of poisoning averages', () => {
  const entries = [];
  for (let i = 0; i < 10; i++) entries.push({ hour: 9, dayOfWeek: 1, level: 4 });
  entries.push({ hour: 9, dayOfWeek: 1, level: 'high' });
  entries.push({ hour: 9, dayOfWeek: 1, level: 9 });

  const pattern = trackerWith(entries).getHourlyPattern();
  assert.strictEqual(pattern.hourly[9], 4);
  assert.strictEqual(pattern.daily[1], 4);
});
