/**
 * React hook for standardized loading state management
 * Provides consistent loading patterns for React components
 */

import { useCallback, useState, useRef } from 'react';

// Global operation tracking to prevent race conditions across all hook instances
// This ensures that if any component is running a named operation, all other components are aware
const globalActiveOperations = new Set();

/**
 * Hook for managing loading states in React components with consistent patterns
 * @param {Object} options - Configuration options
 * @returns {Object} - Loading state utilities
 */
export function useLoadingState(options = {}) {
  const {
    initialLoading = false,
    multipleStates = false, // Whether to support multiple named loading states
    autoReset = true, // Whether to auto-reset loading state on completion
    onLoadingChange = null // Optional callback when loading state changes
  } = options;

  // Single loading state (most common case)
  const [isLoading, setIsLoading] = useState(initialLoading);

  // Multiple loading states (for complex components)
  const [loadingStates, setLoadingStates] = useState({});

  // Track active operations to prevent race conditions
  const activeOperations = useRef(new Set());

  // Helper to notify loading state changes
  const notifyChange = useCallback(
    (state, operation = null) => {
      if (onLoadingChange && typeof onLoadingChange === 'function') {
        onLoadingChange(state, operation);
      }
    },
    [onLoadingChange]
  );

  // Set single loading state with optional callback
  const setLoading = useCallback(
    (loading, operation = null) => {
      setIsLoading(loading);
      notifyChange(loading, operation);
    },
    [notifyChange]
  );

  // Set named loading state (for multiple loading indicators)
  const setNamedLoading = useCallback(
    (name, loading) => {
      if (!multipleStates) {
        console.warn(
          'useLoadingState: multipleStates option must be enabled to use named loading states'
        );
        return;
      }

      setLoadingStates((prev) => ({
        ...prev,
        [name]: loading
      }));

      notifyChange(loading, name);
    },
    [multipleStates, notifyChange]
  );

  // Execute async operation with automatic loading state management
  const executeAsync = useCallback(
    async (operation, operationName = 'async-operation') => {
      // Prevent duplicate operations - check both local and global tracking
      if (activeOperations.current.has(operationName) || globalActiveOperations.has(operationName)) {
        console.warn(`useLoadingState: Operation '${operationName}' is already running`);
        return;
      }

      try {
        activeOperations.current.add(operationName);
        globalActiveOperations.add(operationName);
        setLoading(true, operationName);

        const result = await operation();

        if (autoReset) {
          setLoading(false, operationName);
        }

        return result;
      } catch (error) {
        if (autoReset) {
          setLoading(false, operationName);
        }
        throw error; // Re-throw to allow upstream error handling
      } finally {
        activeOperations.current.delete(operationName);
        globalActiveOperations.delete(operationName);
      }
    },
    [setLoading, autoReset]
  );

  // Execute named async operation (for multiple loading states)
  const executeNamedAsync = useCallback(
    async (operation, name, operationId = name) => {
      if (!multipleStates) {
        console.warn(
          'useLoadingState: multipleStates option must be enabled to use named async operations'
        );
        return;
      }

      // Prevent duplicate operations - check both local and global tracking
      if (activeOperations.current.has(operationId) || globalActiveOperations.has(operationId)) {
        console.warn(`useLoadingState: Named operation '${operationId}' is already running`);
        return;
      }

      try {
        activeOperations.current.add(operationId);
        globalActiveOperations.add(operationId);
        setNamedLoading(name, true);

        const result = await operation();

        if (autoReset) {
          setNamedLoading(name, false);
        }

        return result;
      } catch (error) {
        if (autoReset) {
          setNamedLoading(name, false);
        }
        throw error;
      } finally {
        activeOperations.current.delete(operationId);
        globalActiveOperations.delete(operationId);
      }
    },
    [multipleStates, setNamedLoading, autoReset]
  );

  // Reset all loading states
  const resetLoading = useCallback(() => {
    setIsLoading(false);
    if (multipleStates) {
      setLoadingStates({});
    }
    // Clear operations from both local and global tracking
    for (const operationId of activeOperations.current) {
      globalActiveOperations.delete(operationId);
    }
    activeOperations.current.clear();
    notifyChange(false, 'reset');
  }, [multipleStates, notifyChange]);

  // Check if any loading state is active
  const isAnyLoading = useCallback(() => {
    if (isLoading) return true;
    if (multipleStates) {
      return Object.values(loadingStates).some(Boolean);
    }
    return false;
  }, [isLoading, loadingStates, multipleStates]);

  // Get loading state for a specific operation
  const getLoadingState = useCallback(
    (name = null) => {
      if (!name) return isLoading;
      if (!multipleStates) {
        console.warn(
          'useLoadingState: multipleStates option must be enabled to get named loading states'
        );
        return false;
      }
      return loadingStates[name] || false;
    },
    [isLoading, loadingStates, multipleStates]
  );

  // Create loading wrapper for button/form elements
  const withLoading = useCallback(
    (props = {}, loadingProps = {}) => {
      const isCurrentlyLoading = isAnyLoading();

      return {
        ...props,
        disabled: props.disabled || isCurrentlyLoading,
        'aria-busy': isCurrentlyLoading,
        'data-loading': isCurrentlyLoading,
        ...loadingProps
      };
    },
    [isAnyLoading]
  );

  // Create loading text helper
  const getLoadingText = useCallback(
    (normalText, loadingText = 'Loading...', name = null) => {
      const currentlyLoading = name ? getLoadingState(name) : isLoading;
      return currentlyLoading ? loadingText : normalText;
    },
    [isLoading, getLoadingState]
  );

  return {
    // Core state
    isLoading,
    loadingStates: multipleStates ? loadingStates : {},

    // State setters
    setLoading,
    setNamedLoading: multipleStates
      ? setNamedLoading
      : (name, loading) => {
          console.warn(
            'useLoadingState: multipleStates option must be enabled to use named loading states'
          );
        },
    resetLoading,

    // Async wrappers
    executeAsync,
    executeNamedAsync: multipleStates
      ? executeNamedAsync
      : (operation, name, operationId) => {
          console.warn(
            'useLoadingState: multipleStates option must be enabled to use named async operations'
          );
          return Promise.resolve();
        },

    // Utilities
    isAnyLoading,
    getLoadingState,
    withLoading,
    getLoadingText,

    // Convenience properties
    hasActiveOperations: activeOperations.current.size > 0,
    activeOperationCount: activeOperations.current.size
  };
}

