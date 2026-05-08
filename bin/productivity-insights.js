#!/usr/bin/env node

/**
 * Productivity Insights Generator
 *
 * Analyzes task completion patterns and provides actionable insights:
 * - Peak productivity hours
 * - Task completion patterns
 * - Procrastination detection
 * - Focus duration trends
 * - Weekly/monthly progress reports
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.get-shit-done');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
const INSIGHTS_FILE = path.join(DATA_DIR, 'insights.json');

/**
 * Load tasks from storage
 */
function loadTasks() {
  if (!fs.existsSync(TASKS_FILE)) {
    return [];
  }
  try {
    const data = fs.readFileSync(TASKS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading tasks:', error.message);
    return [];
  }
}

/**
 * Save insights to storage
 */
function saveInsights(insights) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  fs.writeFileSync(INSIGHTS_FILE, JSON.stringify(insights, null, 2));
}

/**
 * Generate productivity insights
 */
function generateInsights() {
  const tasks = loadTasks();

  if (tasks.length === 0) {
    console.log('⚠️  No tasks found. Start tracking tasks to get insights!');
    return;
  }

  const completedTasks = tasks.filter(t => t.completed);

  if (completedTasks.length === 0) {
    console.log('⚠️  No completed tasks yet. Complete some tasks to see insights!');
    return;
  }

  const insights = {
    generated_at: new Date().toISOString(),
    total_tasks: tasks.length,
    completed_tasks: completedTasks.length,
    completion_rate: (completedTasks.length / tasks.length * 100).toFixed(1),
    insights: []
  };

  // Peak productivity hours
  const peakHours = analyzePeakHours(completedTasks);
  if (peakHours.length > 0) {
    insights.insights.push({
      type: 'peak_hours',
      title: '🕐 Peak Productivity Hours',
      description: `You're most productive at ${peakHours.map(h => formatHour(h)).join(', ')}`,
      actionable: `Schedule your most important tasks during these hours.`,
      confidence: 'high'
    });
  }

  // Task completion patterns
  const patterns = analyzeCompletionPatterns(completedTasks);
  if (patterns.bestDay) {
    insights.insights.push({
      type: 'completion_pattern',
      title: '📅 Best Completion Day',
      description: `You complete ${patterns.bestDay.count} tasks on ${patterns.bestDay.name} on average`,
      actionable: `Plan important work for ${patterns.bestDay.name}s.`,
      confidence: 'medium'
    });
  }

  // Procrastination detection
  const procrastination = detectProcrastination(tasks);
  if (procrastination.score > 0.3) {
    insights.insights.push({
      type: 'procrastination',
      title: '⏰ Procrastination Alert',
      description: `${procrastination.delayedTasks} tasks are overdue or delayed`,
      actionable: `Break large tasks into smaller chunks. Set earlier deadlines.`,
      confidence: 'high'
    });
  }

  // Focus duration trends
  const focusTrends = analyzeFocusDuration(completedTasks);
  if (focusTrends.avgDuration) {
    insights.insights.push({
      type: 'focus_duration',
      title: '⏱️ Focus Duration',
      description: `Average task completion time: ${focusTrends.avgDuration} minutes`,
      actionable: focusTrends.recommendation,
      confidence: 'medium'
    });
  }

  // Weekly progress
  const weeklyProgress = analyzeWeeklyProgress(completedTasks);
  insights.insights.push({
    type: 'weekly_progress',
    title: '📊 Weekly Progress',
    description: `${weeklyProgress.thisWeek} tasks completed this week (${weeklyProgress.change >= 0 ? '+' : ''}${weeklyProgress.change}% vs last week)`,
    actionable: weeklyProgress.thisWeek < weeklyProgress.lastWeek
      ? 'You\'re falling behind. Review your priorities.'
      : 'Great momentum! Keep it up!',
    confidence: 'high'
  });

  // Task priority insights
  const priorityInsights = analyzePriorityDistribution(tasks);
  if (priorityInsights.imbalance) {
    insights.insights.push({
      type: 'priority_balance',
      title: '🎯 Priority Balance',
      description: priorityInsights.description,
      actionable: priorityInsights.recommendation,
      confidence: 'medium'
    });
  }

  // Save insights
  saveInsights(insights);

  // Display insights
  displayInsights(insights);

  return insights;
}

