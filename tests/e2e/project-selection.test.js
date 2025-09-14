describe('Project Selection E2E Tests', () => {
  beforeAll(async () => {
    await page.setViewport(global.DESKTOP_VIEWPORT);
  });

  beforeEach(async () => {
    await global.navigateToApp(page);

    // Wait for projects to load - look for project cards
    await page.waitForSelector('[data-testid="project-card"], .project-card, .project-item', {
      timeout: 15000
    });

    await global.takeScreenshot(page, 'projects-loaded');
  });

  test('should display project cards and allow selection', async () => {
    console.log('🧪 Testing project card display and selection...');

    // Find project cards using multiple possible selectors
    const projectSelectors = [
      '[data-testid="project-card"]',
      '.project-card',
      '.project-item',
      '[class*="project"]'
    ];

    let projectCards = [];
    let usedSelector = null;

    for (const selector of projectSelectors) {
      try {
        projectCards = await page.$$(selector);
        if (projectCards.length > 0) {
          usedSelector = selector;
          console.log(`✅ Found ${projectCards.length} project cards using selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.log(`❌ Selector ${selector} not found, trying next...`);
      }
    }

    expect(projectCards.length).toBeGreaterThan(0);
    expect(usedSelector).not.toBeNull();

    // Take screenshot showing all project cards
    await global.takeScreenshot(page, `project-cards-found-${projectCards.length}`, true);

    // Test clicking the first project card
    console.log('🖱️ Clicking first project card...');
    await global.waitForElementAndClick(page, usedSelector);

    // Wait for any navigation or selection feedback
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot after selection
    await global.takeScreenshot(page, 'project-selected', true);

    console.log('✅ Project selection test completed');
  });

  test('should handle project card hover states', async () => {
    console.log('🧪 Testing project card hover interactions...');

    // Find the first project card
    const projectCard = await page.$(
      '[data-testid="project-card"], .project-card, .project-item, [class*="project"]'
    );
    expect(projectCard).not.toBeNull();

    // Take screenshot before hover
    await global.takeScreenshot(page, 'before-hover');

    // Hover over the project card
    await projectCard.hover();
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Take screenshot during hover
    await global.takeScreenshot(page, 'during-hover');

    // Move mouse away
    await page.mouse.move(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Take screenshot after hover
    await global.takeScreenshot(page, 'after-hover');

    console.log('✅ Hover interaction test completed');
  });

  test('should verify project selection provides visual feedback', async () => {
    console.log('🧪 Testing visual feedback during project selection...');

    // Find project cards
    const projectCards = await page.$$(
      '[data-testid="project-card"], .project-card, .project-item, [class*="project"]'
    );
    expect(projectCards.length).toBeGreaterThan(0);

    const firstCard = projectCards[0];

    // Get initial state
    const initialClasses = await page.evaluate((el) => el.className, firstCard);
    console.log('Initial classes:', initialClasses);

    // Take screenshot before interaction
    await global.takeScreenshot(page, 'before-selection');

    // Click the card and immediately check for changes
    await firstCard.click();

    // Wait for any visual state changes
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Get state after click
    const afterClasses = await page.evaluate((el) => el.className, firstCard);
    console.log('Classes after click:', afterClasses);

    // Take screenshot after selection
    await global.takeScreenshot(page, 'after-selection-feedback');

    // Check if there's visual feedback (classes changed, URL changed, or content changed)
    const urlChanged = (await page.url()) !== global.BASE_URL;
    const classesChanged = initialClasses !== afterClasses;
    const hasVisualFeedback = urlChanged || classesChanged;

    console.log('Visual feedback detected:', {
      urlChanged,
      classesChanged,
      currentUrl: await page.url()
    });

    // This test passes if we get ANY kind of visual feedback
    expect(hasVisualFeedback).toBe(true);

    console.log('✅ Visual feedback test completed');
  });

  test('should handle multiple rapid clicks without breaking', async () => {
    console.log('🧪 Testing rapid click handling...');

    const projectCards = await page.$$(
      '[data-testid="project-card"], .project-card, .project-item, [class*="project"]'
    );
    expect(projectCards.length).toBeGreaterThan(0);

    const firstCard = projectCards[0];

    // Take screenshot before rapid clicks
    await global.takeScreenshot(page, 'before-rapid-clicks');

    // Perform multiple rapid clicks
    for (let i = 0; i < 5; i++) {
      await firstCard.click();
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay between clicks
    }

    // Wait for any final state changes
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Take screenshot after rapid clicks
    await global.takeScreenshot(page, 'after-rapid-clicks');

    // Verify the page is still functional
    const isPageResponsive = await page.evaluate(() => {
      return (
        document.readyState === 'complete' &&
        !document.querySelector('[class*="error"]') &&
        !document.querySelector('[class*="crash"]')
      );
    });

    expect(isPageResponsive).toBe(true);

    console.log('✅ Rapid click test completed');
  });

  // Regression test: Ensure no console spam when clicking project items
  test('should not spam console with project limit messages', async () => {
    console.log('🧪 Testing for console spam regression...');

    // Capture console messages
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    const projectCards = await page.$$(
      '[data-testid="project-card"], .project-card, .project-item, [class*="project"]'
    );
    expect(projectCards.length).toBeGreaterThan(0);

    // Take screenshot before test
    await global.takeScreenshot(page, 'before-console-spam-test');

    // Click multiple project items
    const clickCount = Math.min(3, projectCards.length);
    for (let i = 0; i < clickCount; i++) {
      await projectCards[i].click();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Wait for any delayed console messages
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot after clicking
    await global.takeScreenshot(page, 'after-console-spam-test');

    // Check for spam messages
    const spamMessages = consoleMessages.filter(msg =>
      msg.text.includes('Quick fix: Limited to') ||
      msg.text.includes('projects remaining')
    );

    // Should have minimal or no spam messages (at most 1 for the initial load)
    expect(spamMessages.length).toBeLessThanOrEqual(1);

    console.log(`✅ Console spam test completed - found ${spamMessages.length} potential spam messages`);
  });

  // Regression test: Ensure no git validation errors for non-git projects
  test('should handle non-git projects without validation errors', async () => {
    console.log('🧪 Testing git validation error regression...');

    // Capture console errors
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture page errors
    const pageErrors = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    const projectCards = await page.$$(
      '[data-testid="project-card"], .project-card, .project-item, [class*="project"]'
    );
    expect(projectCards.length).toBeGreaterThan(0);

    // Take screenshot before test
    await global.takeScreenshot(page, 'before-git-validation-test');

    // Click each project item and check for git-related errors
    const clickCount = Math.min(3, projectCards.length);
    for (let i = 0; i < clickCount; i++) {
      console.log(`Clicking project ${i + 1} of ${clickCount}...`);
      await projectCards[i].click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Wait for any git operations to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Take screenshot after clicking
    await global.takeScreenshot(page, 'after-git-validation-test');

    // Check for git validation errors
    const gitErrors = [
      ...consoleErrors.filter(error =>
        error.includes('git') ||
        error.includes('validateGitRepository') ||
        error.includes('not a git repository')
      ),
      ...pageErrors.filter(error =>
        error.includes('git') ||
        error.includes('validateGitRepository') ||
        error.includes('not a git repository')
      )
    ];

    // Should not have git validation errors
    expect(gitErrors.length).toBe(0);

    console.log(`✅ Git validation test completed - found ${gitErrors.length} git errors`);
    if (gitErrors.length > 0) {
      console.log('Git errors found:', gitErrors);
    }
  });

  // Test: Verify proper rendering of non-git project message
  test('should show appropriate message for non-git projects', async () => {
    console.log('🧪 Testing non-git project message display...');

    const projectCards = await page.$$(
      '[data-testid="project-card"], .project-card, .project-item, [class*="project"]'
    );
    expect(projectCards.length).toBeGreaterThan(0);

    // Click a project item
    await projectCards[0].click();
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take screenshot after selection
    await global.takeScreenshot(page, 'project-selected-for-git-message-test');

    // Check if we can see either git interface or non-git message
    const hasGitInterface = await page.$('.git-panel, [class*="git"], [data-testid*="git"]') !== null;

    // Look for non-git repository message
    const hasNonGitMessage = await page.evaluate(() => {
      const text = document.body.innerText;
      return text.includes('Not a Git repository') ||
             text.includes('Initialize Git') ||
             text.includes('not a git repository');
    });

    // Should have either git interface OR non-git message (not both, not neither)
    const hasProperRendering = (hasGitInterface && !hasNonGitMessage) || (!hasGitInterface && hasNonGitMessage);
    expect(hasProperRendering).toBe(true);

    console.log(`✅ Non-git project rendering test completed - hasGitInterface: ${hasGitInterface}, hasNonGitMessage: ${hasNonGitMessage}`);
  });
});
