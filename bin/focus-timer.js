#!/usr/bin/env node
/**
 * @fileoverview Pomodoro Focus Timer for get-shit-done
 * @module bin/focus-timer
 *
 * A productivity timer implementing the Pomodoro Technique:
 * - 25-minute focused work sessions
 * - 5-minute short breaks
 * - 15-minute long breaks (after 4 pomodoros)
 * - Session tracking and statistics
 *
 * @example
 * ```bash
 * # Start a focus session
 * npx get-shit-done focus
 *
 * # Custom duration (in minutes)
 * npx get-shit-done focus --duration 30
 *
 * # Show stats
 * npx get-shit-done focus --stats
 * ```
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

/**
 * Path to focus session data file
 * @type {string}
 */
const FOCUS_FILE = path.join(os.homedir(), '.get-shit-done', 'focus-sessions.json');

/**
 * Default timer settings (in minutes)
 */
const DEFAULTS = {
  focusDuration: 25,
  shortBreak: 5,
  longBreak: 15,
  pomodorosForLongBreak: 4,
};

/**
 * @typedef {Object} FocusSession
 * @property {string} id - Session identifier
 * @property {string} startTime - ISO timestamp
 * @property {string} [endTime] - ISO timestamp when completed
 * @property {number} duration - Duration in minutes
 * @property {string} type - 'focus' | 'short_break' | 'long_break'
 * @property {boolean} completed - Whether session was completed
 * @property {string} [taskId] - Associated task ID
 * @property {string} [notes] - Session notes
 */

/**
 * @typedef {Object} FocusStats
 * @property {number} totalSessions - Total focus sessions
 * @property {number} completedSessions - Completed sessions
 * @property {number} totalMinutes - Total focus minutes
 * @property {number} todayMinutes - Minutes focused today
 * @property {number} currentStreak - Current daily streak
 * @property {number} longestStreak - Longest daily streak
 * @property {number} avgSessionLength - Average session length
 * @property {Object.<string, number>} dailyTotals - Minutes by date
 */

/**
 * Ensure data directory exists
 * @returns {void}
 */
