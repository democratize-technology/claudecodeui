/**
 * Comprehensive UI Regression Test Utilities
 * 
 * This module provides utilities for testing UI stability, preventing the critical
 * bugs from recurring: FOUC, dark mode flashing, mobile nav issues, and ErrorBoundary
 * race conditions.
 */

import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Performance timing utilities
export const createPerformanceMeasure = () => {
  const startTime = performance.now();
  return {
    measure: (label) => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      return { label, duration, startTime, endTime };
    }
  };
};

// Theme switching test utilities
export const createThemeTestUtils = () => {
  let themeChangeEvents = [];
  let transitionEvents = [];

  // Mock localStorage
  const mockLocalStorage = (() => {
    let store = {};
    return {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => { store[key] = value.toString(); }),
      removeItem: vi.fn((key) => { delete store[key]; }),
      clear: vi.fn(() => { store = {}; }),
      length: 0,
      key: vi.fn()
    };
  })();

  // Mock matchMedia with event tracking
  const mockMatchMedia = vi.fn((query) => ({
    matches: query === '(prefers-color-scheme: dark)',
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn((event, handler) => {
      if (event === 'change') {
        themeChangeEvents.push({ query, handler });
      }
    }),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));

  // Monitor DOM transitions
  const observeTransitions = (element = document.documentElement) => {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const classList = mutation.target.classList;
          transitionEvents.push({
            timestamp: performance.now(),
            added: [...classList].filter(c => !mutation.oldValue?.includes(c)),
            removed: mutation.oldValue?.split(' ').filter(c => !classList.contains(c)) || [],
            hasNoTransition: classList.contains('no-transition'),
            hasThemeTransition: classList.contains('theme-transition'),
            isDark: classList.contains('dark')
          });
        }
      });
    });

    observer.observe(element, { 
      attributes: true, 
      attributeOldValue: true,
      attributeFilter: ['class']
    });

    return observer;
  };

  return {
    mockLocalStorage,
    mockMatchMedia,
    observeTransitions,
    getThemeEvents: () => themeChangeEvents,
    getTransitionEvents: () => transitionEvents,
    clearEvents: () => {
      themeChangeEvents = [];
      transitionEvents = [];
    },
    simulateSystemThemeChange: (isDark) => {
      themeChangeEvents.forEach(({ handler }) => {
        handler({ matches: isDark });
      });
    }
  };
};

// Visual flash detection utility
export const createFlashDetector = () => {
  const computedStyles = [];
  let rafId;

  const detectFlash = (element, duration = 500) => {
    return new Promise((resolve) => {
      const startTime = performance.now();
      
      const measureStyles = () => {
        const computed = window.getComputedStyle(element);
        computedStyles.push({
          timestamp: performance.now(),
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          opacity: computed.opacity,
          visibility: computed.visibility
        });

        if (performance.now() - startTime < duration) {
          rafId = requestAnimationFrame(measureStyles);
        } else {
          resolve(computedStyles);
        }
      };

      rafId = requestAnimationFrame(measureStyles);
    });
  };

  const hasFlash = (styles) => {
    // Check for rapid color changes that indicate flashing
    for (let i = 1; i < styles.length; i++) {
      const prev = styles[i - 1];
      const curr = styles[i];
      
      // If background color changes rapidly (within 100ms) and then changes back
      if (
        prev.backgroundColor !== curr.backgroundColor &&
        curr.timestamp - prev.timestamp < 100
      ) {
        // Look for a change back within next 100ms
        const next = styles[i + 1];
        if (next && next.backgroundColor !== curr.backgroundColor &&
            next.timestamp - curr.timestamp < 100) {
          return true;
        }
      }
    }
    return false;
  };

  return {
    detectFlash,
    hasFlash,
    cleanup: () => {
      if (rafId) cancelAnimationFrame(rafId);
      computedStyles.length = 0;
    }
  };
};

// Error boundary race condition test utility
export const createErrorBoundaryTestUtils = () => {
  const stateChanges = [];
  
  // Component that can throw errors on command
  const ThrowError = ({ shouldThrow = false, onRender }) => {
    if (onRender) onRender();
    if (shouldThrow) {
      throw new Error('Test error for ErrorBoundary');
    }
    return <div data-testid="error-free-content">Content loaded successfully</div>;
  };

  // Track state changes in ErrorBoundary
  const trackStateChanges = (errorBoundaryInstance) => {
    const originalSetState = errorBoundaryInstance.setState;
    errorBoundaryInstance.setState = function(updater, callback) {
      const prevState = { ...this.state };
      
      originalSetState.call(this, updater, (newState) => {
        stateChanges.push({
          timestamp: performance.now(),
          prevState,
          newState: { ...newState || this.state },
          isResetting: newState?.isResetting || this.state.isResetting
        });
        if (callback) callback.call(this, newState);
      });
    };
  };

  return {
    ThrowError,
    trackStateChanges,
    getStateChanges: () => stateChanges,
    clearStateChanges: () => { stateChanges.length = 0; },
    hasRaceCondition: () => {
      // Check if multiple setState calls happen within 50ms while isResetting is true
      for (let i = 1; i < stateChanges.length; i++) {
        const prev = stateChanges[i - 1];
        const curr = stateChanges[i];
        
        if (
          prev.isResetting && 
          curr.timestamp - prev.timestamp < 50 &&
          prev.newState.hasError !== curr.newState.hasError
        ) {
          return true;
        }
      }
      return false;
    }
  };
};

