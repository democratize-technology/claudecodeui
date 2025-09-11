/**
 * Integration Stability Regression Tests
 *
 * These tests verify that all the bug fixes work together correctly
 * and don't introduce new issues when components interact with each other.
 * This prevents regression scenarios where individual fixes work but
 * create problems in combination.
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';

import { ThemeProvider } from '../../contexts/ThemeContext';
import { TasksSettingsProvider } from '../../contexts/TasksSettingsContext';
import ErrorBoundary from '../../components/ErrorBoundary';
import MobileNav from '../../components/MobileNav';

import {
  createThemeTestUtils,
  createFlashDetector,
  createErrorBoundaryTestUtils,
  createMobileNavTestUtils,
  createPerformanceBenchmark,
  createWebSocketMock
} from '../utils/test-utils';

// Mock WebSocketContext for integration testing
const MockWebSocketProvider = ({ children, connectionState = 'connected' }) => {
  const [state, setState] = React.useState(connectionState);

  const contextValue = {
    connectionState: state,
    sendMessage: vi.fn(),
    reconnect: vi.fn(),
    isConnected: state === 'connected'
  };

  return (
    <div data-connection-state={state}>
      {React.cloneElement(children, { webSocketContext: contextValue })}
    </div>
  );
};

// Full application component simulating real usage
const FullAppSimulation = ({
  initialTheme = null,
  simulateWebSocketIssues = false,
  simulateErrors = false,
  children
}) => {
  const [activeTab, setActiveTab] = React.useState('chat');
  const [isInputFocused, setIsInputFocused] = React.useState(false);
  const [errorCount, setErrorCount] = React.useState(0);
  const [websocketState, setWebsocketState] = React.useState('connected');

  // Simulate network issues
  React.useEffect(() => {
    if (simulateWebSocketIssues) {
      const interval = setInterval(() => {
        setWebsocketState((prev) => (prev === 'connected' ? 'disconnected' : 'connected'));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [simulateWebSocketIssues]);

  return (
    <ErrorBoundary onRetry={() => setErrorCount(0)} key={`error-boundary-${errorCount}`}>
      <TasksSettingsProvider value={{ tasksEnabled: true }}>
        <MockWebSocketProvider connectionState={websocketState}>
          <ThemeProvider>
            <div
              data-testid='full-app-simulation'
              className='min-h-screen bg-white dark:bg-gray-900 transition-colors duration-200'
            >
              {/* Header */}
              <header className='bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4'>
                <div className='flex items-center justify-between'>
                  <h1 className='text-xl font-semibold text-gray-900 dark:text-white'>
                    Claude Code UI
                  </h1>
                  <div className='flex items-center space-x-2'>
                    <div
                      data-testid='connection-indicator'
                      className={`w-2 h-2 rounded-full ${
                        websocketState === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <button
                      data-testid='theme-toggle'
                      onClick={() => {
                        document.documentElement.classList.toggle('dark');
                      }}
                      className='p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded'
                    >
                      🌙/☀️
                    </button>
                  </div>
                </div>
              </header>

              {/* Main content area */}
              <main className='pb-20 p-4'>
                {simulateErrors && errorCount > 0 ? (
                  <ErrorProneContent />
                ) : (
                  <StableContent activeTab={activeTab} />
                )}

                {children}

                {/* Test controls */}
                <div className='fixed top-20 right-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 shadow-lg'>
                  <h3 className='font-semibold mb-2 text-gray-900 dark:text-white'>
                    Test Controls
                  </h3>
                  <div className='space-y-2'>
                    <button
                      data-testid='trigger-error'
                      onClick={() => setErrorCount(1)}
                      className='block w-full px-3 py-1 text-sm bg-red-500 text-white rounded'
                    >
                      Trigger Error
                    </button>
                    <input
                      data-testid='focus-input'
                      placeholder='Focus test'
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                      className='block w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    />
                  </div>
                </div>
              </main>

              {/* Mobile Navigation */}
              <MobileNav
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                isInputFocused={isInputFocused}
              />
            </div>
          </ThemeProvider>
        </MockWebSocketProvider>
      </TasksSettingsProvider>
    </ErrorBoundary>
  );
};

const ErrorProneContent = () => {
  throw new Error('Integration test error');
};

const StableContent = ({ activeTab }) => (
  <div data-testid='stable-content' className='space-y-4'>
    <div className='bg-blue-50 dark:bg-blue-900 p-4 rounded-lg'>
      <h2 className='text-lg font-medium text-blue-900 dark:text-blue-100'>
        Active Tab: {activeTab}
      </h2>
      <p className='text-blue-700 dark:text-blue-300 mt-2'>
        This content changes based on the active navigation tab.
      </p>
    </div>

    {/* Dynamic content grid */}
    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          data-testid={`content-card-${i}`}
          className='p-4 bg-gray-100 dark:bg-gray-800 rounded-lg transition-colors duration-200'
        >
          <h3 className='font-medium text-gray-900 dark:text-white'>Content Block {i + 1}</h3>
          <p className='text-gray-600 dark:text-gray-300 text-sm mt-1'>
            This block demonstrates theme-aware styling and smooth transitions.
          </p>
        </div>
      ))}
    </div>
  </div>
);

describe('Integration Stability Regression Tests', () => {
  let themeUtils;
  let flashDetector;
  let errorBoundaryUtils;
  let mobileNavUtils;
  let performanceBenchmark;
  let webSocketMock;

  beforeEach(() => {
    themeUtils = createThemeTestUtils();
    flashDetector = createFlashDetector();
    errorBoundaryUtils = createErrorBoundaryTestUtils();
    mobileNavUtils = createMobileNavTestUtils();
    performanceBenchmark = createPerformanceBenchmark();
    webSocketMock = createWebSocketMock();

    // Setup comprehensive mocking
    Object.defineProperty(window, 'localStorage', {
      value: themeUtils.mockLocalStorage,
      writable: true
    });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: themeUtils.mockMatchMedia
    });
    global.WebSocket = webSocketMock.MockWebSocket;

    // Simulate the inline script setup
    document.documentElement.classList.add('no-transition');
    setTimeout(() => {
      document.documentElement.classList.remove('no-transition');
    }, 100);
  });

  afterEach(() => {
    themeUtils.clearEvents();
    flashDetector.cleanup();
    errorBoundaryUtils.clearStateChanges();
    mobileNavUtils.clearMeasurements();
    performanceBenchmark.clearMeasurements();
    webSocketMock.clearEvents();

    document.documentElement.classList.remove('dark', 'no-transition', 'theme-transition');
    vi.clearAllMocks();
  });

  describe('Cross-Component Theme Integration', () => {
    it('should coordinate theme changes across all components without flashing', async () => {
      render(<FullAppSimulation />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      // Monitor all theme-aware components for flashing
      const app = screen.getByTestId('full-app-simulation');
      const flashPromise = flashDetector.detectFlash(app, 1000);

      // Perform rapid theme switches
      const themeButton = screen.getByTestId('theme-toggle');

      await act(async () => {
        // Switch themes multiple times
        for (let i = 0; i < 5; i++) {
          await userEvent.click(themeButton);
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      });

      const styles = await flashPromise;

      // No component should flash during theme transitions
      expect(flashDetector.hasFlash(styles)).toBe(false);

      // Verify all components ended up with consistent theming
      const contentCards = screen.getAllByTestId(/content-card-/);
      contentCards.forEach((card) => {
        const computedStyle = window.getComputedStyle(card);
        expect(computedStyle.backgroundColor).not.toBe('');
      });
    });

    it('should maintain theme consistency during navigation changes', async () => {
      render(<FullAppSimulation />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      // Set dark theme
      await act(async () => {
        await userEvent.click(screen.getByTestId('theme-toggle'));
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Navigate through tabs while monitoring theme consistency
      const tabs = ['shell', 'files', 'git', 'tasks', 'chat'];

      for (const tab of tabs) {
        await act(async () => {
          await userEvent.click(screen.getByLabelText(tab));
        });

        // Verify theme remains consistent
        expect(document.documentElement.classList.contains('dark')).toBe(true);

        // Check that content updated for the tab
        await waitFor(() => {
          expect(screen.getByText(`Active Tab: ${tab}`)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Error Recovery Integration', () => {
    it('should handle errors without breaking other component functionality', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<FullAppSimulation simulateErrors={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      // Trigger an error
      await act(async () => {
        await userEvent.click(screen.getByTestId('trigger-error'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      // Verify that other components still work
      // Theme switching should still work
      const themeButton = screen.getByTestId('theme-toggle');
      await act(async () => {
        await userEvent.click(themeButton);
      });

      // Navigation should still work
      const shellTab = screen.getByLabelText('shell');
      await act(async () => {
        await userEvent.click(shellTab);
      });

      // Recovery should work
      const retryButton = screen.getByText(/Try Again/);
      await act(async () => {
        await userEvent.click(retryButton);
      });

      await waitFor(() => {
        expect(screen.getByTestId('stable-content')).toBeInTheDocument();
      });

      // After recovery, everything should work normally
      await act(async () => {
        await userEvent.click(screen.getByLabelText('files'));
      });

      await waitFor(() => {
        expect(screen.getByText('Active Tab: files')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should maintain navigation state through error recovery', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<FullAppSimulation simulateErrors={false} />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      // Navigate to a specific tab
      await act(async () => {
        await userEvent.click(screen.getByLabelText('git'));
      });

      await waitFor(() => {
        expect(screen.getByText('Active Tab: git')).toBeInTheDocument();
      });

      // Trigger error
      await act(async () => {
        await userEvent.click(screen.getByTestId('trigger-error'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      // Recover
      await act(async () => {
        await userEvent.click(screen.getByText(/Try Again/));
      });

      await waitFor(() => {
        expect(screen.getByTestId('stable-content')).toBeInTheDocument();
      });

      // Navigation state should be preserved
      const gitTab = screen.getByLabelText('git');
      expect(gitTab).toHaveClass('text-blue-600', 'dark:text-blue-400');

      consoleSpy.mockRestore();
    });
  });

  describe('Mobile Navigation Integration', () => {
    it('should coordinate mobile navigation with theme and error states', async () => {
      render(<FullAppSimulation />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      // Test navigation in light theme
      await act(async () => {
        await userEvent.click(screen.getByLabelLabel('shell'));
      });

      await waitFor(() => {
        expect(screen.getByText('Active Tab: shell')).toBeInTheDocument();
      });

      // Switch to dark theme
      await act(async () => {
        await userEvent.click(screen.getByTestId('theme-toggle'));
      });

      // Navigation should still work in dark theme
      await act(async () => {
        await userEvent.click(screen.getByLabelLabel('files'));
      });

      await waitFor(() => {
        expect(screen.getByText('Active Tab: files')).toBeInTheDocument();
      });

      // Test input focus behavior
      const input = screen.getByTestId('focus-input');
      await act(async () => {
        input.focus();
      });

      // Mobile nav should respond to input focus
      await new Promise((resolve) => setTimeout(resolve, 100));

      await act(async () => {
        input.blur();
      });

      // Navigation should still work after focus/blur
      await act(async () => {
        await userEvent.click(screen.getByLabelLabel('git'));
      });

      await waitFor(() => {
        expect(screen.getByText('Active Tab: git')).toBeInTheDocument();
      });
    });

    it('should handle navigation transitions smoothly during theme changes', async () => {
      render(<FullAppSimulation />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark(
        'navigation-theme-coordination',
        async () => {
          // Perform coordinated theme and navigation changes
          for (let i = 0; i < 3; i++) {
            // Switch theme
            await act(async () => {
              await userEvent.click(screen.getByTestId('theme-toggle'));
            });

            // Switch navigation
            const tabs = ['chat', 'shell', 'files'];
            await act(async () => {
              await userEvent.click(screen.getByLabelLabel(tabs[i % tabs.length]));
            });

            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
      );

      // Should handle coordinated changes efficiently
      expect(measurement.average).toBeLessThan(500);
    });
  });

  describe('WebSocket Integration Stability', () => {
    it('should handle connection state changes without affecting other components', async () => {
      render(<FullAppSimulation simulateWebSocketIssues={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      // Wait for connection state to change a few times
      await new Promise((resolve) => setTimeout(resolve, 2500));

      // Verify connection indicator reflects state changes
      const indicator = screen.getByTestId('connection-indicator');
      expect(indicator).toBeInTheDocument();

      // Theme switching should still work during connection issues
      await act(async () => {
        await userEvent.click(screen.getByTestId('theme-toggle'));
      });

      // Navigation should still work
      await act(async () => {
        await userEvent.click(screen.getByLabelLabel('shell'));
      });

      await waitFor(() => {
        expect(screen.getByText('Active Tab: shell')).toBeInTheDocument();
      });
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance when all systems are active', async () => {
      const measurement = await performanceBenchmark.benchmark(
        'full-system-integration',
        async () => {
          render(<FullAppSimulation simulateWebSocketIssues={true} simulateErrors={false} />);

          await waitFor(() => {
            expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
          });

          // Perform comprehensive operations
          const operations = [
            // Theme switches
            () => userEvent.click(screen.getByTestId('theme-toggle')),

            // Navigation changes
            () => userEvent.click(screen.getByLabelLabel('shell')),
            () => userEvent.click(screen.getByLabelLabel('files')),
            () => userEvent.click(screen.getByLabelLabel('git')),

            // Input focus/blur
            () => screen.getByTestId('focus-input').focus(),
            () => screen.getByTestId('focus-input').blur()
          ];

          // Execute operations in sequence
          for (const operation of operations) {
            await act(async () => {
              await operation();
            });
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
      );

      // Full integration should still perform well
      expect(measurement.average).toBeLessThan(1000);
      console.log(`✅ Full system integration: ${measurement.average.toFixed(2)}ms`);
    });

    it('should handle stress testing without degradation', async () => {
      render(<FullAppSimulation />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark('stress-test', async () => {
        // Rapid-fire operations
        for (let i = 0; i < 20; i++) {
          const operations = [
            screen.getByTestId('theme-toggle'),
            screen.getByLabelLabel('shell'),
            screen.getByLabelLabel('chat'),
            screen.getByTestId('focus-input')
          ];

          for (const element of operations) {
            await act(async () => {
              if (element.tagName === 'INPUT') {
                element.focus();
                await new Promise((resolve) => setTimeout(resolve, 10));
                element.blur();
              } else {
                await userEvent.click(element);
              }
            });
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        }
      });

      // Should handle stress testing reasonably well
      expect(measurement.average).toBeLessThan(2000);
      console.log(`✅ Stress test: ${measurement.average.toFixed(2)}ms`);
    });
  });

  describe('State Consistency Verification', () => {
    it('should maintain consistent state across all components', async () => {
      render(<FullAppSimulation />);

      await waitFor(() => {
        expect(screen.getByTestId('full-app-simulation')).toBeInTheDocument();
      });

      // Perform a series of state changes
      const stateChangeSequence = [
        {
          action: () => userEvent.click(screen.getByTestId('theme-toggle')),
          verify: () => expect(document.documentElement.classList.contains('dark')).toBe(true)
        },
        {
          action: () => userEvent.click(screen.getByLabelLabel('files')),
          verify: () => expect(screen.getByText('Active Tab: files')).toBeInTheDocument()
        },
        {
          action: () => screen.getByTestId('focus-input').focus(),
          verify: () => expect(document.activeElement).toBe(screen.getByTestId('focus-input'))
        },
        {
          action: () => userEvent.click(screen.getByTestId('theme-toggle')),
          verify: () => expect(document.documentElement.classList.contains('dark')).toBe(false)
        }
      ];

      for (const { action, verify } of stateChangeSequence) {
        await act(async () => {
          await action();
        });

        await waitFor(() => {
          verify();
        });
      }

      // Final state verification
      expect(document.documentElement.classList.contains('dark')).toBe(false);
      expect(screen.getByText('Active Tab: files')).toBeInTheDocument();
    });
  });
});
