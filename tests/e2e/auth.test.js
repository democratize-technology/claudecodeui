/**
 * Authentication Test - Verify e2e auth helper works
 * 
 * This test verifies that the authentication helper successfully
 * bypasses login screens and allows access to the main app interface.
 */

const path = require('path');
const fs = require('fs').promises;

describe('Authentication Helper', () => {
  beforeAll(async () => {
    // Ensure screenshot directory exists
    const screenshotDir = path.join(__dirname, 'screenshots');
    try {
      await fs.mkdir(screenshotDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  });

  test('should bypass login screen and access main app interface', async () => {
    console.log('🧪 Testing authentication bypass...');
    
    // Navigate to app with authentication (default behavior)
    await navigateToApp(page);
    
    // Verify we're authenticated (not on login screen)
    const isAuthenticated = await authHelper.verifyAuthentication(page);
    expect(isAuthenticated).toBe(true);
    
    // Check for main app elements that should be present
    await waitForSelector(page, 'body');
    
    // Look for elements that indicate we're in the main app
    const appElements = await page.evaluate(() => {
      const bodyText = document.body ? document.body.textContent || '' : '';
      // Check for various main app indicators
      const checks = {
        hasAuthToken: localStorage.getItem('auth-token') !== null,
        noLoginForm: !document.querySelector('input[type="password"]'),
        noSignInText: !bodyText.includes('Sign in'),
        hasMainContent: !!document.querySelector('[class*="main"]') || 
                      !!document.querySelector('[class*="content"]') ||
                      !!document.querySelector('main'),
        // Look for project-related elements
        hasProjectElements: !!document.querySelector('[class*="project"]') ||
                           !!document.querySelector('[class*="sidebar"]') ||
                           !!document.querySelector('[data-testid]') ||
                           bodyText.includes('Projects') ||
                           bodyText.includes('Settings')
      };
      
      return checks;
    });
    
    console.log('🔍 App state checks:', appElements);
    
    // Take screenshot for verification
    await takeScreenshot(page, 'authenticated-main-interface', true);
    
    // Assertions
    expect(appElements.hasAuthToken).toBe(true);
    expect(appElements.noLoginForm).toBe(true);
    expect(appElements.noSignInText).toBe(true);
    
    // At least one main app element should be present
    const hasMainAppElements = appElements.hasMainContent || appElements.hasProjectElements;
    expect(hasMainAppElements).toBe(true);
    
    console.log('✅ Authentication test passed - can access main app interface');
  });

  test('should be able to get authenticated user info', async () => {
    console.log('🧪 Testing user info retrieval...');
    
    // Navigate to app (should already be authenticated from previous test)
    await navigateToApp(page);
    
    // Get user info
    const userInfo = await authHelper.getAuthenticatedUser(page);
    
    console.log('👤 Retrieved user info:', userInfo);
    
    // Verify user info
    expect(userInfo).toBeTruthy();
    expect(userInfo.user).toBeTruthy();
    expect(userInfo.user.username).toBe('testuser');
    expect(userInfo.user.id).toBe(2);
    
    console.log('✅ User info test passed');
  });

  test('should handle navigation to specific routes while authenticated', async () => {
    console.log('🧪 Testing navigation while authenticated...');
    
    // Navigate to app first
    await navigateToApp(page);
    
    // Try navigating to root path
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2' });
    
    // Should still be authenticated
    const isAuthenticated = await authHelper.verifyAuthentication(page);
    expect(isAuthenticated).toBe(true);
    
    // Take screenshot
    await takeScreenshot(page, 'authenticated-root-navigation', true);
    
    console.log('✅ Navigation test passed - authentication persists');
  });

  test('should work with unauthenticated navigation option', async () => {
    console.log('🧪 Testing unauthenticated navigation option...');
    
    // Clear any existing auth
    await page.evaluate(() => {
      localStorage.removeItem('auth-token');
    });
    
    // Navigate without authentication
    await navigateToApp(page, { skipAuth: true });
    
    // Should see login screen
    await page.waitForSelector('body');
    
    const loginElements = await page.evaluate(() => {
      const bodyText = document.body ? document.body.textContent || '' : '';
      return {
        hasPasswordInput: !!document.querySelector('input[type="password"]'),
        hasSignInText: bodyText.includes('Sign in') || 
                      bodyText.includes('Welcome Back'),
        noAuthToken: localStorage.getItem('auth-token') === null
      };
    });
    
    console.log('🔍 Login screen checks:', loginElements);
    
    // Take screenshot
    await takeScreenshot(page, 'unauthenticated-login-screen', true);
    
    // Should show login screen
    expect(loginElements.noAuthToken).toBe(true);
    // At least one login indicator should be present
    const showsLogin = loginElements.hasPasswordInput || loginElements.hasSignInText;
    expect(showsLogin).toBe(true);
    
    console.log('✅ Unauthenticated navigation test passed - shows login screen');
  });
});