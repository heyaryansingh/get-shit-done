const test = require('node:test');
const assert = require('node:assert');

const { formatDate, generateWeeklyReport } = require('../bin/productivity-analytics');

test('date key is the local date, not the UTC date', () => {
  const now = new Date();
  const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;

  assert.strictEqual(formatDate(now), expected);
});

test('an evening event stays on its own local day', () => {
  // 11pm local is already tomorrow in UTC anywhere west of Greenwich, which
  // used to file the completion under a day the user had not reached yet.
  const evening = new Date(2024, 2, 15, 23, 30);

  assert.strictEqual(formatDate(evening), '2024-03-15');
});

test('an early-morning event stays on its own local day', () => {
  const morning = new Date(2024, 2, 15, 0, 30);

  assert.strictEqual(formatDate(morning), '2024-03-15');
});

test('single-digit months and days are zero padded', () => {
  assert.strictEqual(formatDate(new Date(2024, 0, 5)), '2024-01-05');
});

test('weekly report spans eight local day keys ending today', () => {
  const report = generateWeeklyReport();

  assert.strictEqual(report.endDate, formatDate(new Date()));
  assert.strictEqual(report.dailyBreakdown.length, 8);
  assert.strictEqual(report.dailyBreakdown[0].date, report.startDate);
  assert.strictEqual(
    report.dailyBreakdown[report.dailyBreakdown.length - 1].date,
    report.endDate
  );
});

test('weekly report days are consecutive with no gaps or repeats', () => {
  const dates = generateWeeklyReport().dailyBreakdown.map((d) => d.date);

  assert.strictEqual(new Set(dates).size, dates.length);
  for (let i = 1; i < dates.length; i++) {
    const previous = new Date(`${dates[i - 1]}T00:00:00`);
    previous.setDate(previous.getDate() + 1);
    assert.strictEqual(formatDate(previous), dates[i]);
  }
});
