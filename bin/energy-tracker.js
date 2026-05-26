#!/usr/bin/env node

/**
 * Energy level tracker for optimizing work schedules.
 *
 * Tracks personal energy patterns throughout the day to help users
 * schedule high-focus tasks during peak energy periods and rest during lows.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DATA_DIR = path.join(os.homedir(), '.gsd', 'energy-data');
const ENERGY_LOG = path.join(DATA_DIR, 'energy-log.json');

// Energy levels
const ENERGY_LEVELS = {
  EXHAUSTED: 1,
  LOW: 2,
  MODERATE: 3,
  GOOD: 4,
  PEAK: 5
};

// Task types
const TASK_TYPES = {
  DEEP_WORK: 'deep_work',
  CREATIVE: 'creative',
  MEETINGS: 'meetings',
  ADMIN: 'admin',
  LEARNING: 'learning'
};

class EnergyTracker {
  constructor() {
    this.ensureDataDir();
    this.loadData();
  }

  ensureDataDir() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  }

  loadData() {
    if (fs.existsSync(ENERGY_LOG)) {
      const data = fs.readFileSync(ENERGY_LOG, 'utf8');
      this.energyLog = JSON.parse(data);
    } else {
      this.energyLog = [];
    }
  }

  saveData() {
    fs.writeFileSync(ENERGY_LOG, JSON.stringify(this.energyLog, null, 2));
  }

  /**
   * Log current energy level.
   */
  logEnergy(level, notes = '') {
    const entry = {
      timestamp: new Date().toISOString(),
      hour: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      level: level,
      notes: notes
    };

    this.energyLog.push(entry);
    this.saveData();

    console.log(`✓ Energy level logged: ${this.getLevelName(level)} at ${new Date().toLocaleTimeString()}`);

    // Provide immediate insight
    const pattern = this.getHourlyPattern();
    const currentHour = new Date().getHours();
    const avgForHour = pattern.hourly[currentHour];

    if (avgForHour && Math.abs(level - avgForHour) > 1) {
      console.log(`\n⚠️  This is ${level > avgForHour ? 'higher' : 'lower'} than your typical ${currentHour}:00 energy`);
    }
  }

  /**
   * Get energy level name.
   */
  getLevelName(level) {
    const names = ['', 'Exhausted', 'Low', 'Moderate', 'Good', 'Peak'];
    return names[level] || 'Unknown';
  }

  /**
   * Analyze energy patterns.
   */
  getHourlyPattern() {
    if (this.energyLog.length < 10) {
      return {
        hourly: {},
        daily: {},
        message: 'Need more data (at least 10 entries) for pattern analysis'
      };
    }

    // Group by hour
    const hourlyData = {};
    const dailyData = {};

    this.energyLog.forEach(entry => {
      // Hourly patterns
      if (!hourlyData[entry.hour]) {
        hourlyData[entry.hour] = [];
      }
      hourlyData[entry.hour].push(entry.level);

      // Daily patterns
      if (!dailyData[entry.dayOfWeek]) {
        dailyData[entry.dayOfWeek] = [];
      }
      dailyData[entry.dayOfWeek].push(entry.level);
    });

    // Calculate averages
    const hourlyAvg = {};
    Object.keys(hourlyData).forEach(hour => {
      const levels = hourlyData[hour];
      hourlyAvg[hour] = levels.reduce((sum, l) => sum + l, 0) / levels.length;
    });

    const dailyAvg = {};
    Object.keys(dailyData).forEach(day => {
      const levels = dailyData[day];
      dailyAvg[day] = levels.reduce((sum, l) => sum + l, 0) / levels.length;
    });

    return {
      hourly: hourlyAvg,
      daily: dailyAvg
    };
  }

  /**
   * Get peak energy hours.
   */
  getPeakHours() {
    const pattern = this.getHourlyPattern();

    if (pattern.message) {
      return { message: pattern.message };
    }

    // Find hours with highest average energy
    const sorted = Object.entries(pattern.hourly)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return sorted.map(([hour, avg]) => ({
      hour: parseInt(hour),
      avgEnergy: avg.toFixed(2),
      timeSlot: this.formatHour(parseInt(hour))
    }));
  }

  /**
   * Get low energy hours.
   */
  getLowEnergyHours() {
    const pattern = this.getHourlyPattern();

    if (pattern.message) {
      return { message: pattern.message };
    }

    const sorted = Object.entries(pattern.hourly)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 3);

    return sorted.map(([hour, avg]) => ({
      hour: parseInt(hour),
      avgEnergy: avg.toFixed(2),
      timeSlot: this.formatHour(parseInt(hour))
    }));
  }

  /**
   * Recommend task scheduling.
   */
  recommendSchedule() {
    const peakHours = this.getPeakHours();
    const lowHours = this.getLowEnergyHours();

    if (peakHours.message) {
      return peakHours;
    }

    const recommendations = {
      peakEnergy: {
        hours: peakHours,
        recommendedTasks: [
          'Deep work and complex problem solving',
          'Important decision making',
          'Creative projects',
          'Learning new skills'
        ]
      },
      lowEnergy: {
        hours: lowHours,
        recommendedTasks: [
          'Email and admin tasks',
          'Routine meetings',
          'Data entry',
          'Simple organizational tasks',
          'Light reading'
        ]
      },
      general: [
        'Schedule your most important work during peak hours',
        'Use low energy periods for easier tasks',
        'Take breaks before energy drops too low',
        'Avoid scheduling back-to-back high-energy tasks'
      ]
    };

    return recommendations;
  }

  /**
   * Get weekly energy trend.
   */
  getWeeklyTrend() {
    const pattern = this.getHourlyPattern();

    if (pattern.message) {
      return { message: pattern.message };
    }

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const trend = Object.entries(pattern.daily)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([day, avg]) => ({
        day: days[parseInt(day)],
        avgEnergy: avg.toFixed(2),
        bars: '█'.repeat(Math.round(avg)) + '░'.repeat(5 - Math.round(avg))
      }));

    return trend;
  }

  /**
   * Predict current energy level based on time.
   */
  predictEnergy() {
    const pattern = this.getHourlyPattern();
    const currentHour = new Date().getHours();
    const currentDay = new Date().getDay();

    if (pattern.message) {
      return { message: pattern.message };
    }

    const hourlyPrediction = pattern.hourly[currentHour];
    const dailyFactor = pattern.daily[currentDay] || 3;

    if (!hourlyPrediction) {
      return {
        message: `No data for ${currentHour}:00. Log your energy to improve predictions!`
      };
    }

    // Adjust based on day of week
    const adjusted = (hourlyPrediction * 0.7) + (dailyFactor * 0.3);

    return {
      predictedLevel: Math.round(adjusted),
      levelName: this.getLevelName(Math.round(adjusted)),
      confidence: this.energyLog.filter(e => e.hour === currentHour).length >= 5 ? 'High' : 'Medium',
      recommendation: this.getRecommendationForLevel(Math.round(adjusted))
    };
  }

  /**
   * Get recommendation based on energy level.
   */
  getRecommendationForLevel(level) {
    const recommendations = {
      1: 'Take a break. Consider a short nap or walk. Avoid important decisions.',
      2: 'Stick to simple, routine tasks. Good time for email and admin work.',
      3: 'Moderate work is fine. Mix challenging and easier tasks.',
      4: 'Good time for focused work. Tackle important projects now.',
      5: 'Peak performance time! Schedule your most demanding work.'
    };

    return recommendations[level] || 'Track more data for personalized recommendations.';
  }

  /**
   * Format hour for display.
   */
  formatHour(hour) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
    return `${displayHour}:00 ${period}`;
  }

  /**
   * Generate energy report.
   */
  generateReport() {
    console.log('\n═══════════════════════════════════════');
    console.log('       ENERGY PATTERN ANALYSIS');
    console.log('═══════════════════════════════════════\n');

    // Total entries
    console.log(`📊 Total Energy Logs: ${this.energyLog.length}\n`);

    if (this.energyLog.length < 10) {
      console.log('⚠️  Need at least 10 energy logs for comprehensive analysis.');
      console.log('   Keep tracking to unlock insights!\n');
      return;
    }

    // Weekly trend
    console.log('📅 Weekly Energy Trend:');
    const weekly = this.getWeeklyTrend();
    weekly.forEach(day => {
      console.log(`   ${day.day.padEnd(10)} ${day.bars} ${day.avgEnergy}`);
    });

    // Peak hours
    console.log('\n⚡ Your Peak Energy Hours:');
    const peaks = this.getPeakHours();
    peaks.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.timeSlot} (avg: ${p.avgEnergy})`);
    });

    // Low energy hours
    console.log('\n😴 Your Low Energy Hours:');
    const lows = this.getLowEnergyHours();
    lows.forEach((l, i) => {
      console.log(`   ${i + 1}. ${l.timeSlot} (avg: ${l.avgEnergy})`);
    });

    // Current prediction
    const prediction = this.predictEnergy();
    if (!prediction.message) {
      console.log('\n🔮 Right Now:');
      console.log(`   Predicted Energy: ${prediction.levelName}`);
      console.log(`   Confidence: ${prediction.confidence}`);
      console.log(`   💡 ${prediction.recommendation}`);
    }

    // Recommendations
    console.log('\n📋 Scheduling Recommendations:');
    const schedule = this.recommendSchedule();
    console.log('\n   Peak Hours (Deep Work):');
    schedule.peakEnergy.recommendedTasks.forEach(task => {
      console.log(`   • ${task}`);
    });

    console.log('\n   Low Energy (Light Tasks):');
    schedule.lowEnergy.recommendedTasks.slice(0, 3).forEach(task => {
      console.log(`   • ${task}`);
    });

    console.log('\n═══════════════════════════════════════\n');
  }

  /**
   * Export energy data.
   */
  exportData() {
    const exportPath = path.join(DATA_DIR, `energy-export-${Date.now()}.json`);
    const exportData = {
      exported: new Date().toISOString(),
      totalEntries: this.energyLog.length,
      pattern: this.getHourlyPattern(),
      recommendations: this.recommendSchedule(),
      rawData: this.energyLog
    };

    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2));
    console.log(`✓ Data exported to: ${exportPath}`);
  }
}

// CLI Interface
const args = process.argv.slice(2);
const command = args[0];

const tracker = new EnergyTracker();

switch (command) {
  case 'log':
    const level = parseInt(args[1]);
    const notes = args.slice(2).join(' ');

    if (!level || level < 1 || level > 5) {
      console.log('Usage: gsd energy log <1-5> [notes]');
      console.log('\nEnergy Levels:');
      console.log('  1 - Exhausted');
      console.log('  2 - Low');
      console.log('  3 - Moderate');
      console.log('  4 - Good');
      console.log('  5 - Peak');
      process.exit(1);
    }

    tracker.logEnergy(level, notes);
    break;

  case 'report':
    tracker.generateReport();
    break;

  case 'predict':
    const prediction = tracker.predictEnergy();
    if (prediction.message) {
      console.log(prediction.message);
    } else {
      console.log(`\n🔮 Energy Prediction for ${new Date().toLocaleTimeString()}`);
      console.log(`   Level: ${prediction.levelName} (${prediction.predictedLevel}/5)`);
      console.log(`   Confidence: ${prediction.confidence}`);
      console.log(`\n   💡 ${prediction.recommendation}\n`);
    }
    break;

  case 'export':
    tracker.exportData();
    break;

  default:
    console.log('Energy Tracker - Optimize your work schedule\n');
    console.log('Usage:');
    console.log('  gsd energy log <1-5> [notes]  - Log current energy level');
    console.log('  gsd energy report             - View energy patterns');
    console.log('  gsd energy predict            - Predict current energy');
    console.log('  gsd energy export             - Export data');
    console.log('\nEnergy Levels: 1=Exhausted, 2=Low, 3=Moderate, 4=Good, 5=Peak');
}

module.exports = EnergyTracker;
