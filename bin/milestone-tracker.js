#!/usr/bin/env node

/**
 * Milestone Tracker - Progress visualization and milestone analytics
 *
 * Provides detailed milestone progress tracking including:
 * - Phase completion percentages
 * - Velocity metrics (tasks/day, phases/week)
 * - Estimated completion dates
 * - Burndown chart data
 * - Task distribution analysis
 */

const fs = require('fs');
const path = require('path');

class MilestoneTracker {
  constructor(planningDir = '.planning') {
    this.planningDir = planningDir;
    this.roadmapPath = path.join(planningDir, 'ROADMAP.md');
    this.phasesDir = path.join(planningDir, 'phases');
    this.summariesDir = path.join(planningDir, 'summaries');
  }

  /**
   * Parse roadmap to get phases
   */
  parseRoadmap() {
    if (!fs.existsSync(this.roadmapPath)) {
      throw new Error('ROADMAP.md not found. Run /gsd:create-roadmap first');
    }

    const content = fs.readFileSync(this.roadmapPath, 'utf-8');
    const phases = [];

    // Match phase headers like "### Phase 1: Foundation"
    const phaseRegex = /###\s+Phase\s+(\d+):\s+(.+)/g;
    let match;

    while ((match = phaseRegex.exec(content)) !== null) {
      const phaseNum = parseInt(match[1]);
      const phaseName = match[2].trim();

      phases.push({
        number: phaseNum,
        name: phaseName,
        status: this.getPhaseStatus(phaseNum),
      });
    }

    return phases;
  }

  /**
   * Determine phase status
   */
  getPhaseStatus(phaseNum) {
    const phaseDir = path.join(this.phasesDir, String(phaseNum).padStart(2, '0') + '-*');

    // Check if phase directory exists
    const matchingDirs = this.glob(this.phasesDir, String(phaseNum).padStart(2, '0'));

    if (matchingDirs.length === 0) {
      return 'not_started';
    }

    const phaseDir

Actual = matchingDirs[0];

    // Count plans and summaries
    const plans = this.getPlanFiles(phaseDirActual);
    const summaries = this.getSummaryFiles(phaseNum);

    if (summaries.length === plans.length && plans.length > 0) {
      return 'completed';
    } else if (summaries.length > 0) {
      return 'in_progress';
    } else {
      return 'planned';
    }
  }

  /**
   * Get plan files for a phase
   */
  getPlanFiles(phaseDir) {
    if (!fs.existsSync(phaseDir)) return [];

    return fs.readdirSync(phaseDir)
      .filter(f => f.endsWith('-PLAN.md'));
  }

  /**
   * Get summary files for a phase
   */
  getSummaryFiles(phaseNum) {
    if (!fs.existsSync(this.summariesDir)) return [];

    const phasePrefix = String(phaseNum).padStart(2, '0');

    return fs.readdirSync(this.summariesDir)
      .filter(f => f.startsWith(phasePrefix) && f.endsWith('-SUMMARY.md'));
  }

  /**
   * Simple glob helper
   */
  glob(dir, pattern) {
    if (!fs.existsSync(dir)) return [];

    return fs.readdirSync(dir)
      .filter(d => d.startsWith(pattern))
      .map(d => path.join(dir, d));
  }

  /**
   * Calculate milestone progress
   */
  calculateProgress() {
    const phases = this.parseRoadmap();

    const stats = {
      total_phases: phases.length,
      completed: phases.filter(p => p.status === 'completed').length,
      in_progress: phases.filter(p => p.status === 'in_progress').length,
      planned: phases.filter(p => p.status === 'planned').length,
      not_started: phases.filter(p => p.status === 'not_started').length,
    };

    stats.completion_percentage = stats.total_phases > 0
      ? Math.round((stats.completed / stats.total_phases) * 100)
      : 0;

    return { phases, stats };
  }

