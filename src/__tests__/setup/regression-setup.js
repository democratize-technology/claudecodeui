/**
 * Regression Test Setup
 *
 * Additional setup specifically for UI regression tests.
 * Configures performance monitoring, visual testing environment,
 * and comprehensive mocking for stability testing.
 */

// Enhanced console methods for test debugging
const originalConsole = { ...console };

beforeAll(() => {
  // Enhanced error tracking for regression tests
  window.__REGRESSION_TEST_ERRORS__ = [];

  const originalError = window.console.error;
  window.console.error = (...args) => {
    window.__REGRESSION_TEST_ERRORS__.push({
      timestamp: Date.now(),
      args: args,
      stack: new Error().stack
    });

    // Still log to console but filter known test warnings
    const message = args[0];
    if (typeof message === 'string') {
      // Filter out known React testing warnings
      if (
        message.includes('Warning: ReactDOM.render is deprecated') ||
        message.includes('Warning: findDOMNode is deprecated') ||
        message.includes('act() warning')
      ) {
        return;
      }
    }

    originalError.apply(console, args);
  };
});

afterAll(() => {
  // Restore console
  Object.assign(console, originalConsole);
});

// Performance monitoring setup
beforeEach(() => {
  // Reset performance marks and measures
  if (performance.clearMarks) {
    performance.clearMarks();
    performance.clearMeasures();
  }

  // Initialize performance observer for regression tests
  if (typeof PerformanceObserver !== 'undefined') {
    window.__PERFORMANCE_ENTRIES__ = [];

    const observer = new PerformanceObserver((list) => {
      window.__PERFORMANCE_ENTRIES__.push(...list.getEntries());
    });

    observer.observe({ entryTypes: ['measure', 'navigation', 'paint'] });
    window.__PERFORMANCE_OBSERVER__ = observer;
  }

  // Reset DOM state
  document.documentElement.className = '';
  document.head
    .querySelectorAll(
      'meta[name="theme-color"], meta[name="apple-mobile-web-app-status-bar-style"]'
    )
    .forEach((el) => {
      el.remove();
    });

  // Add necessary meta tags for theme testing
  const themeColorMeta = document.createElement('meta');
  themeColorMeta.name = 'theme-color';
  themeColorMeta.content = '#ffffff';
  document.head.appendChild(themeColorMeta);

  const statusBarMeta = document.createElement('meta');
  statusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
  statusBarMeta.content = 'default';
  document.head.appendChild(statusBarMeta);

  // Mock requestAnimationFrame for consistent timing
  let rafId = 0;
  window.__RAF_CALLS__ = [];

  global.requestAnimationFrame = (callback) => {
    const id = ++rafId;
    const startTime = performance.now();

    setTimeout(() => {
      window.__RAF_CALLS__.push({
        id,
        startTime,
        executionTime: performance.now()
      });
      callback(performance.now());
    }, 16); // 60fps simulation

    return id;
  };

  global.cancelAnimationFrame = (id) => {
    // Find and mark as cancelled
    const call = window.__RAF_CALLS__.find((c) => c.id === id);
    if (call) {
      call.cancelled = true;
    }
  };
});

afterEach(() => {
  // Clean up performance observer
  if (window.__PERFORMANCE_OBSERVER__) {
    window.__PERFORMANCE_OBSERVER__.disconnect();
    delete window.__PERFORMANCE_OBSERVER__;
  }

  // Clean up performance entries
  delete window.__PERFORMANCE_ENTRIES__;
  delete window.__RAF_CALLS__;

  // Clean up error tracking
  if (window.__REGRESSION_TEST_ERRORS__) {
    window.__REGRESSION_TEST_ERRORS__.length = 0;
  }

  // Reset document state
  document.documentElement.className = '';

  // Clean up any test-added elements
  document.head
    .querySelectorAll(
      'meta[name="theme-color"], meta[name="apple-mobile-web-app-status-bar-style"]'
    )
    .forEach((el) => {
      if (
        el.content === '#ffffff' ||
        el.content === '#0c1117' ||
        el.content === 'default' ||
        el.content === 'black-translucent'
      ) {
        el.remove();
      }
    });
});

// Visual regression test helpers
global.waitForVisualStability = async (element, timeout = 1000) => {
  return new Promise((resolve) => {
    let lastSnapshot = null;
    let stableCount = 0;
    const requiredStableFrames = 5;

    const checkStability = () => {
      const currentSnapshot = {
        background: getComputedStyle(element).backgroundColor,
        color: getComputedStyle(element).color,
        transform: getComputedStyle(element).transform
      };

      const isStable = JSON.stringify(currentSnapshot) === JSON.stringify(lastSnapshot);

      if (isStable) {
        stableCount++;
        if (stableCount >= requiredStableFrames) {
          resolve(true);
          return;
        }
      } else {
        stableCount = 0;
      }

      lastSnapshot = currentSnapshot;

      if (timeout > 0) {
        timeout -= 16;
        requestAnimationFrame(checkStability);
      } else {
        resolve(false);
      }
    };

    requestAnimationFrame(checkStability);
  });
};

