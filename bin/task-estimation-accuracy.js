#!/usr/bin/env node
/**
 * @fileoverview Task Estimation Accuracy - Track estimated vs. actual task duration
 * @module bin/task-estimation-accuracy
 *
 * Compares estimated task duration against actual duration from task history,
 * surfaces over/under-estimation patterns, and suggests a calibration factor
 * to help improve future estimates.
 *
 * @example
 * ```bash
 * # Show estimation accuracy summary
 * npx get-shit-done estimation-accuracy
 *
 * # Show accuracy broken down by tag
 * npx get-shit-done estimation-accuracy --by-tag
 *
 * # Export accuracy report as JSON
 * npx get-shit-done estimation-accuracy --export
 * ```
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Path to tasks history file (shared with productivity-analytics.js).
 * @type {string}
 */
const HISTORY_FILE = path.join(os.homedir(), '.get-shit-done', 'history.json');

/**
 * @typedef {Object} TaskRecord
 * @property {string} id - Unique task identifier
 * @property {string} title - Task title
 * @property {string} status - Task status (completed, pending, cancelled)
 * @property {number} [estimatedMinutes] - Estimated duration in minutes
 * @property {number} [actualMinutes] - Actual duration in minutes
 * @property {string[]} [tags] - Task tags/categories
 */

/**
 * @typedef {Object} EstimationRecord
 * @property {string} id - Task identifier
 * @property {string} title - Task title
 * @property {number} estimatedMinutes - Estimated duration in minutes
 * @property {number} actualMinutes - Actual duration in minutes
 * @property {number} deltaMinutes - actualMinutes - estimatedMinutes
 * @property {number} ratio - actualMinutes / estimatedMinutes
 * @property {string[]} tags - Task tags/categories
 */

/**
 * @typedef {Object} EstimationAccuracySummary
 * @property {number} sampleSize - Number of completed tasks with both estimate and actual
 * @property {number} averageRatio - Mean of actual/estimated ratio across tasks
 * @property {number} medianRatio - Median of actual/estimated ratio across tasks
 * @property {number} calibrationFactor - Suggested multiplier for future estimates
 * @property {number} overestimateCount - Tasks where actual < estimated
 * @property {number} underestimateCount - Tasks where actual > estimated
 * @property {number} accurateCount - Tasks within +/-10% of estimate
 * @property {EstimationRecord[]} worstUnderestimates - Top 5 most underestimated tasks
 * @property {EstimationRecord[]} worstOverestimates - Top 5 most overestimated tasks
 */

/**
 * Load task history from file.
 * @returns {TaskRecord[]} Array of task records
 */
function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading history:', error.message);
  }
  return [];
}

/**
 * Build estimation records from completed tasks that have both an estimate
 * and an actual duration recorded.
 * @param {TaskRecord[]} history - Task history
 * @returns {EstimationRecord[]} Estimation records
 */
function buildEstimationRecords(history) {
  return history
    .filter(
      (task) =>
        task.status === 'completed' &&
        typeof task.estimatedMinutes === 'number' &&
        task.estimatedMinutes > 0 &&
        typeof task.actualMinutes === 'number' &&
        task.actualMinutes >= 0,
    )
    .map((task) => ({
      id: task.id,
      title: task.title,
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: task.actualMinutes,
      deltaMinutes: task.actualMinutes - task.estimatedMinutes,
      ratio: task.actualMinutes / task.estimatedMinutes,
      tags: task.tags || [],
    }));
}

/**
 * Compute the median of a numeric array.
 * @param {number[]} values - Numeric values
 * @returns {number} Median value, or 0 for an empty array
 */
function median(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Calculate estimation accuracy summary from task history.
 * @returns {EstimationAccuracySummary} Estimation accuracy summary
 */
function calculateEstimationAccuracy() {
  const history = loadHistory();
  const records = buildEstimationRecords(history);

  if (records.length === 0) {
    return {
      sampleSize: 0,
      averageRatio: 0,
      medianRatio: 0,
      calibrationFactor: 1,
      overestimateCount: 0,
      underestimateCount: 0,
      accurateCount: 0,
      worstUnderestimates: [],
      worstOverestimates: [],
    };
  }

  const ratios = records.map((r) => r.ratio);
  const averageRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
  const medianRatio = median(ratios);

  let overestimateCount = 0;
  let underestimateCount = 0;
  let accurateCount = 0;

  for (const record of records) {
    if (record.ratio < 0.9) {
      overestimateCount++;
    } else if (record.ratio > 1.1) {
      underestimateCount++;
    } else {
      accurateCount++;
    }
  }

  const worstUnderestimates = [...records]
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);
  const worstOverestimates = [...records]
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, 5);

  return {
    sampleSize: records.length,
    averageRatio: Math.round(averageRatio * 100) / 100,
    medianRatio: Math.round(medianRatio * 100) / 100,
    calibrationFactor: Math.round(medianRatio * 100) / 100,
    overestimateCount,
    underestimateCount,
    accurateCount,
    worstUnderestimates,
    worstOverestimates,
  };
}

/**
 * Calculate estimation accuracy grouped by tag.
 * @returns {Object.<string, {sampleSize: number, averageRatio: number, calibrationFactor: number}>}
 */
