#!/usr/bin/env node

/**
 * @fileoverview Task recurrence manager for Get Shit Done.
 * Creates, lists, and resolves recurring tasks (daily, weekly, monthly)
 * so repetitive work items auto-regenerate on schedule.
 * @module bin/task-recurrence
 */

'use strict';

const fs = require('fs');
const path = require('path');

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const dim = '\x1b[2m';
const bold = '\x1b[1m';
const reset = '\x1b[0m';

const RECURRENCE_FILE = path.join(
  process.env.GSD_DATA_DIR || path.join(process.env.HOME || process.env.USERPROFILE || '.', '.gsd'),
  'recurrence.json'
);

/**
 * Supported recurrence frequencies.
 * @enum {string}
 */
const Frequency = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  BIWEEKLY: 'biweekly',
  MONTHLY: 'monthly',
};

/**
 * Load recurring tasks from disk.
 * @returns {Array<Object>} Array of recurrence definitions.
 */
function loadRecurrences() {
  try {
    if (fs.existsSync(RECURRENCE_FILE)) {
      return JSON.parse(fs.readFileSync(RECURRENCE_FILE, 'utf8'));
    }
  } catch (e) {
    console.error(`${red}Error loading recurrences: ${e.message}${reset}`);
  }
  return [];
}

/**
 * Save recurring tasks to disk.
 * @param {Array<Object>} recurrences - The recurrence definitions.
 */
