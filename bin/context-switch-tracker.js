#!/usr/bin/env node

/**
 * Context Switch Tracker - Log task switches and estimate refocus cost
 * Part of get-shit-done productivity suite
 *
 * Attention-residue research suggests each context switch costs roughly
 * 15-23 minutes of diminished focus while the brain disengages from the
 * previous task. This tool logs switches and estimates that cost so
 * fragmented days become visible.
 *
 * Usage:
 *   gsd context-switch log <task> [--project <name>]
 *   gsd context-switch stats [--days <n>]
 *   gsd context-switch today
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const SWITCHES_FILE = path.join(os.homedir(), '.gsd-context-switches.json');
const DEFAULT_SWITCH_COST_MIN = 15;

/**
 * Load switch log from file
 */
function loadSwitches() {
  try {
    if (fs.existsSync(SWITCHES_FILE)) {
      const data = fs.readFileSync(SWITCHES_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading context switch log:', error.message);
  }

  return { switches: [] };
}

/**
 * Save switch log to file
 */
function saveSwitches(data) {
  try {
    fs.writeFileSync(SWITCHES_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving context switch log:', error.message);
    return false;
  }
}

/**
 * Log a new context switch
 */
function logSwitch(task, project = null) {
  if (!task) {
    console.log('Usage: gsd context-switch log <task> [--project <name>]');
    return false;
  }

  const data = loadSwitches();
  const previous = data.switches[data.switches.length - 1] || null;

  const entry = {
    task,
    project,
    timestamp: new Date().toISOString(),
  };
  data.switches.push(entry);

  if (saveSwitches(data)) {
    console.log(`🔀 Logged switch to: ${task}${project ? ` (${project})` : ''}`);
    if (previous) {
      console.log(`   Previous task: ${previous.task}${previous.project ? ` (${previous.project})` : ''}`);
    }
    return true;
  }

  return false;
}

/**
 * Filter switches within the last N days
 */
function filterRecent(switches, days) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return switches.filter((s) => new Date(s.timestamp).getTime() >= cutoff);
}

/**
 * Count occurrences by key, return sorted descending
 */
function tally(items, keyFn) {
  const counts = {};
  items.forEach((item) => {
    const key = keyFn(item);
    if (!key) return;
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

/**
 * Show stats for the last N days
 */
function showStats(days = 7, switchCostMin = DEFAULT_SWITCH_COST_MIN) {
  const data = loadSwitches();
  const recent = filterRecent(data.switches, days);

  const totalSwitches = recent.length;
  const totalCostMin = totalSwitches * switchCostMin;
  const totalCostHours = (totalCostMin / 60).toFixed(1);
  const avgPerDay = (totalSwitches / days).toFixed(1);

  console.log(`\n🔀 Context Switch Stats (last ${days} day${days === 1 ? '' : 's'})\n`);
  console.log(`Total switches:      ${totalSwitches}`);
  console.log(`Average per day:     ${avgPerDay}`);
  console.log(`Estimated cost:      ${totalCostMin} min (~${totalCostHours}h) at ${switchCostMin} min/switch`);

  const byTask = tally(recent, (s) => s.task);
  if (byTask.length > 0) {
    console.log('\nMost switched-to tasks:');
    byTask.slice(0, 5).forEach(([task, count]) => {
      console.log(`  ${task}: ${count}`);
    });
  }

  const byProject = tally(recent, (s) => s.project);
  if (byProject.length > 0) {
    console.log('\nMost switched-to projects:');
    byProject.slice(0, 5).forEach(([project, count]) => {
      console.log(`  ${project}: ${count}`);
    });
  }

  if (avgPerDay > 10) {
    console.log('\n⚠️  High switching frequency detected. Consider batching similar tasks together.');
  }
}

/**
 * Show a quick summary of today's switches
 */
function showToday(switchCostMin = DEFAULT_SWITCH_COST_MIN) {
  const data = loadSwitches();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const todaySwitches = data.switches.filter(
    (s) => new Date(s.timestamp).getTime() >= startOfDay.getTime()
  );

  console.log(`\n📅 Today's Context Switches\n`);
  console.log(`Switches:        ${todaySwitches.length}`);
  console.log(`Estimated cost:  ${todaySwitches.length * switchCostMin} min`);

  if (todaySwitches.length > 0) {
    console.log('\nTimeline:');
    todaySwitches.forEach((s) => {
      const time = new Date(s.timestamp).toLocaleTimeString();
      console.log(`  ${time}  ${s.task}${s.project ? ` (${s.project})` : ''}`);
    });
  }
}

// Main CLI
const args = process.argv.slice(2);
const command = args[0];

function getFlagValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

switch (command) {
  case 'log': {
    const task = args[1] && !args[1].startsWith('--') ? args[1] : null;
    const project = getFlagValue('--project');
    logSwitch(task, project);
    break;
  }
  case 'stats': {
    const days = parseInt(getFlagValue('--days'), 10) || 7;
    showStats(days);
    break;
  }
  case 'today':
    showToday();
    break;
  default:
    console.log('Usage: gsd context-switch [log|stats|today]');
    console.log('');
    console.log('Commands:');
    console.log('  log <task> [--project <name>]   Log a switch to a new task');
    console.log('  stats [--days <n>]               Show switch stats (default: 7 days)');
    console.log('  today                            Show today\'s switch timeline');
    process.exit(1);
}
