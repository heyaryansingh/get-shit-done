#!/usr/bin/env node

/**
 * distraction-analyzer.js - Analyze and track distractions during work sessions
 *
 * Features:
 * - Track distraction events with categories and durations
 * - Analyze distraction patterns by time, day, and type
 * - Identify peak distraction times
 * - Generate distraction reports and recommendations
 *
 * Usage:
 *   gsd distraction log "Checked email" --category communication --duration 5
 *   gsd distraction analyze --period week
 *   gsd distraction report --detailed
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const DATA_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.gsd');
const DISTRACTION_FILE = path.join(DATA_DIR, 'distractions.json');

// Distraction categories
const CATEGORIES = {
  communication: { name: 'Communication', color: 'blue' },
  social_media: { name: 'Social Media', color: 'magenta' },
  browsing: { name: 'Web Browsing', color: 'cyan' },
  notifications: { name: 'Notifications', color: 'yellow' },
  meetings: { name: 'Unplanned Meetings', color: 'red' },
  personal: { name: 'Personal Tasks', color: 'green' },
  other: { name: 'Other', color: 'gray' },
};

/**
 * Ensure data directory and file exist
 */
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DISTRACTION_FILE)) {
    fs.writeFileSync(DISTRACTION_FILE, JSON.stringify({ distractions: [] }, null, 2));
  }
}

/**
 * Load distraction data
 */
function loadDistractions() {
  ensureDataFile();
  const data = fs.readFileSync(DISTRACTION_FILE, 'utf8');
  return JSON.parse(data);
}

/**
 * Save distraction data
 */
function saveDistractions(data) {
  ensureDataFile();
  fs.writeFileSync(DISTRACTION_FILE, JSON.stringify(data, null, 2));
}

/**
 * Log a distraction event
 */
function logDistraction(description, category, duration) {
  const data = loadDistractions();

  const distraction = {
    id: Date.now().toString(),
    description: description,
    category: category || 'other',
    duration: parseInt(duration) || 0, // minutes
    timestamp: new Date().toISOString(),
    date: new Date().toISOString().split('T')[0],
    hour: new Date().getHours(),
    dayOfWeek: new Date().getDay(),
  };

  data.distractions.push(distraction);
  saveDistractions(data);

  const cat = CATEGORIES[distraction.category] || CATEGORIES.other;
  console.log(chalk.green('✓ Distraction logged:'));
  console.log(chalk[cat.color](`  ${cat.name}`));
  console.log(`  "${description}"`);
  console.log(`  Duration: ${duration} minutes`);
}

/**
 * Analyze distractions for a given period
 */
