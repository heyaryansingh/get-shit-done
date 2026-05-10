#!/usr/bin/env node
/**
 * Project validation utility for Get Shit Done
 * Validates project structure and planning artifacts
 */

const fs = require('fs');
const path = require('path');

class ProjectValidator {
  constructor(projectRoot = process.cwd()) {
    this.projectRoot = projectRoot;
    this.planningDir = path.join(projectRoot, '.planning');
    this.errors = [];
    this.warnings = [];
  }

  /**
   * Run all validation checks
   */
  validate() {
    console.log('🔍 Validating GSD project structure...\n');

    this.checkPlanningDirectory();
    this.checkCoreFiles();
    this.checkRoadmapStructure();
    this.checkPhaseStructure();

    this.printResults();
    return this.errors.length === 0;
  }

  /**
   * Check if .planning directory exists
   */
  checkPlanningDirectory() {
    if (!fs.existsSync(this.planningDir)) {
      this.errors.push('.planning directory not found - run /gsd:new-project first');
      return false;
    }
    return true;
  }

  /**
   * Check for core project files
   */
  checkCoreFiles() {
    const requiredFiles = {
      'PROJECT.md': 'Project specification',
      'ROADMAP.md': 'Project roadmap',
      'STATE.md': 'Project state tracking'
    };

    for (const [filename, description] of Object.entries(requiredFiles)) {
      const filePath = path.join(this.planningDir, filename);
      if (!fs.existsSync(filePath)) {
        this.warnings.push(`Missing ${filename} (${description})`);
      } else {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.length < 100) {
          this.warnings.push(`${filename} seems incomplete (< 100 characters)`);
        }
      }
    }
  }

  /**
   * Validate ROADMAP.md structure
   */
  checkRoadmapStructure() {
    const roadmapPath = path.join(this.planningDir, 'ROADMAP.md');
    if (!fs.existsSync(roadmapPath)) return;

    const content = fs.readFileSync(roadmapPath, 'utf8');

    // Check for phase markers
    const phasePattern = /##\s+Phase\s+\d+:/gi;
    const phases = content.match(phasePattern);

    if (!phases || phases.length === 0) {
      this.warnings.push('ROADMAP.md has no phases defined');
    }

    // Check for status markers
    if (!content.includes('[ ]') && !content.includes('[x]')) {
      this.warnings.push('ROADMAP.md has no task checkboxes');
    }
  }

  /**
   * Validate phases directory structure
   */
  checkPhaseStructure() {
    const phasesDir = path.join(this.planningDir, 'phases');
    if (!fs.existsSync(phasesDir)) {
      this.warnings.push('No phases directory found');
      return;
    }

    const phaseDirs = fs.readdirSync(phasesDir)
      .filter(name => fs.statSync(path.join(phasesDir, name)).isDirectory());

    if (phaseDirs.length === 0) {
      this.warnings.push('No phase directories found - run /gsd:plan-phase to create them');
      return;
    }

    // Check each phase directory
    phaseDirs.forEach(phaseDir => {
      const phasePath = path.join(phasesDir, phaseDir);
      const files = fs.readdirSync(phasePath);

      // Check for PLAN files
      const planFiles = files.filter(f => f.endsWith('-PLAN.md'));
      if (planFiles.length === 0) {
        this.warnings.push(`Phase ${phaseDir} has no PLAN files`);
      }

      // Check for SUMMARY files (indicates completed plans)
      const summaryFiles = files.filter(f => f.endsWith('-SUMMARY.md'));
      if (planFiles.length > 0 && summaryFiles.length === 0) {
        this.warnings.push(`Phase ${phaseDir} has unexecuted plans`);
      }
    });
  }

  /**
   * Print validation results
   */
  printResults() {
    console.log('\n📊 Validation Results:\n');

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ Project structure is valid!\n');
      return;
    }

    if (this.errors.length > 0) {
      console.log('❌ Errors:');
      this.errors.forEach(err => console.log(`  - ${err}`));
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  Warnings:');
      this.warnings.forEach(warn => console.log(`  - ${warn}`));
      console.log('');
    }

    // Provide helpful next steps
    if (this.errors.length > 0) {
      console.log('💡 Next steps:');
      console.log('  - Run /gsd:new-project to initialize your project');
      console.log('  - Run /gsd:create-roadmap to create a roadmap');
      console.log('  - Run /gsd:help for full command list\n');
    }
  }

  /**
   * Get project statistics
   */
  getStats() {
    const stats = {
      totalPhases: 0,
      completedPlans: 0,
      pendingPlans: 0,
      totalCommits: 0
    };

    const phasesDir = path.join(this.planningDir, 'phases');
    if (fs.existsSync(phasesDir)) {
      const phaseDirs = fs.readdirSync(phasesDir)
        .filter(name => fs.statSync(path.join(phasesDir, name)).isDirectory());

      stats.totalPhases = phaseDirs.length;

      phaseDirs.forEach(phaseDir => {
        const phasePath = path.join(phasesDir, phaseDir);
        const files = fs.readdirSync(phasePath);

        const planFiles = files.filter(f => f.endsWith('-PLAN.md'));
        const summaryFiles = files.filter(f => f.endsWith('-SUMMARY.md'));

        stats.completedPlans += summaryFiles.length;
        stats.pendingPlans += (planFiles.length - summaryFiles.length);
      });
    }

    return stats;
  }

  /**
   * Print project statistics
   */
  printStats() {
    const stats = this.getStats();

    console.log('\n📈 Project Statistics:\n');
    console.log(`  Total Phases:    ${stats.totalPhases}`);
    console.log(`  Completed Plans: ${stats.completedPlans}`);
    console.log(`  Pending Plans:   ${stats.pendingPlans}`);

    const progress = stats.totalPhases > 0
      ? ((stats.completedPlans / (stats.completedPlans + stats.pendingPlans)) * 100).toFixed(1)
      : 0;
    console.log(`  Progress:        ${progress}%\n`);
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const projectRoot = args[0] || process.cwd();

  const validator = new ProjectValidator(projectRoot);
  const isValid = validator.validate();

  // Print stats if validation passed
  if (isValid || validator.warnings.length === 0) {
    validator.printStats();
  }

  process.exit(isValid ? 0 : 1);
}

module.exports = ProjectValidator;
