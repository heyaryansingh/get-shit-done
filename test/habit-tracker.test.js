const test = require('node:test');
const assert = require('node:assert');

const {
  getTodayString,
  calculateStreak,
  isCompletedToday
} = require('../bin/habit-tracker');

const { formatDate } = require('../bin/task-recurrence');

/** Build a habits payload with completions offset back from today. */
function habitData(target, offsetsToCount) {
  const completions = {};
  for (const [offset, count] of Object.entries(offsetsToCount)) {
    const d = new Date();
    d.setDate(d.getDate() - Number(offset));
    completions[formatDate(d)] = count;
  }

  return {
    habits: [{ id: 'h1', name: 'Exercise', target, unit: 'session' }],
    completions: { h1: completions }
  };
}

test('today string is the local date, not the UTC date', () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  assert.strictEqual(getTodayString(), expected);
});

test('today string agrees with the keys calculateStreak scans', () => {
  // A UTC key writer paired with a UTC key reader hid this; they must match.
  const data = habitData(1, { 0: 1 });
  assert.strictEqual(calculateStreak('h1', data), 1);
  assert.ok(Object.keys(data.completions.h1).includes(getTodayString()));
});

test('consecutive days accumulate into a streak', () => {
  assert.strictEqual(calculateStreak('h1', habitData(1, { 0: 1, 1: 1, 2: 1 })), 3);
});

test('a gap ends the streak', () => {
  assert.strictEqual(calculateStreak('h1', habitData(1, { 0: 1, 1: 1, 3: 1 })), 2);
});

test('an incomplete day does not count toward the streak', () => {
  assert.strictEqual(calculateStreak('h1', habitData(3, { 0: 3, 1: 1, 2: 3 })), 1);
});

test('missing today is allowed without breaking yesterday\'s streak', () => {
  assert.strictEqual(calculateStreak('h1', habitData(1, { 1: 1, 2: 1 })), 2);
});

test('a habit with no completions has no streak', () => {
  assert.strictEqual(calculateStreak('h1', habitData(1, {})), 0);
});

test('an unknown habit has no streak', () => {
  assert.strictEqual(calculateStreak('nope', habitData(1, { 0: 1 })), 0);
});

test('isCompletedToday needs the full target', () => {
  assert.strictEqual(isCompletedToday('h1', habitData(3, { 0: 2 })), false);
  assert.strictEqual(isCompletedToday('h1', habitData(3, { 0: 3 })), true);
});

test('isCompletedToday is false for an unknown habit', () => {
  assert.strictEqual(isCompletedToday('nope', habitData(1, { 0: 1 })), false);
});
