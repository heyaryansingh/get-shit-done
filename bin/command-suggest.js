#!/usr/bin/env node

/**
 * @fileoverview Command suggestion utility for Get Shit Done.
 * Provides fuzzy matching and typo correction for GSD slash commands.
 * @module bin/command-suggest
 */

'use strict';

const fs = require('fs');
const path = require('path');

const cyan = '\x1b[36m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const dim = '\x1b[2m';
const reset = '\x1b[0m';

/**
 * Calculate Levenshtein distance between two strings.
 * @param {string} a - First string.
 * @param {string} b - Second string.
 * @returns {number} Edit distance.
 */
function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[m][n];
}

/**
 * Load all available GSD command names from the commands directory.
 * @returns {string[]} Array of command names (without .md extension).
 */
function loadCommands() {
  const commandsDir = path.join(__dirname, '..', 'commands', 'gsd');
  try {
    return fs
      .readdirSync(commandsDir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace('.md', ''))
      .sort();
  } catch {
    return [];
  }
}

/**
 * Extract the first line description from a command's markdown file.
 * @param {string} commandName - Command name (without extension).
 * @returns {string} First meaningful line or empty string.
 */
function getCommandDescription(commandName) {
  const filePath = path.join(
    __dirname,
    '..',
    'commands',
    'gsd',
    `${commandName}.md`
  );
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter((l) => l.trim());
    // Skip markdown headers, find first descriptive line
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) continue;
      if (trimmed.startsWith('---')) continue;
      if (trimmed.startsWith('name:') || trimmed.startsWith('description:')) {
        const desc = trimmed.split(':').slice(1).join(':').trim();
        if (desc) return desc;
        continue;
      }
      if (trimmed.length > 10) return trimmed.slice(0, 80);
    }
    return '';
  } catch {
    return '';
  }
}

/**
 * Find commands matching a query using fuzzy matching.
 * @param {string} query - User input to match against commands.
 * @param {number} [maxResults=5] - Maximum number of suggestions.
 * @returns {Array<{name: string, distance: number, description: string}>}
 */
function suggestCommands(query, maxResults = 5) {
  const commands = loadCommands();
  if (!query) return commands.map((name) => ({ name, distance: 0, description: getCommandDescription(name) }));

  const normalized = query.toLowerCase().replace(/^\/?(gsd:?)?/, '');

  // A bare "/gsd", "gsd", or "gsd:" with no subcommand normalizes to an
  // empty string. Without this guard it falls through to fuzzy scoring,
  // where an empty normalized string trivially "contains"/"prefixes" every
  // command name, producing a meaningless ranked "Did you mean" list
  // instead of the full command listing a blank subcommand should show.
  if (!normalized) {
    return commands.map((name) => ({ name, distance: 0, description: getCommandDescription(name) }));
  }

  // Exact match
  if (commands.includes(normalized)) {
    return [{ name: normalized, distance: 0, description: getCommandDescription(normalized) }];
  }

  // Score each command
  const scored = commands.map((cmd) => {
    const dist = levenshtein(normalized, cmd);
    // Bonus for substring match
    const containsBonus = cmd.includes(normalized) || normalized.includes(cmd) ? -2 : 0;
    // Bonus for prefix match
    const prefixBonus = cmd.startsWith(normalized) ? -3 : 0;
    return {
      name: cmd,
      distance: dist + containsBonus + prefixBonus,
      description: getCommandDescription(cmd),
    };
  });

  return scored
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);
}

/**
 * Format suggestions for terminal output.
 * @param {string} query - Original user query.
 * @param {Array<{name: string, distance: number, description: string}>} suggestions
 * @returns {string} Formatted output string.
 */
function formatSuggestions(query, suggestions) {
  if (!suggestions.length) {
    return `${yellow}No commands found.${reset}\n`;
  }

  const lines = [];
  if (query) {
    if (suggestions[0].distance === 0) {
      lines.push(`${green}Exact match:${reset} /gsd:${suggestions[0].name}`);
      if (suggestions[0].description) {
        lines.push(`  ${dim}${suggestions[0].description}${reset}`);
      }
    } else {
      lines.push(`${yellow}Did you mean:${reset}`);
      for (const s of suggestions) {
        const desc = s.description ? `  ${dim}${s.description}${reset}` : '';
        lines.push(`  ${cyan}/gsd:${s.name}${reset}${desc}`);
      }
    }
  } else {
    lines.push(`${cyan}Available commands (${suggestions.length}):${reset}`);
    for (const s of suggestions) {
      const desc = s.description ? `  ${dim}${s.description}${reset}` : '';
      lines.push(`  /gsd:${s.name}${desc}`);
    }
  }

  return lines.join('\n') + '\n';
}

// CLI entry point
if (require.main === module) {
  const query = process.argv[2] || '';
  const normalizedQuery = query.toLowerCase().replace(/^\/?(gsd:?)?/, '');
  const suggestions = suggestCommands(query);
  // Pass the normalized query so a bare "/gsd"/"gsd:" with no subcommand
  // (normalizes to '') is formatted as a full command listing, not a
  // falsely-labeled "Exact match" against whichever command sorts first.
  process.stdout.write(formatSuggestions(normalizedQuery, suggestions));
}

module.exports = { suggestCommands, loadCommands, levenshtein, formatSuggestions };
