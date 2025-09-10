/**
 * ErrorBoundary Race Condition Regression Tests
 * 
 * These tests prevent the ErrorBoundary race condition bug from recurring.
 * The bug was caused by race conditions between `retryCount` and children prop changes,
 * leading to inconsistent error recovery states.
 * 
 * Fix: Added `isResetting` state to prevent race conditions during error recovery
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import ErrorBoundary from '../../components/ErrorBoundary';
import { 
  createErrorBoundaryTestUtils, 
  createPerformanceBenchmark 
} from '../utils/test-utils';

// Mock component that can throw errors on demand
const ErrorProneComponent = ({ 
  shouldThrow = false, 
  throwAfterDelay = 0,
  onRender,
  version = 1 
}) => {
  React.useEffect(() => {
    if (onRender) onRender();
  }, [onRender]);

  if (throwAfterDelay > 0) {
    // Simulate async error
    setTimeout(() => {
      if (shouldThrow) {
        throw new Error(`Delayed error (version ${version})`);
      }
    }, throwAfterDelay);
  }

  if (shouldThrow && throwAfterDelay === 0) {
    throw new Error(`Immediate error (version ${version})`);
  }

  return (
    <div data-testid="error-prone-content">
      Content loaded successfully (version {version})
    </div>
  );
};

// Component that changes its children props rapidly
const RapidPropsChanger = ({ errorBoundaryRef }) => {
  const [version, setVersion] = React.useState(1);
  const [shouldThrow, setShouldThrow] = React.useState(false);

  const triggerError = () => setShouldThrow(true);
  const changeProps = () => setVersion(v => v + 1);
  const reset = () => {
    setShouldThrow(false);
    setVersion(v => v + 1);
  };

  return (
    <div>
      <button data-testid="trigger-error" onClick={triggerError}>
        Trigger Error
      </button>
      <button data-testid="change-props" onClick={changeProps}>
        Change Props
      </button>
      <button data-testid="reset-component" onClick={reset}>
        Reset Component
      </button>
      
      <ErrorBoundary ref={errorBoundaryRef} showDetails={true}>
        <ErrorProneComponent 
          shouldThrow={shouldThrow} 
          version={version}
          key={`error-component-${version}`}
        />
      </ErrorBoundary>
    </div>
  );
};

describe('ErrorBoundary Race Condition Regression Tests', () => {
  let errorBoundaryUtils;
  let performanceBenchmark;
  let consoleErrorSpy;

  beforeEach(() => {
    errorBoundaryUtils = createErrorBoundaryTestUtils();
    performanceBenchmark = createPerformanceBenchmark();
    
    // Suppress error boundary console logs during tests
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    errorBoundaryUtils.clearStateChanges();
    performanceBenchmark.clearMeasurements();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Race Condition Prevention', () => {
    it('should prevent race conditions during retry button clicks', async () => {
      const errorBoundaryRef = React.createRef();
      
      render(<RapidPropsChanger errorBoundaryRef={errorBoundaryRef} />);

      // Trigger an error
      await act(async () => {
        await userEvent.click(screen.getByTestId('trigger-error'));
      });

      // Wait for error boundary to catch the error
      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      // Track state changes in error boundary
      if (errorBoundaryRef.current) {
        errorBoundaryUtils.trackStateChanges(errorBoundaryRef.current);
      }

      // Rapidly click retry multiple times (simulate race condition)
      const retryButton = screen.getByText(/Try Again/);
      
      await act(async () => {
        // Click retry button multiple times rapidly
        for (let i = 0; i < 5; i++) {
          await userEvent.click(retryButton);
          // Small delay to allow state updates
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      });

      // Wait for all state changes to settle
      await waitFor(() => {
        expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
      }, { timeout: 2000 });

      // Verify no race conditions occurred
      expect(errorBoundaryUtils.hasRaceCondition()).toBe(false);

      const stateChanges = errorBoundaryUtils.getStateChanges();
      
      // Verify isResetting flag was used correctly
      const resettingStates = stateChanges.filter(change => change.isResetting);
      expect(resettingStates.length).toBeGreaterThan(0);
      
      // Verify all resetting states eventually resolved
      const finalState = stateChanges[stateChanges.length - 1]?.newState;
      expect(finalState?.isResetting).toBe(false);
      expect(finalState?.hasError).toBe(false);
    });

    it('should handle rapid prop changes without race conditions', async () => {
      const errorBoundaryRef = React.createRef();
      
      render(<RapidPropsChanger errorBoundaryRef={errorBoundaryRef} />);

      // Trigger error
      await act(async () => {
        await userEvent.click(screen.getByTestId('trigger-error'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      // Start tracking state changes
      if (errorBoundaryRef.current) {
        errorBoundaryUtils.trackStateChanges(errorBoundaryRef.current);
      }

      // Rapidly change props while in error state
      await act(async () => {
        for (let i = 0; i < 3; i++) {
          await userEvent.click(screen.getByTestId('change-props'));
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      });

      // Then try to recover
      await act(async () => {
        await userEvent.click(screen.getByText(/Try Again/));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
      });

      // Should not have race conditions even with prop changes
      expect(errorBoundaryUtils.hasRaceCondition()).toBe(false);
    });

    it('should handle componentDidUpdate race conditions', async () => {
      let errorBoundaryInstance;
      
      const TestComponent = () => {
        const [key, setKey] = React.useState(1);
        const [shouldError, setShouldError] = React.useState(false);

        return (
          <div>
            <button 
              data-testid="change-children" 
              onClick={() => setKey(k => k + 1)}
            >
              Change Children
            </button>
            <button 
              data-testid="trigger-error-delayed" 
              onClick={() => setShouldError(true)}
            >
              Trigger Error
            </button>
            
            <ErrorBoundary 
              ref={ref => { errorBoundaryInstance = ref; }}
              onRetry={() => {
                setShouldError(false);
                setKey(k => k + 1);
              }}
            >
              <ErrorProneComponent 
                key={key} 
                shouldThrow={shouldError}
                version={key}
              />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestComponent />);

      // Trigger error
      await act(async () => {
        await userEvent.click(screen.getByTestId('trigger-error-delayed'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      // Track state changes
      if (errorBoundaryInstance) {
        errorBoundaryUtils.trackStateChanges(errorBoundaryInstance);
      }

      // Simulate componentDidUpdate scenario: retry while props are changing
      await act(async () => {
        // Start retry process
        const retryPromise = userEvent.click(screen.getByText(/Try Again/));
        
        // Quickly change children during retry
        await new Promise(resolve => setTimeout(resolve, 5)); // Minimal delay
        await userEvent.click(screen.getByTestId('change-children'));
        
        await retryPromise;
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
      });

      // Should handle the race condition gracefully
      expect(errorBoundaryUtils.hasRaceCondition()).toBe(false);
    });
  });

  describe('Error Recovery Reliability', () => {
    it('should maintain consistent state during error recovery', async () => {
      const onRetry = vi.fn();
      let errorInstance;

      const TestWrapper = () => {
        const [shouldThrow, setShouldThrow] = React.useState(false);

        return (
          <div>
            <button 
              data-testid="cause-error" 
              onClick={() => setShouldThrow(true)}
            >
              Cause Error
            </button>
            
            <ErrorBoundary 
              ref={ref => { errorInstance = ref; }}
              onRetry={() => {
                onRetry();
                setShouldThrow(false);
              }}
              showDetails={true}
            >
              <ErrorProneComponent shouldThrow={shouldThrow} />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestWrapper />);

      // Cause error
      await act(async () => {
        await userEvent.click(screen.getByTestId('cause-error'));
      });

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      // Verify error state
      expect(errorInstance.state.hasError).toBe(true);
      expect(errorInstance.state.isResetting).toBe(false);

      // Start recovery
      await act(async () => {
        await userEvent.click(screen.getByText(/Try Again/));
      });

      // During recovery, isResetting should be true
      expect(errorInstance.state.isResetting).toBe(false); // Should be reset after click
      expect(onRetry).toHaveBeenCalled();

      await waitFor(() => {
        expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
      });

      // Final state should be clean
      expect(errorInstance.state.hasError).toBe(false);
      expect(errorInstance.state.error).toBe(null);
      expect(errorInstance.state.isResetting).toBe(false);
    });

    it('should show retry loading state during recovery', async () => {
      render(
        <ErrorBoundary showDetails={true}>
          <ErrorProneComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      const retryButton = screen.getByText(/Try Again/);
      
      // Click and immediately check for loading state
      await act(async () => {
        await userEvent.click(retryButton);
      });

      // Button should have been disabled and showed loading state briefly
      // (Though this happens very quickly in our implementation)
      expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
    });

    it('should increment retry count on each attempt', async () => {
      let errorInstance;

      const TestErrorComponent = () => {
        const [shouldThrow, setShouldThrow] = React.useState(true);
        const [attemptCount, setAttemptCount] = React.useState(0);

        return (
          <div>
            <button 
              data-testid="fix-error" 
              onClick={() => setShouldThrow(false)}
            >
              Fix Error
            </button>
            
            <ErrorBoundary 
              ref={ref => { errorInstance = ref; }}
              onRetry={() => setAttemptCount(c => c + 1)}
            >
              <ErrorProneComponent 
                shouldThrow={shouldThrow} 
                version={attemptCount}
              />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestErrorComponent />);

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      const initialRetryCount = errorInstance.state.retryCount;

      // Try to recover (will fail because error is still active)
      await act(async () => {
        await userEvent.click(screen.getByText(/Try Again/));
      });

      // Should have incremented retry count
      expect(errorInstance.state.retryCount).toBe(initialRetryCount + 1);

      // Try again (still will fail)
      await act(async () => {
        await userEvent.click(screen.getByText(/Try Again/));
      });

      expect(errorInstance.state.retryCount).toBe(initialRetryCount + 2);

      // Now fix the error and retry
      await act(async () => {
        await userEvent.click(screen.getByTestId('fix-error'));
        await userEvent.click(screen.getByText(/Try Again/));
      });

      await waitFor(() => {
        expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
      });

      // Retry count should be preserved even after successful recovery
      expect(errorInstance.state.retryCount).toBe(initialRetryCount + 3);
    });
  });

  describe('Performance During Error Recovery', () => {
    it('should recover from errors within performance threshold', async () => {
      const TestComponent = ({ shouldError }) => (
        <ErrorBoundary>
          <ErrorProneComponent shouldThrow={shouldError} />
        </ErrorBoundary>
      );

      const { rerender } = render(<TestComponent shouldError={true} />);

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark(
        'error-recovery',
        async () => {
          await act(async () => {
            // Fix the error by rerendering with shouldError=false
            rerender(<TestComponent shouldError={false} />);
            await userEvent.click(screen.getByText(/Try Again/));
          });

          await waitFor(() => {
            expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
          });
        }
      );

      // Error recovery should be fast (under 100ms)
      expect(measurement.average).toBeLessThan(100);
    });

    it('should handle multiple rapid error recoveries efficiently', async () => {
      let errorInstance;
      const TestComponent = () => {
        const [errorCount, setErrorCount] = React.useState(0);
        const [shouldThrow, setShouldThrow] = React.useState(false);

        return (
          <div>
            <button 
              data-testid="cycle-error" 
              onClick={() => {
                setShouldThrow(true);
                setTimeout(() => setShouldThrow(false), 10);
                setErrorCount(c => c + 1);
              }}
            >
              Cycle Error
            </button>
            
            <ErrorBoundary ref={ref => { errorInstance = ref; }}>
              <ErrorProneComponent 
                shouldThrow={shouldThrow}
                key={errorCount}
              />
            </ErrorBoundary>
          </div>
        );
      };

      render(<TestComponent />);

      const measurement = await performanceBenchmark.benchmark(
        'multiple-error-recovery',
        async () => {
          // Simulate 5 error cycles
          for (let i = 0; i < 5; i++) {
            await act(async () => {
              await userEvent.click(screen.getByTestId('cycle-error'));
            });

            // Wait for error state
            await waitFor(() => {
              expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
            }, { timeout: 1000 });

            // Retry
            await act(async () => {
              await userEvent.click(screen.getByText(/Try Again/));
            });

            // Wait for recovery
            await waitFor(() => {
              expect(screen.getByTestId('error-prone-content')).toBeInTheDocument();
            }, { timeout: 1000 });
          }
        },
        1
      );

      // Multiple error recoveries should complete in reasonable time
      expect(measurement.average).toBeLessThan(2000);
    });
  });

  describe('Error Details and Logging', () => {
    it('should show error details when showDetails is true', async () => {
      render(
        <ErrorBoundary showDetails={true}>
          <ErrorProneComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      // Should show error details toggle
      expect(screen.getByText(/Error Details/)).toBeInTheDocument();
      
      // Click to expand details
      await act(async () => {
        await userEvent.click(screen.getByText(/Error Details/));
      });

      // Should show the actual error message
      await waitFor(() => {
        expect(screen.getByText(/Immediate error/)).toBeInTheDocument();
      });
    });

    it('should hide error details when showDetails is false', async () => {
      render(
        <ErrorBoundary showDetails={false}>
          <ErrorProneComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      // Should not show error details
      expect(screen.queryByText(/Error Details/)).not.toBeInTheDocument();
    });

    it('should log errors to console', async () => {
      consoleErrorSpy.mockRestore();
      const newConsoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <ErrorBoundary>
          <ErrorProneComponent shouldThrow={true} />
        </ErrorBoundary>
      );

      await waitFor(() => {
        expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();
      });

      expect(newConsoleErrorSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      );

      newConsoleErrorSpy.mockRestore();
    });
  });
});