function analyzeDistractions(period = 'week') {
  const data = loadDistractions();
  const now = new Date();

  // Calculate date range
  let startDate;
  switch (period) {
    case 'day':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      startDate = new Date(0); // All time
  }

  // Filter distractions
  const filtered = data.distractions.filter(
    (d) => new Date(d.timestamp) >= startDate
  );

  if (filtered.length === 0) {
    console.log(chalk.yellow(`No distractions logged in the past ${period}.`));
    return;
  }

  // Calculate statistics
  const totalDistractions = filtered.length;
  const totalMinutes = filtered.reduce((sum, d) => sum + d.duration, 0);
  const avgDuration = totalMinutes / totalDistractions;

  // By category
  const byCategory = {};
  filtered.forEach((d) => {
    if (!byCategory[d.category]) {
      byCategory[d.category] = { count: 0, duration: 0 };
    }
    byCategory[d.category].count++;
    byCategory[d.category].duration += d.duration;
  });

  // By hour
  const byHour = {};
  for (let h = 0; h < 24; h++) {
    byHour[h] = 0;
  }
  filtered.forEach((d) => {
    byHour[d.hour] = (byHour[d.hour] || 0) + 1;
  });

  // By day of week
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const byDay = {};
  dayNames.forEach((day) => (byDay[day] = 0));
  filtered.forEach((d) => {
    byDay[dayNames[d.dayOfWeek]]++;
  });

  // Display results
  console.log(chalk.bold(`\n📊 Distraction Analysis (${period})`));
  console.log(chalk.gray('─'.repeat(60)));

  console.log(chalk.bold('\nOverall Statistics:'));
  console.log(`  Total Distractions: ${totalDistractions}`);
  console.log(`  Total Time Lost: ${Math.round(totalMinutes)} minutes (${(totalMinutes / 60).toFixed(1)} hours)`);
  console.log(`  Average Duration: ${avgDuration.toFixed(1)} minutes`);

  console.log(chalk.bold('\nBy Category:'));
  Object.entries(byCategory)
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([category, stats]) => {
      const cat = CATEGORIES[category] || CATEGORIES.other;
      const percentage = ((stats.count / totalDistractions) * 100).toFixed(1);
      console.log(
        chalk[cat.color](
          `  ${cat.name.padEnd(20)} ${stats.count.toString().padStart(3)} (${percentage}%)  ${stats.duration} min`
        )
      );
    });

  // Peak distraction hour
  const peakHour = Object.entries(byHour).reduce((max, [hour, count]) =>
    count > max.count ? { hour: parseInt(hour), count } : max
  , { hour: 0, count: 0 });

  console.log(chalk.bold('\nPeak Distraction Time:'));
  console.log(
    `  ${peakHour.hour}:00 - ${peakHour.hour + 1}:00  (${peakHour.count} distractions)`
  );

  // Most distracting day
  const peakDay = Object.entries(byDay).reduce((max, [day, count]) =>
    count > max.count ? { day, count } : max
  , { day: '', count: 0 });

  console.log(chalk.bold('\nMost Distracting Day:'));
  console.log(`  ${peakDay.day}  (${peakDay.count} distractions)`);

  console.log();
}

/**
 * Generate detailed distraction report
 */
