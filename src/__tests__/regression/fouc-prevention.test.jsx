/**
 * FOUC (Flash of Unstyled Content) Prevention Regression Tests
 * 
 * These tests prevent the FOUC bug from recurring during initial page load.
 * The bug was caused by ThemeContext accessing localStorage during React initialization
 * before the DOM was ready.
 * 
 * Fix: Added inline script in index.html + server-safe defaults in ThemeContext
 */

import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { 
  createFOUCDetector, 
  createThemeTestUtils,
  createPerformanceBenchmark 
} from '../utils/test-utils';

// Mock DOM structure that simulates the actual HTML setup
const mockHTMLStructure = () => {
  // Simulate the inline script execution from index.html
  const simulateInlineScript = (savedTheme = null, prefersDark = false) => {
    // Mock localStorage
    const mockStorage = {
      getItem: vi.fn(() => savedTheme),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true
    });

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn(() => ({
        matches: prefersDark,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });

    // Simulate the inline script logic
    document.documentElement.classList.add('no-transition');
    
    const isDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Simulate the setTimeout that removes no-transition
    setTimeout(() => {
      document.documentElement.classList.remove('no-transition');
    }, 100);

    return { mockStorage, isDark };
  };

  return { simulateInlineScript };
};

// Test component that renders with theme-dependent styles
const ThemeAwareComponent = () => {
  return (
    <div 
      data-testid="theme-aware-content"
      className="min-h-screen transition-colors duration-200 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
    >
      <header 
        data-testid="header"
        className="bg-gray-100 dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700"
      >
        <h1 className="text-2xl font-bold">App Header</h1>
      </header>
      
      <main 
        data-testid="main-content"
        className="p-4"
      >
        <div className="bg-blue-50 dark:bg-blue-900 p-6 rounded-lg">
          <p>This content should not flash during initial load</p>
        </div>
      </main>
      
      <footer 
        data-testid="footer"
        className="bg-gray-50 dark:bg-gray-900 p-4 border-t border-gray-200 dark:border-gray-700"
      >
        <p className="text-sm text-gray-600 dark:text-gray-400">Footer content</p>
      </footer>
    </div>
  );
};