function calculateAccuracyByTag() {
  const history = loadHistory();
  const records = buildEstimationRecords(history);

  const byTag = {};
  for (const record of records) {
    const tags = record.tags.length > 0 ? record.tags : ['untagged'];
    for (const tag of tags) {
      if (!byTag[tag]) {
        byTag[tag] = [];
      }
      byTag[tag].push(record.ratio);
    }
  }

  const result = {};
  for (const [tag, ratios] of Object.entries(byTag)) {
    const averageRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
    result[tag] = {
      sampleSize: ratios.length,
      averageRatio: Math.round(averageRatio * 100) / 100,
      calibrationFactor: Math.round(median(ratios) * 100) / 100,
    };
  }

  return result;
}

/**
 * Print estimation accuracy summary to console.
 * @returns {void}
 */
function printSummary() {
  const summary = calculateEstimationAccuracy();

  console.log('\n🎯 Task Estimation Accuracy\n');
  console.log('─'.repeat(40));

  if (summary.sampleSize === 0) {
    console.log('\nNo completed tasks with both estimated and actual duration found.');
    console.log('Record estimatedMinutes and actualMinutes on tasks to enable this report.\n');
    return;
  }

  console.log(`\n📊 Overview (${summary.sampleSize} tasks):`);
  console.log(`   Average Ratio:        ${summary.averageRatio}x (actual / estimated)`);
  console.log(`   Median Ratio:         ${summary.medianRatio}x`);
  console.log(`   Suggested Calibration: multiply future estimates by ${summary.calibrationFactor}x`);

  console.log(`\n📈 Breakdown:`);
  console.log(`   Overestimated (>10% under actual... i.e. took less time):  ${summary.overestimateCount}`);
  console.log(`   Underestimated (took 10%+ longer than estimated):         ${summary.underestimateCount}`);
  console.log(`   Accurate (within +/-10%):                                 ${summary.accurateCount}`);

  if (summary.worstUnderestimates.length > 0) {
    console.log(`\n⏱️  Most Underestimated:`);
    for (const r of summary.worstUnderestimates) {
      console.log(`   ${r.title}: est ${r.estimatedMinutes}m -> actual ${r.actualMinutes}m (${r.ratio.toFixed(2)}x)`);
    }
  }

  if (summary.worstOverestimates.length > 0) {
    console.log(`\n⏱️  Most Overestimated:`);
    for (const r of summary.worstOverestimates) {
      console.log(`   ${r.title}: est ${r.estimatedMinutes}m -> actual ${r.actualMinutes}m (${r.ratio.toFixed(2)}x)`);
    }
  }

  console.log('\n' + '─'.repeat(40) + '\n');
}

/**
 * Print per-tag estimation accuracy to console.
 * @returns {void}
 */
function printByTag() {
  const byTag = calculateAccuracyByTag();
  const tags = Object.keys(byTag);

  console.log('\n🏷️  Estimation Accuracy by Tag\n');
  console.log('─'.repeat(40));

  if (tags.length === 0) {
    console.log('\nNo tagged, completed tasks with estimates found.\n');
    return;
  }

  const sortedTags = tags.sort((a, b) => byTag[b].sampleSize - byTag[a].sampleSize);
  for (const tag of sortedTags) {
    const stats = byTag[tag];
    console.log(
      `   ${tag}: ${stats.sampleSize} tasks, avg ${stats.averageRatio}x, calibrate ${stats.calibrationFactor}x`,
    );
  }

  console.log('\n' + '─'.repeat(40) + '\n');
}

/**
 * Export estimation accuracy report as JSON.
 * @param {string} [outputPath] - Optional output file path
 * @returns {void}
 */
function exportReport(outputPath) {
  const exportData = {
    generatedAt: new Date().toISOString(),
    summary: calculateEstimationAccuracy(),
    byTag: calculateAccuracyByTag(),
  };

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`Estimation accuracy report exported to: ${outputPath}`);
  } else {
    console.log(JSON.stringify(exportData, null, 2));
  }
}

/**
 * CLI entry point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Task Estimation Accuracy for get-shit-done

Usage:
  npx get-shit-done estimation-accuracy [options]

Options:
  --summary, -s     Show estimation accuracy summary (default)
  --by-tag, -t      Show accuracy broken down by tag
  --export, -e      Export accuracy report as JSON
  --output <file>   Export to specific file
  --help, -h        Show this help message

Examples:
  npx get-shit-done estimation-accuracy
  npx get-shit-done estimation-accuracy --by-tag
  npx get-shit-done estimation-accuracy --export --output accuracy.json
`);
    return;
  }

  if (args.includes('--by-tag') || args.includes('-t')) {
    printByTag();
    return;
  }

  if (args.includes('--export') || args.includes('-e')) {
    const outputIdx = args.indexOf('--output');
    const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;
    exportReport(outputPath);
    return;
  }

  // Default: show summary
  printSummary();
}

// Export for use as module
module.exports = {
  calculateEstimationAccuracy,
  calculateAccuracyByTag,
  buildEstimationRecords,
  loadHistory,
};

// Run CLI if executed directly
if (require.main === module) {
  main();
}
