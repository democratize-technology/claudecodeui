/**
 * Performance Benchmarking Framework
 *
 * This test suite provides comprehensive performance regression testing to ensure
 * the UI remains fast and responsive after bug fixes. It benchmarks critical
 * operations and provides performance budgets to prevent regressions.
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Jest globals - no import needed
// vi is replaced with jest in Jest environment
import { ThemeProvider } from '../../contexts/ThemeContext';
import { TasksSettingsProvider } from '../../contexts/TasksSettingsContext';
import ErrorBoundary from '../../components/ErrorBoundary';
import MobileNav from '../../components/MobileNav';
import {
  createPerformanceBenchmark,
  createThemeTestUtils,
  createMobileNavTestUtils,
  createWebSocketMock
} from '../utils/test-utils';

// Comprehensive app component for integration testing
const IntegratedApp = ({
  initialTheme = 'light',
  enableTasks = false,
  simulateError = false,
  children
}) => {
  const [activeTab, setActiveTab] = React.useState('chat');
  const [isInputFocused, setIsInputFocused] = React.useState(false);

  return (
    <ErrorBoundary>
      <TasksSettingsProvider value={{ tasksEnabled: enableTasks }}>
        <ThemeProvider>
          <div data-testid='integrated-app' className='min-h-screen bg-white dark:bg-gray-900'>
            <main className='pb-16'>
              {simulateError && <ErrorProneChild />}
              {children || <DefaultAppContent />}
            </main>

            <MobileNav
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              isInputFocused={isInputFocused}
            />

            <input
              data-testid='focus-input'
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder='Test input for mobile nav behavior'
              className='fixed top-4 left-4 p-2 border rounded'
            />
          </div>
        </ThemeProvider>
      </TasksSettingsProvider>
    </ErrorBoundary>
  );
};

const ErrorProneChild = () => {
  throw new Error('Intentional test error');
};

const DefaultAppContent = () => (
  <div className='p-4'>
    <h1 data-testid='app-title' className='text-2xl font-bold mb-4 text-gray-900 dark:text-white'>
      Claude Code UI
    </h1>
    <div className='grid gap-4'>
      {Array.from({ length: 20 }, (_, i) => (
        <div
          key={i}
          data-testid={`content-block-${i}`}
          className='p-4 bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors'
        >
          Content block {i + 1} with theme-aware styling
        </div>
      ))}
    </div>
  </div>
);

describe('Performance Benchmarking Framework', () => {
  let performanceBenchmark;
  let themeUtils;
  let mobileNavUtils;
  let webSocketMock;

  // Performance budgets (maximum acceptable times in ms)
  const PERFORMANCE_BUDGETS = {
    INITIAL_RENDER: 200,
    THEME_SWITCH: 150,
    TAB_NAVIGATION: 100,
    ERROR_RECOVERY: 200,
    COMPONENT_UPDATE: 50,
    MOBILE_NAV_TRANSITION: 300,
    FULL_APP_RENDER: 500
  };

  beforeEach(() => {
    performanceBenchmark = createPerformanceBenchmark();
    themeUtils = createThemeTestUtils();
    mobileNavUtils = createMobileNavTestUtils();
    webSocketMock = createWebSocketMock();

    // Mock performance APIs
    global.performance.mark = jest.fn();
    global.performance.measure = jest.fn();
    global.performance.getEntriesByType = jest.fn(() => []);

    // Setup theme mocking
    Object.defineProperty(window, 'localStorage', {
      value: themeUtils.mockLocalStorage,
      writable: true
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: themeUtils.mockMatchMedia
    });

    // Setup WebSocket mocking
    global.WebSocket = webSocketMock.MockWebSocket;
  });

  afterEach(() => {
    performanceBenchmark.clearMeasurements();
    themeUtils.clearEvents();
    mobileNavUtils.clearMeasurements();
    webSocketMock.clearEvents();
    jest.clearAllMocks();
  });

  describe('Initial Render Performance', () => {
    it('should render the full app within performance budget', async () => {
      const measurement = await performanceBenchmark.benchmark(
        'full-app-initial-render',
        async () => {
          render(<IntegratedApp />);

          await waitFor(() => {
            expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
            expect(screen.getByTestId('app-title')).toBeInTheDocument();
          });
        }
      );

      expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.FULL_APP_RENDER);
      console.log(
        `✅ Initial render: ${measurement.average.toFixed(2)}ms (budget: ${PERFORMANCE_BUDGETS.FULL_APP_RENDER}ms)`
      );
    });

    it('should render with different theme configurations efficiently', async () => {
      const configurations = [
        { initialTheme: 'light', enableTasks: false },
        { initialTheme: 'dark', enableTasks: false },
        { initialTheme: 'light', enableTasks: true },
        { initialTheme: 'dark', enableTasks: true }
      ];

      for (const config of configurations) {
        const measurement = await performanceBenchmark.benchmark(
          `render-${config.initialTheme}-tasks-${config.enableTasks}`,
          async () => {
            // Pre-set theme in localStorage to simulate saved preference
            themeUtils.mockLocalStorage.getItem.mockReturnValue(config.initialTheme);

            const { unmount } = render(
              <IntegratedApp initialTheme={config.initialTheme} enableTasks={config.enableTasks} />
            );

            await waitFor(() => {
              expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
            });

            unmount();
          }
        );

        expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.INITIAL_RENDER);
        console.log(
          `✅ ${config.initialTheme} theme, tasks ${config.enableTasks ? 'enabled' : 'disabled'}: ${measurement.average.toFixed(2)}ms`
        );
      }
    });

    it('should handle large content rendering efficiently', async () => {
      const LargeContentApp = () => (
        <IntegratedApp>
          <div className='grid gap-2'>
            {Array.from({ length: 100 }, (_, i) => (
              <div
                key={i}
                className='p-2 bg-blue-50 dark:bg-blue-900 rounded text-sm transition-colors'
              >
                Large content item {i + 1} with dynamic styling
              </div>
            ))}
          </div>
        </IntegratedApp>
      );

      const measurement = await performanceBenchmark.benchmark('large-content-render', async () => {
        render(<LargeContentApp />);

        await waitFor(() => {
          expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
          // Wait for a reasonable amount of content to be present
          expect(document.querySelectorAll('[class*="bg-blue-50"]')).toHaveLength(100);
        });
      });

      // Large content should still render reasonably fast
      expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.FULL_APP_RENDER * 1.5);
      console.log(`✅ Large content render: ${measurement.average.toFixed(2)}ms`);
    });
  });

  describe('Theme Switching Performance', () => {
    it('should switch themes within performance budget', async () => {
      render(<IntegratedApp />);

      await waitFor(() => {
        expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark(
        'theme-switch-performance',
        async () => {
          // Simulate theme toggle button click
          act(() => {
            document.documentElement.classList.toggle('dark');
          });

          // Wait for all theme-dependent elements to update
          await waitFor(() => {
            const styledElements = document.querySelectorAll('[class*="dark:"]');
            expect(styledElements.length).toBeGreaterThan(0);
          });
        },
        5 // Test multiple iterations
      );

      expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.THEME_SWITCH);
      console.log(
        `✅ Theme switch: ${measurement.average.toFixed(2)}ms (budget: ${PERFORMANCE_BUDGETS.THEME_SWITCH}ms)`
      );
    });

    it('should handle rapid theme switches without performance degradation', async () => {
      render(<IntegratedApp />);

      await waitFor(() => {
        expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark('rapid-theme-switches', async () => {
        // Switch themes rapidly 10 times
        for (let i = 0; i < 10; i++) {
          act(() => {
            document.documentElement.classList.toggle('dark');
          });
          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Wait for final state to settle
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should handle rapid switches efficiently
      expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.THEME_SWITCH * 2);
      console.log(`✅ Rapid theme switches: ${measurement.average.toFixed(2)}ms`);
    });
  });

  describe('Navigation Performance', () => {
    it('should switch tabs within performance budget', async () => {
      render(<IntegratedApp enableTasks={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
      });

      const tabs = ['chat', 'shell', 'files', 'git', 'tasks'];

      const measurement = await performanceBenchmark.benchmark(
        'tab-navigation-performance',
        async () => {
          for (const tab of tabs) {
            const tabButton = screen.getByLabelText(tab);

            await act(async () => {
              await userEvent.click(tabButton);
            });

            // Verify tab is active (visual state update)
            expect(tabButton).toHaveClass('text-blue-600', 'dark:text-blue-400');
          }
        }
      );

      expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.TAB_NAVIGATION * tabs.length);
      console.log(`✅ Tab navigation: ${measurement.average.toFixed(2)}ms`);
    });

    it('should handle mobile navigation transitions efficiently', async () => {
      const { rerender } = render(<IntegratedApp />);

      await waitFor(() => {
        expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark(
        'mobile-nav-transitions',
        async () => {
          // Hide navigation
          rerender(<IntegratedApp />);
          const input = screen.getByTestId('focus-input');

          await act(async () => {
            input.focus();
          });

          await new Promise((resolve) => setTimeout(resolve, 100));

          // Show navigation
          await act(async () => {
            input.blur();
          });

          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      );

      expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.MOBILE_NAV_TRANSITION);
      console.log(`✅ Mobile nav transitions: ${measurement.average.toFixed(2)}ms`);
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover from errors within performance budget', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      render(<IntegratedApp simulateError={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark(
        'error-recovery-performance',
        async () => {
          // Click retry button
          const retryButton = screen.getByText(/Try Again/);

          await act(async () => {
            await userEvent.click(retryButton);
          });

          // Wait for successful recovery (error should be gone)
          await waitFor(() => {
            expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
          });
        }
      );

      expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.ERROR_RECOVERY);
      console.log(`✅ Error recovery: ${measurement.average.toFixed(2)}ms`);

      consoleSpy.mockRestore();
    });
  });

  describe('Component Update Performance', () => {
    it('should handle prop updates efficiently', async () => {
      const TestComponent = ({ count }) => (
        <IntegratedApp>
          <div data-testid='dynamic-content'>
            {Array.from({ length: count }, (_, i) => (
              <div key={i} className='p-1 bg-gray-100 dark:bg-gray-800 transition-colors'>
                Item {i}
              </div>
            ))}
          </div>
        </IntegratedApp>
      );

      const { rerender } = render(<TestComponent count={10} />);

      await waitFor(() => {
        expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark('component-updates', async () => {
        // Update with more items
        rerender(<TestComponent count={50} />);

        await waitFor(() => {
          expect(screen.getByTestId('dynamic-content').children).toHaveLength(50);
        });

        // Update with fewer items
        rerender(<TestComponent count={25} />);

        await waitFor(() => {
          expect(screen.getByTestId('dynamic-content').children).toHaveLength(25);
        });
      });

      expect(measurement.average).toBeLessThan(PERFORMANCE_BUDGETS.COMPONENT_UPDATE * 2);
      console.log(`✅ Component updates: ${measurement.average.toFixed(2)}ms`);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should not leak memory during repeated operations', async () => {
      // This test checks for memory leaks by performing operations repeatedly
      const { rerender, unmount } = render(<IntegratedApp />);

      await waitFor(() => {
        expect(screen.getByTestId('integrated-app')).toBeInTheDocument();
      });

      const initialMemory = performance.memory?.usedJSHeapSize || 0;

      const measurement = await performanceBenchmark.benchmark('memory-leak-test', async () => {
        // Perform operations that historically caused memory leaks
        for (let i = 0; i < 10; i++) {
          // Theme switches
          act(() => {
            document.documentElement.classList.toggle('dark');
          });

          // Component re-renders
          rerender(<IntegratedApp key={i} enableTasks={i % 2 === 0} />);

          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      });

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for this test)
      if (performance.memory) {
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        console.log(`✅ Memory usage increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      }

      console.log(`✅ Memory leak test: ${measurement.average.toFixed(2)}ms`);

      unmount();
    });
  });

  describe('Performance Budget Summary', () => {
    it('should log performance summary', () => {
      const measurements = performanceBenchmark.getMeasurements();

      console.log('\n📊 Performance Budget Summary:');
      console.log('================================');

      Object.entries(PERFORMANCE_BUDGETS).forEach(([operation, budget]) => {
        const measurement = measurements.find((m) =>
          m.name.toLowerCase().includes(operation.toLowerCase())
        );

        if (measurement) {
          const status = measurement.average <= budget ? '✅' : '❌';
          console.log(`${status} ${operation}: ${measurement.average.toFixed(2)}ms / ${budget}ms`);
        } else {
          console.log(`⚪ ${operation}: Not tested / ${budget}ms`);
        }
      });

      console.log('================================\n');
    });
  });
});
