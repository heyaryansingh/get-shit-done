const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MilestoneTracker = require('../bin/milestone-tracker');
const { formatDate } = require('../bin/task-recurrence');

/**
 * Build a throwaway .planning tree.
 *
 * @param {Object} spec
 * @param {string} [spec.roadmap] - ROADMAP.md contents.
 * @param {Object} [spec.phases] - Map of phase dir name to plan file names.
 * @param {string[]} [spec.summaries] - Summary file names.
 * @returns {string} Path to the planning directory.
 */
function planningDir({ roadmap, phases = {}, summaries = [] }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-milestone-'));

  if (roadmap !== undefined) {
    fs.writeFileSync(path.join(dir, 'ROADMAP.md'), roadmap);
  }

  for (const [name, plans] of Object.entries(phases)) {
    const phaseDir = path.join(dir, 'phases', name);
    fs.mkdirSync(phaseDir, { recursive: true });
    for (const plan of plans) {
      fs.writeFileSync(path.join(phaseDir, plan), '# plan');
    }
  }

  if (summaries.length > 0) {
    fs.mkdirSync(path.join(dir, 'summaries'), { recursive: true });
    for (const summary of summaries) {
      fs.writeFileSync(path.join(dir, 'summaries', summary), '# summary');
    }
  }

  return dir;
}

const ROADMAP = [
  '# Roadmap',
  '',
  '### Phase 1: Foundation',
  'Set up the skeleton.',
  '',
  '### Phase 2: Features',
  'Build the thing.',
  '',
  '### Phase 3: Polish',
  'Clean up.',
  ''
].join('\n');

test('module loads and exposes the tracker class', () => {
  // A botched rename left `const phaseDir` dangling mid-statement, so the file
  // threw a SyntaxError on require and every command using it was dead.
  assert.strictEqual(typeof MilestoneTracker, 'function');
  assert.strictEqual(typeof new MilestoneTracker('.planning').generateReport, 'function');
});

test('parseRoadmap reads every phase header', () => {
  const dir = planningDir({ roadmap: ROADMAP });
  const phases = new MilestoneTracker(dir).parseRoadmap();

  assert.strictEqual(phases.length, 3);
  assert.deepStrictEqual(phases.map(p => p.number), [1, 2, 3]);
  assert.deepStrictEqual(phases.map(p => p.name), ['Foundation', 'Features', 'Polish']);
});

test('parseRoadmap explains a missing roadmap instead of crashing', () => {
  const dir = planningDir({});

  assert.throws(() => new MilestoneTracker(dir).parseRoadmap(), /ROADMAP\.md not found/);
});

test('a phase with no directory is not_started', () => {
  const dir = planningDir({ roadmap: ROADMAP });

  assert.strictEqual(new MilestoneTracker(dir).getPhaseStatus(1), 'not_started');
});

test('a phase with plans but no summaries is planned', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    phases: { '01-foundation': ['01-setup-PLAN.md'] }
  });

  assert.strictEqual(new MilestoneTracker(dir).getPhaseStatus(1), 'planned');
});

test('a phase with some summaries is in_progress', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    phases: { '01-foundation': ['01-setup-PLAN.md', '01-wire-PLAN.md'] },
    summaries: ['01-setup-SUMMARY.md']
  });

  assert.strictEqual(new MilestoneTracker(dir).getPhaseStatus(1), 'in_progress');
});

test('a phase with a summary for every plan is completed', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    phases: { '01-foundation': ['01-setup-PLAN.md'] },
    summaries: ['01-setup-SUMMARY.md']
  });

  assert.strictEqual(new MilestoneTracker(dir).getPhaseStatus(1), 'completed');
});

test('summaries are matched to their own phase, not a neighbour', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    phases: { '01-foundation': ['01-setup-PLAN.md'], '02-features': ['02-build-PLAN.md'] },
    summaries: ['02-build-SUMMARY.md']
  });
  const tracker = new MilestoneTracker(dir);

  assert.strictEqual(tracker.getPhaseStatus(1), 'planned');
  assert.strictEqual(tracker.getPhaseStatus(2), 'completed');
});

test('calculateProgress counts each status and the completion percentage', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    phases: { '01-foundation': ['01-setup-PLAN.md'], '02-features': ['02-build-PLAN.md'] },
    summaries: ['01-setup-SUMMARY.md']
  });

  const { stats } = new MilestoneTracker(dir).calculateProgress();

  assert.strictEqual(stats.total_phases, 3);
  assert.strictEqual(stats.completed, 1);
  assert.strictEqual(stats.planned, 1);
  assert.strictEqual(stats.not_started, 1);
  assert.strictEqual(stats.completion_percentage, 33);
});

