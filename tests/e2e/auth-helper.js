/**
 * E2E Authentication Helper
 *
 * Provides authentication utilities for end-to-end tests.
 * Handles automatic login and JWT token management to bypass login screens.
 */

const fs = require('fs');
const path = require('path');

// Environment-aware configuration
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5174';
const DEFAULT_TIMEOUT = parseInt(process.env.E2E_TIMEOUT || '15000');
const AUTH_WAIT_TIMEOUT = parseInt(process.env.E2E_AUTH_TIMEOUT || '3000');
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

// Test user credentials (matches database)
const TEST_CREDENTIALS = {
  username: 'testuser',
  password: 'password123' // This should match the password used when creating testuser
};

/**
 * Clean up old screenshots to prevent disk space accumulation
 * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
 */
function cleanupScreenshots(maxAge = 24 * 60 * 60 * 1000) {
  try {
    if (!fs.existsSync(SCREENSHOT_DIR)) return;

    const files = fs.readdirSync(SCREENSHOT_DIR);
    const now = Date.now();

    files.forEach((file) => {
      const filePath = path.join(SCREENSHOT_DIR, file);
      const stats = fs.statSync(filePath);
      const age = now - stats.mtime.getTime();

      if (age > maxAge && file.endsWith('.png')) {
        fs.unlinkSync(filePath);
        logger.log(`🗑️ Cleaned up old screenshot: ${file}`);
      }
    });
  } catch (error) {
    logger.error('Failed to cleanup screenshots:', error);
  }
}

/**
 * Take screenshot with automatic cleanup
 * @param {Object} page - Puppeteer page instance
 * @param {string} name - Screenshot name
 */
async function takeScreenshot(page, name) {
  try {
    // Ensure screenshot directory exists
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }

    // Clean up old screenshots first
    cleanupScreenshots();

    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    await page.screenshot({ path: filepath, fullPage: true });
    logger.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
  } catch (error) {
    logger.error('Failed to take screenshot:', error);
    return null;
  }
}

/**
 * Authenticate test user and return JWT token
 * @returns {Promise<string>} JWT token
 */
async function getAuthToken() {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(TEST_CREDENTIALS)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Login failed: ${errorData.error || response.statusText}`);
  }

  const data = await response.json();
  return data.token;
}

/**
 * Set up authentication for e2e tests
 * This function should be called in test setup to bypass login screens
 * @param {Object} page - Puppeteer page instance
 */
async function setupE2EAuth(page) {
  logger.log('Setting up e2e authentication...');

  try {
    // Get fresh JWT token
    const token = await getAuthToken();
    logger.log('✅ Successfully obtained JWT token');

    // Navigate to the app first to establish domain context
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

    // Set the auth token in localStorage
    await page.evaluate((authToken) => {
      localStorage.setItem('auth-token', authToken);
    }, token);

    logger.log('✅ JWT token stored in localStorage');

    // Reload the page to trigger authentication check
    await page.reload({ waitUntil: 'networkidle2' });

    // Wait for React to hydrate and auth to complete
    await new Promise((resolve) => setTimeout(resolve, AUTH_WAIT_TIMEOUT));

    // Wait specifically for the authentication to complete by checking for auth state changes
    try {
      await page.waitForFunction(
        () => {
          const pageText = document.body.textContent || '';
          const hasAuthToken = localStorage.getItem('auth-token') !== null;
          const notInLoadingState = !pageText.includes('Loading...');
          const notInLoginState =
            !pageText.includes('Sign in') && !pageText.includes('Welcome Back');
          const hasMainAppContent =
            pageText.includes('Claude Code UI') && pageText.includes('Projects');

          return hasAuthToken && notInLoadingState && notInLoginState && hasMainAppContent;
        },
        { timeout: DEFAULT_TIMEOUT }
      );
      logger.log('✅ Authentication state change detected');
    } catch (error) {
      logger.log('⚠️ Timeout waiting for auth state change, continuing anyway...');
    }

    logger.log('✅ E2E authentication setup complete');

    return token;
  } catch (error) {
    logger.error('❌ E2E authentication setup failed:', error);

    // Take screenshot for debugging
    if (page) {
      await takeScreenshot(page, 'auth-setup-error');
    }

    throw error;
  }
}

/**
 * Verify that authentication is working
 * @param {Object} page - Puppeteer page instance
 * @returns {Promise<boolean>} True if authenticated successfully
 */
async function verifyAuthentication(page) {
  try {
    // Check if we're on the main app interface (not login screen)
    await page.waitForSelector('body', { timeout: 5000 });

    // Look for elements that indicate we're in the main app
    const isAuthenticated = await page.evaluate(() => {
      // Check for auth token
      const hasAuthToken = localStorage.getItem('auth-token') !== null;

      // Check for login/setup indicators (negative check)
      const pageText = document.body.textContent || '';
      const hasLoginIndicators =
        pageText.includes('Sign in') ||
        pageText.includes('Welcome Back') ||
        pageText.includes('Username and password') ||
        !!document.querySelector('input[type="password"]');

      // Check for loading state
      const isLoading = pageText.includes('Loading...');

      // Check for main app elements (positive check based on actual app content)
      const hasMainAppContent =
        pageText.includes('Claude Code UI') &&
        pageText.includes('Projects') &&
        (pageText.includes('Settings') ||
          pageText.includes('No projects found') ||
          pageText.includes('Quick Settings'));

      // Debug info for test environment only
      if (process.env.NODE_ENV !== 'production') {
        console.log('Auth verification:', {
          hasAuthToken,
          hasLoginIndicators,
          isLoading,
          hasMainAppContent,
          bodyTextSample: `${pageText.substring(0, 200)}...`
        });
      }

      return hasAuthToken && !hasLoginIndicators && !isLoading && hasMainAppContent;
    });

    if (isAuthenticated) {
      logger.log('✅ Authentication verified - user is logged in');
      return true;
    } else {
      logger.log('❌ Authentication failed - still showing login screen');

      // Take screenshot for debugging
      await takeScreenshot(page, 'auth-verify-failed');

      return false;
    }
  } catch (error) {
    logger.error('❌ Authentication verification failed:', error);
    return false;
  }
}

/**
 * Enhanced navigation function that ensures authentication
 * @param {Object} page - Puppeteer page instance
 */
async function navigateToAppAuthenticated(page) {
  // Set up authentication first
  await setupE2EAuth(page);

  // Verify we're authenticated
  const isAuthenticated = await verifyAuthentication(page);

  if (!isAuthenticated) {
    throw new Error('Failed to authenticate for e2e tests');
  }

  // Take screenshot of authenticated app state
  await takeScreenshot(page, 'authenticated-app');

  logger.log('✅ Successfully navigated to authenticated app');
}

/**
 * Get user info from token (for debugging)
 * @param {Object} page - Puppeteer page instance
 */
async function getAuthenticatedUser(page) {
  try {
    const userInfo = await page.evaluate(async () => {
      const token = localStorage.getItem('auth-token');
      if (!token) return null;

      const response = await fetch('/api/auth/user', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        return await response.json();
      }
      return null;
    });

    logger.log('👤 Authenticated user:', userInfo);
    return userInfo;
  } catch (error) {
    logger.error('Failed to get authenticated user:', error);
    return null;
  }
}

module.exports = {
  setupE2EAuth,
  verifyAuthentication,
  navigateToAppAuthenticated,
  getAuthenticatedUser,
  getAuthToken,
  takeScreenshot,
  cleanupScreenshots,
  TEST_CREDENTIALS
};