// Performance assertion helpers
global.expectPerformanceWithinBudget = (operationName, actualTime, budgetKey) => {
  const budget = global.PERFORMANCE_BUDGETS?.[budgetKey];
  if (!budget) {
    console.warn(`Performance budget not defined for: ${budgetKey}`);
    return;
  }

  if (actualTime > budget) {
    throw new Error(
      `Performance regression detected in ${operationName}!\n` +
        `Expected: ≤ ${budget}ms\n` +
        `Actual: ${actualTime.toFixed(2)}ms\n` +
        `Exceeded by: ${(actualTime - budget).toFixed(2)}ms`
    );
  }

  console.log(`✅ ${operationName}: ${actualTime.toFixed(2)}ms (budget: ${budget}ms)`);
};

// Theme testing utilities
global.simulateSystemThemeChange = (isDark) => {
  // Mock matchMedia to return the specified preference
  const mockMatchMedia = jest.fn((query) => ({
    matches: query === '(prefers-color-scheme: dark)' ? isDark : false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  }));

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: mockMatchMedia
  });

  // Dispatch change event to existing listeners
  const existingListeners = window.__THEME_CHANGE_LISTENERS__ || [];
  existingListeners.forEach((listener) => {
    listener({ matches: isDark });
  });
};

// Error boundary testing utilities
global.triggerReactError = (component, errorMessage = 'Test error') => {
  // Simulate React error by throwing during render
  const originalComponentDidUpdate = component.componentDidUpdate;
  component.componentDidUpdate = function (...args) {
    if (originalComponentDidUpdate) {
      originalComponentDidUpdate.apply(this, args);
    }
    throw new Error(errorMessage);
  };
};

// Mobile navigation testing utilities
global.simulateMobileEnvironment = () => {
  // Mock mobile viewport
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: 375
  });

  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: 667
  });

  // Mock touch capabilities
  Object.defineProperty(window, 'ontouchstart', {
    writable: true,
    configurable: true,
    value: null
  });

  // Dispatch resize event
  window.dispatchEvent(new Event('resize'));
};

// WebSocket mocking for integration tests
global.mockWebSocketBehavior = (behavior = 'stable') => {
  const behaviors = {
    stable: { connectDelay: 10, disconnectChance: 0 },
    unstable: { connectDelay: 100, disconnectChance: 0.3 },
    offline: { connectDelay: 5000, disconnectChance: 1 }
  };

  const config = behaviors[behavior] || behaviors.stable;

  class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = WebSocket.CONNECTING;

      setTimeout(() => {
        if (Math.random() > config.disconnectChance) {
          this.readyState = WebSocket.OPEN;
          if (this.onopen) this.onopen({ type: 'open' });
        } else {
          this.readyState = WebSocket.CLOSED;
          if (this.onerror) this.onerror({ type: 'error' });
        }
      }, config.connectDelay);
    }

    send(data) {
      if (this.readyState !== WebSocket.OPEN) {
        throw new Error('WebSocket is not open');
      }
    }

    close() {
      this.readyState = WebSocket.CLOSED;
      if (this.onclose) this.onclose({ type: 'close' });
    }
  }

  MockWebSocket.CONNECTING = 0;
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;

  global.WebSocket = MockWebSocket;
};

// Accessibility testing helpers
global.checkA11yCompliance = async (container) => {
  const violations = [];

  // Check for basic accessibility requirements
  const buttons = container.querySelectorAll('button');
  buttons.forEach((button, index) => {
    if (!button.hasAttribute('aria-label') && !button.textContent.trim()) {
      violations.push(`Button at index ${index} lacks accessible text`);
    }
  });

  const inputs = container.querySelectorAll('input');
  inputs.forEach((input, index) => {
    if (
      !input.hasAttribute('aria-label') &&
      !input.hasAttribute('aria-labelledby') &&
      !input.hasAttribute('placeholder')
    ) {
      violations.push(`Input at index ${index} lacks accessible label`);
    }
  });

  if (violations.length > 0) {
    throw new Error(`Accessibility violations found:\n${violations.join('\n')}`);
  }

  return true;
};

// Test isolation helpers
global.isolateComponent = (Component, props = {}) => {
  // Wrap component with all necessary providers for isolation
  const TestWrapper = ({ children }) => (
    <div data-testid='isolated-component-wrapper'>{children}</div>
  );

  return (
    <TestWrapper>
      <Component {...props} />
    </TestWrapper>
  );
};
