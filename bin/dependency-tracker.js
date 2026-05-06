#!/usr/bin/env node

/**
 * Task Dependency Tracker for Get Shit Done (GSD)
 *
 * Manages task dependencies and blocks to ensure tasks are completed in the right order.
 * Prevents circular dependencies and provides topological sort for optimal task scheduling.
 *
 * Features:
 * - Add/remove task dependencies
 * - Detect circular dependencies
 * - Topological sort for execution order
 * - Find blocked and unblocked tasks
 * - Visualize dependency graph
 * - Mark tasks as completed and unblock dependents
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const DEPENDENCY_FILE = path.join(process.cwd(), '.gsd-dependencies.json');

class DependencyTracker {
  constructor() {
    this.dependencies = this.load();
  }

  /**
   * Load dependencies from file or create empty structure
   */
  load() {
    if (fs.existsSync(DEPENDENCY_FILE)) {
      try {
        return JSON.parse(fs.readFileSync(DEPENDENCY_FILE, 'utf8'));
      } catch (err) {
        console.error(chalk.red(`Error loading dependencies: ${err.message}`));
        return { tasks: {}, completed: [] };
      }
    }
    return { tasks: {}, completed: [] };
  }

  /**
   * Save dependencies to file
   */
  save() {
    try {
      fs.writeFileSync(
        DEPENDENCY_FILE,
        JSON.stringify(this.dependencies, null, 2),
        'utf8'
      );
    } catch (err) {
      console.error(chalk.red(`Error saving dependencies: ${err.message}`));
    }
  }

  /**
   * Add a task dependency (taskA depends on taskB)
   */
  addDependency(taskId, dependsOnId) {
    if (!this.dependencies.tasks[taskId]) {
      this.dependencies.tasks[taskId] = { dependsOn: [], metadata: {} };
    }

    // Prevent duplicate dependencies
    if (!this.dependencies.tasks[taskId].dependsOn.includes(dependsOnId)) {
      this.dependencies.tasks[taskId].dependsOn.push(dependsOnId);
    }

    // Ensure dependency task exists
    if (!this.dependencies.tasks[dependsOnId]) {
      this.dependencies.tasks[dependsOnId] = { dependsOn: [], metadata: {} };
    }

    // Check for circular dependency
    if (this.detectCircular(taskId)) {
      // Rollback
      this.dependencies.tasks[taskId].dependsOn = this.dependencies.tasks[
        taskId
      ].dependsOn.filter((id) => id !== dependsOnId);
      throw new Error(
        `Circular dependency detected: ${taskId} -> ${dependsOnId}`
      );
    }

    this.save();
    return true;
  }

  /**
   * Remove a task dependency
   */
  removeDependency(taskId, dependsOnId) {
    if (this.dependencies.tasks[taskId]) {
      this.dependencies.tasks[taskId].dependsOn = this.dependencies.tasks[
        taskId
      ].dependsOn.filter((id) => id !== dependsOnId);
      this.save();
      return true;
    }
    return false;
  }

  /**
   * Mark a task as completed
   */
  completeTask(taskId) {
    if (!this.dependencies.completed.includes(taskId)) {
      this.dependencies.completed.push(taskId);
      this.save();
      console.log(chalk.green(`✓ Task ${taskId} marked as completed`));

      // Show what this unblocks
      const unblocked = this.getUnblockedTasks().filter((t) =>
        this.dependencies.tasks[t].dependsOn.includes(taskId)
      );
      if (unblocked.length > 0) {
        console.log(
          chalk.yellow(`  → Unblocked tasks: ${unblocked.join(', ')}`)
        );
      }
    }
  }

  /**
   * Detect circular dependencies using DFS
   */
  detectCircular(startTask, visited = new Set(), stack = new Set()) {
    if (stack.has(startTask)) {
      return true; // Circular dependency found
    }

    if (visited.has(startTask)) {
      return false; // Already checked
    }

    visited.add(startTask);
    stack.add(startTask);

    const task = this.dependencies.tasks[startTask];
    if (task && task.dependsOn) {
      for (const dep of task.dependsOn) {
        if (this.detectCircular(dep, visited, stack)) {
          return true;
        }
      }
    }

    stack.delete(startTask);
    return false;
  }

  /**
   * Get tasks that are not blocked (all dependencies completed)
   */
  getUnblockedTasks() {
    const unblocked = [];
    const completed = new Set(this.dependencies.completed);

    for (const [taskId, task] of Object.entries(this.dependencies.tasks)) {
      if (completed.has(taskId)) {
        continue; // Skip completed tasks
      }

      // Check if all dependencies are completed
      const allDepsCompleted = task.dependsOn.every((dep) =>
        completed.has(dep)
      );
      if (allDepsCompleted) {
        unblocked.push(taskId);
      }
    }

    return unblocked;
  }

  /**
   * Get tasks that are blocked (have incomplete dependencies)
   */
  getBlockedTasks() {
    const blocked = [];
    const completed = new Set(this.dependencies.completed);

    for (const [taskId, task] of Object.entries(this.dependencies.tasks)) {
      if (completed.has(taskId)) {
        continue; // Skip completed tasks
      }

      // Check if any dependencies are incomplete
      const hasIncompleteDeps = task.dependsOn.some(
        (dep) => !completed.has(dep)
      );
      if (hasIncompleteDeps) {
        blocked.push({
          id: taskId,
          blockedBy: task.dependsOn.filter((dep) => !completed.has(dep)),
        });
      }
    }

    return blocked;
  }

  /**
   * Topological sort using Kahn's algorithm
   * Returns tasks in execution order
   */
  topologicalSort() {
    const sorted = [];
    const inDegree = {};
    const tasks = Object.keys(this.dependencies.tasks);

    // Initialize in-degree
    tasks.forEach((task) => {
      inDegree[task] = 0;
    });

    // Calculate in-degree for each task
    tasks.forEach((task) => {
      this.dependencies.tasks[task].dependsOn.forEach((dep) => {
        inDegree[task] = (inDegree[task] || 0) + 1;
      });
    });

    // Queue of tasks with no dependencies
    const queue = tasks.filter((task) => inDegree[task] === 0);

    while (queue.length > 0) {
      const current = queue.shift();
      sorted.push(current);

      // Reduce in-degree for dependent tasks
      tasks.forEach((task) => {
        if (this.dependencies.tasks[task].dependsOn.includes(current)) {
          inDegree[task]--;
          if (inDegree[task] === 0) {
            queue.push(task);
          }
        }
      });
    }

    // Check if all tasks were sorted (no cycles)
    if (sorted.length !== tasks.length) {
      throw new Error('Circular dependency detected in task graph');
    }

    return sorted;
  }

  /**
   * Visualize dependency graph
   */
  visualize() {
    console.log(chalk.bold.blue('\n📊 Task Dependency Graph\n'));

    const completed = new Set(this.dependencies.completed);

    for (const [taskId, task] of Object.entries(this.dependencies.tasks)) {
      const isCompleted = completed.has(taskId);
      const icon = isCompleted ? '✓' : '○';
      const color = isCompleted ? chalk.green : chalk.white;

      console.log(color(`${icon} ${taskId}`));

      if (task.dependsOn.length > 0) {
        task.dependsOn.forEach((dep) => {
          const depCompleted = completed.has(dep);
          const depIcon = depCompleted ? '✓' : '○';
          const depColor = depCompleted ? chalk.green : chalk.yellow;
          console.log(depColor(`  ↳ depends on: ${depIcon} ${dep}`));
        });
      }
    }

    console.log();
  }

  /**
   * Get critical path (longest path through dependency graph)
   */
  getCriticalPath() {
    const sorted = this.topologicalSort();
    const distances = {};

    // Initialize distances
    sorted.forEach((task) => {
      distances[task] = 0;
    });

    // Calculate longest path
    sorted.forEach((task) => {
      const deps = this.dependencies.tasks[task].dependsOn;
      deps.forEach((dep) => {
        distances[task] = Math.max(distances[task], distances[dep] + 1);
      });
    });

    // Find task with max distance
    const criticalTask = sorted.reduce((max, task) =>
      distances[task] > distances[max] ? task : max
    );

    // Reconstruct critical path
    const path = [criticalTask];
    let current = criticalTask;

    while (distances[current] > 0) {
      const deps = this.dependencies.tasks[current].dependsOn;
      current = deps.reduce((max, dep) =>
        distances[dep] > distances[max] ? dep : max
      );
      path.unshift(current);
    }

    return path;
  }
}

