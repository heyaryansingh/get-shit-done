const test = require('node:test');
const assert = require('node:assert');

const { calculateStats } = require('../bin/focus-timer');
const { formatDate } = require('../bin/task-recurrence');

/** A completed focus session starting at the given local hour, `daysAgo` back. */
function session(hour, daysAgo = 0, duration = 25) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);

  return {
    id: `s_${daysAgo}_${hour}`,
    startTime: d.toISOString(),
    duration,
    type: 'focus',
    completed: true
  };
}

function focusData(sessions) {
  return {
    sessions,
    settings: {},
    streakData: { current: 1, longest: 1, lastActiveDate: null }
  };
}

test('a late-evening session counts toward today, not tomorrow', () => {
  // Stored as a UTC ISO timestamp; west of Greenwich a 9pm local start is
  // already tomorrow in UTC, which the old prefix match bucketed wrongly.
  const stats = calculateStats(focusData([session(21)]));

  assert.strictEqual(stats.todayMinutes, 25);
  assert.strictEqual(stats.dailyTotals[formatDate(new Date())], 25);
});

test('an early-morning session counts toward today, not yesterday', () => {
  const stats = calculateStats(focusData([session(1)]));

  assert.strictEqual(stats.todayMinutes, 25);
});

test('sessions across one local day are summed together', () => {
  const stats = calculateStats(focusData([session(1), session(13), session(21)]));

  assert.strictEqual(stats.todayMinutes, 75);
  assert.strictEqual(stats.dailyTotals[formatDate(new Date())], 75);
});

test('yesterday stays out of today', () => {
  const stats = calculateStats(focusData([session(21, 1)]));

  assert.strictEqual(stats.todayMinutes, 0);
  assert.strictEqual(stats.totalMinutes, 25);
});

test('incomplete and break sessions are excluded', () => {
  const cancelled = { ...session(10), completed: false };
  const shortBreak = { ...session(11), type: 'short_break' };

  const stats = calculateStats(focusData([cancelled, shortBreak, session(12)]));

  assert.strictEqual(stats.todayMinutes, 25);
  assert.strictEqual(stats.completedSessions, 1);
});

test('empty data yields zeroed stats', () => {
  const stats = calculateStats(focusData([]));

  assert.strictEqual(stats.todayMinutes, 0);
  assert.strictEqual(stats.totalMinutes, 0);
  assert.strictEqual(stats.avgSessionLength, 0);
});
