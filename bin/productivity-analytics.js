#!/usr/bin/env node
/**
 * @fileoverview Productivity Analytics - Track and analyze task completion patterns
 * @module bin/productivity-analytics
 *
 * Provides analytics for task completion patterns, productivity metrics,
 * and insights to help improve workflow efficiency.
 *
 * @example
 * ```bash
 * # Show productivity summary
 * npx get-shit-done analytics
 *
 * # Show weekly report
 * npx get-shit-done analytics --weekly
 *
 * # Export analytics as JSON
 * npx get-shit-done analytics --export
 * ```
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Path to analytics data file
 * @type {string}
 */
const ANALYTICS_FILE = path.join(os.homedir(), '.get-shit-done', 'analytics.json');

/**
 * Path to tasks history file
 * @type {string}
 */
const HISTORY_FILE = path.join(os.homedir(), '.get-shit-done', 'history.json');

/**
 * @typedef {Object} TaskRecord
 * @property {string} id - Unique task identifier
 * @property {string} title - Task title
 * @property {string} status - Task status (completed, pending, cancelled)
 * @property {string} createdAt - ISO timestamp when task was created
 * @property {string} [completedAt] - ISO timestamp when task was completed
 * @property {number} [estimatedMinutes] - Estimated duration in minutes
 * @property {number} [actualMinutes] - Actual duration in minutes
 * @property {string[]} [tags] - Task tags/categories
 * @property {number} [priority] - Priority level (1-5)
 */

/**
 * @typedef {Object} DailyStats
 * @property {string} date - Date in YYYY-MM-DD format
 * @property {number} tasksCreated - Tasks created on this day
 * @property {number} tasksCompleted - Tasks completed on this day
 * @property {number} tasksCancelled - Tasks cancelled on this day
 * @property {number} totalMinutesWorked - Total minutes spent on tasks
 * @property {number} averageCompletionTime - Average time to complete tasks
 * @property {string[]} topTags - Most used tags
 */

/**
 * @typedef {Object} AnalyticsSummary
 * @property {number} totalTasks - Total tasks ever created
 * @property {number} completedTasks - Total completed tasks
 * @property {number} completionRate - Percentage of completed tasks
 * @property {number} averageTasksPerDay - Average tasks completed per day
 * @property {number} streakDays - Current streak of productive days
 * @property {number} longestStreak - Longest productivity streak
 * @property {string} mostProductiveDay - Day of week with most completions
 * @property {string} mostProductiveHour - Hour with most completions
 * @property {Object.<string, number>} tagBreakdown - Tasks by tag
 * @property {DailyStats[]} recentDays - Stats for recent days
 */

/**
 * Ensure analytics directory exists
 * @returns {void}
 */
