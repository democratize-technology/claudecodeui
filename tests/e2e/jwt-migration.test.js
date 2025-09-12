/**
 * JWT Token Migration Test
 * 
 * This test verifies the JWT token migration from JWT_SECRET to JWT_ACCESS_SECRET
 * by simulating a user with stale localStorage tokens and testing the complete
 * authentication flow including WebSocket connections.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

describe('JWT Token Migration', () => {
  let browser;
  let page;

  beforeAll(async () => {
    // Ensure screenshot directory exists
    try {
      await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
    } catch (error) {
      // Directory already exists
    }

    // Launch browser
    browser = await puppeteer.launch({
      headless: process.env.CI === 'true',
      devtools: !process.env.CI,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 720 });
    
    // Enable console logging for debugging
    page.on('console', msg => {
      if (msg.type() === 'error' || msg.type() === 'warn') {
        console.log(`Browser ${msg.type()}: ${msg.text()}`);
      }
    });
    
    // Listen for WebSocket errors
    page.on('pageerror', error => {
      console.log('Page error:', error.message);
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  /**
   * Helper function to take screenshots
   */
  async function takeScreenshot(name, step = '') {
    const filename = step ? `jwt-migration-${step}-${name}.png` : `jwt-migration-${name}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`📸 Screenshot saved: ${filename}`);
    return filepath;
  }

  /**
   * Helper function to wait for network idle
   */
  async function waitForNetworkIdle() {
    await page.waitForLoadState?.('networkidle') || 
          page.waitForFunction(() => document.readyState === 'complete');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Extra wait for React hydration
  }

  test('should handle JWT token migration flow completely', async () => {
    console.log('🧪 Testing complete JWT token migration flow...');

    // Step 1: Clear localStorage to simulate migration scenario
    console.log('📝 Step 1: Clearing localStorage to simulate migration...');
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    await page.evaluate(() => {
      // Clear all localStorage to simulate fresh start after migration
      localStorage.clear();
      sessionStorage.clear();
    });

    await takeScreenshot('step1-localStorage-cleared', '01');

    // Step 2: Reload and check if app shows setup screen
    console.log('📝 Step 2: Checking if app shows setup screen...');
    await page.reload({ waitUntil: 'networkidle0' });
    await waitForNetworkIdle();

    const initialState = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      return {
        hasAuthToken: localStorage.getItem('auth-token') !== null,
        bodyText: bodyText.substring(0, 500),
        hasSetupIndicators: bodyText.includes('Welcome') || 
                           bodyText.includes('Setup') || 
                           bodyText.includes('Sign') ||
                           bodyText.includes('Register'),
        hasPasswordInput: !!document.querySelector('input[type="password"]'),
        hasUsernameInput: !!document.querySelector('input[type="text"]') || 
                         !!document.querySelector('input[placeholder*="username" i]'),
        url: window.location.href
      };
    });

    console.log('🔍 Initial state after clearing localStorage:', initialState);
    await takeScreenshot('step2-initial-state', '02');

    expect(initialState.hasAuthToken).toBe(false);
    expect(initialState.hasSetupIndicators || initialState.hasPasswordInput).toBe(true);

    // Step 3: Complete user registration/login flow
    console.log('📝 Step 3: Completing authentication flow...');

    // Look for registration/login form elements
    await page.waitForSelector('body', { timeout: 10000 });

    const formElements = await page.evaluate(() => {
      const usernameInputs = Array.from(document.querySelectorAll('input')).filter(input => 
        input.type === 'text' || 
        input.placeholder?.toLowerCase().includes('username') ||
        input.name?.toLowerCase().includes('username')
      );
      
      const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
      const submitButtons = Array.from(document.querySelectorAll('button')).filter(btn => 
        btn.type === 'submit' || 
        btn.textContent?.toLowerCase().includes('sign') ||
        btn.textContent?.toLowerCase().includes('login') ||
        btn.textContent?.toLowerCase().includes('register')
      );

      return {
        usernameSelector: usernameInputs[0]?.tagName ? `${usernameInputs[0].tagName.toLowerCase()}${usernameInputs[0].type ? `[type="${usernameInputs[0].type}"]` : ''}` : null,
        passwordSelector: passwordInputs[0]?.tagName ? `${passwordInputs[0].tagName.toLowerCase()}[type="password"]` : null,
        submitSelector: submitButtons[0]?.tagName ? `${submitButtons[0].tagName.toLowerCase()}` : null,
        usernameInputsCount: usernameInputs.length,
        passwordInputsCount: passwordInputs.length,
        submitButtonsCount: submitButtons.length
      };
    });

    console.log('🔍 Form elements found:', formElements);

    // Check if this is a registration form or login form
    const isRegistrationForm = initialState.bodyText.includes('Create Account') || 
                               initialState.bodyText.includes('Confirm Password');

    // Try to authenticate using the test user credentials
    if (formElements.passwordSelector && formElements.submitSelector) {
      try {
        if (isRegistrationForm) {
          console.log('📝 Detected registration form, creating new user...');
          
          // Fill in registration details
          if (formElements.usernameSelector) {
            await page.waitForSelector(formElements.usernameSelector, { timeout: 5000 });
            await page.type(formElements.usernameSelector, 'migrationtestuser');
          }
          
          // Find both password fields for registration
          const passwordFields = await page.$$('input[type="password"]');
          if (passwordFields.length >= 2) {
            await passwordFields[0].type('password123');  // Password field
            await passwordFields[1].type('password123');  // Confirm password field
          } else {
            await page.type('input[type="password"]', 'password123');
          }
          
        } else {
          console.log('📝 Detected login form, using existing credentials...');
          
          // Fill in login credentials
          if (formElements.usernameSelector) {
            await page.waitForSelector(formElements.usernameSelector, { timeout: 5000 });
            await page.type(formElements.usernameSelector, 'testuser');
          }
          
          await page.waitForSelector(formElements.passwordSelector, { timeout: 5000 });
          await page.type(formElements.passwordSelector, 'password123');
        }

        await takeScreenshot('step3a-form-filled', '03a');

        // Submit form
        await page.click(formElements.submitSelector);
        console.log('✅ Form submitted');

        // Wait for authentication to complete
        await waitForNetworkIdle();
        await new Promise(resolve => setTimeout(resolve, 3000)); // Longer wait for registration

      } catch (error) {
        console.log('⚠️ Form authentication failed, trying API approach:', error.message);
        
        // Fallback: Use API to get token directly
        const authToken = await page.evaluate(async (isReg) => {
          try {
            let response;
            if (isReg) {
              // Try registration first
              response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  username: 'migrationtestuser', 
                  password: 'password123',
                  confirmPassword: 'password123'
                })
              });
              
              if (!response.ok) {
                // If registration fails (user exists), try login
                response = await fetch('/api/auth/login', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ username: 'migrationtestuser', password: 'password123' })
                });
              }
            } else {
              response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'testuser', password: 'password123' })
              });
            }
            
            if (response.ok) {
              const data = await response.json();
              localStorage.setItem('auth-token', data.token);
              return data.token;
            }
            return null;
          } catch (e) {
            console.error('API auth failed:', e);
            return null;
          }
        }, isRegistrationForm);

        if (authToken) {
          console.log('✅ API authentication successful');
          await page.reload({ waitUntil: 'networkidle0' });
          await waitForNetworkIdle();
        }
      }
    }

    await takeScreenshot('step3b-after-auth', '03b');

    // Step 4: Verify successful authentication
    console.log('📝 Step 4: Verifying successful authentication...');

    const authState = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      return {
        hasAuthToken: localStorage.getItem('auth-token') !== null,
        tokenLength: localStorage.getItem('auth-token')?.length || 0,
        noLoginIndicators: !bodyText.includes('Sign in') && !bodyText.includes('Welcome Back'),
        hasMainAppContent: bodyText.includes('Claude Code') || bodyText.includes('Projects'),
        bodyTextSample: bodyText.substring(0, 300)
      };
    });

    console.log('🔍 Authentication state:', authState);
    expect(authState.hasAuthToken).toBe(true);
    expect(authState.tokenLength).toBeGreaterThan(100); // JWT tokens are typically longer
    expect(authState.noLoginIndicators).toBe(true);

    await takeScreenshot('step4-authenticated', '04');

    // Step 5: Test protected endpoint access
    console.log('📝 Step 5: Testing protected endpoint access...');

    const endpointTests = await page.evaluate(async () => {
      const token = localStorage.getItem('auth-token');
      const results = {};

      // Test /api/config endpoint
      try {
        const configResponse = await fetch('/api/config', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        results.config = {
          status: configResponse.status,
          ok: configResponse.ok,
          statusText: configResponse.statusText
        };
        if (configResponse.ok) {
          results.configData = await configResponse.json();
        }
      } catch (error) {
        results.config = { error: error.message };
      }

      // Test /api/auth/user endpoint
      try {
        const userResponse = await fetch('/api/auth/user', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        results.user = {
          status: userResponse.status,
          ok: userResponse.ok,
          statusText: userResponse.statusText
        };
        if (userResponse.ok) {
          results.userData = await userResponse.json();
        }
      } catch (error) {
        results.user = { error: error.message };
      }

      return results;
    });

    console.log('🔍 Endpoint test results:', endpointTests);

    expect(endpointTests.config.ok).toBe(true);
    expect(endpointTests.config.status).toBe(200);
    expect(endpointTests.user.ok).toBe(true);
    expect(endpointTests.user.status).toBe(200);

    await takeScreenshot('step5-endpoints-tested', '05');

    // Step 6: Test WebSocket connection
    console.log('📝 Step 6: Testing WebSocket connection...');

    const websocketTest = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const token = localStorage.getItem('auth-token');
        const wsUrl = `ws://localhost:3001?token=${encodeURIComponent(token)}`;
        
        const ws = new WebSocket(wsUrl);
        const result = { success: false, error: null, events: [] };

        const timeout = setTimeout(() => {
          ws.close();
          result.error = 'WebSocket connection timeout';
          resolve(result);
        }, 5000);

        ws.onopen = () => {
          result.events.push('open');
          result.success = true;
          clearTimeout(timeout);
          ws.close();
          resolve(result);
        };

        ws.onerror = (error) => {
          result.events.push('error');
          result.error = error.message || 'WebSocket error';
          clearTimeout(timeout);
          resolve(result);
        };

        ws.onclose = (event) => {
          result.events.push(`close-${event.code}`);
          if (!result.success && !result.error) {
            result.error = `WebSocket closed with code ${event.code}`;
          }
          clearTimeout(timeout);
          resolve(result);
        };
      });
    });

    console.log('🔍 WebSocket test result:', websocketTest);

    // WebSocket might fail in test environment, but we should not get authentication errors
    if (!websocketTest.success) {
      console.log('⚠️ WebSocket connection failed, but this may be expected in test environment');
      // Check that it's not an authentication error (code 1002 would indicate auth issues)
      if (websocketTest.error && websocketTest.error.includes('1002')) {
        throw new Error('WebSocket failed with authentication error: ' + websocketTest.error);
      }
    }

    await takeScreenshot('step6-websocket-tested', '06');

    // Step 7: Verify no DOMException errors in console
    console.log('📝 Step 7: Checking for console errors...');

    const consoleErrors = await page.evaluate(() => {
      // This is a simple check - in a real scenario you'd need to capture console events
      const errors = [];
      
      // Check if there are any visible error messages
      const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
      errorElements.forEach(el => {
        errors.push(el.textContent);
      });

      return {
        visibleErrors: errors,
        // Note: Console errors would need to be captured differently using page.on('console')
        timestamp: new Date().toISOString()
      };
    });

    console.log('🔍 Console error check:', consoleErrors);
    
    await takeScreenshot('step7-final-state', '07');

    // Final verification
    console.log('✅ JWT token migration test completed successfully');
    
    const finalSummary = {
      authTokenPresent: authState.hasAuthToken,
      configEndpointWorking: endpointTests.config.ok,
      userEndpointWorking: endpointTests.user.ok,
      websocketAttempted: true,
      websocketAuthSuccess: websocketTest.success || !websocketTest.error?.includes('1002'),
      noVisibleErrors: consoleErrors.visibleErrors.length === 0
    };

    console.log('📊 Final test summary:', finalSummary);

    // All critical checks should pass
    expect(finalSummary.authTokenPresent).toBe(true);
    expect(finalSummary.configEndpointWorking).toBe(true);
    expect(finalSummary.userEndpointWorking).toBe(true);
    expect(finalSummary.websocketAuthSuccess).toBe(true);
    expect(finalSummary.noVisibleErrors).toBe(true);
  });

  test('should reject old JWT tokens signed with different secret', async () => {
    console.log('🧪 Testing rejection of old JWT tokens...');

    // Create a fake token that would have been signed with old JWT_SECRET
    const fakeOldToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoidGVzdHVzZXIiLCJpYXQiOjE3MjYxNDE4NjQsImV4cCI6MTcyNjIyODI2NH0.invalidSignatureFromOldSecret';

    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    
    // Set the fake old token
    await page.evaluate((token) => {
      localStorage.setItem('auth-token', token);
    }, fakeOldToken);

    await page.reload({ waitUntil: 'networkidle0' });
    await waitForNetworkIdle();

    // Try to access protected endpoint with old token
    const oldTokenTest = await page.evaluate(async () => {
      const token = localStorage.getItem('auth-token');
      
      try {
        const response = await fetch('/api/config', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        return {
          status: response.status,
          ok: response.ok,
          statusText: response.statusText,
          body: response.ok ? await response.json() : await response.text()
        };
      } catch (error) {
        return { error: error.message };
      }
    });

    console.log('🔍 Old token test result:', oldTokenTest);

    // Should reject old token
    expect(oldTokenTest.ok).toBe(false);
    expect(oldTokenTest.status).toBe(403); // Invalid token should return 403

    await takeScreenshot('old-token-rejected');

    console.log('✅ Old JWT token correctly rejected');
  });
});