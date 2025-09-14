/**
 * Regression Watch Plugin for Jest
 *
 * Custom Jest watch plugin for regression testing workflow
 */

class RegressionWatchPlugin {
  constructor({ config }) {
    this.config = config;
  }

  getUsageInfo() {
    return {
      key: 'r',
      prompt: 'run regression tests'
    };
  }

  run() {
    return Promise.resolve({
      shouldRunTests: true,
      testNamePattern: '.*regression.*'
    });
  }
}

module.exports = RegressionWatchPlugin;