test('velocity is zero when there is nothing to measure', () => {
  const dir = planningDir({ roadmap: ROADMAP });

  assert.deepStrictEqual(new MilestoneTracker(dir).calculateVelocity(), {
    tasks_per_day: 0,
    phases_per_week: 0
  });
});

test('generateReport emits parseable JSON', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    phases: { '01-foundation': ['01-setup-PLAN.md'] },
    summaries: ['01-setup-SUMMARY.md']
  });

  const payload = JSON.parse(new MilestoneTracker(dir).generateReport('json'));

  assert.strictEqual(payload.milestone_progress.total_phases, 3);
  assert.strictEqual(payload.phases.length, 3);
  assert.ok('estimated_completion' in payload);
});

/** Backdate a summary file so velocity has a real time span to measure. */
function setMtime(dir, file, daysAgo) {
  const when = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const target = path.join(dir, 'summaries', file);
  fs.utimesSync(target, when, when);
}

test('a burst of summaries in one afternoon does not inflate velocity', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    summaries: ['01-a-SUMMARY.md', '01-b-SUMMARY.md']
  });
  // Two summaries one hour apart span 1/24 of a day.
  setMtime(dir, '01-a-SUMMARY.md', 1 / 24);
  setMtime(dir, '01-b-SUMMARY.md', 0);

  const velocity = new MilestoneTracker(dir).calculateVelocity();

  // Dividing by the raw span would report 48 tasks/day off one afternoon.
  assert.strictEqual(velocity.tasks_per_day, '2.00');
});

test('velocity measures real elapsed days when the span is longer', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    summaries: ['01-a-SUMMARY.md', '01-b-SUMMARY.md', '02-c-SUMMARY.md']
  });
  setMtime(dir, '01-a-SUMMARY.md', 10);
  setMtime(dir, '01-b-SUMMARY.md', 5);
  setMtime(dir, '02-c-SUMMARY.md', 0);

  const velocity = new MilestoneTracker(dir).calculateVelocity();

  assert.strictEqual(velocity.days_active, 10);
  assert.strictEqual(velocity.tasks_per_day, '0.30');
  assert.strictEqual(velocity.total_tasks_completed, 3);
});

test('the estimated completion date is a local calendar day', () => {
  const dir = planningDir({
    roadmap: ROADMAP,
    phases: { '01-foundation': ['01-a-PLAN.md'] },
    summaries: ['01-a-SUMMARY.md', '02-b-SUMMARY.md']
  });
  setMtime(dir, '01-a-SUMMARY.md', 20);
  setMtime(dir, '02-b-SUMMARY.md', 0);

  const completion = new MilestoneTracker(dir).estimateCompletion();

  assert.match(completion.estimated_date, /^\d{4}-\d{2}-\d{2}$/);

  // toISOString would report the UTC day, which rolls over early for anyone
  // west of Greenwich.
  const expected = new Date();
  expected.setDate(expected.getDate() + completion.days_remaining);
  assert.strictEqual(completion.estimated_date, formatDate(expected));
});

test('confidence is reported from the number of completed tasks', () => {
  const tracker = new MilestoneTracker('.planning');

  assert.strictEqual(tracker.calculateConfidence(0), 'Low');
  assert.strictEqual(tracker.calculateConfidence(4), 'Low');
  assert.strictEqual(tracker.calculateConfidence(10), 'Medium');
  assert.strictEqual(tracker.calculateConfidence(20), 'High');
});

test('an unmeasurable velocity reports Unknown rather than a date', () => {
  const dir = planningDir({ roadmap: ROADMAP });

  const completion = new MilestoneTracker(dir).estimateCompletion();

  assert.strictEqual(completion.estimated_date, 'Unknown');
  assert.strictEqual(completion.days_remaining, 'Unknown');
});

test('generateReport text output lists every phase', () => {
  const dir = planningDir({ roadmap: ROADMAP });

  const report = new MilestoneTracker(dir).generateReport();

  assert.match(report, /Phase 1: Foundation/);
  assert.match(report, /Phase 3: Polish/);
  assert.match(report, /OVERALL PROGRESS/);
});
