/**
 * Theme Switching Regression Tests
 * 
 * These tests prevent the dark mode flashing bug from recurring.
 * The bug was caused by CSS transitions being applied to ALL elements
 * during theme switches, causing visible color flashes.
 * 
 * Fix: Selective `.theme-transition` class with optimized timing
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { ThemeProvider, useTheme } from '../../contexts/ThemeContext';
import { 
  createThemeTestUtils, 
  createFlashDetector, 
  createPerformanceBenchmark 
} from '../utils/test-utils';

// Test component that uses theme
const TestThemeComponent = ({ onThemeChange }) => {
  const { isDarkMode, toggleDarkMode, isInitialized } = useTheme();
  
  React.useEffect(() => {
    if (onThemeChange) onThemeChange({ isDarkMode, isInitialized });
  }, [isDarkMode, isInitialized, onThemeChange]);

  return (
    <div 
      data-testid="theme-component" 
      className={`p-4 transition-colors duration-200 ${
        isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'
      }`}
    >
      <button 
        data-testid="theme-toggle" 
        onClick={toggleDarkMode}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Switch to {isDarkMode ? 'Light' : 'Dark'} Mode
      </button>
      <div data-testid="theme-status">
        Mode: {isDarkMode ? 'Dark' : 'Light'} | Initialized: {isInitialized.toString()}
      </div>
    </div>
  );
};

describe('Theme Switching Regression Tests', () => {
  let themeUtils;
  let flashDetector;
  let performanceBenchmark;
  let mockLocalStorage;
  let mockMatchMedia;

  beforeEach(() => {
    themeUtils = createThemeTestUtils();
    flashDetector = createFlashDetector();
    performanceBenchmark = createPerformanceBenchmark();
    
    mockLocalStorage = themeUtils.mockLocalStorage;
    mockMatchMedia = themeUtils.mockMatchMedia;

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });

    // Reset document classes
    document.documentElement.classList.remove('dark', 'no-transition', 'theme-transition');
  });

  afterEach(() => {
    flashDetector.cleanup();
    themeUtils.clearEvents();
    performanceBenchmark.clearMeasurements();
    vi.clearAllMocks();
  });

  describe('Visual Flash Prevention', () => {
    it('should not flash during theme switching', async () => {
      const themeChanges = [];
      const onThemeChange = vi.fn((theme) => themeChanges.push(theme));

      render(
        <ThemeProvider>
          <TestThemeComponent onThemeChange={onThemeChange} />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('theme-toggle');
      const component = screen.getByTestId('theme-component');

      // Wait for initialization
      await waitFor(() => {
        expect(onThemeChange).toHaveBeenCalledWith(
          expect.objectContaining({ isInitialized: true })
        );
      });

      // Start flash detection
      const flashPromise = flashDetector.detectFlash(component, 500);

      // Switch theme
      await act(async () => {
        await userEvent.click(toggleButton);
      });

      // Wait for theme change to complete
      await waitFor(() => {
        expect(screen.getByText(/Mode: Dark/)).toBeInTheDocument();
      });

      const styles = await flashPromise;
      
      // Verify no flash occurred
      expect(flashDetector.hasFlash(styles)).toBe(false);

      // Verify styles changed smoothly
      expect(styles.length).toBeGreaterThan(1);
      expect(styles[0].backgroundColor).not.toBe(styles[styles.length - 1].backgroundColor);
    });

    it('should use theme-transition class for selective transitions', async () => {
      const transitionObserver = themeUtils.observeTransitions();

      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      // Wait for initialization
      await waitFor(() => {
        expect(screen.getByText(/Initialized: true/)).toBeInTheDocument();
      });

      // Switch theme and check transition events
      await act(async () => {
        await userEvent.click(screen.getByTestId('theme-toggle'));
      });

      await waitFor(() => {
        const events = themeUtils.getTransitionEvents();
        
        // Should have transition-related class changes
        expect(events.some(event => 
          event.added.includes('theme-transition') || 
          event.removed.includes('theme-transition')
        )).toBe(true);
      });

      transitionObserver.disconnect();
    });

    it('should complete theme switch within performance threshold', async () => {
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Initialized: true/)).toBeInTheDocument();
      });

      const measurement = await performanceBenchmark.benchmark(
        'theme-switch',
        async () => {
          await act(async () => {
            await userEvent.click(screen.getByTestId('theme-toggle'));
          });
          
          await waitFor(() => {
            expect(document.documentElement.classList.contains('dark')).toBe(true);
          });
        }
      );

      // Theme switch should complete within 300ms (well under the visual threshold)
      expect(measurement.average).toBeLessThan(300);
    });
  });

  describe('localStorage Integration', () => {
    it('should persist theme choice without flashing', async () => {
      // Start with saved dark theme
      mockLocalStorage.getItem.mockReturnValue('dark');

      const { rerender } = render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      // Should initialize with dark theme
      await waitFor(() => {
        expect(screen.getByText(/Mode: Dark/)).toBeInTheDocument();
        expect(document.documentElement.classList.contains('dark')).toBe(true);
      });

      // Switch to light
      await act(async () => {
        await userEvent.click(screen.getByTestId('theme-toggle'));
      });

      // Verify localStorage was updated
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('theme', 'light');

      // Simulate app restart with saved theme
      mockLocalStorage.getItem.mockReturnValue('light');
      
      rerender(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      // Should restore light theme without flash
      await waitFor(() => {
        expect(screen.getByText(/Mode: Light/)).toBeInTheDocument();
        expect(document.documentElement.classList.contains('dark')).toBe(false);
      });
    });

    it('should handle localStorage errors gracefully', async () => {
      // Mock localStorage to throw errors
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage not available');
      });

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      // Should still initialize successfully
      await waitFor(() => {
        expect(screen.getByText(/Initialized: true/)).toBeInTheDocument();
      });

      // Should log warning
      expect(consoleSpy).toHaveBeenCalledWith(
        'Theme initialization error:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('System Theme Integration', () => {
    it('should respond to system theme changes without flashing', async () => {
      // Start with no saved preference
      mockLocalStorage.getItem.mockReturnValue(null);
      mockMatchMedia.mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      });

      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Mode: Light/)).toBeInTheDocument();
      });

      const component = screen.getByTestId('theme-component');
      const flashPromise = flashDetector.detectFlash(component, 300);

      // Simulate system theme change to dark
      act(() => {
        themeUtils.simulateSystemThemeChange(true);
      });

      await waitFor(() => {
        expect(screen.getByText(/Mode: Dark/)).toBeInTheDocument();
      });

      const styles = await flashPromise;
      expect(flashDetector.hasFlash(styles)).toBe(false);
    });

    it('should not override manual theme selection', async () => {
      mockLocalStorage.getItem.mockReturnValue('light');

      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Mode: Light/)).toBeInTheDocument();
      });

      // Simulate system theme change - should be ignored due to manual selection
      act(() => {
        themeUtils.simulateSystemThemeChange(true);
      });

      // Should remain light theme
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(screen.getByText(/Mode: Light/)).toBeInTheDocument();
    });
  });

  describe('Meta Tag Updates', () => {
    let statusBarMeta;
    let themeColorMeta;

    beforeEach(() => {
      // Create meta tags
      statusBarMeta = document.createElement('meta');
      statusBarMeta.name = 'apple-mobile-web-app-status-bar-style';
      statusBarMeta.content = 'default';
      document.head.appendChild(statusBarMeta);

      themeColorMeta = document.createElement('meta');
      themeColorMeta.name = 'theme-color';
      themeColorMeta.content = '#ffffff';
      document.head.appendChild(themeColorMeta);
    });

    afterEach(() => {
      if (statusBarMeta.parentNode) {
        statusBarMeta.parentNode.removeChild(statusBarMeta);
      }
      if (themeColorMeta.parentNode) {
        themeColorMeta.parentNode.removeChild(themeColorMeta);
      }
    });

    it('should update meta tags during theme switch', async () => {
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Initialized: true/)).toBeInTheDocument();
      });

      // Switch to dark theme
      await act(async () => {
        await userEvent.click(screen.getByTestId('theme-toggle'));
      });

      await waitFor(() => {
        expect(statusBarMeta.content).toBe('black-translucent');
        expect(themeColorMeta.content).toBe('#0c1117');
      });

      // Switch back to light theme
      await act(async () => {
        await userEvent.click(screen.getByTestId('theme-toggle'));
      });

      await waitFor(() => {
        expect(statusBarMeta.content).toBe('default');
        expect(themeColorMeta.content).toBe('#ffffff');
      });
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance thresholds for rapid theme switching', async () => {
      render(
        <ThemeProvider>
          <TestThemeComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/Initialized: true/)).toBeInTheDocument();
      });

      // Test rapid theme switching
      const rapidSwitchBenchmark = await performanceBenchmark.benchmark(
        'rapid-theme-switch',
        async () => {
          // Switch 5 times rapidly
          for (let i = 0; i < 5; i++) {
            await act(async () => {
              await userEvent.click(screen.getByTestId('theme-toggle'));
            });
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
          }
        }
      );

      // Should complete all switches within 1 second
      expect(rapidSwitchBenchmark.average).toBeLessThan(1000);

      // Verify final state is consistent
      const finalMode = screen.getByTestId('theme-status').textContent;
      expect(finalMode).toMatch(/Mode: (Light|Dark)/);
    });
  });
});