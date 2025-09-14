/**
 * Jest Configuration for UI Regression Tests
 *
 * Optimized configuration specifically for regression testing to ensure
 * critical UI bugs don't return. Includes performance monitoring,
 * visual regression detection, and comprehensive coverage tracking.
 */

/** @type {import('jest').Config} */
export default {
  // Extend base config
  preset: './jest.config.js',

  // Test environment optimized for UI testing
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'http://localhost:3000',
    // Enable performance APIs for benchmarking
    pretendToBeVisual: true,
    resources: 'usable'
  },

  // Focus on regression tests
  testMatch: [
    '<rootDir>/src/__tests__/regression/**/*.test.(js|jsx)'
  ],

  // Exclude reporter files from test execution
  testPathIgnorePatterns: [
    '/node_modules/',
    '<rootDir>/src/__tests__/reporters/',
    '<rootDir>/src/__tests__/processors/',
    '<rootDir>/src/__tests__/plugins/',
    '<rootDir>/src/__tests__/sequencer/'
  ],

  // Setup files for regression testing
  setupFilesAfterEnv: [
    '<rootDir>/src/setupTests.js',
    '<rootDir>/src/__tests__/setup/regression-setup.js'
  ],

  // Module name mapping with additional mocks for stability
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      'jest-transform-stub',
    // Mock WebSocket for integration tests
    '^ws$': '<rootDir>/src/__tests__/mocks/websocket-mock.js'
  },

  // Transform configuration
  transform: {
    '^.+\\.(js|jsx)$': [
      'babel-jest',
      {
        presets: [
          ['@babel/preset-env', { targets: { node: 'current' } }],
          ['@babel/preset-react', { runtime: 'automatic' }]
        ],
        // Plugins disabled due to missing dependencies
        // plugins: [
        //   // Enable source maps for better debugging
        //   ['babel-plugin-source-map-support', { registerInstance: false }]
        // ]
      }
    ]
  },

  // Coverage configuration focused on regression-critical areas
  collectCoverageFrom: [
    'src/contexts/ThemeContext.jsx',
    'src/components/ErrorBoundary.jsx',
    'src/components/MobileNav.jsx',
    'src/__tests__/utils/test-utils.js',
    '!**/node_modules/**',
    '!**/*.test.js',
    '!**/*.spec.js'
  ],

  // Strict coverage thresholds for critical components
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    // Specific thresholds for critical components
    'src/contexts/ThemeContext.jsx': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/components/ErrorBoundary.jsx': {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95
    },
    'src/components/MobileNav.jsx': {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },

  // Performance and timeout settings
  testTimeout: 30000, // Longer timeout for performance tests
  maxWorkers: '50%', // Use half the available cores for stability

  // Error handling
  bail: 0, // Don't bail on first failure - run all regression tests
  verbose: true,

  // Reporters for CI/CD integration
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'test-results/regression',
        outputName: 'regression-results.xml',
        classNameTemplate: '{classname}',
        titleTemplate: '{title}',
        suiteNameTemplate: '{filepath}',
        includeConsoleOutput: true
      }
    ],
    // Performance reporter for benchmarking
    '<rootDir>/src/__tests__/reporters/performance-reporter.cjs'
  ],

  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'cobertura', // For CI/CD integration
    'json-summary' // For programmatic access
  ],

  coverageDirectory: 'coverage/regression',

  // Global test configuration
  globals: {
    'ts-jest': {
      useESM: true
    },
    // Performance budgets (ms)
    PERFORMANCE_BUDGETS: {
      INITIAL_RENDER: 200,
      THEME_SWITCH: 150,
      TAB_NAVIGATION: 100,
      ERROR_RECOVERY: 200,
      COMPONENT_UPDATE: 50,
      MOBILE_NAV_TRANSITION: 300,
      FULL_APP_RENDER: 500
    }
  },

  // Clear mocks between tests for isolation
  clearMocks: true,
  restoreMocks: true,

  // Detect open handles and async operations
  detectOpenHandles: true,
  forceExit: false,

  // Test result processor for custom metrics
  testResultsProcessor: '<rootDir>/src/__tests__/processors/regression-processor.cjs',

  // Watch plugins for development (commented out due to missing dependencies)
  // watchPlugins: [
  //   'jest-watch-typeahead/filename',
  //   'jest-watch-typeahead/testname',
  //   '<rootDir>/src/__tests__/plugins/regression-watch-plugin.js'
  // ],

  // Custom test sequencer for optimal regression test order (commented out for now)
  // testSequencer: '<rootDir>/src/__tests__/sequencer/regression-sequencer.js'
};
