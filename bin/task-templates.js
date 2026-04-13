#!/usr/bin/env node

/**
 * @fileoverview Task templates for get-shit-done.
 *
 * Provides pre-defined task templates for common workflows
 * to speed up task creation and ensure consistency.
 *
 * @module bin/task-templates
 *
 * @example
 * // List available templates
 * node bin/task-templates.js list
 *
 * // Create from template
 * node bin/task-templates.js create bug-fix --title "Fix login bug"
 */

const fs = require("fs");
const path = require("path");

/**
 * @typedef {Object} TaskTemplate
 * @property {string} name - Template identifier
 * @property {string} description - What this template is for
 * @property {string} category - Template category
 * @property {string[]} subtasks - Default subtasks to include
 * @property {string[]} labels - Default labels
 * @property {string} [estimatedTime] - Estimated time to complete
 * @property {Object} [metadata] - Additional template metadata
 */

/**
 * Built-in task templates for common workflows.
 * @type {Object.<string, TaskTemplate>}
 */
const templates = {
  "bug-fix": {
    name: "bug-fix",
    description: "Template for fixing bugs",
    category: "development",
    subtasks: [
      "Reproduce the bug",
      "Identify root cause",
      "Write failing test",
      "Implement fix",
      "Verify fix passes test",
      "Test edge cases",
      "Update documentation if needed",
      "Create PR"
    ],
    labels: ["bug", "fix"],
    estimatedTime: "2-4 hours",
    metadata: {
      priority: "high",
      requiresReview: true
    }
  },

  "new-feature": {
    name: "new-feature",
    description: "Template for implementing new features",
    category: "development",
    subtasks: [
      "Define acceptance criteria",
      "Design solution approach",
      "Break down into smaller tasks",
      "Set up feature branch",
      "Implement core functionality",
      "Add unit tests",
      "Add integration tests",
      "Update documentation",
      "Create PR",
      "Address review feedback"
    ],
    labels: ["feature", "enhancement"],
    estimatedTime: "1-2 days",
    metadata: {
      priority: "medium",
      requiresReview: true,
      requiresDesign: true
    }
  },

  "code-review": {
    name: "code-review",
    description: "Template for reviewing pull requests",
    category: "review",
    subtasks: [
      "Read PR description and context",
      "Review file changes",
      "Check code style and conventions",
      "Verify test coverage",
      "Test functionality locally",
      "Check for security issues",
      "Leave constructive feedback",
      "Approve or request changes"
    ],
    labels: ["review"],
    estimatedTime: "30-60 minutes",
    metadata: {
      priority: "high"
    }
  },

  refactor: {
    name: "refactor",
    description: "Template for code refactoring",
    category: "development",
    subtasks: [
      "Identify code to refactor",
      "Ensure tests exist for current behavior",
      "Plan refactoring approach",
      "Refactor in small increments",
      "Run tests after each change",
      "Update documentation",
      "Create PR"
    ],
    labels: ["refactor", "tech-debt"],
    estimatedTime: "2-4 hours",
    metadata: {
      priority: "medium",
      requiresTests: true
    }
  },

  documentation: {
    name: "documentation",
    description: "Template for documentation tasks",
    category: "docs",
    subtasks: [
      "Identify documentation needs",
      "Gather information from code/team",
      "Write draft content",
      "Add code examples",
      "Review for clarity and accuracy",
      "Get feedback from team",
      "Finalize and publish"
    ],
    labels: ["documentation"],
    estimatedTime: "1-2 hours",
    metadata: {
      priority: "low"
    }
  },

  release: {
    name: "release",
    description: "Template for release preparation",
    category: "release",
    subtasks: [
      "Review pending changes",
      "Update version number",
      "Update CHANGELOG",
      "Run full test suite",
      "Build production artifacts",
      "Test production build",
      "Create release branch/tag",
      "Deploy to staging",
      "Verify staging deployment",
      "Deploy to production",
      "Monitor for issues",
      "Announce release"
    ],
    labels: ["release"],
    estimatedTime: "2-3 hours",
    metadata: {
      priority: "high",
      critical: true
    }
  },

  "security-review": {
    name: "security-review",
    description: "Template for security review tasks",
    category: "security",
    subtasks: [
      "Review authentication flows",
      "Check authorization logic",
      "Audit input validation",
      "Check for SQL injection risks",
      "Check for XSS vulnerabilities",
      "Review dependency vulnerabilities",
      "Check secrets management",
      "Document findings",
      "Create remediation tasks"
    ],
    labels: ["security", "audit"],
    estimatedTime: "3-4 hours",
    metadata: {
      priority: "high",
      critical: true
    }
  },

  "performance-optimization": {
    name: "performance-optimization",
    description: "Template for performance improvements",
    category: "performance",
    subtasks: [
      "Establish baseline metrics",
      "Profile application",
      "Identify bottlenecks",
      "Research optimization strategies",
      "Implement optimizations",
      "Measure improvements",
      "Verify no regressions",
      "Document changes"
    ],
    labels: ["performance", "optimization"],
    estimatedTime: "4-8 hours",
    metadata: {
      priority: "medium"
    }
  },

  meeting: {
    name: "meeting",
    description: "Template for meeting preparation",
    category: "planning",
    subtasks: [
      "Define meeting agenda",
      "Invite participants",
      "Prepare presentation/materials",
      "Set up meeting room/link",
      "Send reminder",
      "Conduct meeting",
      "Document action items",
      "Follow up on action items"
    ],
    labels: ["meeting"],
    estimatedTime: "variable",
    metadata: {
      priority: "medium"
    }
  },

  "sprint-planning": {
    name: "sprint-planning",
    description: "Template for sprint planning",
    category: "planning",
    subtasks: [
      "Review backlog",
      "Prioritize items",
      "Estimate effort",
      "Assign tasks",
      "Define sprint goal",
      "Set up sprint board",
      "Communicate plan to team"
    ],
    labels: ["planning", "sprint"],
    estimatedTime: "1-2 hours",
    metadata: {
      recurring: "bi-weekly"
    }
  }
};