function saveRecurrences(recurrences) {
  const dir = path.dirname(RECURRENCE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(RECURRENCE_FILE, JSON.stringify(recurrences, null, 2), 'utf8');
}

/**
 * Generate a short unique ID.
 * @returns {string} 6-character hex ID.
 */
function generateId() {
  return Math.random().toString(16).slice(2, 8);
}

/**
 * Calculate the next due date from a given date and frequency.
 * @param {Date} fromDate - Starting date.
 * @param {string} frequency - One of Frequency values.
 * @returns {Date} Next due date.
 */
function nextDueDate(fromDate, frequency) {
  const d = new Date(fromDate);
  switch (frequency) {
    case Frequency.DAILY:
      d.setDate(d.getDate() + 1);
      break;
    case Frequency.WEEKLY:
      d.setDate(d.getDate() + 7);
      break;
    case Frequency.BIWEEKLY:
      d.setDate(d.getDate() + 14);
      break;
    case Frequency.MONTHLY:
      d.setMonth(d.getMonth() + 1);
      break;
    default:
      d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Check whether a recurrence is due (i.e., next_due <= today).
 * @param {Object} rec - Recurrence object with next_due field.
 * @returns {boolean} True if the task is due.
 */
function isDue(rec) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(rec.next_due);
  due.setHours(0, 0, 0, 0);
  return due <= today;
}

/**
 * Format a date as YYYY-MM-DD.
 * @param {Date|string} d - Date to format.
 * @returns {string} Formatted date string.
 */
function formatDate(d) {
  const date = new Date(d);
  return date.toISOString().split('T')[0];
}

// ---- Commands ----

/**
 * Add a new recurring task.
 * @param {string} title - Task title.
 * @param {string} frequency - Recurrence frequency.
 * @param {string} [category] - Optional category/tag.
 */
function addRecurrence(title, frequency, category) {
  if (!Object.values(Frequency).includes(frequency)) {
    console.error(`${red}Invalid frequency: ${frequency}${reset}`);
    console.log(`Valid options: ${Object.values(Frequency).join(', ')}`);
    process.exit(1);
  }

  const recurrences = loadRecurrences();
  const now = new Date();

  const rec = {
    id: generateId(),
    title: title,
    frequency: frequency,
    category: category || 'general',
    created: now.toISOString(),
    next_due: formatDate(now),
    completions: 0,
    active: true,
  };

  recurrences.push(rec);
  saveRecurrences(recurrences);

  console.log(`${green}+ Added recurring task:${reset} ${bold}${title}${reset}`);
  console.log(`  ${dim}Frequency: ${frequency} | Next due: ${formatDate(now)} | ID: ${rec.id}${reset}`);
}

/**
 * List all recurring tasks with their status.
 * @param {boolean} [showAll=false] - Show inactive tasks too.
 */
function listRecurrences(showAll) {
  const recurrences = loadRecurrences();
  const active = showAll ? recurrences : recurrences.filter(r => r.active);

  if (active.length === 0) {
    console.log(`${dim}No recurring tasks found. Use 'add' to create one.${reset}`);
    return;
  }

  console.log(`\n${bold}${cyan}Recurring Tasks${reset}\n`);

  for (const rec of active) {
    const due = isDue(rec);
    const status = due ? `${red}DUE${reset}` : `${green}OK${reset}`;
    const activeFlag = rec.active ? '' : ` ${dim}(paused)${reset}`;

    console.log(
      `  [${status}] ${bold}${rec.title}${reset}${activeFlag}`
    );
    console.log(
      `       ${dim}${rec.frequency} | Next: ${formatDate(rec.next_due)} | Done: ${rec.completions}x | ID: ${rec.id}${reset}`
    );
  }

  const dueCount = active.filter(isDue).length;
  console.log(`\n  ${yellow}${dueCount} task(s) due today${reset}\n`);
}

/**
 * Mark a recurring task as done and advance to next due date.
 * @param {string} idOrTitle - Task ID or partial title match.
 */
function completeRecurrence(idOrTitle) {
  const recurrences = loadRecurrences();
  const needle = idOrTitle.toLowerCase();
  const rec = recurrences.find(
    r => r.id === idOrTitle || r.title.toLowerCase().includes(needle)
  );

  if (!rec) {
    console.error(`${red}No recurring task matching: ${idOrTitle}${reset}`);
    process.exit(1);
  }

  rec.completions += 1;
  rec.last_completed = new Date().toISOString();
  rec.next_due = formatDate(nextDueDate(new Date(), rec.frequency));

  saveRecurrences(recurrences);

  console.log(`${green}Completed:${reset} ${bold}${rec.title}${reset}`);
  console.log(`  ${dim}Next due: ${rec.next_due} | Total completions: ${rec.completions}${reset}`);
}

/**
 * Pause or resume a recurring task.
 * @param {string} idOrTitle - Task ID or partial title match.
 */
function toggleRecurrence(idOrTitle) {
  const recurrences = loadRecurrences();
  const needle = idOrTitle.toLowerCase();
  const rec = recurrences.find(
    r => r.id === idOrTitle || r.title.toLowerCase().includes(needle)
  );

  if (!rec) {
    console.error(`${red}No recurring task matching: ${idOrTitle}${reset}`);
    process.exit(1);
  }

  rec.active = !rec.active;
  saveRecurrences(recurrences);

  const state = rec.active ? `${green}resumed${reset}` : `${yellow}paused${reset}`;
  console.log(`${bold}${rec.title}${reset} ${state}`);
}

/**
 * Remove a recurring task permanently.
 * @param {string} idOrTitle - Task ID or partial title match.
 */
function removeRecurrence(idOrTitle) {
  const recurrences = loadRecurrences();
  const needle = idOrTitle.toLowerCase();
  const idx = recurrences.findIndex(
    r => r.id === idOrTitle || r.title.toLowerCase().includes(needle)
  );

  if (idx === -1) {
    console.error(`${red}No recurring task matching: ${idOrTitle}${reset}`);
    process.exit(1);
  }

  const removed = recurrences.splice(idx, 1)[0];
  saveRecurrences(recurrences);

  console.log(`${red}Removed:${reset} ${removed.title}`);
}

/**
 * Show summary of due tasks across all recurrences.
 */
function showDueSummary() {
  const recurrences = loadRecurrences().filter(r => r.active);
  const due = recurrences.filter(isDue);

  if (due.length === 0) {
    console.log(`${green}All caught up! No recurring tasks due.${reset}`);
    return;
  }

  console.log(`\n${bold}${red}${due.length} recurring task(s) due:${reset}\n`);
  for (const rec of due) {
    console.log(`  ${yellow}*${reset} ${rec.title} ${dim}(${rec.frequency}, last due ${formatDate(rec.next_due)})${reset}`);
  }
  console.log();
}

// ---- CLI Dispatch ----

function printUsage() {
  console.log(`
${bold}${cyan}Task Recurrence Manager${reset}

${bold}Usage:${reset}
  task-recurrence add <title> <frequency> [category]   Add recurring task
  task-recurrence list [--all]                         List active recurring tasks
  task-recurrence done <id|title>                      Mark task complete, advance date
  task-recurrence toggle <id|title>                    Pause/resume a task
  task-recurrence remove <id|title>                    Remove a task permanently
  task-recurrence due                                  Show tasks due today

${bold}Frequencies:${reset} daily, weekly, biweekly, monthly

${bold}Examples:${reset}
  task-recurrence add "Review PRs" daily code-review
  task-recurrence add "Weekly standup notes" weekly meetings
  task-recurrence done "Review PRs"
  task-recurrence list
`);
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'add':
    if (args.length < 3) {
      console.error(`${red}Usage: task-recurrence add <title> <frequency> [category]${reset}`);
      process.exit(1);
    }
    addRecurrence(args[1], args[2], args[3]);
    break;

  case 'list':
    listRecurrences(args.includes('--all'));
    break;

  case 'done':
  case 'complete':
    if (!args[1]) {
      console.error(`${red}Usage: task-recurrence done <id|title>${reset}`);
      process.exit(1);
    }
    completeRecurrence(args[1]);
    break;

  case 'toggle':
    if (!args[1]) {
      console.error(`${red}Usage: task-recurrence toggle <id|title>${reset}`);
      process.exit(1);
    }
    toggleRecurrence(args[1]);
    break;

  case 'remove':
  case 'rm':
    if (!args[1]) {
      console.error(`${red}Usage: task-recurrence remove <id|title>${reset}`);
      process.exit(1);
    }
    removeRecurrence(args[1]);
    break;

  case 'due':
    showDueSummary();
    break;

  default:
    printUsage();
    break;
}