// CLI Interface
const tracker = new DependencyTracker();
const args = process.argv.slice(2);
const command = args[0];

try {
  switch (command) {
    case 'add':
      if (args.length < 3) {
        console.log(
          chalk.yellow('Usage: dependency-tracker add <task> <depends-on>')
        );
        process.exit(1);
      }
      tracker.addDependency(args[1], args[2]);
      console.log(
        chalk.green(`✓ Added dependency: ${args[1]} depends on ${args[2]}`)
      );
      break;

    case 'remove':
      if (args.length < 3) {
        console.log(
          chalk.yellow('Usage: dependency-tracker remove <task> <depends-on>')
        );
        process.exit(1);
      }
      tracker.removeDependency(args[1], args[2]);
      console.log(
        chalk.green(`✓ Removed dependency: ${args[1]} -> ${args[2]}`)
      );
      break;

    case 'complete':
      if (args.length < 2) {
        console.log(chalk.yellow('Usage: dependency-tracker complete <task>'));
        process.exit(1);
      }
      tracker.completeTask(args[1]);
      break;

    case 'unblocked':
      const unblocked = tracker.getUnblockedTasks();
      console.log(chalk.bold.green('\n✓ Unblocked tasks (ready to work on):'));
      if (unblocked.length === 0) {
        console.log(chalk.gray('  (none)'));
      } else {
        unblocked.forEach((task) => console.log(`  • ${task}`));
      }
      console.log();
      break;

    case 'blocked':
      const blocked = tracker.getBlockedTasks();
      console.log(chalk.bold.yellow('\n⏸  Blocked tasks:'));
      if (blocked.length === 0) {
        console.log(chalk.gray('  (none)'));
      } else {
        blocked.forEach((task) => {
          console.log(`  • ${task.id}`);
          console.log(
            chalk.gray(`    blocked by: ${task.blockedBy.join(', ')}`)
          );
        });
      }
      console.log();
      break;

    case 'sort':
      const sorted = tracker.topologicalSort();
      console.log(chalk.bold.blue('\n📋 Optimal task execution order:\n'));
      sorted.forEach((task, idx) => {
        const completed = tracker.dependencies.completed.includes(task);
        const icon = completed ? '✓' : idx + 1;
        const color = completed ? chalk.green : chalk.white;
        console.log(color(`${icon}. ${task}`));
      });
      console.log();
      break;

    case 'critical':
      const path = tracker.getCriticalPath();
      console.log(chalk.bold.red('\n🔥 Critical path (longest dependency chain):\n'));
      path.forEach((task, idx) => {
        console.log(`${idx + 1}. ${task}`);
        if (idx < path.length - 1) {
          console.log(chalk.gray('   ↓'));
        }
      });
      console.log();
      break;

    case 'viz':
    case 'visualize':
      tracker.visualize();
      break;

    case 'status':
      console.log(chalk.bold.blue('\n📊 Dependency Tracker Status\n'));
      console.log(`Total tasks: ${Object.keys(tracker.dependencies.tasks).length}`);
      console.log(`Completed tasks: ${tracker.dependencies.completed.length}`);
      console.log(`Unblocked tasks: ${tracker.getUnblockedTasks().length}`);
      console.log(`Blocked tasks: ${tracker.getBlockedTasks().length}`);
      console.log();
      break;

    default:
      console.log(chalk.bold('GSD Dependency Tracker\n'));
      console.log('Commands:');
      console.log('  add <task> <depends-on>  - Add dependency');
      console.log('  remove <task> <depends-on> - Remove dependency');
      console.log('  complete <task>          - Mark task as completed');
      console.log('  unblocked                - Show unblocked tasks');
      console.log('  blocked                  - Show blocked tasks');
      console.log('  sort                     - Show optimal execution order');
      console.log('  critical                 - Show critical path');
      console.log('  viz, visualize           - Visualize dependency graph');
      console.log('  status                   - Show tracker status');
      console.log();
  }
} catch (err) {
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
}