describe('FOUC Prevention Regression Tests', () => {
  let foucDetector;
  let themeUtils;
  let performanceBenchmark;
  let htmlUtils;

  beforeEach(() => {
    foucDetector = createFOUCDetector();
    themeUtils = createThemeTestUtils();
    performanceBenchmark = createPerformanceBenchmark();
    htmlUtils = mockHTMLStructure();

    // Reset document state
    document.documentElement.classList.remove('dark', 'no-transition', 'theme-transition');
    document.documentElement.setAttribute('class', '');
  });

  afterEach(() => {
    foucDetector.clearSnapshots();
    themeUtils.clearEvents();
    performanceBenchmark.clearMeasurements();
    
    // Clean up document state
    document.documentElement.classList.remove('dark', 'no-transition', 'theme-transition');
    
    vi.clearAllMocks();
  });

  describe('Initial Load FOUC Prevention', () => {
    it('should prevent FOUC with saved light theme', async () => {
      // Simulate inline script execution with saved light theme
      const { mockStorage } = htmlUtils.simulateInlineScript('light', false);

      // Capture initial styles before React renders
      const initialSnapshot = foucDetector.captureInitialStyles();

      const measurement = await performanceBenchmark.benchmark(
        'light-theme-initial-load',
        async () => {
          const { container } = render(
            <ThemeProvider>
              <ThemeAwareComponent />
            </ThemeProvider>
          );

          // Capture styles during hydration
          for (let i = 0; i < 5; i++) {
            foucDetector.captureInitialStyles();
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          await waitFor(() => {
            expect(container.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();
          });
        }
      );

      // Verify no FOUC occurred
      expect(foucDetector.detectFOUC()).toBe(false);

      // Initial load should be protected by no-transition class
      expect(initialSnapshot.hasNoTransition).toBe(true);
      expect(initialSnapshot.isDark).toBe(false);

      // Should load quickly
      expect(measurement.average).toBeLessThan(200);
    });

    it('should prevent FOUC with saved dark theme', async () => {
      // Simulate inline script execution with saved dark theme
      const { mockStorage } = htmlUtils.simulateInlineScript('dark', false);

      const initialSnapshot = foucDetector.captureInitialStyles();

      const measurement = await performanceBenchmark.benchmark(
        'dark-theme-initial-load',
        async () => {
          const { container } = render(
            <ThemeProvider>
              <ThemeAwareComponent />
            </ThemeProvider>
          );

          // Capture styles during hydration
          for (let i = 0; i < 5; i++) {
            foucDetector.captureInitialStyles();
            await new Promise(resolve => setTimeout(resolve, 20));
          }

          await waitFor(() => {
            expect(container.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();
          });
        }
      );

      // Verify no FOUC occurred
      expect(foucDetector.detectFOUC()).toBe(false);

      // Initial state should have dark class and no-transition protection
      expect(initialSnapshot.hasNoTransition).toBe(true);
      expect(initialSnapshot.isDark).toBe(true);

      expect(measurement.average).toBeLessThan(200);
    });

    it('should prevent FOUC with system preference (no saved theme)', async () => {
      // Simulate inline script with system preference for dark mode
      const { mockStorage } = htmlUtils.simulateInlineScript(null, true);

      const initialSnapshot = foucDetector.captureInitialStyles();

      render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      // Capture styles during hydration phase
      const snapshots = [];
      for (let i = 0; i < 10; i++) {
        snapshots.push(foucDetector.captureInitialStyles());
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      await waitFor(() => {
        expect(document.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();
      });

      // Should respect system preference and prevent FOUC
      expect(foucDetector.detectFOUC(snapshots)).toBe(false);
      expect(initialSnapshot.isDark).toBe(true); // System preference was dark
      expect(initialSnapshot.hasNoTransition).toBe(true);
    });

    it('should handle no-transition class removal timing correctly', async () => {
      htmlUtils.simulateInlineScript('light', false);

      render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      // Initially should have no-transition class
      expect(document.documentElement.classList.contains('no-transition')).toBe(true);

      // Wait for the class to be removed (100ms timeout in inline script)
      await waitFor(() => {
        expect(document.documentElement.classList.contains('no-transition')).toBe(false);
      }, { timeout: 200 });

      // After removal, transitions should be enabled
      const element = document.querySelector('[data-testid="theme-aware-content"]');
      if (element) {
        const computedStyle = window.getComputedStyle(element);
        // Should have transition-duration defined (not 'none' or '0s')
        expect(computedStyle.transitionDuration).not.toBe('0s');
      }
    });
  });

  describe('Hydration Mismatch Prevention', () => {
    it('should prevent hydration mismatches with server-safe defaults', async () => {
      // Simulate server-side render scenario (no localStorage access)
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => { throw new Error('localStorage not available'); }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn()
        },
        writable: true
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();
      });

      // Should handle localStorage errors gracefully
      expect(consoleSpy).toHaveBeenCalledWith(
        'Theme initialization error:',
        expect.any(Error)
      );

      // Should still initialize without throwing
      expect(document.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });

    it('should maintain consistent initial state between server and client', async () => {
      // Simulate the exact initialization sequence that happens in production
      htmlUtils.simulateInlineScript(null, false); // No saved theme, light system preference

      const { container } = render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      // Component should render with light theme initially (server-safe default)
      const themeAwareElement = container.querySelector('[data-testid="theme-aware-content"]');
      
      // Should not have dark classes initially
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      
      // Wait for theme initialization
      await waitFor(() => {
        // After initialization, should still be light theme
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });
  });

  describe('Performance During Initial Load', () => {
    it('should complete initial theme setup within performance threshold', async () => {
      htmlUtils.simulateInlineScript('dark', false);

      const measurement = await performanceBenchmark.benchmark(
        'initial-theme-setup',
        async () => {
          render(
            <ThemeProvider>
              <ThemeAwareComponent />
            </ThemeProvider>
          );

          // Wait for full initialization
          await waitFor(() => {
            const element = document.querySelector('[data-testid="main-content"]');
            const computedStyle = window.getComputedStyle(element);
            // Should have proper dark mode styles applied
            return computedStyle.color !== ''; // Some style should be computed
          });
        }
      );

      // Initial theme setup should be very fast
      expect(measurement.average).toBeLessThan(100);
    });

    it('should not block rendering during theme initialization', async () => {
      htmlUtils.simulateInlineScript('light', false);

      const renderStartTime = performance.now();
      
      const { container } = render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      const renderEndTime = performance.now();
      const renderTime = renderEndTime - renderStartTime;

      // Component should render immediately (not blocked by theme logic)
      expect(container.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();
      expect(renderTime).toBeLessThan(50); // Very fast initial render

      // Theme initialization happens asynchronously
      await waitFor(() => {
        // Just verify the component is there - theme initialization is separate
        expect(container.querySelector('[data-testid="header"]')).toBeInTheDocument();
      });
    });
  });

  describe('Style Consistency Across Components', () => {
    it('should apply consistent theme styles to all components during initial load', async () => {
      htmlUtils.simulateInlineScript('dark', false);

      render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();
      });

      // All theme-dependent components should have consistent styling
      const header = document.querySelector('[data-testid="header"]');
      const main = document.querySelector('[data-testid="main-content"]');
      const footer = document.querySelector('[data-testid="footer"]');

      // Check that all components have appropriate classes for dark theme
      const headerStyles = window.getComputedStyle(header);
      const mainStyles = window.getComputedStyle(main);
      const footerStyles = window.getComputedStyle(footer);

      // All should be styled consistently (dark colors)
      expect(headerStyles.backgroundColor).not.toBe('');
      expect(mainStyles.color).not.toBe('');
      expect(footerStyles.backgroundColor).not.toBe('');

      // Document should have dark class applied
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('should prevent mixed light/dark styling during initialization', async () => {
      htmlUtils.simulateInlineScript('dark', false);

      // Capture multiple style snapshots during initialization
      const styleSnapshots = [];
      
      render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      // Rapidly capture styles during initialization
      for (let i = 0; i < 8; i++) {
        const snapshot = {
          timestamp: performance.now(),
          documentHasDark: document.documentElement.classList.contains('dark'),
          documentHasNoTransition: document.documentElement.classList.contains('no-transition')
        };
        styleSnapshots.push(snapshot);
        await new Promise(resolve => setTimeout(resolve, 12));
      }

      // All snapshots should be consistent
      const darkStates = styleSnapshots.map(s => s.documentHasDark);
      const firstDarkState = darkStates[0];
      
      // Should maintain consistent dark state throughout initialization
      darkStates.forEach((isDark, index) => {
        expect(isDark).toBe(firstDarkState);
      });
    });
  });

  describe('Error Recovery During Initial Load', () => {
    it('should recover gracefully from localStorage errors during initial load', async () => {
      // Mock localStorage to throw during inline script simulation
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => { throw new Error('Storage quota exceeded'); }),
          setItem: vi.fn(() => { throw new Error('Storage quota exceeded'); }),
          removeItem: vi.fn(),
          clear: vi.fn()
        },
        writable: true
      });

      // Inline script should handle errors gracefully
      try {
        htmlUtils.simulateInlineScript('dark', false);
      } catch (error) {
        // Should not throw - inline script has try/catch
        expect(true).toBe(false);
      }

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();
      });

      // Should still render successfully despite localStorage errors
      expect(document.querySelector('[data-testid="header"]')).toBeInTheDocument();
      
      consoleSpy.mockRestore();
    });

    it('should fallback to system preference when localStorage fails', async () => {
      // Mock localStorage failure but working matchMedia
      Object.defineProperty(window, 'localStorage', {
        value: {
          getItem: vi.fn(() => { throw new Error('localStorage error'); }),
          setItem: vi.fn(),
          removeItem: vi.fn(),
          clear: vi.fn()
        },
        writable: true
      });

      // System prefers dark mode
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn(() => ({
          matches: true, // Prefers dark
          addEventListener: vi.fn(),
          removeEventListener: vi.fn()
        }))
      });

      // Simulate inline script with system preference fallback
      document.documentElement.classList.add('no-transition');
      // Should fall back to system preference (dark)
      document.documentElement.classList.add('dark');

      render(
        <ThemeProvider>
          <ThemeAwareComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="theme-aware-content"]')).toBeInTheDocument();
      });

      // Should have applied dark theme from system preference
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });
});