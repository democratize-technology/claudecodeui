/**
 * Regression Test Sequencer
 *
 * Custom test sequencer that optimizes the order of regression tests
 * for faster feedback and better parallelization.
 */

const Sequencer = require('@jest/test-sequencer').default;

class RegressionSequencer extends Sequencer {
  sort(tests) {
    // Sort tests by priority for regression testing
    return tests.sort((testA, testB) => {
      // Performance tests first (most likely to catch regressions)
      const aIsPerf = testA.path.includes('performance');
      const bIsPerf = testB.path.includes('performance');

      if (aIsPerf && !bIsPerf) return -1;
      if (!aIsPerf && bIsPerf) return 1;

      // FOUC tests second (critical UI issue)
      const aIsFouc = testA.path.includes('fouc');
      const bIsFouc = testB.path.includes('fouc');

      if (aIsFouc && !bIsFouc) return -1;
      if (!aIsFouc && bIsFouc) return 1;

      // Then by file size (smaller tests first for faster feedback)
      return testA.stats.size - testB.stats.size;
    });
  }
}

module.exports = RegressionSequencer;