#!/usr/bin/env node
/**
 * Tests for bin/task-estimation-accuracy.js pure logic (buildEstimationRecords).
 * Uses Node's built-in test runner (node:test) - no external dependencies.
 *
 * Run with: node --test test/
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildEstimationRecords } = require('../bin/task-estimation-accuracy.js');

test('buildEstimationRecords filters to completed tasks with both estimate and actual', () => {
  const history = [
    { id: '1', title: 'A', status: 'completed', estimatedMinutes: 30, actualMinutes: 45, tags: ['dev'] },
    { id: '2', title: 'B', status: 'pending', estimatedMinutes: 20, actualMinutes: 20 },
    { id: '3', title: 'C', status: 'completed', estimatedMinutes: 0, actualMinutes: 10 },
    { id: '4', title: 'D', status: 'completed', actualMinutes: 15 },
    { id: '5', title: 'E', status: 'completed', estimatedMinutes: 10 },
  ];

  const records = buildEstimationRecords(history);

  assert.equal(records.length, 1);
  assert.equal(records[0].id, '1');
});

test('buildEstimationRecords computes deltaMinutes and ratio correctly', () => {
  const history = [
    { id: '1', title: 'A', status: 'completed', estimatedMinutes: 40, actualMinutes: 60, tags: ['dev'] },
  ];

  const [record] = buildEstimationRecords(history);

  assert.equal(record.deltaMinutes, 20);
  assert.equal(record.ratio, 1.5);
  assert.deepEqual(record.tags, ['dev']);
});

test('buildEstimationRecords defaults tags to empty array when missing', () => {
  const history = [
    { id: '1', title: 'A', status: 'completed', estimatedMinutes: 10, actualMinutes: 10 },
  ];

  const [record] = buildEstimationRecords(history);

  assert.deepEqual(record.tags, []);
});

test('buildEstimationRecords allows zero actualMinutes', () => {
  const history = [
    { id: '1', title: 'Instant', status: 'completed', estimatedMinutes: 10, actualMinutes: 0 },
  ];

  const records = buildEstimationRecords(history);

  assert.equal(records.length, 1);
  assert.equal(records[0].ratio, 0);
});

test('buildEstimationRecords returns empty array for empty history', () => {
  assert.deepEqual(buildEstimationRecords([]), []);
});

test('buildEstimationRecords excludes negative estimatedMinutes', () => {
  const history = [
    { id: '1', title: 'Bad', status: 'completed', estimatedMinutes: -5, actualMinutes: 10 },
  ];

  assert.deepEqual(buildEstimationRecords(history), []);
});

test('buildEstimationRecords ignores non-array tags instead of passing a string through', () => {
  const history = [
    { id: '1', title: 'A', status: 'completed', estimatedMinutes: 10, actualMinutes: 10, tags: 'api' },
  ];

  const [record] = buildEstimationRecords(history);

  assert.deepEqual(record.tags, []);
});

test('calculateAccuracyByTag handles tags named like Object.prototype members', () => {
  const { execFileSync } = require('node:child_process');
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-home-'));
  fs.mkdirSync(path.join(home, '.get-shit-done'));
  fs.writeFileSync(path.join(home, '.get-shit-done', 'history.json'), JSON.stringify([
    { id: '1', title: 'A', status: 'completed', estimatedMinutes: 10, actualMinutes: 20, tags: ['constructor', '__proto__'] },
  ]));
  const script = `console.log(JSON.stringify(require(${JSON.stringify(path.resolve(__dirname, '../bin/task-estimation-accuracy.js'))}).calculateAccuracyByTag()))`;
  const out = execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, HOME: home, USERPROFILE: home },
    encoding: 'utf8',
  });
  const byTag = JSON.parse(out);
  assert.equal(byTag.constructor.sampleSize, 1);
  assert.equal(byTag.__proto__.averageRatio, 2);
});
