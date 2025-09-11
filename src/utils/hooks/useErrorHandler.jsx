/**
 * React hook for standardized error handling
 * Provides consistent error handling patterns for React components
 */

import { useCallback, useState } from 'react';
import { handleError, ERROR_CATEGORIES, ERROR_SEVERITY } from '../errorHandling.jsx';

/**
 * Hook for handling errors in React components with consistent UI feedback
 * @param {Object} options - Configuration options
 * @returns {Object} - Error handling utilities
 */
export function useErrorHandler(options = {}) {
  const {
    defaultCategory = ERROR_CATEGORIES.UNKNOWN,
    defaultSeverity = ERROR_SEVERITY.MEDIUM,
    onError = null, // Optional callback for custom error handling
    showToast = false, // Whether to show toast notifications (requires toast system)
    autoReset = true, // Whether to auto-reset error state after successful operations
    resetDelay = 3000 // How long to show errors before auto-reset (ms)
  } = options;

  // Error state management
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reset error state
  const resetError = useCallback(() => {
    setError(null);
    setRetryCount(0);
  }, []);

  // Handle error with standardized processing
  const reportError = useCallback(
    (err, category = defaultCategory, severity = defaultSeverity, context = {}) => {
      const processedError = handleError(
        err,
        category,
        severity,
        {
          ...context,
          component: context.component || 'useErrorHandler',
          retryCount
        },
        showToast
          ? (errorInfo) => {
              // Toast notification would go here if toast system is available
              console.info('Error toast:', errorInfo);
            }
          : null
      );

      setError(processedError);

      // Call custom error handler if provided
      if (onError && typeof onError === 'function') {
        onError(processedError);
      }

      // Auto-reset after delay if enabled
      if (autoReset && resetDelay > 0) {
        setTimeout(() => {
          setError(null);
        }, resetDelay);
      }

      return processedError;
    },
    [defaultCategory, defaultSeverity, onError, showToast, autoReset, resetDelay, retryCount]
  );

  // Async operation wrapper with loading and error states
  const executeAsync = useCallback(
    async (operation, category = defaultCategory, severity = defaultSeverity, context = {}) => {
      try {
        setIsLoading(true);
        if (autoReset) {
          resetError();
        }

        const result = await operation();

        // Reset error on successful operation
        if (autoReset && error) {
          resetError();
        }

        return result;
      } catch (err) {
        const processedError = reportError(err, category, severity, {
          ...context,
          operation: operation.name || 'async operation'
        });

        // Re-throw with processed error info for upstream handling
        const enhancedError = new Error(processedError.userMessage);
        enhancedError.processedError = processedError;
        throw enhancedError;
      } finally {
        setIsLoading(false);
      }
    },
    [defaultCategory, defaultSeverity, autoReset, error, reportError, resetError]
  );

  // Retry last failed operation
  const retry = useCallback(
    async (operation) => {
      if (!operation) {
        console.warn('No operation provided to retry');
        return;
      }

      setRetryCount((prev) => prev + 1);
      return executeAsync(operation, defaultCategory, defaultSeverity, {
        isRetry: true,
        retryAttempt: retryCount + 1
      });
    },
    [executeAsync, defaultCategory, defaultSeverity, retryCount]
  );

  // Graceful operation with fallback
  const executeWithFallback = useCallback(
    async (operation, fallbackValue, category = defaultCategory) => {
      try {
        return await executeAsync(operation, category, ERROR_SEVERITY.LOW, {
          hasFallback: true
        });
      } catch (err) {
        reportError(err, category, ERROR_SEVERITY.LOW, {
          operation: operation.name || 'fallback operation',
          fallbackUsed: true
        });
        return fallbackValue;
      }
    },
    [executeAsync, reportError, defaultCategory]
  );

  // Network request wrapper with standard error handling
  const fetchWithErrorHandling = useCallback(
    async (url, options = {}) => {
      return executeAsync(
        async () => {
          const response = await fetch(url, options);

          if (!response.ok) {
            // Create error with response details
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.response = response;
            error.status = response.status;
            throw error;
          }

          return response;
        },
        ERROR_CATEGORIES.NETWORK,
        ERROR_SEVERITY.MEDIUM,
        {
          url,
          method: options.method || 'GET',
          status: 'pending'
        }
      );
    },
    [executeAsync]
  );

  // Component-safe error boundary simulator
  const safeExecute = useCallback(
    (operation, fallback = null) => {
      try {
        return operation();
      } catch (err) {
        reportError(err, ERROR_CATEGORIES.COMPONENT, ERROR_SEVERITY.MEDIUM, {
          component: 'safeExecute',
          operation: operation.name || 'component operation'
        });
        return fallback;
      }
    },
    [reportError]
  );

  return {
    // Error state
    error,
    isLoading,
    retryCount,

    // Error management
    reportError,
    resetError,
    retry,

    // Operation wrappers
    executeAsync,
    executeWithFallback,
    fetchWithErrorHandling,
    safeExecute,

    // Convenience properties
    hasError: !!error,
    canRetry: error?.shouldRetry ?? false,
    errorMessage: error?.userMessage || null,
    errorSeverity: error?.severity || null,
    errorCategory: error?.category || null
  };
}

/**
 * Higher-order component for automatic error boundary integration
 * @param {React.Component} WrappedComponent - Component to wrap
 * @param {Object} errorHandlerOptions - Options for useErrorHandler
 * @returns {React.Component} - Enhanced component with error handling
 */
export function withErrorHandler(WrappedComponent, errorHandlerOptions = {}) {
  return function ErrorHandledComponent(props) {
    const errorHandler = useErrorHandler(errorHandlerOptions);

    return <WrappedComponent {...props} errorHandler={errorHandler} />;
  };
}

/**
 * Hook for handling form validation errors consistently
 * @param {Object} options - Configuration options
 * @returns {Object} - Form error handling utilities
 */
export function useFormErrorHandler(options = {}) {
  const baseHandler = useErrorHandler({
    ...options,
    defaultCategory: ERROR_CATEGORIES.VALIDATION,
    defaultSeverity: ERROR_SEVERITY.MEDIUM
  });

  const [fieldErrors, setFieldErrors] = useState({});

  const setFieldError = useCallback((field, error) => {
    setFieldErrors((prev) => ({
      ...prev,
      [field]: error
    }));
  }, []);

  const clearFieldError = useCallback((field) => {
    setFieldErrors((prev) => {
      const updated = { ...prev };
      delete updated[field];
      return updated;
    });
  }, []);

  const clearAllFieldErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  const validateField = useCallback(
    (field, value, validator) => {
      try {
        const result = validator(value);
        if (result !== true) {
          setFieldError(field, result);
          return false;
        }
        clearFieldError(field);
        return true;
      } catch (error) {
        const processedError = baseHandler.reportError(
          error,
          ERROR_CATEGORIES.VALIDATION,
          ERROR_SEVERITY.LOW,
          { field, value: typeof value === 'string' ? value.substring(0, 50) : typeof value }
        );
        setFieldError(field, processedError.userMessage);
        return false;
      }
    },
    [baseHandler, setFieldError, clearFieldError]
  );

  return {
    ...baseHandler,
    fieldErrors,
    setFieldError,
    clearFieldError,
    clearAllFieldErrors,
    validateField,
    hasFieldErrors: Object.keys(fieldErrors).length > 0
  };
}