/**
 * Simplified loading hook for basic use cases
 * @param {boolean} initialLoading - Initial loading state
 * @returns {[boolean, function, function]} - [isLoading, setLoading, executeAsync]
 */
export function useSimpleLoading(initialLoading = false) {
  const { isLoading, setLoading, executeAsync } = useLoadingState({
    initialLoading,
    autoReset: true
  });

  return [isLoading, setLoading, executeAsync];
}

/**
 * Hook for components that need multiple loading states
 * @param {Array} stateNames - Names of loading states to manage
 * @returns {Object} - Loading state utilities configured for multiple states
 */
export function useMultipleLoadingStates(stateNames = []) {
  const loadingHook = useLoadingState({
    multipleStates: true,
    autoReset: true
  });

  // Pre-initialize named states
  const { setNamedLoading } = loadingHook;

  // Create convenience methods for each named state
  const namedMethods = {};
  stateNames.forEach((name) => {
    namedMethods[`${name}Loading`] = loadingHook.getLoadingState(name);
    namedMethods[`set${name.charAt(0).toUpperCase() + name.slice(1)}Loading`] = (loading) =>
      setNamedLoading(name, loading);
  });

  return {
    ...loadingHook,
    ...namedMethods
  };
}

/**
 * Higher-order component for automatic loading state integration
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} loadingOptions - Options for useLoadingState
 * @returns {React.Component} - Enhanced component with loading state
 */
export function withLoadingState(WrappedComponent, loadingOptions = {}) {
  return function LoadingEnabledComponent(props) {
    const loadingState = useLoadingState(loadingOptions);

    return <WrappedComponent {...props} loadingState={loadingState} />;
  };
}
