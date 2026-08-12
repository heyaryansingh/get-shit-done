const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const MilestoneTracker = require('../bin/milestone-tracker');

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

test('generateReport text output lists every phase', () => {
  const dir = planningDir({ roadmap: ROADMAP });

  const report = new MilestoneTracker(dir).generateReport();

  assert.match(report, /Phase 1: Foundation/);
  assert.match(report, /Phase 3: Polish/);
  assert.match(report, /OVERALL PROGRESS/);
});
