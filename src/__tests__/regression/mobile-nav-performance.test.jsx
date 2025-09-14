/**
 * MobileNav Performance and Transition Regression Tests
 *
 * These tests prevent mobile navigation flashing and performance issues from recurring.
 * The bugs were caused by missing state synchronization and lack of performance optimizations.
 *
 * Fix: Added `willChange` CSS property and improved transitions
 */

import React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Jest globals - no import needed
// vi is replaced with jest in Jest environment
import MobileNav from '../../components/MobileNav';
import { TasksSettingsProvider } from '../../contexts/TasksSettingsContext';
import {
  createMobileNavTestUtils,
  createPerformanceBenchmark,
  createFlashDetector
} from '../utils/test-utils';

// Mock the TasksSettingsContext for testing
const MockTasksSettingsProvider = ({ children, tasksEnabled = false }) => (
  <TasksSettingsProvider value={{ tasksEnabled }}>{children}</TasksSettingsProvider>
);

// Test wrapper component
const MobileNavTestWrapper = ({
  initialTab = 'chat',
  isInputFocused = false,
  tasksEnabled = false,
  onTabChange
}) => {
  const [activeTab, setActiveTab] = React.useState(initialTab);

  const handleSetActiveTab = (tab) => {
    setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  return (
    <MockTasksSettingsProvider tasksEnabled={tasksEnabled}>
      <div data-testid='mobile-nav-container'>
        <MobileNav
          activeTab={activeTab}
          setActiveTab={handleSetActiveTab}
          isInputFocused={isInputFocused}
        />
      </div>
    </MockTasksSettingsProvider>
  );
};

describe('MobileNav Performance Regression Tests', () => {
  let mobileNavUtils;
  let performanceBenchmark;
  let flashDetector;

  beforeEach(() => {
    mobileNavUtils = createMobileNavTestUtils();
    performanceBenchmark = createPerformanceBenchmark();
    flashDetector = createFlashDetector();

    // Mock IntersectionObserver for better test stability
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));

    // Reset viewport to mobile size
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
  });

  afterEach(() => {
    mobileNavUtils.clearMeasurements();
    performanceBenchmark.clearMeasurements();
    flashDetector.cleanup();
    jest.clearAllMocks();
  });

  describe('Transition Performance', () => {
    it('should animate hide/show transitions smoothly without flashing', async () => {
      const { rerender } = render(<MobileNavTestWrapper isInputFocused={false} />);

      const navContainer = screen.getByTestId('mobile-nav-container');
      const mobileNavElement = navContainer.querySelector('[class*="fixed bottom-0"]');

      // Start flash detection
      const flashPromise = flashDetector.detectFlash(mobileNavElement, 1000);

      // Start performance monitoring
      const cleanup = mobileNavUtils.measureTransitionPerformance(mobileNavElement);

      // Hide navigation (simulate keyboard focus)
      rerender(<MobileNavTestWrapper isInputFocused={true} />);

      // Wait for transition
      await waitFor(() => {
        const style = window.getComputedStyle(mobileNavElement);
        expect(style.transform).toMatch(/translateY\(100%\)|translate3d\(0px, 100%, 0px\)/);
      });

      // Show navigation again
      rerender(<MobileNavTestWrapper isInputFocused={false} />);

      await waitFor(() => {
        const style = window.getComputedStyle(mobileNavElement);
        expect(style.transform).toMatch(/translateY\(0px\)|translate3d\(0px, 0px, 0px\)|none/);
      });

      const styles = await flashPromise;
      cleanup();

      // Verify no visual flashing occurred
      expect(flashDetector.hasFlash(styles)).toBe(false);

      // Check transition performance
      const measurements = mobileNavUtils.getTransitionMeasurements();

      // Should have recorded transition events
      expect(measurements.length).toBeGreaterThan(0);

      // Transitions should be fast (< 300ms as per CSS)
      const transitionDurations = measurements
        .filter((m) => m.name.includes('transform'))
        .map((m) => m.duration);

      if (transitionDurations.length > 0) {
        expect(Math.max(...transitionDurations)).toBeLessThan(350); // Allow some buffer
      }
    });

    it('should use willChange property for optimized transitions', async () => {
      const { rerender } = render(<MobileNavTestWrapper isInputFocused={false} />);

      const navContainer = screen.getByTestId('mobile-nav-container');
      const mobileNavElement = navContainer.querySelector('[class*="fixed bottom-0"]');

      // Initial state - willChange should be 'auto'
      let computedStyle = window.getComputedStyle(mobileNavElement);
      expect(computedStyle.willChange).toBe('auto');

      // Hide navigation - should trigger willChange
      act(() => {
        rerender(<MobileNavTestWrapper isInputFocused={true} />);
      });

      // During transition, willChange should be set to 'transform'
      computedStyle = window.getComputedStyle(mobileNavElement);
      // Note: This is set via inline style in the component
      expect(mobileNavElement.style.willChange).toBe('transform');

      // Show navigation again
      act(() => {
        rerender(<MobileNavTestWrapper isInputFocused={false} />);
      });

      // Should reset willChange after transition
      computedStyle = window.getComputedStyle(mobileNavElement);
      expect(mobileNavElement.style.willChange).toBe('auto');
    });

    it('should handle rapid show/hide cycles without performance degradation', async () => {
      const { rerender } = render(<MobileNavTestWrapper isInputFocused={false} />);

      const measurement = await performanceBenchmark.benchmark(
        'rapid-nav-transitions',
        async () => {
          // Rapidly toggle visibility 10 times
          for (let i = 0; i < 10; i++) {
            await act(async () => {
              rerender(<MobileNavTestWrapper isInputFocused={i % 2 === 0} />);
            });
            // Small delay to allow transition start
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }
      );

      // Should complete all transitions efficiently
      expect(measurement.average).toBeLessThan(1000);
    });
  });

  describe('Tab Navigation Performance', () => {
    it('should switch tabs quickly without layout thrashing', async () => {
      const onTabChange = jest.fn();
      render(<MobileNavTestWrapper onTabChange={onTabChange} />);

      const tabs = ['chat', 'shell', 'files', 'git'];

      const measurement = await performanceBenchmark.benchmark('tab-switching', async () => {
        for (const tab of tabs) {
          const tabButton = screen.getByLabelText(tab);

          await act(async () => {
            await userEvent.click(tabButton);
          });

          // Verify tab became active quickly
          expect(onTabChange).toHaveBeenCalledWith(tab);
        }
      });

      // Tab switching should be very fast
      expect(measurement.average).toBeLessThan(200);
    });

    it('should handle touch events efficiently', async () => {
      const onTabChange = jest.fn();
      render(<MobileNavTestWrapper onTabChange={onTabChange} />);

      const chatButton = screen.getByLabelText('chat');
      const shellButton = screen.getByLabelText('shell');

      const measurement = await performanceBenchmark.benchmark('touch-interactions', async () => {
        // Simulate touch events
        const touchStart = mobileNavUtils.mockTouchEvent('touchstart', [
          { x: 100, y: 500, target: chatButton }
        ]);

        await act(async () => {
          fireEvent(chatButton, touchStart);
        });

        // Simulate touch on different button
        const touchStart2 = mobileNavUtils.mockTouchEvent('touchstart', [
          { x: 200, y: 500, target: shellButton }
        ]);

        await act(async () => {
          fireEvent(shellButton, touchStart2);
        });
      });

      // Touch interactions should be very responsive
      expect(measurement.average).toBeLessThan(50);
      expect(onTabChange).toHaveBeenCalledWith('shell');
    });

    it('should prevent default on touch events to avoid scrolling issues', async () => {
      render(<MobileNavTestWrapper />);

      const chatButton = screen.getByLabelText('chat');
      const touchEvent = mobileNavUtils.mockTouchEvent('touchstart', [
        { x: 100, y: 500, target: chatButton }
      ]);

      await act(async () => {
        fireEvent(chatButton, touchEvent);
      });

      // Verify preventDefault was called
      expect(touchEvent.preventDefault).toHaveBeenCalled();
    });
  });

  describe('Dynamic Tab Configuration', () => {
    it('should efficiently add/remove tasks tab based on settings', async () => {
      const { rerender } = render(<MobileNavTestWrapper tasksEnabled={false} />);

      // Initially should not have tasks tab
      expect(screen.queryByLabelText('tasks')).not.toBeInTheDocument();

      const standardTabs = screen.getAllByRole('button');
      expect(standardTabs).toHaveLength(4); // chat, shell, files, git

      const measurement = await performanceBenchmark.benchmark('dynamic-tab-toggle', async () => {
        // Enable tasks
        await act(async () => {
          rerender(<MobileNavTestWrapper tasksEnabled={true} />);
        });

        await waitFor(() => {
          expect(screen.getByLabelText('tasks')).toBeInTheDocument();
        });

        // Disable tasks
        await act(async () => {
          rerender(<MobileNavTestWrapper tasksEnabled={false} />);
        });

        await waitFor(() => {
          expect(screen.queryByLabelText('tasks')).not.toBeInTheDocument();
        });
      });

      // Dynamic reconfiguration should be fast
      expect(measurement.average).toBeLessThan(100);
    });

    it('should maintain performance with tasks tab enabled', async () => {
      const onTabChange = jest.fn();
      render(<MobileNavTestWrapper tasksEnabled={true} onTabChange={onTabChange} />);

      // Should have all 5 tabs including tasks
      const allTabs = screen.getAllByRole('button');
      expect(allTabs).toHaveLength(5);

      const tasksButton = screen.getByLabelText('tasks');
      expect(tasksButton).toBeInTheDocument();

      // Test navigation to tasks tab
      const measurement = await performanceBenchmark.benchmark('tasks-tab-navigation', async () => {
        await act(async () => {
          await userEvent.click(tasksButton);
        });
      });

      expect(onTabChange).toHaveBeenCalledWith('tasks');
      expect(measurement.average).toBeLessThan(50);
    });
  });

  describe('Visual State Management', () => {
    it('should show active state indicators without flashing', async () => {
      const { rerender } = render(<MobileNavTestWrapper initialTab='chat' />);

      const chatButton = screen.getByLabelText('chat');
      const shellButton = screen.getByLabelText('shell');

      // Initial state - chat should be active
      expect(chatButton).toHaveClass('text-blue-600', 'dark:text-blue-400');
      expect(shellButton).not.toHaveClass('text-blue-600', 'dark:text-blue-400');

      // Start flash detection
      const flashPromise = flashDetector.detectFlash(chatButton.parentElement, 500);

      // Switch to shell tab
      await act(async () => {
        await userEvent.click(shellButton);
      });

      await waitFor(() => {
        expect(shellButton).toHaveClass('text-blue-600', 'dark:text-blue-400');
        expect(chatButton).not.toHaveClass('text-blue-600', 'dark:text-blue-400');
      });

      const styles = await flashPromise;

      // Should not have visual flashing during state changes
      expect(flashDetector.hasFlash(styles)).toBe(false);
    });

    it('should show active tab indicators correctly', async () => {
      render(<MobileNavTestWrapper initialTab='files' />);

      const filesButton = screen.getByLabelText('files');

      // Should have active indicator (blue dot)
      const indicator = filesButton.querySelector('.absolute.top-0');
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass('bg-blue-600', 'dark:bg-blue-400');

      // Other tabs should not have indicators
      const chatButton = screen.getByLabelText('chat');
      const chatIndicator = chatButton.querySelector('.absolute.top-0');
      expect(chatIndicator).not.toBeInTheDocument();
    });
  });

  describe('Responsive Behavior', () => {
    it('should handle viewport changes efficiently', async () => {
      const { container } = render(<MobileNavTestWrapper />);

      const measurement = await performanceBenchmark.benchmark('viewport-resize', async () => {
        // Simulate device rotation
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 667 });
          Object.defineProperty(window, 'innerHeight', { value: 375 });
          window.dispatchEvent(new Event('resize'));
        });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Rotate back
        act(() => {
          Object.defineProperty(window, 'innerWidth', { value: 375 });
          Object.defineProperty(window, 'innerHeight', { value: 667 });
          window.dispatchEvent(new Event('resize'));
        });

        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      // Should handle orientation changes quickly
      expect(measurement.average).toBeLessThan(300);
    });

    it('should maintain accessibility during transitions', async () => {
      const { rerender } = render(<MobileNavTestWrapper isInputFocused={false} />);

      // All buttons should be accessible
      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('aria-label');
        expect(button).toHaveClass('touch-manipulation'); // iOS optimization
      });

      // Hide navigation
      rerender(<MobileNavTestWrapper isInputFocused={true} />);

      // Buttons should still be accessible even when visually hidden
      await waitFor(() => {
        const hiddenButtons = screen.getAllByRole('button');
        hiddenButtons.forEach((button) => {
          expect(button).toHaveAttribute('aria-label');
        });
      });
    });
  });

  describe('CSS Class Management', () => {
    it('should apply correct CSS classes for different states', async () => {
      const { rerender } = render(<MobileNavTestWrapper isInputFocused={false} />);

      const navContainer = screen.getByTestId('mobile-nav-container');
      const navElement = navContainer.querySelector('[class*="fixed bottom-0"]');

      // Initial state classes
      expect(navElement).toHaveClass('translate-y-0');
      expect(navElement).toHaveClass('transition-transform');
      expect(navElement).toHaveClass('duration-300');
      expect(navElement).toHaveClass('ease-in-out');
      expect(navElement).toHaveClass('no-transition');

      // Hidden state
      rerender(<MobileNavTestWrapper isInputFocused={true} />);

      await waitFor(() => {
        expect(navElement).toHaveClass('translate-y-full');
      });

      // Should maintain other classes
      expect(navElement).toHaveClass('transition-transform');
      expect(navElement).toHaveClass('duration-300');
    });

    it('should handle theme classes correctly', async () => {
      render(<MobileNavTestWrapper />);

      const navContainer = screen.getByTestId('mobile-nav-container');
      const navElement = navContainer.querySelector('[class*="fixed bottom-0"]');

      // Should have both light and dark theme classes
      expect(navElement).toHaveClass('bg-white', 'dark:bg-gray-800');
      expect(navElement).toHaveClass('border-gray-200', 'dark:border-gray-700');
    });
  });
});
