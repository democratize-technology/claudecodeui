/**
 * Performance Reporter for Jest
 *
 * Custom Jest reporter that tracks performance metrics during regression tests
 * and generates performance reports for CI/CD integration.
 */

class PerformanceReporter {
  constructor(globalConfig, options) {
    this.globalConfig = globalConfig;
    this.options = options || {};
    this.performanceData = [];
    this.testResults = [];
  }

  onRunStart(aggregatedResults, options) {
    console.log('🚀 Starting UI Regression Performance Testing...\n');
    this.startTime = Date.now();
  }

  onTestResult(test, testResult, aggregatedResults) {
    // Extract performance data from test results
    const performanceMetrics = this.extractPerformanceMetrics(testResult);

    if (performanceMetrics.length > 0) {
      this.performanceData.push({
        testFile: test.path,
        testName: testResult.testResults.map((t) => t.title).join(' > '),
        metrics: performanceMetrics,
        duration: testResult.perfStats.end - testResult.perfStats.start
      });
    }

    // Check for performance budget violations
    const budgetViolations = this.checkPerformanceBudgets(performanceMetrics);
    if (budgetViolations.length > 0) {
      this.logBudgetViolations(test.path, budgetViolations);
    }

    this.testResults.push({
      testFile: test.path,
      success: testResult.numFailingTests === 0,
      duration: testResult.perfStats.end - testResult.perfStats.start,
      failureMessages: testResult.testResults
        .filter((t) => t.status === 'failed')
        .map((t) => t.failureMessages)
        .flat()
    });
  }

  onRunComplete(contexts, results) {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    console.log('\n📊 Performance Test Summary');
    console.log('================================');

    this.generatePerformanceSummary();
    this.generatePerformanceReport();
    this.checkOverallBudgetCompliance();

    console.log(`\n⏱️  Total test duration: ${totalDuration}ms`);
    console.log(`✅ Tests passed: ${results.numPassedTests}`);
    console.log(`❌ Tests failed: ${results.numFailedTests}`);

    if (results.numFailedTests > 0) {
      console.log('\n🚨 REGRESSION TEST FAILURES DETECTED!');
      console.log('Review the failures above - these may indicate UI regressions.');
    } else {
      console.log('\n🎉 All regression tests passed! UI stability maintained.');
    }
  }

  extractPerformanceMetrics(testResult) {
    const metrics = [];

    // Look for performance data in console messages or test names
    testResult.testResults.forEach((test) => {
      // Extract timing data from test names or descriptions
      const titleMatch = test.title.match(/(\d+\.?\d*)ms/);
      if (titleMatch) {
        metrics.push({
          operation: test.title.replace(/\s*\d+\.?\d*ms.*/, ''),
          duration: parseFloat(titleMatch[1]),
          budget: this.getBudgetForOperation(test.title),
          timestamp: Date.now()
        });
      }

      // Extract performance data from console output
      if (test.console) {
        test.console.forEach((msg) => {
          const perfMatch = msg.message.match(/(.+): (\d+\.?\d*)ms \(budget: (\d+)ms\)/);
          if (perfMatch) {
            metrics.push({
              operation: perfMatch[1],
              duration: parseFloat(perfMatch[2]),
              budget: parseFloat(perfMatch[3]),
              timestamp: Date.now()
            });
          }
        });
      }
    });

    return metrics;
  }

  getBudgetForOperation(operation) {
    const budgets = {
      'initial render': 200,
      'theme switch': 150,
      'tab navigation': 100,
      'error recovery': 200,
      'component update': 50,
      'mobile nav': 300,
      'full app render': 500
    };

    const operationLower = operation.toLowerCase();
    for (const [key, budget] of Object.entries(budgets)) {
      if (operationLower.includes(key)) {
        return budget;
      }
    }

    return null;
  }

  checkPerformanceBudgets(metrics) {
    const violations = [];

    metrics.forEach((metric) => {
      if (metric.budget && metric.duration > metric.budget) {
        violations.push({
          operation: metric.operation,
          actual: metric.duration,
          budget: metric.budget,
          exceeded: metric.duration - metric.budget
        });
      }
    });

    return violations;
  }

  logBudgetViolations(testFile, violations) {
    console.log(`\n⚠️  Performance Budget Violations in ${testFile}:`);
    violations.forEach((violation) => {
      console.log(
        `   ${violation.operation}: ${violation.actual.toFixed(2)}ms ` +
          `(budget: ${violation.budget}ms, exceeded by: ${violation.exceeded.toFixed(2)}ms)`
      );
    });
  }

  generatePerformanceSummary() {
    if (this.performanceData.length === 0) {
      console.log('No performance data collected');
      return;
    }

    const allMetrics = this.performanceData
      .map((d) => d.metrics)
      .flat()
      .filter((m) => m.budget);

    if (allMetrics.length === 0) {
      console.log('No performance metrics with budgets found');
      return;
    }

    // Group by operation type
    const groupedMetrics = allMetrics.reduce((groups, metric) => {
      const key = metric.operation;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
      return groups;
    }, {});

    // Calculate statistics for each operation
    Object.entries(groupedMetrics).forEach(([operation, metrics]) => {
      const durations = metrics.map((m) => m.duration);
      const budget = metrics[0].budget;

      const avg = durations.reduce((sum, d) => sum + d, 0) / durations.length;
      const min = Math.min(...durations);
      const max = Math.max(...durations);
      const violations = metrics.filter((m) => m.duration > m.budget).length;

      const status = avg <= budget ? '✅' : '❌';

      console.log(
        `${status} ${operation}: avg ${avg.toFixed(1)}ms, ` +
          `min ${min.toFixed(1)}ms, max ${max.toFixed(1)}ms ` +
          `(budget: ${budget}ms, violations: ${violations}/${metrics.length})`
      );
    });
  }

