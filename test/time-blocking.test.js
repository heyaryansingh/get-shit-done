'use strict';

const test = require('node:test');
const assert = require('node:assert');

const { periodStart, resolveStartTime } = require('../bin/time-blocking.js');

// 2024-03-13 is a Wednesday.
const WEDNESDAY_AFTERNOON = new Date(2024, 2, 13, 15, 42, 17, 500);

test('the day window starts at local midnight, not at the current time', () => {
  const start = periodStart(WEDNESDAY_AFTERNOON, 'day');

  assert.strictEqual(start.getFullYear(), 2024);
  assert.strictEqual(start.getMonth(), 2);
  assert.strictEqual(start.getDate(), 13);
  assert.strictEqual(start.getHours(), 0);
  assert.strictEqual(start.getMinutes(), 0);
  assert.strictEqual(start.getSeconds(), 0);
  assert.strictEqual(start.getMilliseconds(), 0);
});

test('the week window starts at midnight on the preceding Sunday', () => {
  const start = periodStart(WEDNESDAY_AFTERNOON, 'week');

  assert.strictEqual(start.getDay(), 0);
  assert.strictEqual(start.getDate(), 10);
  assert.strictEqual(start.getHours(), 0);
  assert.strictEqual(start.getMilliseconds(), 0);
});

test('a block earlier the same day falls inside the day window', () => {
  const start = periodStart(WEDNESDAY_AFTERNOON, 'day');
  const morningBlock = new Date(2024, 2, 13, 8, 0, 0);

  assert.ok(morningBlock >= start, 'an 8am block must count toward today');
});

test('a block earlier on Sunday falls inside the week window', () => {
  const start = periodStart(WEDNESDAY_AFTERNOON, 'week');
  const sundayMorning = new Date(2024, 2, 10, 6, 30, 0);

  assert.ok(sundayMorning >= start, 'a Sunday 6:30am block must count this week');
});

test('yesterday is outside the day window', () => {
  const start = periodStart(WEDNESDAY_AFTERNOON, 'day');
  const yesterday = new Date(2024, 2, 12, 23, 59, 59);

  assert.ok(yesterday < start);
});

test('the Saturday before is outside the week window', () => {
  const start = periodStart(WEDNESDAY_AFTERNOON, 'week');
  const lastSaturday = new Date(2024, 2, 9, 23, 59, 59);

  assert.ok(lastSaturday < start);
});

test('a Sunday reference date keeps the whole of that Sunday', () => {
  const sunday = new Date(2024, 2, 10, 20, 0, 0);
  const start = periodStart(sunday, 'week');

  assert.strictEqual(start.getDate(), 10);
  assert.strictEqual(start.getHours(), 0);
});

test('the week window rolls back across a month boundary', () => {
  // 2024-03-01 is a Friday, so the week starts on 2024-02-25.
  const start = periodStart(new Date(2024, 2, 1, 11, 0, 0), 'week');

  assert.strictEqual(start.getMonth(), 1);
  assert.strictEqual(start.getDate(), 25);
});

test('periodStart does not mutate the date it is given', () => {
  const now = new Date(WEDNESDAY_AFTERNOON.getTime());

  periodStart(now, 'week');

  assert.strictEqual(now.getTime(), WEDNESDAY_AFTERNOON.getTime());
});

test('an HH:MM start time resolves to that clock time today', () => {
  const start = new Date(resolveStartTime('14:05', WEDNESDAY_AFTERNOON));
  assert.deepStrictEqual(
    [start.getFullYear(), start.getMonth(), start.getDate(), start.getHours(), start.getMinutes()],
    [2024, 2, 13, 14, 5]
  );
});

test('unparseable start times resolve to null', () => {
  assert.strictEqual(resolveStartTime('25:00', WEDNESDAY_AFTERNOON), null);
  assert.strictEqual(resolveStartTime('soon', WEDNESDAY_AFTERNOON), null);
});
