'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
  Frequency,
  nextDueDate,
  parseLocalDate,
  formatDate,
  isDue,
} = require('../bin/task-recurrence.js');

const next = (from, frequency) => formatDate(nextDueDate(from, frequency));

test('monthly recurrence clamps to the last day of a short month', () => {
  assert.strictEqual(next('2024-01-31', Frequency.MONTHLY), '2024-02-29');
  assert.strictEqual(next('2023-01-31', Frequency.MONTHLY), '2023-02-28');
  assert.strictEqual(next('2024-03-31', Frequency.MONTHLY), '2024-04-30');
});

test('monthly recurrence keeps the day of month when it exists', () => {
  assert.strictEqual(next('2024-01-15', Frequency.MONTHLY), '2024-02-15');
  assert.strictEqual(next('2024-12-15', Frequency.MONTHLY), '2025-01-15');
});

test('daily, weekly and biweekly advance across month and year ends', () => {
  assert.strictEqual(next('2024-02-28', Frequency.DAILY), '2024-02-29');
  assert.strictEqual(next('2024-02-28', Frequency.WEEKLY), '2024-03-06');
  assert.strictEqual(next('2024-12-25', Frequency.BIWEEKLY), '2025-01-08');
});

test('an unknown frequency falls back to daily', () => {
  assert.strictEqual(next('2024-05-01', 'fortnightly'), '2024-05-02');
});

test('date-only strings are read as local dates, not UTC midnight', () => {
  const parsed = parseLocalDate('2024-01-31');

  assert.strictEqual(parsed.getFullYear(), 2024);
  assert.strictEqual(parsed.getMonth(), 0);
  assert.strictEqual(parsed.getDate(), 31);
  assert.strictEqual(formatDate('2024-01-31'), '2024-01-31');
});

test('formatDate pads single-digit months and days', () => {
  assert.strictEqual(formatDate(new Date(2024, 0, 5)), '2024-01-05');
});

test('parseLocalDate still accepts Date objects and timestamps', () => {
  const d = new Date(2024, 6, 4, 13, 30);

  assert.strictEqual(formatDate(d), '2024-07-04');
  assert.strictEqual(formatDate(parseLocalDate(d.getTime())), '2024-07-04');
});

test('a task due today is due, one due tomorrow is not', () => {
  const today = formatDate(new Date());

  assert.strictEqual(isDue({ next_due: today }), true);
  assert.strictEqual(isDue({ next_due: next(new Date(), Frequency.DAILY) }), false);
});

test('an overdue task stays due', () => {
  const past = new Date();
  past.setDate(past.getDate() - 30);

  assert.strictEqual(isDue({ next_due: formatDate(past) }), true);
});
