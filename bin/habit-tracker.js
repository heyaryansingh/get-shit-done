#!/usr/bin/env node

/**
 * Habit Tracker - Track daily habits and streaks
 * Part of get-shit-done productivity suite
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const HABITS_FILE = path.join(os.homedir(), '.gsd-habits.json');

/**
 * Load habits from file
 */
function loadHabits() {
  try {
    if (fs.existsSync(HABITS_FILE)) {
      const data = fs.readFileSync(HABITS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading habits:', error.message);
  }

  return {
    habits: [],
    completions: {}
  };
}

/**
 * Save habits to file
 */
function saveHabits(data) {
  try {
    fs.writeFileSync(HABITS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving habits:', error.message);
    return false;
  }
}

/**
 * Get today's date string
 */
function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Add a new habit
 */
function addHabit(name, target = 1, unit = 'times') {
  const data = loadHabits();

  const habit = {
    id: `habit_${Date.now()}`,
    name,
    target,
    unit,
    createdAt: new Date().toISOString()
  };

  data.habits.push(habit);

  if (saveHabits(data)) {
    console.log(`✅ Habit added: ${name} (${target} ${unit}/day)`);
    return true;
  }

  return false;
}

/**
 * List all habits
 */
function listHabits() {
  const data = loadHabits();

  if (data.habits.length === 0) {
    console.log('No habits tracked yet. Add one with: gsd habit add <name>');
    return;
  }

  console.log('\n📋 Your Habits:\n');

  data.habits.forEach((habit, index) => {
    const streak = calculateStreak(habit.id, data);
    const todayComplete = isCompletedToday(habit.id, data);

    console.log(
      `${index + 1}. ${todayComplete ? '✅' : '⬜'} ${habit.name} ` +
      `(${habit.target} ${habit.unit}/day) - 🔥 ${streak} day streak`
    );
  });

  console.log('');
}

/**
 * Mark habit as complete for today
 */
function completeHabit(habitId) {
  const data = loadHabits();
  const habit = data.habits.find(h => h.id === habitId || h.name === habitId);

  if (!habit) {
    console.log(`❌ Habit not found: ${habitId}`);
    return false;
  }

  const today = getTodayString();

  if (!data.completions[habit.id]) {
    data.completions[habit.id] = {};
  }

  const current = data.completions[habit.id][today] || 0;
  data.completions[habit.id][today] = current + 1;

  if (saveHabits(data)) {
    const newCount = data.completions[habit.id][today];
    const streak = calculateStreak(habit.id, data);

    if (newCount >= habit.target) {
      console.log(`✅ Habit complete: ${habit.name} (${newCount}/${habit.target}) 🔥 ${streak} days`);
    } else {
      console.log(`📝 Progress: ${habit.name} (${newCount}/${habit.target})`);
    }

    return true;
  }

  return false;
}

/**
 * Calculate streak for a habit
 */
function calculateStreak(habitId, data) {
  const completions = data.completions[habitId] || {};
  const habit = data.habits.find(h => h.id === habitId);

  if (!habit) return 0;

  let streak = 0;
  const today = new Date();

  // Check backwards from today
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    const count = completions[dateStr] || 0;

    if (count >= habit.target) {
      streak++;
    } else if (i > 0) {
      // Allow missing today only
      break;
    }
  }

  return streak;
}

/**
 * Check if habit is completed today
 */
function isCompletedToday(habitId, data) {
  const today = getTodayString();
  const habit = data.habits.find(h => h.id === habitId);

  if (!habit) return false;

  const completions = data.completions[habitId] || {};
  return (completions[today] || 0) >= habit.target;
}

/**
 * Show habit statistics
 */
function showStats() {
  const data = loadHabits();

  if (data.habits.length === 0) {
    console.log('No habits tracked yet.');
    return;
  }

  console.log('\n📊 Habit Statistics:\n');

  data.habits.forEach(habit => {
    const streak = calculateStreak(habit.id, data);
    const completions = data.completions[habit.id] || {};
    const totalDays = Object.keys(completions).length;
    const totalCompletions = Object.values(completions).reduce((a, b) => a + b, 0);

    console.log(`${habit.name}:`);
    console.log(`  🔥 Current streak: ${streak} days`);
    console.log(`  📅 Total active days: ${totalDays}`);
    console.log(`  ✅ Total completions: ${totalCompletions}`);
    console.log('');
  });
}

/**
 * Delete a habit
 */
function deleteHabit(habitId) {
  const data = loadHabits();
  const index = data.habits.findIndex(h => h.id === habitId || h.name === habitId);

  if (index === -1) {
    console.log(`❌ Habit not found: ${habitId}`);
    return false;
  }

  const habit = data.habits[index];
  data.habits.splice(index, 1);
  delete data.completions[habit.id];

  if (saveHabits(data)) {
    console.log(`🗑️  Habit deleted: ${habit.name}`);
    return true;
  }

  return false;
}

/**
 * Main CLI handler
 */
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'add':
      if (args.length < 2) {
        console.log('Usage: gsd habit add <name> [target] [unit]');
        return;
      }
      addHabit(args[1], parseInt(args[2]) || 1, args[3] || 'times');
      break;

    case 'list':
      listHabits();
      break;

    case 'complete':
    case 'done':
      if (args.length < 2) {
        console.log('Usage: gsd habit complete <habit-name-or-id>');
        return;
      }
      completeHabit(args[1]);
      break;

    case 'stats':
      showStats();
      break;

    case 'delete':
    case 'remove':
      if (args.length < 2) {
        console.log('Usage: gsd habit delete <habit-name-or-id>');
        return;
      }
      deleteHabit(args[1]);
      break;

    default:
      console.log(`
📝 Habit Tracker - Track your daily habits

Usage:
  gsd habit add <name> [target] [unit]    Add a new habit
  gsd habit list                           List all habits
  gsd habit complete <name>                Mark habit as complete
  gsd habit stats                          Show habit statistics
  gsd habit delete <name>                  Delete a habit

Examples:
  gsd habit add "Exercise" 1 "session"
  gsd habit add "Read" 30 "minutes"
  gsd habit complete "Exercise"
  gsd habit stats
      `);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  addHabit,
  listHabits,
  completeHabit,
  showStats,
  deleteHabit
};