  /**
   * Calculate velocity metrics
   */
  calculateVelocity() {
    // Get all summaries with timestamps
    if (!fs.existsSync(this.summariesDir)) {
      return { tasks_per_day: 0, phases_per_week: 0 };
    }

    const summaries = fs.readdirSync(this.summariesDir)
      .filter(f => f.endsWith('-SUMMARY.md'))
      .map(f => {
        const filePath = path.join(this.summariesDir, f);
        const stats = fs.statSync(filePath);
        return {
          file: f,
          timestamp: stats.mtime,
        };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    if (summaries.length < 2) {
      return { tasks_per_day: 0, phases_per_week: 0 };
    }

    // Calculate time span
    const firstTask = summaries[0].timestamp;
    const lastTask = summaries[summaries.length - 1].timestamp;
    const daysElapsed = (lastTask - firstTask) / (1000 * 60 * 60 * 24);

    const tasksPerDay = daysElapsed > 0
      ? summaries.length / daysElapsed
      : 0;

    // Estimate phases (assuming 3 tasks per phase)
    const phasesPerWeek = tasksPerDay * 7 / 3;

    return {
      tasks_per_day: tasksPerDay.toFixed(2),
      phases_per_week: phasesPerWeek.toFixed(2),
      total_tasks_completed: summaries.length,
      days_active: Math.round(daysElapsed),
    };
  }

  /**
   * Estimate completion date
   */
  estimateCompletion() {
    const { phases, stats } = this.calculateProgress();
    const velocity = this.calculateVelocity();

    const remainingPhases = stats.total_phases - stats.completed;

    if (velocity.phases_per_week === 0 || velocity.phases_per_week === '0.00') {
      return { estimated_date: 'Unknown', days_remaining: 'Unknown' };
    }

    const weeksRemaining = remainingPhases / parseFloat(velocity.phases_per_week);
    const daysRemaining = Math.ceil(weeksRemaining * 7);

    const completionDate = new Date();
    completionDate.setDate(completionDate.getDate() + daysRemaining);

    return {
      estimated_date: completionDate.toISOString().split('T')[0],
      days_remaining: daysRemaining,
      confidence: this.calculateConfidence(velocity.total_tasks_completed),
    };
  }

  /**
   * Calculate confidence level based on data points
   */
  calculateConfidence(dataPoints) {
    if (dataPoints < 5) return 'Low';
    if (dataPoints < 15) return 'Medium';
    return 'High';
  }

  /**
   * Generate full progress report
   */
  generateReport(format = 'text') {
    const { phases, stats } = this.calculateProgress();
    const velocity = this.calculateVelocity();
    const completion = this.estimateCompletion();

    if (format === 'json') {
      return JSON.stringify({
        milestone_progress: stats,
        phases: phases,
        velocity: velocity,
        estimated_completion: completion,
      }, null, 2);
    }

    // Text format
    let report = '';
    report += '╔════════════════════════════════════════════════════════════╗\n';
    report += '║           MILESTONE PROGRESS TRACKER                      ║\n';
    report += '╚════════════════════════════════════════════════════════════╝\n\n';

    report += '📊 OVERALL PROGRESS\n';
    report += `   Completion: ${stats.completion_percentage}% (${stats.completed}/${stats.total_phases} phases)\n`;
    report += `   ✅ Completed: ${stats.completed}\n`;
    report += `   🚧 In Progress: ${stats.in_progress}\n`;
    report += `   📋 Planned: ${stats.planned}\n`;
    report += `   ⏸️  Not Started: ${stats.not_started}\n\n`;

    report += '📈 VELOCITY METRICS\n';
    report += `   Tasks/Day: ${velocity.tasks_per_day}\n`;
    report += `   Phases/Week: ${velocity.phases_per_week}\n`;
    report += `   Active Days: ${velocity.days_active}\n`;
    report += `   Total Tasks: ${velocity.total_tasks_completed}\n\n`;

    report += '🎯 ESTIMATED COMPLETION\n';
    report += `   Date: ${completion.estimated_date}\n`;
    report += `   Days Remaining: ${completion.days_remaining}\n`;
    report += `   Confidence: ${completion.confidence}\n\n`;

    report += '📑 PHASE STATUS\n';
    phases.forEach(phase => {
      const icon = phase.status === 'completed' ? '✅' :
                   phase.status === 'in_progress' ? '🚧' :
                   phase.status === 'planned' ? '📋' : '⏸️';
      report += `   ${icon} Phase ${phase.number}: ${phase.name}\n`;
    });

    return report;
  }
}

// CLI Interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const format = args.includes('--json') ? 'json' : 'text';

  try {
    const tracker = new MilestoneTracker();
    const report = tracker.generateReport(format);
    console.log(report);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

module.exports = MilestoneTracker;
