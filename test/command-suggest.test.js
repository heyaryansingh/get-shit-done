#!/usr/bin/env node
/**
 * Tests for bin/command-suggest.js fuzzy command matching.
 * Uses Node's built-in test runner (node:test) - no external dependencies.
 *
 * Run with: node --test test/
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  suggestCommands,
  loadCommands,
  levenshtein,
  formatSuggestions,
} = require('../bin/command-suggest.js');

test('levenshtein returns 0 for identical strings', () => {
  assert.equal(levenshtein('phase', 'phase'), 0);
});

test('levenshtein computes edit distance for different strings', () => {
  assert.equal(levenshtein('kitten', 'sitting'), 3);
});

test('loadCommands returns a non-empty sorted array of command names', () => {
  const commands = loadCommands();
  assert.ok(commands.length > 0);
  const sorted = [...commands].sort();
  assert.deepEqual(commands, sorted);
});

test('suggestCommands returns exact match for a known command', () => {
  const commands = loadCommands();
  const known = commands[0];
  const result = suggestCommands(known);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, known);
  assert.equal(result[0].distance, 0);
});

test('suggestCommands strips leading "/gsd:" prefix before matching', () => {
  const commands = loadCommands();
  const known = commands[0];
  const result = suggestCommands(`/gsd:${known}`);
  assert.equal(result[0].name, known);
  assert.equal(result[0].distance, 0);
});

test('suggestCommands returns all commands with distance 0 for empty query', () => {
  const commands = loadCommands();
  const result = suggestCommands('');
  assert.equal(result.length, commands.length);
  assert.ok(result.every((r) => r.distance === 0));
});

test('suggestCommands returns all commands for a bare "/gsd" with no subcommand', () => {
  // Regression test: "/gsd" normalizes to an empty string internally, but
  // previously fell through to fuzzy scoring instead of listing all
  // commands, producing a meaningless ranked "Did you mean" list.
  const commands = loadCommands();
  const result = suggestCommands('/gsd');
  assert.equal(result.length, commands.length);
  assert.ok(result.every((r) => r.distance === 0));
});

test('suggestCommands returns all commands for a bare "gsd:" with no subcommand', () => {
  const commands = loadCommands();
  const result = suggestCommands('gsd:');
  assert.equal(result.length, commands.length);
});

test('suggestCommands respects maxResults for fuzzy (non-exact) queries', () => {
  const result = suggestCommands('zzzznotarealcommandzzzz', 3);
  assert.ok(result.length <= 3);
});

test('suggestCommands sorts fuzzy results by ascending distance', () => {
  const result = suggestCommands('zzzznotarealcommandzzzz', 5);
  const distances = result.map((r) => r.distance);
  const sorted = [...distances].sort((a, b) => a - b);
  assert.deepEqual(distances, sorted);
});

test('formatSuggestions lists all commands when query is empty', () => {
  const commands = loadCommands();
  const suggestions = suggestCommands('');
  const output = formatSuggestions('', suggestions);
  assert.match(output, /Available commands/);
  assert.match(output, new RegExp(`\\(${commands.length}\\)`));
});

test('formatSuggestions labels an exact match distinctly from fuzzy matches', () => {
  const commands = loadCommands();
  const known = commands[0];
  const suggestions = suggestCommands(known);
  const output = formatSuggestions(known, suggestions);
  assert.match(output, /Exact match/);
});

test('formatSuggestions shows "Did you mean" for a genuine typo', () => {
  const suggestions = suggestCommands('zzzznotarealcommandzzzz', 3);
  const output = formatSuggestions('zzzznotarealcommandzzzz', suggestions);
  assert.match(output, /Did you mean/);
});

test('formatSuggestions reports no commands found for empty suggestion list', () => {
  const output = formatSuggestions('anything', []);
  assert.match(output, /No commands found/);
});
