#!/usr/bin/env node

/**
 * Goal Tracker - Track and visualize long-term goals
 * Part of get-shit-done productivity suite
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const GOALS_FILE = path.join(os.homedir(), '.gsd-goals.json');

/**
 * Load goals from file
 */
function loadGoals() {
  try {
    if (fs.existsSync(GOALS_FILE)) {
      const data = fs.readFileSync(GOALS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading goals:', error.message);
  }

  return { goals: [] };
}

/**
 * Save goals to file
 */
function saveGoals(data) {
  try {
    fs.writeFileSync(GOALS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving goals:', error.message);
    return false;
  }
}

/**
 * Add a new goal
 */
function addGoal(name, deadline, category = 'personal') {
  const data = loadGoals();

  const goal = {
    id: `goal_${Date.now()}`,
    name,
    deadline: deadline ? new Date(deadline).toISOString() : null,
    category,
    progress: 0,
    milestones: [],
    createdAt: new Date().toISOString(),
    status: 'in-progress'
  };

  data.goals.push(goal);

  if (saveGoals(data)) {
    console.log(`🎯 Goal added: ${name}`);
    if (deadline) {
      const daysRemaining = getDaysRemaining(deadline);
      console.log(`   Deadline: ${deadline} (${daysRemaining} days remaining)`);
    }
    return true;
  }

  return false;
}

/**
 * List all goals
 */
function listGoals(filterCategory = null) {
  const data = loadGoals();
  let goals = data.goals;

  if (filterCategory) {
    goals = goals.filter(g => g.category === filterCategory);
  }

  if (goals.length === 0) {
    console.log('No goals set yet. Add one with: gsd goal add <name> <deadline>');
    return;
  }

  console.log('\n🎯 Your Goals:\n');

  goals.forEach((goal, index) => {
    const statusIcon = getStatusIcon(goal);
    const progressBar = getProgressBar(goal.progress);
    const daysRemaining = goal.deadline ? getDaysRemaining(goal.deadline) : null;

    console.log(`${index + 1}. ${statusIcon} ${goal.name} [${goal.category}]`);
    console.log(`   ${progressBar} ${goal.progress}%`);

    if (daysRemaining !== null) {
      const urgency = daysRemaining < 7 ? '⚠️  ' : '';
      console.log(`   ${urgency}${daysRemaining} days remaining`);
    }

    if (goal.milestones.length > 0) {
      const completed = goal.milestones.filter(m => m.completed).length;
      console.log(`   📊 Milestones: ${completed}/${goal.milestones.length} complete`);
    }

    console.log('');
  });
}

/**
 * Update goal progress
 */
function updateProgress(goalId, progress) {
  const data = loadGoals();
  const goal = data.goals.find(g => g.id === goalId || g.name === goalId);

  if (!goal) {
    console.log(`❌ Goal not found: ${goalId}`);
    return false;
  }

  const oldProgress = goal.progress;
  goal.progress = Math.min(100, Math.max(0, progress));

  if (goal.progress === 100) {
    goal.status = 'completed';
    goal.completedAt = new Date().toISOString();
  }

  if (saveGoals(data)) {
    console.log(`📈 Progress updated: ${goal.name}`);
    console.log(`   ${oldProgress}% → ${goal.progress}%`);

    if (goal.progress === 100) {
      console.log('   🎉 Goal completed!');
    }

    return true;
  }

  return false;
}

/**
 * Add a milestone to a goal
 */
function addMilestone(goalId, milestoneName) {
  const data = loadGoals();
  const goal = data.goals.find(g => g.id === goalId || g.name === goalId);

  if (!goal) {
    console.log(`❌ Goal not found: ${goalId}`);
    return false;
  }

  const milestone = {
    id: `milestone_${Date.now()}`,
    name: milestoneName,
    completed: false,
    createdAt: new Date().toISOString()
  };

  goal.milestones.push(milestone);

  if (saveGoals(data)) {
    console.log(`✅ Milestone added to "${goal.name}": ${milestoneName}`);
    return true;
  }

  return false;
}

/**
 * Complete a milestone
 */
function completeMilestone(goalId, milestoneIndex) {
  const data = loadGoals();
  const goal = data.goals.find(g => g.id === goalId || g.name === goalId);

  if (!goal) {
    console.log(`❌ Goal not found: ${goalId}`);
    return false;
  }

  const index = parseInt(milestoneIndex) - 1;

  if (index < 0 || index >= goal.milestones.length) {
    console.log(`❌ Invalid milestone index: ${milestoneIndex}`);
    return false;
  }

  goal.milestones[index].completed = true;
  goal.milestones[index].completedAt = new Date().toISOString();

  // Auto-update goal progress based on milestones
  const completedCount = goal.milestones.filter(m => m.completed).length;
  goal.progress = Math.round((completedCount / goal.milestones.length) * 100);

  if (saveGoals(data)) {
    console.log(`✅ Milestone completed: ${goal.milestones[index].name}`);
    console.log(`   Goal progress: ${goal.progress}%`);
    return true;
  }

  return false;
}

/**
 * Delete a goal
 */
function deleteGoal(goalId) {
  const data = loadGoals();
  const index = data.goals.findIndex(g => g.id === goalId || g.name === goalId);

  if (index === -1) {
    console.log(`❌ Goal not found: ${goalId}`);
    return false;
  }

  const goal = data.goals[index];
  data.goals.splice(index, 1);

  if (saveGoals(data)) {
    console.log(`🗑️  Goal deleted: ${goal.name}`);
    return true;
  }

  return false;
}

/**
 * Show goal statistics
 */
function showStats() {
  const data = loadGoals();

  if (data.goals.length === 0) {
    console.log('No goals set yet.');
    return;
  }

  const completed = data.goals.filter(g => g.status === 'completed').length;
  const inProgress = data.goals.filter(g => g.status === 'in-progress').length;
  const avgProgress = data.goals.reduce((sum, g) => sum + g.progress, 0) / data.goals.length;

  const byCategory = data.goals.reduce((acc, goal) => {
    acc[goal.category] = (acc[goal.category] || 0) + 1;
    return acc;
  }, {});

  console.log('\n📊 Goal Statistics:\n');
  console.log(`Total goals: ${data.goals.length}`);
  console.log(`Completed: ${completed}`);
  console.log(`In progress: ${inProgress}`);
  console.log(`Average progress: ${avgProgress.toFixed(1)}%`);
  console.log('\nBy category:');

  Object.entries(byCategory).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });

  console.log('');
}

// Helper functions

function getStatusIcon(goal) {
  if (goal.status === 'completed') return '✅';
  if (goal.progress >= 75) return '🟢';
  if (goal.progress >= 50) return '🟡';
  if (goal.progress >= 25) return '🟠';
  return '🔴';
}

function getProgressBar(progress, width = 20) {
  const filled = Math.round((progress / 100) * width);
  const empty = width - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

function getDaysRemaining(deadline) {
  const now = new Date();
  const end = new Date(deadline);
  const diff = end - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
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
        console.log('Usage: gsd goal add <name> [deadline] [category]');
        return;
      }
      addGoal(args[1], args[2], args[3]);
      break;

    case 'list':
      listGoals(args[1]);
      break;

    case 'progress':
      if (args.length < 3) {
        console.log('Usage: gsd goal progress <name> <percentage>');
        return;
      }
      updateProgress(args[1], parseInt(args[2]));
      break;

    case 'milestone':
      if (args.length < 3) {
        console.log('Usage: gsd goal milestone <goal-name> <milestone-name>');
        return;
      }
      addMilestone(args[1], args[2]);
      break;

    case 'complete':
      if (args.length < 3) {
        console.log('Usage: gsd goal complete <goal-name> <milestone-index>');
        return;
      }
      completeMilestone(args[1], args[2]);
      break;

    case 'delete':
      if (args.length < 2) {
        console.log('Usage: gsd goal delete <name>');
        return;
      }
      deleteGoal(args[1]);
      break;

    case 'stats':
      showStats();
      break;

    default:
      console.log(`
🎯 Goal Tracker - Track and achieve your long-term goals

Usage:
  gsd goal add <name> [deadline] [category]   Add a new goal
  gsd goal list [category]                     List all goals
  gsd goal progress <name> <percentage>        Update goal progress
  gsd goal milestone <name> <milestone>        Add milestone to goal
  gsd goal complete <name> <index>             Complete a milestone
  gsd goal delete <name>                       Delete a goal
  gsd goal stats                               Show goal statistics

Examples:
  gsd goal add "Learn TypeScript" 2026-12-31 "learning"
  gsd goal progress "Learn TypeScript" 50
  gsd goal milestone "Learn TypeScript" "Complete basic tutorial"
  gsd goal complete "Learn TypeScript" 1
      `);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  addGoal,
  listGoals,
  updateProgress,
  addMilestone,
  completeMilestone,
  deleteGoal,
  showStats
};
