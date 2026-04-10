#!/usr/bin/env node

/**
 * @fileoverview Update checker for Get Shit Done CLI tool.
 * Compares local version against npm registry and provides upgrade instructions.
 * @module bin/check-update
 */

'use strict';

const https = require('https');
const path = require('path');

/** @constant {string} ANSI escape code for cyan text */
const cyan = '\x1b[36m';
/** @constant {string} ANSI escape code for green text */
const green = '\x1b[32m';
/** @constant {string} ANSI escape code for yellow text */
const yellow = '\x1b[33m';
/** @constant {string} ANSI escape code for red text */
const red = '\x1b[31m';
/** @constant {string} ANSI escape code for dim text */
const dim = '\x1b[2m';
/** @constant {string} ANSI escape code to reset text formatting */
const reset = '\x1b[0m';

// Get version from package.json
const pkg = require('../package.json');
const currentVersion = pkg.version;
const packageName = pkg.name;

/**
 * @typedef {Object} VersionInfo
 * @property {string} current - Currently installed version
 * @property {string} latest - Latest version from npm
 * @property {boolean} updateAvailable - Whether an update is available
 * @property {string} type - Update type (major, minor, patch)
 */

/**
 * Parse semantic version string into components.
 * @param {string} version - Version string (e.g., "1.2.3")
 * @returns {{ major: number, minor: number, patch: number }} Version components
 */
function parseVersion(version) {
  const clean = version.replace(/^v/, '');
  const [major = 0, minor = 0, patch = 0] = clean.split('.').map(n => parseInt(n, 10));
  return { major, minor, patch };
}

/**
 * Compare two version strings.
 * @param {string} v1 - First version
 * @param {string} v2 - Second version
 * @returns {number} -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
function compareVersions(v1, v2) {
  const a = parseVersion(v1);
  const b = parseVersion(v2);

  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}

/**
 * Determine the type of version update.
 * @param {string} current - Current version
 * @param {string} latest - Latest version
 * @returns {string} Update type: 'major', 'minor', 'patch', or 'none'
 */
function getUpdateType(current, latest) {
  const c = parseVersion(current);
  const l = parseVersion(latest);

  if (l.major > c.major) return 'major';
  if (l.minor > c.minor) return 'minor';
  if (l.patch > c.patch) return 'patch';
  return 'none';
}

/**
 * Fetch the latest version from npm registry.
 * @param {string} pkgName - Package name to check
 * @returns {Promise<string>} Latest version string
 */
function fetchLatestVersion(pkgName) {
  return new Promise((resolve, reject) => {
    const url = `https://registry.npmjs.org/${pkgName}/latest`;

    https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      if (res.statusCode === 404) {
        reject(new Error('Package not found on npm'));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.version);
        } catch (e) {
          reject(new Error('Invalid response from npm'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * Check for updates and return version info.
 * @returns {Promise<VersionInfo>} Version comparison info
 */
async function checkForUpdates() {
  const latest = await fetchLatestVersion(packageName);
  const comparison = compareVersions(currentVersion, latest);
  const updateType = getUpdateType(currentVersion, latest);

  return {
    current: currentVersion,
    latest,
    updateAvailable: comparison < 0,
    type: updateType,
  };
}

/**
 * Format version info for display.
 * @param {VersionInfo} info - Version info to format
 * @returns {string} Formatted output string
 */
function formatOutput(info) {
  const lines = [];

  lines.push('');
  lines.push(`  ${cyan}Get Shit Done${reset} - Update Check`);
  lines.push('');
  lines.push(`  Current version: ${dim}v${info.current}${reset}`);
  lines.push(`  Latest version:  ${green}v${info.latest}${reset}`);
  lines.push('');

  if (info.updateAvailable) {
    const typeColors = {
      major: red,
      minor: yellow,
      patch: green,
    };
    const color = typeColors[info.type] || green;

    lines.push(`  ${color}Update available!${reset} (${info.type} update)`);
    lines.push('');
    lines.push(`  ${yellow}To update:${reset}`);
    lines.push(`    npm install -g ${packageName}@latest`);
    lines.push('');
    lines.push(`  ${dim}Or run the installer:${reset}`);
    lines.push(`    npx ${packageName} --global`);

    if (info.type === 'major') {
      lines.push('');
      lines.push(`  ${red}Note:${reset} Major version update may include breaking changes.`);
      lines.push(`        Please review the changelog before updating.`);
    }
  } else {
    lines.push(`  ${green}You're up to date!${reset}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Perform verification of the current installation.
 * @returns {{ valid: boolean, issues: string[] }} Verification result
 */
function verifyInstallation() {
  const issues = [];

  // Check if package.json exists
  try {
    require('../package.json');
  } catch (e) {
    issues.push('package.json not found - installation may be corrupted');
  }

  // Check if main files exist
  const fs = require('fs');
  const requiredPaths = [
    '../commands/gsd',
    '../get-shit-done',
  ];

  for (const relPath of requiredPaths) {
    const fullPath = path.join(__dirname, relPath);
    if (!fs.existsSync(fullPath)) {
      issues.push(`Missing: ${relPath}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Format verification result for display.
 * @param {{ valid: boolean, issues: string[] }} result - Verification result
 * @returns {string} Formatted output
 */
function formatVerification(result) {
  const lines = [];

  lines.push('');
  lines.push(`  ${cyan}Installation Verification${reset}`);
  lines.push('');

  if (result.valid) {
    lines.push(`  ${green}✓${reset} Installation is valid`);
  } else {
    lines.push(`  ${red}✗${reset} Installation issues found:`);
    for (const issue of result.issues) {
      lines.push(`    ${yellow}•${reset} ${issue}`);
    }
    lines.push('');
    lines.push(`  ${dim}Try reinstalling:${reset}`);
    lines.push(`    npx ${packageName} --global`);
  }

  lines.push('');
  return lines.join('\n');
}

// Parse command line arguments
const args = process.argv.slice(2);
const hasHelp = args.includes('--help') || args.includes('-h');
const hasVerify = args.includes('--verify') || args.includes('-v');
const hasJson = args.includes('--json');

if (hasHelp) {
  console.log(`
  ${cyan}Get Shit Done${reset} - Update Checker

  ${yellow}Usage:${reset}
    npx ${packageName} check-update [options]

  ${yellow}Options:${reset}
    ${cyan}-h, --help${reset}    Show this help message
    ${cyan}-v, --verify${reset}  Verify installation integrity
    ${cyan}--json${reset}        Output in JSON format

  ${yellow}Examples:${reset}
    ${dim}# Check for updates${reset}
    npx ${packageName} check-update

    ${dim}# Verify installation${reset}
    npx ${packageName} check-update --verify

    ${dim}# Get JSON output for scripting${reset}
    npx ${packageName} check-update --json
`);
  process.exit(0);
}

// Main execution
async function main() {
  try {
    if (hasVerify) {
      const verification = verifyInstallation();

      if (hasJson) {
        console.log(JSON.stringify(verification, null, 2));
      } else {
        console.log(formatVerification(verification));
      }

      process.exit(verification.valid ? 0 : 1);
    }

    const info = await checkForUpdates();

    if (hasJson) {
      console.log(JSON.stringify(info, null, 2));
    } else {
      console.log(formatOutput(info));
    }

    // Exit with code 1 if update available (useful for CI/CD)
    process.exit(info.updateAvailable ? 1 : 0);

  } catch (error) {
    if (hasJson) {
      console.log(JSON.stringify({ error: error.message }, null, 2));
    } else {
      console.error(`\n  ${red}Error:${reset} ${error.message}\n`);
    }
    process.exit(2);
  }
}

main();
