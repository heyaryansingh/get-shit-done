/**
 * Shared JSON persistence for the get-shit-done trackers.
 *
 * Every tracker keeps its state in a JSON file under the home directory. Two
 * problems were repeated across all of them:
 *
 *   - writeFileSync truncates in place, so an interrupted write leaves a
 *     half-written file behind.
 *   - a failed JSON.parse was swallowed and the default empty state returned,
 *     so the very next save overwrote the damaged - but still recoverable -
 *     file with an empty one.
 *
 * readJson/writeJson fix both once, for every caller.
 */

const fs = require('fs');
const path = require('path');

/**
 * Read and parse a JSON file, falling back to a default when it is missing.
 *
 * A file that exists but does not parse is moved aside rather than ignored,
 * so the data stays recoverable instead of being overwritten on the next save.
 *
 * @param {string} file Absolute path to the JSON file.
 * @param {*} fallback Value to return when the file is missing or unreadable.
 * @returns {*} Parsed contents, or `fallback`.
 */
function readJson(file, fallback) {
  if (!fs.existsSync(file)) {
    return fallback;
  }

  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    console.error(`Error reading ${file}:`, error.message);
    return fallback;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    const backup = `${file}.corrupt-${Date.now()}`;
    try {
      fs.renameSync(file, backup);
      console.error(`${file} is not valid JSON. Moved it to ${backup}.`);
    } catch (renameError) {
      console.error(`${file} is not valid JSON:`, error.message);
    }
    return fallback;
  }
}

/**
 * Serialize `data` to `file` atomically.
 *
 * Writes to a temporary file in the same directory and renames it over the
 * target. Rename is atomic within a filesystem, so readers see either the old
 * contents or the new ones, never a truncated file.
 *
 * @param {string} file Absolute path to the JSON file.
 * @param {*} data Value to serialize.
 * @returns {boolean} True when the write succeeded.
 */
function writeJson(file, data) {
  const tmp = `${file}.${process.pid}.tmp`;

  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
    return true;
  } catch (error) {
    console.error(`Error writing ${file}:`, error.message);
    try {
      fs.unlinkSync(tmp);
    } catch (cleanupError) {
      // Nothing to clean up.
    }
    return false;
  }
}

module.exports = { readJson, writeJson };