/**
 * Analyze peak productivity hours
 */
function analyzePeakHours(tasks) {
  const hourCounts = {};

  for (const task of tasks) {
    if (!task.completed_at) continue;

    const hour = new Date(task.completed_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  }

  const maxCount = Math.max(...Object.values(hourCounts));
  const peakHours = Object.entries(hourCounts)
    .filter(([, count]) => count === maxCount)
    .map(([hour]) => parseInt(hour));

  return peakHours.slice(0, 3);
}

/**
 * Analyze completion patterns
 */
function analyzeCompletionPatterns(tasks) {
  const dayCounts = {};
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  for (const task of tasks) {
    if (!task.completed_at) continue;

    const day = new Date(task.completed_at).getDay();
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  }

  const maxCount = Math.max(...Object.values(dayCounts), 0);
  const bestDay = Object.entries(dayCounts)
    .map(([day, count]) => ({ day: parseInt(day), name: dayNames[day], count }))
    .find(d => d.count === maxCount);

  return { bestDay };
}

/**
 * Detect procrastination
 */
function detectProcrastination(tasks) {
  const now = new Date();
  let delayedTasks = 0;
  let totalWithDeadline = 0;

  for (const task of tasks) {
    if (!task.deadline) continue;

    totalWithDeadline++;

    const deadline = new Date(task.deadline);
    if (!task.completed && deadline < now) {
      delayedTasks++;
    } else if (task.completed && task.completed_at) {
      const completedAt = new Date(task.completed_at);
      if (completedAt > deadline) {
        delayedTasks++;
      }
    }
  }

  const score = totalWithDeadline > 0 ? delayedTasks / totalWithDeadline : 0;

  return { score, delayedTasks, totalWithDeadline };
}

/**
 * Analyze focus duration
 */
function analyzeFocusDuration(tasks) {
  const durations = [];

  for (const task of tasks) {
    if (!task.created_at || !task.completed_at) continue;

    const created = new Date(task.created_at);
    const completed = new Date(task.completed_at);
    const durationMs = completed - created;
    const durationMin = Math.round(durationMs / (1000 * 60));

    if (durationMin > 0 && durationMin < 480) { // Filter out unrealistic durations
      durations.push(durationMin);
    }
  }

  if (durations.length === 0) {
    return {};
  }

  const avgDuration = Math.round(
    durations.reduce((a, b) => a + b, 0) / durations.length
  );

  let recommendation;
  if (avgDuration < 30) {
    recommendation = 'Consider combining small tasks for better flow.';
  } else if (avgDuration > 120) {
    recommendation = 'Break large tasks into smaller, focused chunks.';
  } else {
    recommendation = 'Your task sizes are well-balanced!';
  }

  return { avgDuration, recommendation };
}

/**
 * Analyze weekly progress
 */
function analyzeWeeklyProgress(tasks) {
  const now = new Date();
  const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

  const thisWeek = tasks.filter(t => {
    if (!t.completed_at) return false;
    const completedAt = new Date(t.completed_at);
    return completedAt >= oneWeekAgo && completedAt <= now;
  }).length;

  const lastWeek = tasks.filter(t => {
    if (!t.completed_at) return false;
    const completedAt = new Date(t.completed_at);
    return completedAt >= twoWeeksAgo && completedAt < oneWeekAgo;
  }).length;

  const change = lastWeek > 0
    ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100)
    : 0;

  return { thisWeek, lastWeek, change };
}

/**
 * Analyze priority distribution
 */