// Mobile navigation performance test utility
export const createMobileNavTestUtils = () => {
  const touchEvents = [];
  const transitionMeasurements = [];

  // Mock touch events
  const mockTouchEvent = (type, touches = []) => ({
    type,
    touches: touches.map(touch => ({
      clientX: touch.x || 0,
      clientY: touch.y || 0,
      target: touch.target || document.body
    })),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn()
  });

  // Measure transition performance
  const measureTransitionPerformance = (element) => {
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.name.includes('transition') || entry.name.includes('transform')) {
          transitionMeasurements.push({
            name: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      });
    });

    observer.observe({ entryTypes: ['measure', 'navigation'] });

    // Also observe CSS transitions
    const transitionEndHandler = (e) => {
      transitionMeasurements.push({
        name: `css-transition-${e.propertyName}`,
        duration: e.elapsedTime * 1000, // Convert to ms
        startTime: performance.now() - (e.elapsedTime * 1000)
      });
    };

    element.addEventListener('transitionend', transitionEndHandler);

    return () => {
      observer.disconnect();
      element.removeEventListener('transitionend', transitionEndHandler);
    };
  };

  return {
    mockTouchEvent,
    measureTransitionPerformance,
    getTouchEvents: () => touchEvents,
    getTransitionMeasurements: () => transitionMeasurements,
    clearMeasurements: () => {
      touchEvents.length = 0;
      transitionMeasurements.length = 0;
    }
  };
};

// FOUC detection utility
export const createFOUCDetector = () => {
  const styleSnapshots = [];
  
  const captureInitialStyles = (element = document.documentElement) => {
    const snapshot = {
      timestamp: performance.now(),
      hasNoTransition: element.classList.contains('no-transition'),
      isDark: element.classList.contains('dark'),
      computedStyle: {
        backgroundColor: window.getComputedStyle(element).backgroundColor,
        color: window.getComputedStyle(element).color
      }
    };
    
    styleSnapshots.push(snapshot);
    return snapshot;
  };

  const detectFOUC = (snapshots = styleSnapshots) => {
    if (snapshots.length < 2) return false;

    // FOUC is detected if:
    // 1. Initial style changes rapidly (within 100ms)
    // 2. 'no-transition' class is not present during style changes
    // 3. Background/color values change and then stabilize
    
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const curr = snapshots[i];
      
      const hasStyleChange = (
        prev.computedStyle.backgroundColor !== curr.computedStyle.backgroundColor ||
        prev.computedStyle.color !== curr.computedStyle.color
      );
      
      const isRapidChange = curr.timestamp - prev.timestamp < 100;
      const lacksTransitionProtection = !curr.hasNoTransition;
      
      if (hasStyleChange && isRapidChange && lacksTransitionProtection) {
        return true;
      }
    }
    
    return false;
  };

  return {
    captureInitialStyles,
    detectFOUC,
    getSnapshots: () => styleSnapshots,
    clearSnapshots: () => { styleSnapshots.length = 0; }
  };
};

// WebSocket mock utility for integration tests
export const createWebSocketMock = () => {
  const events = [];
  
  class MockWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = WebSocket.CONNECTING;
      this.onopen = null;
      this.onclose = null;
      this.onmessage = null;
      this.onerror = null;
      
      // Simulate connection
      setTimeout(() => {
        this.readyState = WebSocket.OPEN;
        if (this.onopen) this.onopen({ type: 'open' });
      }, 10);
    }
    
    send(data) {
      events.push({ type: 'send', data, timestamp: performance.now() });
    }
    
    close() {
      this.readyState = WebSocket.CLOSED;
      if (this.onclose) this.onclose({ type: 'close' });
    }
    
    simulateMessage(data) {
      if (this.onmessage) {
        this.onmessage({ type: 'message', data });
      }
    }
  }
  
  // Constants
  MockWebSocket.CONNECTING = 0;
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;
  
  return {
    MockWebSocket,
    getEvents: () => events,
    clearEvents: () => { events.length = 0; }
  };
};

// Performance benchmarking utility
export const createPerformanceBenchmark = () => {
  const measurements = [];
  
  const benchmark = async (name, fn, iterations = 1) => {
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      results.push(end - start);
    }
    
    const avg = results.reduce((sum, time) => sum + time, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    
    const measurement = {
      name,
      iterations,
      average: avg,
      min,
      max,
      results
    };
    
    measurements.push(measurement);
    return measurement;
  };
  
  return {
    benchmark,
    getMeasurements: () => measurements,
    clearMeasurements: () => { measurements.length = 0; }
  };
};