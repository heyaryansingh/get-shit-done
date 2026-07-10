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