function analyzePriorityDistribution(tasks) {
  const priorityCounts = {
    high: 0,
    medium: 0,
    low: 0
  };

  for (const task of tasks) {
    const priority = (task.priority || 'medium').toLowerCase();
    if (priorityCounts.hasOwnProperty(priority)) {
      priorityCounts[priority]++;
    }
  }

  const total = tasks.length;
  const highPercent = (priorityCounts.high / total) * 100;
  const lowPercent = (priorityCounts.low / total) * 100;

  let imbalance = false;
  let description = '';
  let recommendation = '';

  if (highPercent > 50) {
    imbalance = true;
    description = `${highPercent.toFixed(0)}% of tasks are high priority`;
    recommendation = 'Too many high-priority tasks may cause burnout. Reassess priorities.';
  } else if (lowPercent > 60) {
    imbalance = true;
    description = `${lowPercent.toFixed(0)}% of tasks are low priority`;
    recommendation = 'Focus on higher-impact tasks to drive meaningful progress.';
  }

  return { imbalance, description, recommendation };
}

/**
 * Format hour for display
 */
function formatHour(hour) {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}${period}`;
}

/**
 * Display insights
 */
function displayInsights(insights) {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║       📊 PRODUCTIVITY INSIGHTS               ║');
  console.log('╚═══════════════════════════════════════════════╝\n');

  console.log(`📈 Overall Stats:`);
  console.log(`   • Total Tasks: ${insights.total_tasks}`);
  console.log(`   • Completed: ${insights.completed_tasks} (${insights.completion_rate}%)`);
  console.log(`   • Generated: ${new Date(insights.generated_at).toLocaleString()}\n`);

  for (const insight of insights.insights) {
    console.log(`${insight.title}`);
    console.log(`   ${insight.description}`);
    console.log(`   💡 ${insight.actionable}`);
    console.log(`   Confidence: ${insight.confidence}\n`);
  }

  console.log('─────────────────────────────────────────────────');
  console.log('💾 Insights saved to:', INSIGHTS_FILE);
  console.log('─────────────────────────────────────────────────\n');
}

/**
 * Export insights as JSON
 */
function exportInsights(format = 'json') {
  if (!fs.existsSync(INSIGHTS_FILE)) {
    console.log('⚠️  No insights found. Run insights generation first.');
    return;
  }

  const insights = JSON.parse(fs.readFileSync(INSIGHTS_FILE, 'utf8'));

  if (format === 'json') {
    console.log(JSON.stringify(insights, null, 2));
  } else if (format === 'markdown') {
    console.log(`# Productivity Insights\n`);
    console.log(`Generated: ${new Date(insights.generated_at).toLocaleString()}\n`);
    console.log(`## Overview\n`);
    console.log(`- **Total Tasks**: ${insights.total_tasks}`);
    console.log(`- **Completed**: ${insights.completed_tasks} (${insights.completion_rate}%)\n`);
    console.log(`## Insights\n`);

    for (const insight of insights.insights) {
      console.log(`### ${insight.title}\n`);
      console.log(`${insight.description}\n`);
      console.log(`**Action**: ${insight.actionable}\n`);
      console.log(`**Confidence**: ${insight.confidence}\n`);
    }
  }
}

// CLI
const args = process.argv.slice(2);
const command = args[0] || 'generate';

if (command === 'generate') {
  generateInsights();
} else if (command === 'export') {
  const format = args[1] || 'json';
  exportInsights(format);
} else if (command === 'help') {
  console.log(`
Usage: gsd insights [command] [options]

Commands:
  generate          Generate new productivity insights (default)
  export [format]   Export insights (json or markdown)
  help              Show this help message

Examples:
  gsd insights
  gsd insights generate
  gsd insights export markdown
  `);
} else {
  console.log(`Unknown command: ${command}`);
  console.log('Run "gsd insights help" for usage information.');
}
