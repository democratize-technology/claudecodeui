import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../contexts/ThemeContext';

// Test component that uses the theme context
const TestComponent = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  return (
    <div>
      <div data-testid='theme-indicator'>{isDarkMode ? 'dark' : 'light'}</div>
      <button data-testid='toggle-theme' onClick={toggleDarkMode}>
        Toggle Theme
      </button>
    </div>
  );
};

// Test component that tries to use theme outside provider
const ComponentOutsideProvider = () => {
  const { isDarkMode } = useTheme();
  return <div>{isDarkMode ? 'dark' : 'light'}</div>;
};

describe('ThemeContext', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();

    // Reset document classes
    document.documentElement.classList.remove('dark');

    // Reset matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    });

    // Mock meta tags
    document.head.innerHTML = `
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="theme-color" content="#ffffff" />
    `;
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  describe('ThemeProvider', () => {
    test('should provide theme context to children', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-theme')).toBeInTheDocument();
    });

    test('should start with light theme by default', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    test('should toggle theme when toggleDarkMode is called', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      const toggleButton = screen.getByTestId('toggle-theme');

      // Initially light
      expect(themeIndicator).toHaveTextContent('light');

      // Toggle to dark
      act(() => {
        fireEvent.click(toggleButton);
      });

      expect(themeIndicator).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      // Toggle back to light
      act(() => {
        fireEvent.click(toggleButton);
      });

      expect(themeIndicator).toHaveTextContent('light');
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  describe('localStorage integration', () => {
    test('should save theme preference to localStorage', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');

      // Toggle to dark mode
      act(() => {
        fireEvent.click(toggleButton);
      });

      expect(localStorage.getItem('theme')).toBe('dark');

      // Toggle to light mode
      act(() => {
        fireEvent.click(toggleButton);
      });

      expect(localStorage.getItem('theme')).toBe('light');
    });

    test('should load saved theme preference from localStorage', () => {
      // Set dark theme in localStorage
      localStorage.setItem('theme', 'dark');

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('dark');
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    test('should handle invalid localStorage values gracefully', () => {
      localStorage.setItem('theme', 'invalid-value');

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('light');
    });
  });

  describe('System preference detection', () => {
    test('should detect dark system preference when no saved preference', () => {
      // Mock system dark mode preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('dark');
    });

    test('should detect light system preference when no saved preference', () => {
      // Mock system light mode preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: false, // Light mode
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('light');
    });

    test('should prefer saved preference over system preference', () => {
      localStorage.setItem('theme', 'light');

      // Mock system dark mode preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('light'); // Saved preference wins
    });

    test('should handle absence of matchMedia gracefully', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: undefined
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('light'); // Falls back to light
    });
  });

  describe('Meta tag updates', () => {
    test('should update meta tags for dark mode', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');

      // Toggle to dark mode
      act(() => {
        fireEvent.click(toggleButton);
      });

      const statusBarMeta = document.querySelector(
        'meta[name="apple-mobile-web-app-status-bar-style"]'
      );
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');

      expect(statusBarMeta?.getAttribute('content')).toBe('black-translucent');
      expect(themeColorMeta?.getAttribute('content')).toBe('#0c1117');
    });

    test('should update meta tags for light mode', () => {
      localStorage.setItem('theme', 'dark');

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');

      // Toggle to light mode
      act(() => {
        fireEvent.click(toggleButton);
      });

      const statusBarMeta = document.querySelector(
        'meta[name="apple-mobile-web-app-status-bar-style"]'
      );
      const themeColorMeta = document.querySelector('meta[name="theme-color"]');

      expect(statusBarMeta?.getAttribute('content')).toBe('default');
      expect(themeColorMeta?.getAttribute('content')).toBe('#ffffff');
    });

    test('should handle missing meta tags gracefully', () => {
      // Remove meta tags
      document.head.innerHTML = '';

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');

      // Should not throw error when toggling
      expect(() => {
        act(() => {
          fireEvent.click(toggleButton);
        });
      }).not.toThrow();
    });
  });

  describe('System theme change listener', () => {
    test('should listen for system theme changes', () => {
      const addEventListener = jest.fn();
      const removeEventListener = jest.fn();

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener,
          removeEventListener,
          dispatchEvent: jest.fn()
        }))
      });

      const { unmount } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

      unmount();
      expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });

    test('should update theme when system preference changes and no saved preference', () => {
      const addEventListener = jest.fn();
      let changeHandler;

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: (event, handler) => {
            changeHandler = handler;
            addEventListener(event, handler);
          },
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('light');

      // Clear localStorage to simulate no saved preference
      act(() => {
        localStorage.removeItem('theme');
      });

      // Simulate system theme change to dark
      act(() => {
        if (changeHandler) {
          changeHandler({ matches: true });
        }
      });

      expect(themeIndicator).toHaveTextContent('dark');
    });

    test('should not update theme when system preference changes if user has saved preference', () => {
      localStorage.setItem('theme', 'light');

      const addEventListener = jest.fn();
      let changeHandler;

      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation((query) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: jest.fn(),
          removeListener: jest.fn(),
          addEventListener: (event, handler) => {
            changeHandler = handler;
            addEventListener(event, handler);
          },
          removeEventListener: jest.fn(),
          dispatchEvent: jest.fn()
        }))
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const themeIndicator = screen.getByTestId('theme-indicator');
      expect(themeIndicator).toHaveTextContent('light');

      // Simulate system theme change to dark
      act(() => {
        if (changeHandler) {
          changeHandler({ matches: true });
        }
      });

      // Should remain light because user has saved preference
      expect(themeIndicator).toHaveTextContent('light');
    });

    test('should handle absence of matchMedia in listener setup gracefully', () => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: undefined
      });

      expect(() => {
        render(
          <ThemeProvider>
            <TestComponent />
          </ThemeProvider>
        );
      }).not.toThrow();
    });
  });

  describe('useTheme hook', () => {
    test('should throw error when used outside ThemeProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<ComponentOutsideProvider />);
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });

    test('should provide theme state and toggle function', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      // Should provide both isDarkMode state and toggleDarkMode function
      expect(screen.getByTestId('theme-indicator')).toBeInTheDocument();
      expect(screen.getByTestId('toggle-theme')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid theme toggles', () => {
      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');
      const themeIndicator = screen.getByTestId('theme-indicator');

      // Rapidly toggle theme multiple times
      act(() => {
        fireEvent.click(toggleButton); // dark
        fireEvent.click(toggleButton); // light
        fireEvent.click(toggleButton); // dark
        fireEvent.click(toggleButton); // light
      });

      expect(themeIndicator).toHaveTextContent('light');
      expect(localStorage.getItem('theme')).toBe('light');
    });

    test('should handle localStorage setItem failures gracefully', () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = jest.fn(() => {
        throw new Error('Storage quota exceeded');
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');

      // Should not crash when localStorage fails
      expect(() => {
        act(() => {
          fireEvent.click(toggleButton);
        });
      }).not.toThrow();

      // Restore original method
      localStorage.setItem = originalSetItem;
    });

    test('should handle document classList operations safely', () => {
      // Test that the component handles classList operations safely
      const originalClassList = document.documentElement.classList;
      const mockClassList = {
        add: jest.fn(),
        remove: jest.fn(),
        contains: jest.fn(() => false)
      };

      Object.defineProperty(document.documentElement, 'classList', {
        value: mockClassList,
        writable: true
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const toggleButton = screen.getByTestId('toggle-theme');

      act(() => {
        fireEvent.click(toggleButton);
      });

      expect(mockClassList.add).toHaveBeenCalledWith('dark');

      // Restore
      Object.defineProperty(document.documentElement, 'classList', {
        value: originalClassList,
        writable: true
      });
    });
  });
});
