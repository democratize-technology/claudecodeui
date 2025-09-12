module.exports = {
  preset: 'jest-puppeteer',
  testMatch: [
    '<rootDir>/tests/e2e/**/*.test.js'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/tests/e2e/setup.js'
  ],
  testTimeout: 30000,
  globalSetup: 'jest-environment-puppeteer/setup',
  globalTeardown: 'jest-environment-puppeteer/teardown',
  testEnvironment: 'jest-environment-puppeteer',
  verbose: true,
  collectCoverage: false
};