/**
 * Get all available template names.
 *
 * @returns {string[]} Array of template names
 */
function listTemplates() {
  return Object.keys(templates);
}

/**
 * Get templates by category.
 *
 * @param {string} category - Category to filter by
 * @returns {TaskTemplate[]} Templates in the category
 */
function getTemplatesByCategory(category) {
  return Object.values(templates).filter((t) => t.category === category);
}

/**
 * Get all unique categories.
 *
 * @returns {string[]} Array of category names
 */
function getCategories() {
  return [...new Set(Object.values(templates).map((t) => t.category))];
}

/**
 * Get a specific template by name.
 *
 * @param {string} name - Template name
 * @returns {TaskTemplate|null} The template or null if not found
 */
function getTemplate(name) {
  return templates[name] || null;
}

/**
 * Create a task from a template.
 *
 * @param {string} templateName - Name of the template to use
 * @param {Object} overrides - Values to override from template
 * @param {string} [overrides.title] - Task title
 * @param {string} [overrides.description] - Task description
 * @param {string[]} [overrides.additionalSubtasks] - Extra subtasks
 * @param {string[]} [overrides.additionalLabels] - Extra labels
 * @returns {Object} Task object ready to create
 */
function createFromTemplate(templateName, overrides = {}) {
  const template = getTemplate(templateName);

  if (!template) {
    throw new Error(`Template "${templateName}" not found`);
  }

  const task = {
    title: overrides.title || `New ${template.name} task`,
    description: overrides.description || template.description,
    subtasks: [...template.subtasks],
    labels: [...template.labels],
    estimatedTime: template.estimatedTime,
    metadata: { ...template.metadata, template: templateName },
    createdAt: new Date().toISOString(),
    status: "pending"
  };

  // Add any additional subtasks
  if (overrides.additionalSubtasks) {
    task.subtasks = [...task.subtasks, ...overrides.additionalSubtasks];
  }

  // Add any additional labels
  if (overrides.additionalLabels) {
    task.labels = [...new Set([...task.labels, ...overrides.additionalLabels])];
  }

  return task;
}

/**
 * Format template for display.
 *
 * @param {TaskTemplate} template - Template to format
 * @returns {string} Formatted template description
 */
function formatTemplate(template) {
  const lines = [
    `Name: ${template.name}`,
    `Category: ${template.category}`,
    `Description: ${template.description}`,
    `Estimated Time: ${template.estimatedTime || "Not specified"}`,
    "",
    "Subtasks:",
    ...template.subtasks.map((s, i) => `  ${i + 1}. ${s}`),
    "",
    `Labels: ${template.labels.join(", ")}`
  ];

  return lines.join("\n");
}

/**
 * Export templates to JSON file.
 *
 * @param {string} filePath - Path to export to
 */
function exportTemplates(filePath) {
  fs.writeFileSync(filePath, JSON.stringify(templates, null, 2));
}

/**
 * Import custom templates from JSON file.
 *
 * @param {string} filePath - Path to import from
 * @returns {Object} Merged templates object
 */
function importTemplates(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const imported = JSON.parse(content);

  // Validate imported templates
  for (const [name, template] of Object.entries(imported)) {
    if (!template.name || !template.subtasks || !Array.isArray(template.subtasks)) {
      throw new Error(`Invalid template format for "${name}"`);
    }
  }

  return { ...templates, ...imported };
}

// CLI handling
function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "list":
      console.log("Available templates:\n");
      const categories = getCategories();
      for (const category of categories) {
        console.log(`\n${category.toUpperCase()}:`);
        const catTemplates = getTemplatesByCategory(category);
        for (const t of catTemplates) {
          console.log(`  ${t.name} - ${t.description}`);
        }
      }
      break;

    case "show":
      const templateName = args[1];
      if (!templateName) {
        console.error("Usage: task-templates show <template-name>");
        process.exit(1);
      }
      const template = getTemplate(templateName);
      if (!template) {
        console.error(`Template "${templateName}" not found`);
        process.exit(1);
      }
      console.log(formatTemplate(template));
      break;

    case "create":
      const createName = args[1];
      const title = args.find((a) => a.startsWith("--title="))?.split("=")[1];
      if (!createName) {
        console.error("Usage: task-templates create <template-name> --title=<title>");
        process.exit(1);
      }
      try {
        const task = createFromTemplate(createName, { title });
        console.log(JSON.stringify(task, null, 2));
      } catch (err) {
        console.error(err.message);
        process.exit(1);
      }
      break;

    case "export":
      const exportPath = args[1] || "templates.json";
      exportTemplates(exportPath);
      console.log(`Templates exported to ${exportPath}`);
      break;

    case "categories":
      console.log("Categories:", getCategories().join(", "));
      break;

    default:
      console.log(`
get-shit-done Task Templates

Usage:
  task-templates list                     List all available templates
  task-templates show <name>              Show details for a template
  task-templates create <name> [options]  Create a task from template
  task-templates categories               List all categories
  task-templates export [path]            Export templates to JSON

Options for create:
  --title=<title>    Set the task title

Examples:
  task-templates show bug-fix
  task-templates create new-feature --title="Add dark mode"
      `);
  }
}

// Export for use as module
module.exports = {
  templates,
  listTemplates,
  getTemplate,
  getTemplatesByCategory,
  getCategories,
  createFromTemplate,
  formatTemplate,
  exportTemplates,
  importTemplates
};

// Run CLI if executed directly
if (require.main === module) {
  main();
}
