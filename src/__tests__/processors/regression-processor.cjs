/**
 * Regression Test Results Processor
 *
 * Processes Jest test results to extract regression-specific metrics
 * and provide additional insights for UI stability testing.
 */

module.exports = (testResult) => {
  // Add regression-specific processing
  const processedResult = {
    ...testResult,
    regressionMetrics: {
      performanceViolations: 0,
      stabilityScore: 100,
      componentsCovered: []
    }
  };

  // Extract regression-specific data from test results
  if (testResult.testResults) {
    testResult.testResults.forEach(test => {
      // Check for performance budget violations in test names
      if (test.title && test.title.includes('performance') && test.status === 'failed') {
        processedResult.regressionMetrics.performanceViolations++;
        processedResult.regressionMetrics.stabilityScore -= 10;
      }

      // Track tested components
      if (test.ancestorTitles && test.ancestorTitles.length > 0) {
        const component = test.ancestorTitles[0];
        if (!processedResult.regressionMetrics.componentsCovered.includes(component)) {
          processedResult.regressionMetrics.componentsCovered.push(component);
        }
      }
    });
  }

  return processedResult;
};