/**
 * Debug Authentication - Step by step debugging
 */

describe('Debug Authentication', () => {
  test('debug auth step by step', async () => {
    console.log('🔍 Starting debug...');

    // Step 1: Go to app without auth
    await page.goto('http://localhost:5174', { waitUntil: 'networkidle2' });
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const step1 = await page.evaluate(() => ({
      url: window.location.href,
      title: document.title,
      bodyText: document.body.textContent.substring(0, 300),
      hasPasswordInput: !!document.querySelector('input[type="password"]'),
      hasSignInText: document.body.textContent.includes('Sign in'),
      authToken: localStorage.getItem('auth-token')
    }));

    console.log('📋 Step 1 (No auth):', step1);

    // Step 2: Get JWT token
    const response = await page.evaluate(async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'testuser', password: 'password123' })
        });
        const data = await res.json();
        return { success: res.ok, data, status: res.status };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    console.log('📋 Step 2 (Login API):', response);

    if (response.success) {
      // Step 3: Set token and reload
      await page.evaluate((token) => {
        localStorage.setItem('auth-token', token);
      }, response.data.token);

      console.log('📋 Step 3: Token set in localStorage');

      await page.reload({ waitUntil: 'networkidle2' });
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const step3 = await page.evaluate(() => ({
        url: window.location.href,
        title: document.title,
        bodyText: document.body.textContent.substring(0, 500),
        hasPasswordInput: !!document.querySelector('input[type="password"]'),
        hasSignInText: document.body.textContent.includes('Sign in'),
        hasWelcomeBack: document.body.textContent.includes('Welcome Back'),
        hasLoading: document.body.textContent.includes('Loading'),
        authToken: localStorage.getItem('auth-token'),
        authTokenLength: localStorage.getItem('auth-token')?.length,
        mainElements: {
          sidebar: !!document.querySelector('[class*="sidebar"]'),
          main: !!document.querySelector('[class*="main"]'),
          nav: !!document.querySelector('nav'),
          header: !!document.querySelector('header'),
          testIds: document.querySelectorAll('[data-testid]').length
        }
      }));

      console.log('📋 Step 3 (After reload):', step3);

      // Step 4: Test API call with token
      const apiTest = await page.evaluate(async (token) => {
        try {
          const res = await fetch('/api/auth/user', {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          return { success: res.ok, data, status: res.status };
        } catch (error) {
          return { success: false, error: error.message };
        }
      }, response.data.token);

      console.log('📋 Step 4 (API with token):', apiTest);
    }

    // Take final screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/debug-final.png',
      fullPage: true
    });

    expect(response.success).toBe(true);
  }, 60000); // 60 second timeout
});
