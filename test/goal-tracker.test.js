const test = require('node:test');
const assert = require('node:assert');

const {
  parseDeadline,
  applyProgress,
  getDaysRemaining
} = require('../bin/goal-tracker');

/** Format a Date as the local YYYY-MM-DD string the CLI accepts. */
function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

function daysFromToday(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return localDate(d);
}

test('a date-only deadline is local midnight, not UTC midnight', () => {
  const parsed = parseDeadline('2026-12-31');

  assert.strictEqual(parsed.getFullYear(), 2026);
  assert.strictEqual(parsed.getMonth(), 11);
  assert.strictEqual(parsed.getDate(), 31);
});

test('an unparseable deadline throws instead of crashing on toISOString', () => {
  assert.throws(() => parseDeadline('next friday'), /Invalid deadline/);
  assert.throws(() => parseDeadline('31/12/2026'), /Invalid deadline/);
});

test('an absent deadline is null, not an error', () => {
  assert.strictEqual(parseDeadline(undefined), null);
  assert.strictEqual(parseDeadline(null), null);
  assert.strictEqual(parseDeadline('   '), null);
});

test('days remaining counts calendar days', () => {
  assert.strictEqual(getDaysRemaining(daysFromToday(0)), 0);
  assert.strictEqual(getDaysRemaining(daysFromToday(1)), 1);
  assert.strictEqual(getDaysRemaining(daysFromToday(-1)), -1);
  assert.strictEqual(getDaysRemaining(daysFromToday(30)), 30);
});

test('days remaining is null for a deadline it cannot read', () => {
  assert.strictEqual(getDaysRemaining('someday'), null);
  assert.strictEqual(getDaysRemaining(null), null);
});

test('reaching 100 percent marks the goal completed', () => {
  const goal = { progress: 40, status: 'in-progress', milestones: [] };

  applyProgress(goal, 100);

  assert.strictEqual(goal.progress, 100);
  assert.strictEqual(goal.status, 'completed');
  assert.ok(goal.completedAt);
});

test('dropping back below 100 reopens the goal', () => {
  const goal = { progress: 100, status: 'completed', completedAt: 'x', milestones: [] };

  applyProgress(goal, 60);

  assert.strictEqual(goal.status, 'in-progress');
  assert.strictEqual(goal.completedAt, undefined);
});

test('progress is clamped to 0..100', () => {
  const goal = { progress: 0, status: 'in-progress', milestones: [] };

  assert.strictEqual(applyProgress(goal, 250), 100);
  assert.strictEqual(applyProgress(goal, -30), 0);
});

test('a numeric string from the CLI is accepted', () => {
  const goal = { progress: 0, status: 'in-progress', milestones: [] };

  assert.strictEqual(applyProgress(goal, '75'), 75);
});

test('a non-numeric progress throws instead of storing NaN', () => {
  const goal = { progress: 10, status: 'in-progress', milestones: [] };

  assert.throws(() => applyProgress(goal, 'abc'), /Invalid progress/);
  assert.strictEqual(goal.progress, 10);
});

test('an existing completion timestamp is preserved', () => {
  const goal = {
    progress: 100,
    status: 'completed',
    completedAt: '2024-01-01T00:00:00.000Z',
    milestones: []
  };

  applyProgress(goal, 100);

  assert.strictEqual(goal.completedAt, '2024-01-01T00:00:00.000Z');
});
