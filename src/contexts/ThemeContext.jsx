import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  // Initialize with server-safe default to prevent hydration mismatches
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Set initial theme after hydration to prevent FOUC
  useEffect(() => {
    try {
      // COORDINATION BRIDGE: Check for atomic theme state from inline script first
      let coordinationData = null;
      try {
        const coordinationRaw = sessionStorage.getItem('theme-coordination');
        if (coordinationRaw) {
          coordinationData = JSON.parse(coordinationRaw);

          // Validate coordination data is recent (< 5000ms to handle slow React initialization)
          const isRecent =
            coordinationData.timestamp && Date.now() - coordinationData.timestamp < 5000;
          const isValid = coordinationData.scriptApplied && coordinationData.theme;

          if (isValid && isRecent) {
            const prefersDark = coordinationData.theme === 'dark';
            setIsDarkMode(prefersDark);
            setIsInitialized(true);

            // Clear coordination data after successful use
            sessionStorage.removeItem('theme-coordination');
            console.debug('Theme coordination: Used script state:', coordinationData.theme);
            return;
          } else {
            console.debug('Theme coordination: Data stale or invalid, falling back to detection');
            sessionStorage.removeItem('theme-coordination');
          }
        }
      } catch (coordinationError) {
        console.warn('Theme coordination bridge failed:', coordinationError);
      }

      // FALLBACK: Original theme detection logic
      // Check localStorage first
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        const prefersDark = savedTheme === 'dark';
        setIsDarkMode(prefersDark);
        setIsInitialized(true);
        console.debug('Theme coordination: Used localStorage fallback:', savedTheme);
        return;
      }

      // Check system preference
      if (window.matchMedia) {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(prefersDark);
        setIsInitialized(true);
        console.debug(
          'Theme coordination: Used system preference fallback:',
          prefersDark ? 'dark' : 'light'
        );
        return;
      }

      setIsInitialized(true);
      console.debug('Theme coordination: No theme detected, using default');
    } catch (error) {
      console.warn('Theme initialization error:', error);
      setIsInitialized(true);
    }
  }, []);

  // Update document class and localStorage when theme changes (only after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');

        // Update iOS status bar style and theme color for dark mode
        const statusBarMeta = document.querySelector(
          'meta[name="apple-mobile-web-app-status-bar-style"]'
        );
        if (statusBarMeta) {
          statusBarMeta.setAttribute('content', 'black-translucent');
        }

        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
          themeColorMeta.setAttribute('content', '#0c1117'); // Dark background color (hsl(222.2 84% 4.9%))
        }
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');

        // Update iOS status bar style and theme color for light mode
        const statusBarMeta = document.querySelector(
          'meta[name="apple-mobile-web-app-status-bar-style"]'
        );
        if (statusBarMeta) {
          statusBarMeta.setAttribute('content', 'default');
        }

        const themeColorMeta = document.querySelector('meta[name="theme-color"]');
        if (themeColorMeta) {
          themeColorMeta.setAttribute('content', '#ffffff'); // Light background color
        }
      }
    } catch (error) {
      console.warn('Theme update error:', error);
    }
  }, [isDarkMode, isInitialized]);

  // Listen for system theme changes (only after initialization)
  useEffect(() => {
    if (!isInitialized || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => {
      try {
        // Only update if user hasn't manually set a preference
        const savedTheme = localStorage.getItem('theme');
        if (!savedTheme) {
          setIsDarkMode(e.matches);
        }
      } catch (error) {
        console.warn('System theme change error:', error);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [isInitialized]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

  const value = {
    isDarkMode,
    toggleDarkMode,
    isInitialized
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
