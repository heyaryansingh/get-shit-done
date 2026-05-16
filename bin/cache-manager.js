#!/usr/bin/env node
/**
 * Cache Manager for Get Shit Done
 *
 * Manages cached data, cleans old entries, and provides cache statistics.
 * Helps maintain performance by preventing cache bloat.
 *
 * Usage:
 *   gsd cache stats          Show cache statistics
 *   gsd cache clean          Clean old cache entries
 *   gsd cache clear          Clear all cache
 *   gsd cache size           Show cache size
 */

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.gsd', 'cache');
const MAX_CACHE_AGE_DAYS = 30;
const MAX_CACHE_SIZE_MB = 100;

/**
 * Ensure cache directory exists
 */
function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

/**
 * Get all cache files with metadata
 */
function getCacheFiles() {
  ensureCacheDir();
  const files = fs.readdirSync(CACHE_DIR);

  return files
    .map(file => {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      return {
        name: file,
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
        age: Date.now() - stats.mtime.getTime()
      };
    })
    .sort((a, b) => b.modified - a.modified);
}

/**
 * Calculate total cache size in MB
 */
function getTotalCacheSize() {
  const files = getCacheFiles();
  const totalBytes = files.reduce((sum, f) => sum + f.size, 0);
  return (totalBytes / (1024 * 1024)).toFixed(2);
}

/**
 * Show cache statistics
 */
function showStats() {
  const files = getCacheFiles();
  const totalSize = getTotalCacheSize();
  const oldFiles = files.filter(f => f.age > MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000);

  console.log('📊 Cache Statistics\n');
  console.log(`Total files:     ${files.length}`);
  console.log(`Total size:      ${totalSize} MB`);
  console.log(`Old files (>${MAX_CACHE_AGE_DAYS}d): ${oldFiles.length}`);
  console.log(`Cache location:  ${CACHE_DIR}\n`);

  if (files.length > 0) {
    console.log('Recent cache entries:');
    files.slice(0, 5).forEach(f => {
      const ageHours = Math.floor(f.age / (1000 * 60 * 60));
      const sizekB = (f.size / 1024).toFixed(1);
      console.log(`  ${f.name} (${sizekB} KB, ${ageHours}h ago)`);
    });
  }

  if (parseFloat(totalSize) > MAX_CACHE_SIZE_MB) {
    console.log(`\n⚠️  Cache size exceeds ${MAX_CACHE_SIZE_MB} MB. Consider running 'gsd cache clean'`);
  }
}

/**
 * Clean old cache entries
 */
function cleanCache() {
  const files = getCacheFiles();
  const maxAge = MAX_CACHE_AGE_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  let freedSpace = 0;

  files.forEach(file => {
    if (file.age > maxAge) {
      fs.unlinkSync(file.path);
      removed++;
      freedSpace += file.size;
    }
  });

  const freedMB = (freedSpace / (1024 * 1024)).toFixed(2);
  console.log(`✅ Cleaned ${removed} old cache entries`);
  console.log(`💾 Freed ${freedMB} MB of space`);
}

/**
 * Clear all cache
 */
function clearCache() {
  const files = getCacheFiles();
  let removed = 0;

  files.forEach(file => {
    fs.unlinkSync(file.path);
    removed++;
  });

  console.log(`✅ Cleared ${removed} cache entries`);
}

/**
 * Show cache size
 */
function showSize() {
  const totalSize = getTotalCacheSize();
  const files = getCacheFiles();

  console.log(`Cache size: ${totalSize} MB (${files.length} files)`);

  if (parseFloat(totalSize) > MAX_CACHE_SIZE_MB) {
    console.log(`⚠️  Exceeds ${MAX_CACHE_SIZE_MB} MB limit`);
  }
}

// Main CLI
const command = process.argv[2];

switch (command) {
  case 'stats':
    showStats();
    break;
  case 'clean':
    cleanCache();
    break;
  case 'clear':
    clearCache();
    break;
  case 'size':
    showSize();
    break;
  default:
    console.log('Usage: gsd cache [stats|clean|clear|size]');
    console.log('');
    console.log('Commands:');
    console.log('  stats   Show cache statistics');
    console.log('  clean   Clean old cache entries (>30 days)');
    console.log('  clear   Clear all cache');
    console.log('  size    Show cache size');
    process.exit(1);
}