  generatePerformanceReport() {
    const reportData = {
      timestamp: new Date().toISOString(),
      totalTests: this.testResults.length,
      passedTests: this.testResults.filter((t) => t.success).length,
      failedTests: this.testResults.filter((t) => !t.success).length,
      performanceMetrics: this.performanceData,
      budgetViolations: this.getAllBudgetViolations(),
      summary: this.generateSummaryStats()
    };

    // Write JSON report for programmatic access
    const fs = require('fs');
    const path = require('path');

    const reportDir = path.join(process.cwd(), 'test-results', 'regression');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const reportPath = path.join(reportDir, 'performance-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    console.log(`\n📄 Performance report written to: ${reportPath}`);

    // Generate markdown report for human readability
    this.generateMarkdownReport(reportData, reportDir);
  }

  generateMarkdownReport(data, reportDir) {
    const fs = require('fs');
    const path = require('path');

    let markdown = `# UI Regression Performance Report

Generated: ${data.timestamp}

## Summary

- **Total Tests:** ${data.totalTests}
- **Passed:** ${data.passedTests}
- **Failed:** ${data.failedTests}
- **Success Rate:** ${((data.passedTests / data.totalTests) * 100).toFixed(1)}%

## Performance Metrics

`;

    if (data.performanceMetrics.length > 0) {
      markdown += `| Operation | Average (ms) | Budget (ms) | Status |\n`;
      markdown += `|-----------|--------------|-------------|--------|\n`;

      const grouped = data.summary.operationStats || {};
      Object.entries(grouped).forEach(([operation, stats]) => {
        const status = stats.average <= stats.budget ? '✅ Pass' : '❌ Fail';
        markdown += `| ${operation} | ${stats.average.toFixed(1)} | ${stats.budget} | ${status} |\n`;
      });
    } else {
      markdown += 'No performance metrics collected.\n';
    }

    markdown += `\n## Budget Violations

`;

    if (data.budgetViolations.length > 0) {
      markdown += `⚠️ **${data.budgetViolations.length} budget violations detected:**\n\n`;
      data.budgetViolations.forEach((violation) => {
        markdown += `- **${violation.operation}:** ${violation.actual.toFixed(2)}ms (budget: ${violation.budget}ms)\n`;
      });
    } else {
      markdown += '✅ No performance budget violations detected.\n';
    }

    markdown += `\n## Recommendations

`;

    if (data.budgetViolations.length > 0) {
      markdown += `- Investigate the ${data.budgetViolations.length} operations that exceeded performance budgets
- Consider optimizing components or adjusting budgets if the violations are acceptable
- Review the performance impact of recent changes
`;
    } else {
      markdown += `- All performance budgets are being met ✅
- Consider tightening budgets to maintain performance over time
- Monitor trends to catch performance regressions early
`;
    }

    const markdownPath = path.join(reportDir, 'performance-report.md');
    fs.writeFileSync(markdownPath, markdown);

    console.log(`📝 Markdown report written to: ${markdownPath}`);
  }

  getAllBudgetViolations() {
    const violations = [];

    this.performanceData.forEach((data) => {
      const budgetViolations = this.checkPerformanceBudgets(data.metrics);
      violations.push(...budgetViolations);
    });

    return violations;
  }

  generateSummaryStats() {
    const allMetrics = this.performanceData
      .map((d) => d.metrics)
      .flat()
      .filter((m) => m.budget);

    const groupedMetrics = allMetrics.reduce((groups, metric) => {
      const key = metric.operation;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
      return groups;
    }, {});

    const operationStats = {};
    Object.entries(groupedMetrics).forEach(([operation, metrics]) => {
      const durations = metrics.map((m) => m.duration);
      operationStats[operation] = {
        average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        budget: metrics[0].budget,
        violations: metrics.filter((m) => m.duration > m.budget).length,
        total: metrics.length
      };
    });

    return {
      operationStats,
      totalMetrics: allMetrics.length,
      totalViolations: this.getAllBudgetViolations().length
    };
  }

  checkOverallBudgetCompliance() {
    const violations = this.getAllBudgetViolations();

    if (violations.length > 0) {
      console.log(`\n🚨 PERFORMANCE REGRESSION DETECTED!`);
      console.log(`${violations.length} operations exceeded their performance budgets.`);
      console.log('This may indicate a performance regression that needs investigation.');

      // Exit with error code for CI/CD integration
      if (process.env.CI) {
        process.exitCode = 1;
      }
    } else {
      console.log(`\n🎯 All performance budgets met! No regressions detected.`);
    }
  }
}

module.exports = PerformanceReporter;