function ensureDirectoryExists() {
  const dir = path.dirname(ANALYTICS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load task history from file
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
 * Load analytics data from file
 * @returns {Object} Analytics data
 */
function loadAnalytics() {
  try {
    if (fs.existsSync(ANALYTICS_FILE)) {
      const data = fs.readFileSync(ANALYTICS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading analytics:', error.message);
  }
  return {
    totalTasks: 0,
    completedTasks: 0,
    dailyStats: {},
    streakData: { current: 0, longest: 0, lastActiveDate: null },
  };
}

/**
 * Save analytics data to file
 * @param {Object} analytics - Analytics data to save
 * @returns {void}
 */
function saveAnalytics(analytics) {
  ensureDirectoryExists();
  fs.writeFileSync(ANALYTICS_FILE, JSON.stringify(analytics, null, 2));
}

/**
 * Record a task event (creation, completion, cancellation)
 *
 * @param {TaskRecord} task - Task record
 * @param {'created' | 'completed' | 'cancelled'} eventType - Type of event
 * @returns {void}
 *
 * @example
 * ```javascript
 * recordTaskEvent({ id: 'task-1', title: 'Fix bug' }, 'completed');
 * ```
 */
function recordTaskEvent(task, eventType) {
  const analytics = loadAnalytics();
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();

  // Initialize daily stats if needed
  if (!analytics.dailyStats[today]) {
    analytics.dailyStats[today] = {
      date: today,
      tasksCreated: 0,
      tasksCompleted: 0,
      tasksCancelled: 0,
      totalMinutesWorked: 0,
      hourlyCompletions: {},
      tags: {},
    };
  }

  const dayStats = analytics.dailyStats[today];

  switch (eventType) {
    case 'created':
      analytics.totalTasks++;
      dayStats.tasksCreated++;
      break;
    case 'completed':
      analytics.completedTasks++;
      dayStats.tasksCompleted++;
      dayStats.hourlyCompletions[hour] = (dayStats.hourlyCompletions[hour] || 0) + 1;
      if (task.actualMinutes) {
        dayStats.totalMinutesWorked += task.actualMinutes;
      }
      break;
    case 'cancelled':
      dayStats.tasksCancelled++;
      break;
  }

  // Track tags
  if (task.tags && task.tags.length > 0) {
    for (const tag of task.tags) {
      dayStats.tags[tag] = (dayStats.tags[tag] || 0) + 1;
    }
  }

  // Update streak
  updateStreak(analytics, today);

  saveAnalytics(analytics);
}

/**
 * Update productivity streak data
 * @param {Object} analytics - Analytics object
 * @param {string} today - Today's date in YYYY-MM-DD format
 */
function updateStreak(analytics, today) {
  const { streakData } = analytics;
  const lastActive = streakData.lastActiveDate;

  if (!lastActive) {
    streakData.current = 1;
    streakData.lastActiveDate = today;
  } else {
    const lastDate = new Date(lastActive);
    const todayDate = new Date(today);
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, no change
    } else if (diffDays === 1) {
      // Consecutive day, increment streak
      streakData.current++;
      streakData.lastActiveDate = today;
    } else {
      // Streak broken, restart
      streakData.current = 1;
      streakData.lastActiveDate = today;
    }
  }

  // Update longest streak
  if (streakData.current > streakData.longest) {
    streakData.longest = streakData.current;
  }
}

/**
 * Calculate comprehensive analytics summary
 * @returns {AnalyticsSummary} Analytics summary
 */
function calculateSummary() {
  const analytics = loadAnalytics();
  const history = loadHistory();

  // Calculate completion rate
  const completionRate = analytics.totalTasks > 0
    ? (analytics.completedTasks / analytics.totalTasks) * 100
    : 0;

  // Calculate tasks per day
  const daysWithActivity = Object.keys(analytics.dailyStats).length;
  const averageTasksPerDay = daysWithActivity > 0
    ? analytics.completedTasks / daysWithActivity
    : 0;

  // Find most productive day of week
  const dayOfWeekStats = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
  const hourStats = {};
  const tagTotals = {};

  for (const [date, stats] of Object.entries(analytics.dailyStats)) {
    const dow = new Date(date).getDay();
    dayOfWeekStats[dow] += stats.tasksCompleted;

    // Aggregate hourly stats
    for (const [hour, count] of Object.entries(stats.hourlyCompletions || {})) {
      hourStats[hour] = (hourStats[hour] || 0) + count;
    }

    // Aggregate tags
    for (const [tag, count] of Object.entries(stats.tags || {})) {
      tagTotals[tag] = (tagTotals[tag] || 0) + count;
    }
  }

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const mostProductiveDow = Object.entries(dayOfWeekStats)
    .sort((a, b) => b[1] - a[1])[0];
  const mostProductiveDay = dayNames[parseInt(mostProductiveDow[0])];

  // Find most productive hour
  const mostProductiveHourEntry = Object.entries(hourStats)
    .sort((a, b) => b[1] - a[1])[0];
  const mostProductiveHour = mostProductiveHourEntry
    ? `${mostProductiveHourEntry[0]}:00`
    : 'N/A';

  // Get recent days (last 7)
  const recentDays = Object.values(analytics.dailyStats)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7)
    .map((day) => ({
      date: day.date,
      tasksCreated: day.tasksCreated,
      tasksCompleted: day.tasksCompleted,
      tasksCancelled: day.tasksCancelled,
      totalMinutesWorked: day.totalMinutesWorked,
      averageCompletionTime: day.tasksCompleted > 0
        ? Math.round(day.totalMinutesWorked / day.tasksCompleted)
        : 0,
      topTags: Object.entries(day.tags || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => tag),
    }));

  return {
    totalTasks: analytics.totalTasks,
    completedTasks: analytics.completedTasks,
    completionRate: Math.round(completionRate * 10) / 10,
    averageTasksPerDay: Math.round(averageTasksPerDay * 10) / 10,
    streakDays: analytics.streakData?.current || 0,
    longestStreak: analytics.streakData?.longest || 0,
    mostProductiveDay,
    mostProductiveHour,
    tagBreakdown: tagTotals,
    recentDays,
  };
}

/**
 * Generate weekly productivity report
 * @returns {Object} Weekly report data
 */
function generateWeeklyReport() {
  const analytics = loadAnalytics();
  const today = new Date();
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const weeklyData = {
    startDate: weekAgo.toISOString().split('T')[0],
    endDate: today.toISOString().split('T')[0],
    totalTasksCompleted: 0,
    totalTasksCreated: 0,
    totalMinutesWorked: 0,
    dailyBreakdown: [],
    insights: [],
  };

  // Collect data for the week
  for (let d = new Date(weekAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dayStats = analytics.dailyStats[dateStr] || {
      date: dateStr,
      tasksCreated: 0,
      tasksCompleted: 0,
      totalMinutesWorked: 0,
    };

    weeklyData.totalTasksCompleted += dayStats.tasksCompleted;
    weeklyData.totalTasksCreated += dayStats.tasksCreated;
    weeklyData.totalMinutesWorked += dayStats.totalMinutesWorked;
    weeklyData.dailyBreakdown.push({
      date: dateStr,
      completed: dayStats.tasksCompleted,
      created: dayStats.tasksCreated,
      minutes: dayStats.totalMinutesWorked,
    });
  }

  // Generate insights
  const avgDaily = weeklyData.totalTasksCompleted / 7;
  if (avgDaily >= 5) {
    weeklyData.insights.push('Great week! You averaged 5+ tasks per day.');
  } else if (avgDaily >= 3) {
    weeklyData.insights.push('Good progress this week with 3+ tasks per day on average.');
  } else if (avgDaily >= 1) {
    weeklyData.insights.push('Steady week. Consider setting daily task goals to boost productivity.');
  } else {
    weeklyData.insights.push('Quiet week. Try breaking larger tasks into smaller ones.');
  }

  // Check for most productive day
  const bestDay = weeklyData.dailyBreakdown
    .reduce((best, day) => day.completed > best.completed ? day : best, { completed: 0 });
  if (bestDay.completed > 0) {
    weeklyData.insights.push(
      `Most productive day: ${bestDay.date} with ${bestDay.completed} tasks completed.`
    );
  }

  return weeklyData;
}

/**
 * Print productivity summary to console
 * @returns {void}
 */
function printSummary() {
  const summary = calculateSummary();

  console.log('\n📊 Productivity Analytics Summary\n');
  console.log('─'.repeat(40));

  console.log(`\n📈 Overview:`);
  console.log(`   Total Tasks:       ${summary.totalTasks}`);
  console.log(`   Completed:         ${summary.completedTasks}`);
  console.log(`   Completion Rate:   ${summary.completionRate}%`);
  console.log(`   Avg Tasks/Day:     ${summary.averageTasksPerDay}`);

  console.log(`\n🔥 Streaks:`);
  console.log(`   Current Streak:    ${summary.streakDays} days`);
  console.log(`   Longest Streak:    ${summary.longestStreak} days`);

  console.log(`\n⏰ Peak Productivity:`);
  console.log(`   Best Day:          ${summary.mostProductiveDay}`);
  console.log(`   Best Hour:         ${summary.mostProductiveHour}`);

  if (Object.keys(summary.tagBreakdown).length > 0) {
    console.log(`\n🏷️ Top Tags:`);
    const sortedTags = Object.entries(summary.tagBreakdown)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    for (const [tag, count] of sortedTags) {
      console.log(`   ${tag}: ${count} tasks`);
    }
  }

  if (summary.recentDays.length > 0) {
    console.log(`\n📅 Last 7 Days:`);
    for (const day of summary.recentDays) {
      const bar = '█'.repeat(Math.min(day.tasksCompleted, 10));
      console.log(`   ${day.date}: ${bar} ${day.tasksCompleted} completed`);
    }
  }

  console.log('\n' + '─'.repeat(40) + '\n');
}

/**
 * Print weekly report to console
 * @returns {void}
 */
function printWeeklyReport() {
  const report = generateWeeklyReport();

  console.log('\n📅 Weekly Productivity Report\n');
  console.log(`Period: ${report.startDate} to ${report.endDate}`);
  console.log('─'.repeat(40));

  console.log(`\n📊 Week Summary:`);
  console.log(`   Tasks Completed:   ${report.totalTasksCompleted}`);
  console.log(`   Tasks Created:     ${report.totalTasksCreated}`);
  console.log(`   Time Worked:       ${Math.round(report.totalMinutesWorked / 60)} hours`);

  console.log(`\n📆 Daily Breakdown:`);
  for (const day of report.dailyBreakdown) {
    const dayName = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' });
    const bar = '█'.repeat(Math.min(day.completed, 10));
    console.log(`   ${dayName} ${day.date}: ${bar} ${day.completed}`);
  }

  if (report.insights.length > 0) {
    console.log(`\n💡 Insights:`);
    for (const insight of report.insights) {
      console.log(`   • ${insight}`);
    }
  }

  console.log('\n' + '─'.repeat(40) + '\n');
}

/**
 * Export analytics as JSON
 * @param {string} [outputPath] - Optional output file path
 * @returns {void}
 */
function exportAnalytics(outputPath) {
  const summary = calculateSummary();
  const weekly = generateWeeklyReport();

  const exportData = {
    generatedAt: new Date().toISOString(),
    summary,
    weeklyReport: weekly,
  };

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2));
    console.log(`Analytics exported to: ${outputPath}`);
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
Productivity Analytics for get-shit-done

Usage:
  npx get-shit-done analytics [options]

Options:
  --summary, -s     Show productivity summary (default)
  --weekly, -w      Show weekly report
  --export, -e      Export analytics as JSON
  --output <file>   Export to specific file
  --help, -h        Show this help message

Examples:
  npx get-shit-done analytics
  npx get-shit-done analytics --weekly
  npx get-shit-done analytics --export --output analytics.json
`);
    return;
  }

  if (args.includes('--weekly') || args.includes('-w')) {
    printWeeklyReport();
    return;
  }

  if (args.includes('--export') || args.includes('-e')) {
    const outputIdx = args.indexOf('--output');
    const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;
    exportAnalytics(outputPath);
    return;
  }

  // Default: show summary
  printSummary();
}

// Export for use as module
module.exports = {
  recordTaskEvent,
  calculateSummary,
  generateWeeklyReport,
  exportAnalytics,
  loadHistory,
  loadAnalytics,
};

// Run CLI if executed directly
if (require.main === module) {
  main();
}
