#!/usr/bin/env node
/**
 * Tests for bin/dependency-tracker.js DependencyTracker class.
 * Uses Node's built-in test runner (node:test) - no external test dependencies.
 * Each test uses an isolated temp JSON file (via the injectable filePath
 * constructor param) so tests never touch a real .gsd-dependencies.json.
 *
 * Run with: node --test test/
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { DependencyTracker } = require('../bin/dependency-tracker.js');

function makeTempFile() {
  return path.join(
    os.tmpdir(),
    `gsd-dep-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`
  );
}

function withTracker(fn) {
  const filePath = makeTempFile();
  const tracker = new DependencyTracker(filePath);
  try {
    fn(tracker, filePath);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

test('constructor starts with empty tasks/completed when no file exists', () => {
  withTracker((tracker) => {
    assert.deepEqual(tracker.dependencies, { tasks: {}, completed: [] });
  });
});

test('constructor does not create or write a file just by loading', () => {
  const filePath = makeTempFile();
  new DependencyTracker(filePath);
  assert.equal(fs.existsSync(filePath), false);
});

test('addDependency creates both tasks and persists to disk', () => {
  withTracker((tracker, filePath) => {
    tracker.addDependency('B', 'A');
    assert.deepEqual(tracker.dependencies.tasks.B.dependsOn, ['A']);
    assert.ok(tracker.dependencies.tasks.A);
    assert.equal(fs.existsSync(filePath), true);
  });
});

test('addDependency does not add duplicate dependency entries', () => {
  withTracker((tracker) => {
    tracker.addDependency('B', 'A');
    tracker.addDependency('B', 'A');
    assert.deepEqual(tracker.dependencies.tasks.B.dependsOn, ['A']);
  });
});

test('addDependency throws and rolls back on circular dependency', () => {
  withTracker((tracker) => {
    tracker.addDependency('B', 'A');
    tracker.addDependency('C', 'B');
    assert.throws(() => tracker.addDependency('A', 'C'), /Circular dependency detected/);
    // rollback: A should not depend on C after the throw
    assert.equal(tracker.dependencies.tasks.A.dependsOn.includes('C'), false);
  });
});

test('removeDependency removes an existing edge and returns true', () => {
  withTracker((tracker) => {
    tracker.addDependency('B', 'A');
    const result = tracker.removeDependency('B', 'A');
    assert.equal(result, true);
    assert.deepEqual(tracker.dependencies.tasks.B.dependsOn, []);
  });
});

test('removeDependency returns false for unknown task', () => {
  withTracker((tracker) => {
    assert.equal(tracker.removeDependency('missing', 'A'), false);
  });
});

test('completeTask marks a task completed exactly once', () => {
  withTracker((tracker) => {
    tracker.addDependency('B', 'A');
    tracker.completeTask('A');
    tracker.completeTask('A');
    assert.deepEqual(tracker.dependencies.completed, ['A']);
  });
});

test('getUnblockedTasks returns only tasks whose deps are all completed', () => {
  withTracker((tracker) => {
    tracker.addDependency('B', 'A');
    tracker.addDependency('C', 'B');
    let unblocked = tracker.getUnblockedTasks();
    assert.ok(unblocked.includes('A'));
    assert.equal(unblocked.includes('B'), false);

    tracker.completeTask('A');
    unblocked = tracker.getUnblockedTasks();
    assert.ok(unblocked.includes('B'));
    assert.equal(unblocked.includes('C'), false);
  });
});

test('getBlockedTasks lists incomplete blockers', () => {
  withTracker((tracker) => {
    tracker.addDependency('B', 'A');
    const blocked = tracker.getBlockedTasks();
    const entry = blocked.find((b) => b.id === 'B');
    assert.ok(entry);
    assert.deepEqual(entry.blockedBy, ['A']);
  });
});

test('topologicalSort orders dependencies before dependents', () => {
  withTracker((tracker) => {
    tracker.addDependency('B', 'A');
    tracker.addDependency('C', 'B');
    const sorted = tracker.topologicalSort();
    assert.ok(sorted.indexOf('A') < sorted.indexOf('B'));
    assert.ok(sorted.indexOf('B') < sorted.indexOf('C'));
    assert.equal(sorted.length, 3);
  });
});

test('getCriticalPath returns the longest dependency chain', () => {
  withTracker((tracker) => {
    tracker.addDependency('B', 'A');
    tracker.addDependency('C', 'B');
    tracker.addDependency('D', 'C');
    const path = tracker.getCriticalPath();
    assert.deepEqual(path, ['A', 'B', 'C', 'D']);
  });
});

test('save/load round-trip persists state across instances', () => {
  const filePath = makeTempFile();
  try {
    const t1 = new DependencyTracker(filePath);
    t1.addDependency('B', 'A');
    t1.completeTask('A');

    const t2 = new DependencyTracker(filePath);
    assert.deepEqual(t2.dependencies.tasks.B.dependsOn, ['A']);
    assert.deepEqual(t2.dependencies.completed, ['A']);
  } finally {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
});
