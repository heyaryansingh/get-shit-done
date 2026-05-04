#!/usr/bin/env node

/**
 * Time Blocking and Calendar Optimization Utility
 *
 * Features:
 * - Create time blocks for deep work sessions
 * - Analyze calendar utilization and fragmentation
 * - Suggest optimal scheduling based on energy levels
 * - Track time block effectiveness
 * - Generate weekly time-blocking templates
 *
 * Usage:
 *   gsd time-block create --task "Deep Work" --duration 120
 *   gsd time-block analyze --week
 *   gsd time-block optimize
 *   gsd time-block report
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.get-shit-done');
const TIME_BLOCKS_FILE = path.join(CONFIG_DIR, 'time-blocks.json');

// Ensure config directory exists
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

/**
 * Load time blocks from storage
 */
function loadTimeBlocks() {
  if (!fs.existsSync(TIME_BLOCKS_FILE)) {
    return {
      blocks: [],
      templates: getDefaultTemplates(),
      settings: getDefaultSettings(),
    };
  }
  return JSON.parse(fs.readFileSync(TIME_BLOCKS_FILE, 'utf8'));
}

/**
 * Save time blocks to storage
 */
function saveTimeBlocks(data) {
  fs.writeFileSync(TIME_BLOCKS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Default time block templates
 */
function getDefaultTemplates() {
  return {
    deepWork: {
      name: 'Deep Work',
      duration: 120,
      breakAfter: 15,
      preferredTimes: ['09:00', '14:00'],
      category: 'focus',
    },
    meetings: {
      name: 'Meetings',
      duration: 60,
      breakAfter: 5,
      preferredTimes: ['11:00', '15:00'],
      category: 'collaboration',
    },
    shallowWork: {
      name: 'Shallow Work',
      duration: 30,
      breakAfter: 5,
      preferredTimes: ['10:00', '16:00'],
      category: 'admin',
    },
    learning: {
      name: 'Learning',
      duration: 90,
      breakAfter: 10,
      preferredTimes: ['20:00'],
      category: 'growth',
    },
  };
}

/**
 * Default settings
 */
function getDefaultSettings() {
  return {
    workdayStart: '09:00',
    workdayEnd: '18:00',
    peakEnergyHours: ['09:00', '10:00', '11:00', '14:00', '15:00'],
    lowEnergyHours: ['13:00', '16:00', '17:00'],
    minBlockDuration: 25,
    maxDailyBlocks: 6,
  };
}

/**
 * Create a new time block
 */
function createTimeBlock(task, duration, startTime, category = 'focus') {
  const data = loadTimeBlocks();

  const block = {
    id: Date.now().toString(),
    task,
    duration,
    startTime: startTime || new Date().toISOString(),
    category,
    status: 'planned',
    createdAt: new Date().toISOString(),
  };

  data.blocks.push(block);
  saveTimeBlocks(data);

  console.log('✅ Time block created:');
  console.log(`   Task: ${task}`);
  console.log(`   Duration: ${duration} minutes`);
  console.log(`   Start: ${new Date(block.startTime).toLocaleString()}`);
  console.log(`   Category: ${category}`);
}

/**
 * Analyze calendar fragmentation
 */
function analyzeCalendar(options = {}) {
  const data = loadTimeBlocks();
  const { week = false } = options;

  const now = new Date();
  const startDate = week
    ? new Date(now.setDate(now.getDate() - now.getDay()))
    : new Date(now.setHours(0, 0, 0, 0));

  const relevantBlocks = data.blocks.filter(b =>
    new Date(b.startTime) >= startDate
  );

  if (relevantBlocks.length === 0) {
    console.log('📊 No time blocks found for analysis period');
    return;
  }

  // Calculate metrics
  const totalMinutes = relevantBlocks.reduce((sum, b) => sum + b.duration, 0);
  const totalHours = totalMinutes / 60;
  const avgBlockSize = totalMinutes / relevantBlocks.length;

  // Count by category
  const byCategory = {};
  relevantBlocks.forEach(b => {
    byCategory[b.category] = (byCategory[b.category] || 0) + b.duration;
  });

  // Fragmentation score (prefer fewer, longer blocks)
  const fragmentation = relevantBlocks.length / (totalHours || 1);
  const fragmentationScore = Math.max(0, 100 - fragmentation * 10);

  console.log('\n📊 Calendar Analysis');
  console.log('━'.repeat(50));
  console.log(`Period: ${week ? 'This week' : 'Today'}`);
  console.log(`Total blocks: ${relevantBlocks.length}`);
  console.log(`Total time: ${totalHours.toFixed(1)} hours`);
  console.log(`Average block: ${avgBlockSize.toFixed(0)} minutes`);
  console.log(`Fragmentation score: ${fragmentationScore.toFixed(0)}/100`);

  console.log('\n📈 Time by Category:');
  Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, minutes]) => {
      const hours = minutes / 60;
      const percentage = (minutes / totalMinutes) * 100;
      console.log(`   ${category}: ${hours.toFixed(1)}h (${percentage.toFixed(0)}%)`);
    });

  // Recommendations
  console.log('\n💡 Recommendations:');
  if (fragmentationScore < 60) {
    console.log('   ⚠️  High fragmentation - consolidate blocks for better focus');
  }
  if (avgBlockSize < 60) {
    console.log('   ⚠️  Blocks are too short - aim for 60-120 minute focus sessions');
  }
  if (byCategory.focus && byCategory.focus / totalMinutes < 0.4) {
    console.log('   ⚠️  Low focus time - increase deep work blocks');
  }
  if (fragmentationScore >= 80 && avgBlockSize >= 90) {
    console.log('   ✅ Excellent time blocking! Keep it up.');
  }
}

