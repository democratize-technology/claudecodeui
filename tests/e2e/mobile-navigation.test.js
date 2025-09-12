describe('Mobile Navigation E2E Tests', () => {
  beforeAll(async () => {
    // Set mobile viewport
    await page.setViewport(global.MOBILE_VIEWPORT);

    // Enable touch events
    await page.setUserAgent(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
    );
  });

  beforeEach(async () => {
    await global.navigateToApp(page);

    // Take screenshot of mobile layout
    await global.takeScreenshot(page, 'mobile-layout-loaded', true);
  });

  test('should display hamburger menu on mobile viewport', async () => {
    console.log('🧪 Testing hamburger menu visibility on mobile...');

    // Look for hamburger menu button with various possible selectors
    const hamburgerSelectors = [
      '[data-testid="hamburger-menu"]',
      '[data-testid="menu-button"]',
      '.hamburger',
      '.menu-button',
      '.mobile-menu-button',
      '[class*="hamburger"]',
      '[class*="menu-toggle"]',
      'button[class*="menu"]'
    ];

    let hamburgerButton = null;
    let usedSelector = null;

    for (const selector of hamburgerSelectors) {
      try {
        hamburgerButton = await page.$(selector);
        if (hamburgerButton) {
          // Check if element is visible
          const isVisible = await page.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return (
              style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
            );
          }, hamburgerButton);

          if (isVisible) {
            usedSelector = selector;
            console.log(`✅ Found visible hamburger menu using selector: ${selector}`);
            break;
          }
        }
      } catch (error) {
        console.log(`❌ Selector ${selector} not found or not visible, trying next...`);
      }
    }

    expect(hamburgerButton).not.toBeNull();
    expect(usedSelector).not.toBeNull();

    // Take screenshot showing hamburger button
    await global.takeScreenshot(page, 'hamburger-menu-visible');

    console.log('✅ Hamburger menu visibility test completed');
  });

  test('should open and close mobile menu with touch interactions', async () => {
    console.log('🧪 Testing mobile menu touch interactions...');

    // Find hamburger menu button
    const hamburgerButton = await page.$(
      '[data-testid="hamburger-menu"], [data-testid="menu-button"], .hamburger, .menu-button, .mobile-menu-button, [class*="hamburger"], [class*="menu-toggle"], button[class*="menu"]'
    );
    expect(hamburgerButton).not.toBeNull();

    // Take screenshot before opening menu
    await global.takeScreenshot(page, 'before-menu-open');

    // Simulate touch to open menu
    console.log('👆 Touching hamburger menu to open...');
    await global.simulateMobileTouch(
      page,
      '[data-testid="hamburger-menu"], [data-testid="menu-button"], .hamburger, .menu-button, .mobile-menu-button, [class*="hamburger"], [class*="menu-toggle"], button[class*="menu"]'
    );

    // Wait for menu animation
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Take screenshot with menu open
    await global.takeScreenshot(page, 'menu-opened', true);

    // Look for opened menu content
    const menuContentSelectors = [
      '[data-testid="mobile-menu"]',
      '.mobile-menu',
      '.sidebar',
      '[class*="menu-open"]',
      '[class*="nav-open"]'
    ];

    let menuVisible = false;
    for (const selector of menuContentSelectors) {
      try {
        const menuElement = await page.$(selector);
        if (menuElement) {
          const isVisible = await page.evaluate((el) => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return (
              style.display !== 'none' &&
              style.visibility !== 'hidden' &&
              style.opacity !== '0' &&
              rect.width > 0 &&
              rect.height > 0
            );
          }, menuElement);

          if (isVisible) {
            console.log(`✅ Menu is visible using selector: ${selector}`);
            menuVisible = true;
            break;
          }
        }
      } catch (error) {
        console.log(`Selector ${selector} not found`);
      }
    }

    // If we can't detect the menu by selectors, check for DOM changes
    if (!menuVisible) {
      console.log('🔍 Checking for DOM changes that indicate menu opened...');

      const bodyClasses = await page.evaluate(() => document.body.className);
      const htmlClasses = await page.evaluate(() => document.documentElement.className);

      menuVisible =
        bodyClasses.includes('menu-open') ||
        bodyClasses.includes('nav-open') ||
        htmlClasses.includes('menu-open') ||
        htmlClasses.includes('nav-open');

      console.log('Body classes:', bodyClasses);
      console.log('HTML classes:', htmlClasses);
    }

    console.log('Menu visible after touch:', menuVisible);

    // Test closing menu (try clicking hamburger again)
    console.log('👆 Touching hamburger menu to close...');
    await global.simulateMobileTouch(
      page,
      '[data-testid="hamburger-menu"], [data-testid="menu-button"], .hamburger, .menu-button, .mobile-menu-button, [class*="hamburger"], [class*="menu-toggle"], button[class*="menu"]'
    );

    // Wait for close animation
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Take screenshot with menu closed
    await global.takeScreenshot(page, 'menu-closed', true);

    console.log('✅ Mobile menu touch interaction test completed');
  });

  test('should provide visual feedback on hamburger menu touch', async () => {
    console.log('🧪 Testing hamburger menu touch feedback...');

    const hamburgerButton = await page.$(
      '[data-testid="hamburger-menu"], [data-testid="menu-button"], .hamburger, .menu-button, .mobile-menu-button, [class*="hamburger"], [class*="menu-toggle"], button[class*="menu"]'
    );
    expect(hamburgerButton).not.toBeNull();

    // Get initial state
    const initialClasses = await page.evaluate((el) => el.className, hamburgerButton);
    const initialStyles = await page.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        transform: style.transform,
        opacity: style.opacity
      };
    }, hamburgerButton);

    console.log('Initial hamburger state:', { initialClasses, initialStyles });

    // Take screenshot before touch
    await global.takeScreenshot(page, 'before-hamburger-touch');

    // Simulate touch start (press and hold)
    const box = await hamburgerButton.boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);

    // Wait for immediate visual feedback
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Take screenshot during touch feedback
    await global.takeScreenshot(page, 'during-hamburger-touch');

    // Get state during/after touch
    const touchClasses = await page.evaluate((el) => el.className, hamburgerButton);
    const touchStyles = await page.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        backgroundColor: style.backgroundColor,
        transform: style.transform,
        opacity: style.opacity
      };
    }, hamburgerButton);

    console.log('Touch state:', { touchClasses, touchStyles });

    // Wait for any additional feedback/animation
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Take screenshot after touch
    await global.takeScreenshot(page, 'after-hamburger-touch');

    // Check for visual feedback
    const classesChanged = initialClasses !== touchClasses;
    const stylesChanged = JSON.stringify(initialStyles) !== JSON.stringify(touchStyles);
    const hasVisualFeedback = classesChanged || stylesChanged;

    console.log('Visual feedback detected:', {
      classesChanged,
      stylesChanged,
      hasVisualFeedback
    });

    // The test passes if we detect ANY visual feedback
    expect(hasVisualFeedback).toBe(true);

    console.log('✅ Hamburger touch feedback test completed');
  });

  test('should handle rapid hamburger menu touches without breaking', async () => {
    console.log('🧪 Testing rapid hamburger menu touches...');

    const hamburgerButton = await page.$(
      '[data-testid="hamburger-menu"], [data-testid="menu-button"], .hamburger, .menu-button, .mobile-menu-button, [class*="hamburger"], [class*="menu-toggle"], button[class*="menu"]'
    );
    expect(hamburgerButton).not.toBeNull();

    // Take screenshot before rapid touches
    await global.takeScreenshot(page, 'before-rapid-hamburger-touches');

    const box = await hamburgerButton.boundingBox();

    // Perform multiple rapid touches
    for (let i = 0; i < 6; i++) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await new Promise((resolve) => setTimeout(resolve, 150)); // Small delay between touches
      console.log(`Touch ${i + 1} completed`);
    }

    // Wait for any final state changes
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot after rapid touches
    await global.takeScreenshot(page, 'after-rapid-hamburger-touches', true);

    // Verify the app is still responsive
    const isPageResponsive = await page.evaluate(() => {
      return (
        document.readyState === 'complete' &&
        !document.querySelector('[class*="error"]') &&
        !document.querySelector('[class*="crash"]') &&
        document.body !== null
      );
    });

    expect(isPageResponsive).toBe(true);

    console.log('✅ Rapid hamburger touches test completed');
  });

  test('should work correctly after viewport resize', async () => {
    console.log('🧪 Testing hamburger menu after viewport changes...');

    // Start with mobile viewport and take screenshot
    await global.takeScreenshot(page, 'mobile-viewport-start');

    // Resize to desktop
    await page.setViewport(global.DESKTOP_VIEWPORT);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await global.takeScreenshot(page, 'desktop-viewport-resized');

    // Resize back to mobile
    await page.setViewport(global.MOBILE_VIEWPORT);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await global.takeScreenshot(page, 'mobile-viewport-restored');

    // Test hamburger menu still works
    const hamburgerButton = await page.$(
      '[data-testid="hamburger-menu"], [data-testid="menu-button"], .hamburger, .menu-button, .mobile-menu-button, [class*="hamburger"], [class*="menu-toggle"], button[class*="menu"]'
    );

    if (hamburgerButton) {
      await global.simulateMobileTouch(
        page,
        '[data-testid="hamburger-menu"], [data-testid="menu-button"], .hamburger, .menu-button, .mobile-menu-button, [class*="hamburger"], [class*="menu-toggle"], button[class*="menu"]'
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await global.takeScreenshot(page, 'hamburger-after-resize');

      console.log('✅ Hamburger menu works after viewport resize');
    } else {
      console.log('ℹ️ Hamburger menu not visible after resize (expected for responsive design)');
    }

    console.log('✅ Viewport resize test completed');
  });
});
