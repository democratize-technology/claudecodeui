const path = require('path');
const authHelper = require('./auth-helper');

// Environment-aware configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5174';
const DEFAULT_TIMEOUT = parseInt(process.env.E2E_TIMEOUT || '15000');
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Environment-aware logging
const logger =
  process.env.NODE_ENV === 'production'
    ? {
        log: () => {},
        error: console.error,
        warn: console.warn
      }
    : console;

// Test configuration
global.BASE_URL = BASE_URL;
global.SCREENSHOT_DIR = SCREENSHOT_DIR;
global.DEFAULT_TIMEOUT = DEFAULT_TIMEOUT;
global.MOBILE_VIEWPORT = { width: 375, height: 667 };
global.DESKTOP_VIEWPORT = { width: 1280, height: 720 };
global.logger = logger;

// Make auth helper available globally
global.authHelper = authHelper;

// Helper functions available in all tests
global.waitForSelector = async (page, selector, options = {}) => {
  const timeout = options.timeout || global.DEFAULT_TIMEOUT;
  try {
    await page.waitForSelector(selector, { visible: true, timeout });
    return true;
  } catch (error) {
    logger.log(`Selector "${selector}" not found within ${timeout}ms`);
    throw error;
  }
};

// Use centralized screenshot utility from auth-helper
global.takeScreenshot = authHelper.takeScreenshot;

global.waitForElementAndClick = async (page, selector, options = {}) => {
  await global.waitForSelector(page, selector, options);

  // Take screenshot before clicking
  await global.takeScreenshot(page, `before-click-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);

  // Click the element
  await page.click(selector);

  // Wait a moment for any visual feedback
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Take screenshot after clicking
  await global.takeScreenshot(page, `after-click-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);
};

global.simulateMobileTouch = async (page, selector, options = {}) => {
  await global.waitForSelector(page, selector, options);

  // Take screenshot before touch
  await global.takeScreenshot(page, `before-touch-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);

  // Get element position
  const element = await page.$(selector);
  const box = await element.boundingBox();

  // Simulate touch start, move, and end
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

  // Wait for any animations or state changes
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Take screenshot after touch
  await global.takeScreenshot(page, `after-touch-${selector.replace(/[^a-zA-Z0-9]/g, '_')}`);
};

global.navigateToApp = async (page, options = {}) => {
  const { skipAuth = false } = options;

  if (skipAuth) {
    // Original behavior for tests that need to test login flow
    logger.log(`Navigating to: ${global.BASE_URL} (unauthenticated)`);
    await page.goto(global.BASE_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait for React to hydrate and initial API calls to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot of initial app state
    await global.takeScreenshot(page, 'app-loaded');
  } else {
    // New behavior: authenticate automatically
    logger.log(`Navigating to: ${global.BASE_URL} (with authentication)`);
    await global.authHelper.navigateToAppAuthenticated(page);
  }
};

// Test lifecycle hooks
beforeEach(async () => {
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );
});

afterEach(async () => {
  // Take final screenshot if test failed
  const testState = expect.getState();
  if (testState.currentTestName && testState.assertionCalls === 0) {
    await global.takeScreenshot(page, 'test-final-state');
  }
});