/**
 * Optimize schedule based on energy levels
 */
function optimizeSchedule() {
  const data = loadTimeBlocks();
  const { settings } = data;

  console.log('\n🎯 Schedule Optimization Suggestions');
  console.log('━'.repeat(50));

  console.log('\n⚡ Peak Energy Hours (best for deep work):');
  settings.peakEnergyHours.forEach(time => {
    console.log(`   ${time} - ${addMinutes(time, 120)}`);
  });

  console.log('\n🔋 Low Energy Hours (best for shallow work):');
  settings.lowEnergyHours.forEach(time => {
    console.log(`   ${time} - ${addMinutes(time, 60)}`);
  });

  console.log('\n📋 Suggested Weekly Template:');
  console.log('   Monday:    Deep Work (2h) → Meetings (1h) → Admin (30m)');
  console.log('   Tuesday:   Deep Work (2h) → Learning (90m) → Admin (30m)');
  console.log('   Wednesday: Meetings (2h) → Deep Work (2h)');
  console.log('   Thursday:  Deep Work (2h) → Learning (90m) → Admin (30m)');
  console.log('   Friday:    Deep Work (2h) → Review (1h) → Planning (30m)');

  console.log('\n💡 Best Practices:');
  console.log('   • Schedule deep work during peak energy hours');
  console.log('   • Batch similar tasks together');
  console.log('   • Leave buffer time between blocks');
  console.log('   • Protect your morning for creative work');
  console.log('   • Group meetings on specific days');
}

/**
 * Generate time blocking report
 */
function generateReport() {
  const data = loadTimeBlocks();

  const now = new Date();
  const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
  const weekBlocks = data.blocks.filter(b =>
    new Date(b.startTime) >= weekStart
  );

  if (weekBlocks.length === 0) {
    console.log('📊 No data available for report');
    return;
  }

  const completed = weekBlocks.filter(b => b.status === 'completed');
  const completionRate = (completed.length / weekBlocks.length) * 100;

  const totalPlannedMinutes = weekBlocks.reduce((sum, b) => sum + b.duration, 0);
  const totalCompletedMinutes = completed.reduce((sum, b) => sum + b.duration, 0);

  console.log('\n📊 Time Blocking Report (This Week)');
  console.log('━'.repeat(50));
  console.log(`Blocks planned: ${weekBlocks.length}`);
  console.log(`Blocks completed: ${completed.length}`);
  console.log(`Completion rate: ${completionRate.toFixed(0)}%`);
  console.log(`Time planned: ${(totalPlannedMinutes / 60).toFixed(1)}h`);
  console.log(`Time completed: ${(totalCompletedMinutes / 60).toFixed(1)}h`);

  // Effectiveness score
  const effectiveness = completionRate * (totalCompletedMinutes / totalPlannedMinutes);
  console.log(`\n🎯 Effectiveness Score: ${effectiveness.toFixed(0)}/100`);

  if (effectiveness >= 80) {
    console.log('   ✅ Excellent adherence to time blocks!');
  } else if (effectiveness >= 60) {
    console.log('   👍 Good job! Room for improvement.');
  } else {
    console.log('   ⚠️  Consider reviewing your time blocking strategy');
  }
}

/**
 * Helper: Add minutes to time string
 */
function addMinutes(time, minutes) {
  const [hours, mins] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, mins + minutes);
  return date.toTimeString().substring(0, 5);
}

/**
 * Main CLI handler
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === 'help') {
    console.log(`
Time Blocking & Calendar Optimization

Usage:
  gsd time-block create <task> --duration <minutes> [--time <HH:MM>] [--category <category>]
  gsd time-block analyze [--week]
  gsd time-block optimize
  gsd time-block report
  gsd time-block help

Examples:
  gsd time-block create "Write documentation" --duration 120 --category focus
  gsd time-block analyze --week
  gsd time-block optimize
  gsd time-block report
    `);
    return;
  }

  switch (command) {
    case 'create': {
      const task = args[1];
      const durationIdx = args.indexOf('--duration');
      const timeIdx = args.indexOf('--time');
      const categoryIdx = args.indexOf('--category');

      if (!task || durationIdx === -1) {
        console.error('❌ Usage: time-block create <task> --duration <minutes>');
        process.exit(1);
      }

      const duration = parseInt(args[durationIdx + 1]);
      const startTime = timeIdx !== -1 ? args[timeIdx + 1] : null;
      const category = categoryIdx !== -1 ? args[categoryIdx + 1] : 'focus';

      createTimeBlock(task, duration, startTime, category);
      break;
    }

    case 'analyze': {
      const week = args.includes('--week');
      analyzeCalendar({ week });
      break;
    }

    case 'optimize': {
      optimizeSchedule();
      break;
    }

    case 'report': {
      generateReport();
      break;
    }

    default:
      console.error(`❌ Unknown command: ${command}`);
      console.log('Run "gsd time-block help" for usage information');
      process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = { createTimeBlock, analyzeCalendar, optimizeSchedule, generateReport };