function generateReport(detailed = false) {
  const data = loadDistractions();

  if (data.distractions.length === 0) {
    console.log(chalk.yellow('No distraction data available yet.'));
    return;
  }

  console.log(chalk.bold('\n📈 Distraction Report'));
  console.log(chalk.gray('─'.repeat(60)));

  // Analyze multiple periods
  ['day', 'week', 'month'].forEach((period) => {
    analyzeDistractions(period);
  });

  // Recommendations
  console.log(chalk.bold('\n💡 Recommendations:'));

  const weekData = data.distractions.filter(
    (d) =>
      new Date(d.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  );

  if (weekData.length === 0) {
    console.log(chalk.gray('  Not enough data for recommendations.'));
    return;
  }

  const totalWeekMinutes = weekData.reduce((sum, d) => sum + d.duration, 0);
  const avgPerDay = totalWeekMinutes / 7;

  if (avgPerDay > 60) {
    console.log(
      chalk.red(
        '  ⚠ High distraction rate: You\'re losing over 1 hour per day to distractions.'
      )
    );
  }

  // Category-specific recommendations
  const byCategory = {};
  weekData.forEach((d) => {
    byCategory[d.category] = (byCategory[d.category] || 0) + 1;
  });

  const topCategory = Object.entries(byCategory).sort(
    (a, b) => b[1] - a[1]
  )[0];

  if (topCategory) {
    const [category, count] = topCategory;
    const cat = CATEGORIES[category] || CATEGORIES.other;

    console.log(
      chalk.yellow(`  • Focus on reducing ${cat.name.toLowerCase()} distractions (${count} this week).`)
    );

    // Category-specific tips
    switch (category) {
      case 'communication':
        console.log(
          '    Tip: Schedule specific times for checking emails and messages.'
        );
        break;
      case 'social_media':
        console.log(
          '    Tip: Use website blockers during deep work sessions.'
        );
        break;
      case 'notifications':
        console.log(
          '    Tip: Enable Do Not Disturb mode during focused work.'
        );
        break;
      case 'meetings':
        console.log(
          '    Tip: Block calendar time for deep work to avoid interruptions.'
        );
        break;
    }
  }

  // Peak hour recommendation
  const byHour = {};
  weekData.forEach((d) => {
    byHour[d.hour] = (byHour[d.hour] || 0) + 1;
  });

  const peakHour = Object.entries(byHour).reduce(
    (max, [hour, count]) =>
      count > max.count ? { hour: parseInt(hour), count } : max,
    { hour: 0, count: 0 }
  );

  if (peakHour.count > 5) {
    console.log(
      chalk.yellow(
        `  • Schedule your most important work outside of ${peakHour.hour}:00-${peakHour.hour + 1}:00.`
      )
    );
  }

  console.log();

  if (detailed) {
    console.log(chalk.bold('Recent Distractions:'));
    data.distractions
      .slice(-10)
      .reverse()
      .forEach((d) => {
        const cat = CATEGORIES[d.category] || CATEGORIES.other;
        const time = new Date(d.timestamp).toLocaleString();
        console.log(chalk[cat.color](`  [${time}] ${d.description} (${d.duration} min)`));
      });
    console.log();
  }
}

/**
 * Clear distraction history
 */
function clearHistory(confirm = false) {
  if (!confirm) {
    console.log(chalk.yellow('⚠ Use --confirm to clear all distraction history.'));
    return;
  }

  saveDistractions({ distractions: [] });
  console.log(chalk.green('✓ Distraction history cleared.'));
}

/**
 * Show help
 */
function showHelp() {
  console.log(chalk.bold('\n📍 Distraction Analyzer'));
  console.log(chalk.gray('Track and analyze distractions to improve focus.\n'));

  console.log(chalk.bold('Commands:'));
  console.log('  log <description>         Log a distraction event');
  console.log('    --category <type>       Category (communication, social_media, browsing, etc.)');
  console.log('    --duration <minutes>    Duration in minutes');
  console.log('');
  console.log('  analyze                   Analyze distractions');
  console.log('    --period <day|week|month>  Analysis period (default: week)');
  console.log('');
  console.log('  report                    Generate comprehensive report');
  console.log('    --detailed              Include recent distraction list');
  console.log('');
  console.log('  clear                     Clear distraction history');
  console.log('    --confirm               Confirm deletion');
  console.log('');
  console.log(chalk.bold('Categories:'));
  Object.entries(CATEGORIES).forEach(([key, cat]) => {
    console.log(chalk[cat.color](`  ${key.padEnd(20)} ${cat.name}`));
  });
  console.log();
}

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  showHelp();
  process.exit(0);
}

// Extract options
function getOption(name, defaultValue = null) {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && args[index + 1]) {
    return args[index + 1];
  }
  return defaultValue;
}

function hasFlag(name) {
  return args.includes(`--${name}`);
}

try {
  switch (command) {
    case 'log':
      const description = args.slice(1).find((arg) => !arg.startsWith('--')) || '';
      const category = getOption('category', 'other');
      const duration = getOption('duration', '0');

      if (!description) {
        console.log(chalk.red('Error: Description required.'));
        console.log('Usage: gsd distraction log <description> --category <type> --duration <minutes>');
        process.exit(1);
      }

      if (!CATEGORIES[category]) {
        console.log(chalk.red(`Error: Invalid category "${category}".`));
        console.log(`Valid categories: ${Object.keys(CATEGORIES).join(', ')}`);
        process.exit(1);
      }

      logDistraction(description, category, duration);
      break;

    case 'analyze':
      const period = getOption('period', 'week');
      analyzeDistractions(period);
      break;

    case 'report':
      const detailed = hasFlag('detailed');
      generateReport(detailed);
      break;

    case 'clear':
      const confirm = hasFlag('confirm');
      clearHistory(confirm);
      break;

    default:
      console.log(chalk.red(`Unknown command: ${command}`));
      console.log('Run "gsd distraction help" for usage information.');
      process.exit(1);
  }
} catch (error) {
  console.error(chalk.red(`Error: ${error.message}`));
  process.exit(1);
}