function ensureDirectoryExists() {
  const dir = path.dirname(FOCUS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load focus session data
 * @returns {Object} Focus data
 */
function loadFocusData() {
  try {
    if (fs.existsSync(FOCUS_FILE)) {
      const data = fs.readFileSync(FOCUS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading focus data:', error.message);
  }
  return {
    sessions: [],
    settings: { ...DEFAULTS },
    streakData: { current: 0, longest: 0, lastActiveDate: null },
  };
}

/**
 * Save focus session data
 * @param {Object} data - Data to save
 */
function saveFocusData(data) {
  ensureDirectoryExists();
  fs.writeFileSync(FOCUS_FILE, JSON.stringify(data, null, 2));
}

/**
 * Generate unique session ID
 * @returns {string} Session ID
 */
function generateSessionId() {
  return `focus_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Format duration for display
 * @param {number} seconds - Duration in seconds
 * @returns {string} Formatted string (MM:SS)
 */
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Update streak data
 * @param {Object} focusData - Focus data object
 * @param {string} today - Today's date (YYYY-MM-DD)
 */
function updateStreak(focusData, today) {
  const { streakData } = focusData;
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
      streakData.current++;
      streakData.lastActiveDate = today;
    } else {
      streakData.current = 1;
      streakData.lastActiveDate = today;
    }
  }

  if (streakData.current > streakData.longest) {
    streakData.longest = streakData.current;
  }
}

/**
 * Start a focus timer session
 * @param {Object} options - Timer options
 * @param {number} [options.duration] - Duration in minutes
 * @param {string} [options.type] - Session type
 * @param {string} [options.taskId] - Associated task
 * @returns {Promise<FocusSession>} Completed session
 */
async function startTimer(options = {}) {
  const focusData = loadFocusData();
  const duration = options.duration || focusData.settings.focusDuration;
  const type = options.type || 'focus';
  const totalSeconds = duration * 60;

  const session = {
    id: generateSessionId(),
    startTime: new Date().toISOString(),
    duration,
    type,
    completed: false,
    taskId: options.taskId || null,
  };

  console.log('\n🍅 Focus Timer Started');
  console.log('─'.repeat(40));
  console.log(`Duration: ${duration} minutes`);
  console.log(`Type: ${type.replace('_', ' ')}`);
  console.log('\nPress Ctrl+C to cancel\n');

  // Set up input handling for early termination
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let cancelled = false;
  let remainingSeconds = totalSeconds;

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    cancelled = true;
    console.log('\n\n⏹️  Timer cancelled');
  });

  // Timer loop with progress display
  const startTime = Date.now();

  while (remainingSeconds > 0 && !cancelled) {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    remainingSeconds = Math.max(0, totalSeconds - elapsed);

    // Progress bar
    const progress = (totalSeconds - remainingSeconds) / totalSeconds;
    const barLength = 30;
    const filled = Math.floor(progress * barLength);
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled);

    // Display timer (overwrite line)
    process.stdout.write(
      `\r⏱️  ${formatDuration(remainingSeconds)} remaining  [${bar}] ${Math.floor(progress * 100)}%`
    );

    // Wait 1 second
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('\n');

  rl.close();

  // Complete session
  session.endTime = new Date().toISOString();
  session.completed = !cancelled;

  // Save session
  focusData.sessions.push(session);

  // Update streak if focus session completed
  if (session.completed && type === 'focus') {
    const today = new Date().toISOString().split('T')[0];
    updateStreak(focusData, today);
  }

  saveFocusData(focusData);

  // Show completion message
  if (session.completed) {
    console.log('✅ Focus session completed!');
    playNotificationSound();

    // Count completed pomodoros today
    const today = new Date().toISOString().split('T')[0];
    const todayPomodoros = focusData.sessions.filter(
      (s) =>
        s.completed &&
        s.type === 'focus' &&
        s.startTime.startsWith(today)
    ).length;

    console.log(`🍅 Today's pomodoros: ${todayPomodoros}`);

    // Suggest break
    if (type === 'focus') {
      const isLongBreak = todayPomodoros % focusData.settings.pomodorosForLongBreak === 0;
      const breakDuration = isLongBreak
        ? focusData.settings.longBreak
        : focusData.settings.shortBreak;
      const breakType = isLongBreak ? 'long' : 'short';

      console.log(`\n💡 Suggestion: Take a ${breakDuration}-minute ${breakType} break`);
      console.log(`   Run: npx get-shit-done focus --break ${breakType}`);
    }
  }

  return session;
}

/**
 * Play notification sound (cross-platform)
 */
function playNotificationSound() {
  // Bell character for terminal
  process.stdout.write('\x07');
}

/**
 * Calculate focus statistics
 * @returns {FocusStats} Statistics object
 */
function calculateStats() {
  const focusData = loadFocusData();
  const { sessions, streakData } = focusData;

  const focusSessions = sessions.filter((s) => s.type === 'focus');
  const completedFocus = focusSessions.filter((s) => s.completed);

  const totalMinutes = completedFocus.reduce((sum, s) => sum + s.duration, 0);

  // Today's focus time
  const today = new Date().toISOString().split('T')[0];
  const todaySessions = completedFocus.filter((s) => s.startTime.startsWith(today));
  const todayMinutes = todaySessions.reduce((sum, s) => sum + s.duration, 0);

  // Daily totals (last 7 days)
  const dailyTotals = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];

    const dayMinutes = completedFocus
      .filter((s) => s.startTime.startsWith(dateStr))
      .reduce((sum, s) => sum + s.duration, 0);

    dailyTotals[dateStr] = dayMinutes;
  }

  // Average session length
  const avgSessionLength = completedFocus.length > 0
    ? totalMinutes / completedFocus.length
    : 0;

  return {
    totalSessions: focusSessions.length,
    completedSessions: completedFocus.length,
    totalMinutes,
    todayMinutes,
    todayPomodoros: todaySessions.length,
    currentStreak: streakData.current,
    longestStreak: streakData.longest,
    avgSessionLength: Math.round(avgSessionLength * 10) / 10,
    dailyTotals,
    completionRate: focusSessions.length > 0
      ? Math.round((completedFocus.length / focusSessions.length) * 100)
      : 0,
  };
}

/**
 * Print focus statistics
 */
function printStats() {
  const stats = calculateStats();

  console.log('\n🍅 Focus Timer Statistics\n');
  console.log('─'.repeat(40));

  console.log('\n📊 Overall:');
  console.log(`   Total Sessions:     ${stats.totalSessions}`);
  console.log(`   Completed:          ${stats.completedSessions}`);
  console.log(`   Completion Rate:    ${stats.completionRate}%`);
  console.log(`   Total Focus Time:   ${Math.floor(stats.totalMinutes / 60)}h ${stats.totalMinutes % 60}m`);
  console.log(`   Avg Session Length: ${stats.avgSessionLength} min`);

  console.log('\n📅 Today:');
  console.log(`   Focus Time:         ${stats.todayMinutes} minutes`);
  console.log(`   Pomodoros:          ${stats.todayPomodoros}`);

  console.log('\n🔥 Streaks:');
  console.log(`   Current Streak:     ${stats.currentStreak} days`);
  console.log(`   Longest Streak:     ${stats.longestStreak} days`);

  console.log('\n📈 Last 7 Days:');
  const sortedDays = Object.entries(stats.dailyTotals).sort((a, b) => b[0].localeCompare(a[0]));
  for (const [date, minutes] of sortedDays) {
    const pomodoros = Math.floor(minutes / 25);
    const bar = '🍅'.repeat(Math.min(pomodoros, 10)) || '○';
    console.log(`   ${date}: ${bar} (${minutes} min)`);
  }

  console.log('\n' + '─'.repeat(40) + '\n');
}

/**
 * Update timer settings
 * @param {Object} newSettings - Settings to update
 */
function updateSettings(newSettings) {
  const focusData = loadFocusData();
  focusData.settings = { ...focusData.settings, ...newSettings };
  saveFocusData(focusData);
  console.log('Settings updated:', focusData.settings);
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
🍅 Focus Timer for get-shit-done

Usage:
  npx get-shit-done focus [options]

Commands:
  (default)         Start a focus session (25 min)
  --stats, -s       Show focus statistics
  --settings        Show current settings
  --help, -h        Show this help message

Options:
  --duration <min>  Set custom duration (minutes)
  --break short     Start a short break (5 min)
  --break long      Start a long break (15 min)
  --task <id>       Associate with a task ID

Settings:
  --set-focus <min>       Set default focus duration
  --set-short-break <min> Set short break duration
  --set-long-break <min>  Set long break duration
  --set-pomodoros <n>     Pomodoros before long break

Examples:
  npx get-shit-done focus
  npx get-shit-done focus --duration 30
  npx get-shit-done focus --break short
  npx get-shit-done focus --stats
  npx get-shit-done focus --set-focus 30
`);
}

/**
 * Parse command line arguments
 * @param {string[]} args - CLI arguments
 * @returns {Object} Parsed options
 */
function parseArgs(args) {
  const options = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        options.help = true;
        break;
      case '--stats':
      case '-s':
        options.stats = true;
        break;
      case '--settings':
        options.showSettings = true;
        break;
      case '--duration':
        options.duration = parseInt(args[++i], 10);
        break;
      case '--break':
        const breakType = args[++i];
        options.type = breakType === 'long' ? 'long_break' : 'short_break';
        options.duration = breakType === 'long'
          ? loadFocusData().settings.longBreak
          : loadFocusData().settings.shortBreak;
        break;
      case '--task':
        options.taskId = args[++i];
        break;
      case '--set-focus':
        options.setFocus = parseInt(args[++i], 10);
        break;
      case '--set-short-break':
        options.setShortBreak = parseInt(args[++i], 10);
        break;
      case '--set-long-break':
        options.setLongBreak = parseInt(args[++i], 10);
        break;
      case '--set-pomodoros':
        options.setPomodoros = parseInt(args[++i], 10);
        break;
    }
  }

  return options;
}

/**
 * CLI entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  if (options.help) {
    printHelp();
    return;
  }

  if (options.stats) {
    printStats();
    return;
  }

  if (options.showSettings) {
    const focusData = loadFocusData();
    console.log('\nCurrent Settings:');
    console.log(JSON.stringify(focusData.settings, null, 2));
    return;
  }

  // Handle settings updates
  const settingsUpdates = {};
  if (options.setFocus) settingsUpdates.focusDuration = options.setFocus;
  if (options.setShortBreak) settingsUpdates.shortBreak = options.setShortBreak;
  if (options.setLongBreak) settingsUpdates.longBreak = options.setLongBreak;
  if (options.setPomodoros) settingsUpdates.pomodorosForLongBreak = options.setPomodoros;

  if (Object.keys(settingsUpdates).length > 0) {
    updateSettings(settingsUpdates);
    return;
  }

  // Start timer
  try {
    await startTimer({
      duration: options.duration,
      type: options.type || 'focus',
      taskId: options.taskId,
    });
  } catch (error) {
    console.error('Timer error:', error.message);
    process.exit(1);
  }
}

// Export for use as module
module.exports = {
  startTimer,
  calculateStats,
  updateSettings,
  loadFocusData,
  saveFocusData,
};

// Run CLI if executed directly
if (require.main === module) {
  main().catch(console.error);
}
