/**
 * Standardized error handling utilities for consistent user experience
 * Provides centralized error logging, user notifications, and fallback patterns
 */

// Error severity levels
export const ERROR_SEVERITY = {
  LOW: 'low', // Minor issues that don't affect core functionality
  MEDIUM: 'medium', // Issues that affect some functionality but have fallbacks
  HIGH: 'high', // Critical issues that significantly impact user experience
  CRITICAL: 'critical' // System-breaking issues that require immediate attention
};

// Error categories for better tracking and handling
export const ERROR_CATEGORIES = {
  NETWORK: 'network', // API calls, fetch failures, connection issues
  AUTHENTICATION: 'auth', // Login, token, permission issues
  VALIDATION: 'validation', // Input validation, data format issues
  COMPONENT: 'component', // React component failures, lazy loading
  FILESYSTEM: 'filesystem', // File operations, upload/download issues
  WEBSOCKET: 'websocket', // Real-time communication failures
  EXTERNAL_SERVICE: 'external', // Third-party service failures
  UNKNOWN: 'unknown' // Unclassified errors
};

// User-friendly error messages mapped to common error patterns
export const ERROR_MESSAGES = {
  [ERROR_CATEGORIES.NETWORK]: {
    [ERROR_SEVERITY.LOW]: 'Connection temporarily unavailable. Retrying...',
    [ERROR_SEVERITY.MEDIUM]: 'Network issue detected. Some features may be limited.',
    [ERROR_SEVERITY.HIGH]: 'Unable to connect to server. Please check your connection.',
    [ERROR_SEVERITY.CRITICAL]: 'Server is unreachable. Please try again later.'
  },
  [ERROR_CATEGORIES.AUTHENTICATION]: {
    [ERROR_SEVERITY.LOW]: 'Session refreshed successfully.',
    [ERROR_SEVERITY.MEDIUM]: 'Please verify your credentials.',
    [ERROR_SEVERITY.HIGH]: 'Authentication failed. Please log in again.',
    [ERROR_SEVERITY.CRITICAL]: 'Access denied. Contact administrator.'
  },
  [ERROR_CATEGORIES.VALIDATION]: {
    [ERROR_SEVERITY.LOW]: 'Please check your input and try again.',
    [ERROR_SEVERITY.MEDIUM]: 'Some fields contain invalid data.',
    [ERROR_SEVERITY.HIGH]: 'Unable to process request due to invalid data.',
    [ERROR_SEVERITY.CRITICAL]: 'Data format error. Please contact support.'
  },
  [ERROR_CATEGORIES.COMPONENT]: {
    [ERROR_SEVERITY.LOW]: 'Component loading delayed. Please wait...',
    [ERROR_SEVERITY.MEDIUM]: 'Some features may not be available right now.',
    [ERROR_SEVERITY.HIGH]: 'Interface component failed to load.',
    [ERROR_SEVERITY.CRITICAL]: 'Critical component failure. Please reload the page.'
  },
  [ERROR_CATEGORIES.FILESYSTEM]: {
    [ERROR_SEVERITY.LOW]: 'File operation in progress...',
    [ERROR_SEVERITY.MEDIUM]: 'File operation partially completed.',
    [ERROR_SEVERITY.HIGH]: 'Unable to access file. Please try again.',
    [ERROR_SEVERITY.CRITICAL]: 'File system error. Please contact support.'
  },
  [ERROR_CATEGORIES.WEBSOCKET]: {
    [ERROR_SEVERITY.LOW]: 'Reconnecting to server...',
    [ERROR_SEVERITY.MEDIUM]: 'Connection unstable. Some features may be delayed.',
    [ERROR_SEVERITY.HIGH]: 'Real-time features unavailable. Reconnecting...',
    [ERROR_SEVERITY.CRITICAL]: 'Unable to establish real-time connection.'
  },
  [ERROR_CATEGORIES.EXTERNAL_SERVICE]: {
    [ERROR_SEVERITY.LOW]: 'External service temporarily slow.',
    [ERROR_SEVERITY.MEDIUM]: 'Third-party service experiencing issues.',
    [ERROR_SEVERITY.HIGH]: 'External service unavailable. Using fallback.',
    [ERROR_SEVERITY.CRITICAL]: 'Critical external service failure.'
  },
  [ERROR_CATEGORIES.UNKNOWN]: {
    [ERROR_SEVERITY.LOW]: 'Minor issue detected. Continuing...',
    [ERROR_SEVERITY.MEDIUM]: 'Unexpected issue occurred. Trying alternative.',
    [ERROR_SEVERITY.HIGH]: 'An unexpected error occurred. Please try again.',
    [ERROR_SEVERITY.CRITICAL]: 'Critical system error. Please reload the page.'
  }
};

/**
 * Standardized error handler that provides consistent logging and user feedback
 * @param {Error} error - The error object
 * @param {string} category - Error category from ERROR_CATEGORIES
 * @param {string} severity - Error severity from ERROR_SEVERITY
 * @param {Object} context - Additional context for debugging
 * @param {Function} onUserNotify - Optional callback for user notification
 * @returns {Object} - Processed error information
 */
export function handleError(
  error,
  category = ERROR_CATEGORIES.UNKNOWN,
  severity = ERROR_SEVERITY.MEDIUM,
  context = {},
  onUserNotify = null
) {
  // Generate unique error ID for tracking
  const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // Enhanced error context
  const errorContext = {
    id: errorId,
    timestamp: new Date().toISOString(),
    category,
    severity,
    message: error?.message || 'Unknown error',
    stack: error?.stack,
    userAgent: navigator?.userAgent,
    url: window?.location?.href,
    ...context
  };

  // Log error with appropriate level
  const logLevel = {
    [ERROR_SEVERITY.LOW]: 'debug',
    [ERROR_SEVERITY.MEDIUM]: 'warn',
    [ERROR_SEVERITY.HIGH]: 'error',
    [ERROR_SEVERITY.CRITICAL]: 'error'
  }[severity];

  const log = (level, message, context) => {
    console[level](message, context);
  };

  log(logLevel, `[${category.toUpperCase()}] ${severity.toUpperCase()}:`, errorContext);

  // Get user-friendly message
  const userMessage =
    ERROR_MESSAGES[category]?.[severity] || ERROR_MESSAGES[ERROR_CATEGORIES.UNKNOWN][severity];

  // Notify user if callback provided
  if (onUserNotify && typeof onUserNotify === 'function') {
    onUserNotify({
      message: userMessage,
      severity,
      category,
      errorId,
      canRetry: severity !== ERROR_SEVERITY.CRITICAL
    });
  }

  // Return processed error info
  return {
    id: errorId,
    category,
    severity,
    userMessage,
    originalError: error,
    context: errorContext,
    shouldRetry: severity !== ERROR_SEVERITY.CRITICAL,
    timestamp: errorContext.timestamp
  };
}

/**
 * Async wrapper that handles promise rejections with consistent error handling
 * @param {Promise} promise - Promise to wrap
 * @param {string} category - Error category
 * @param {string} severity - Error severity
 * @param {Object} context - Additional context
 * @returns {Promise} - Wrapped promise with error handling
 */
export async function withErrorHandling(
  promise,
  category,
  severity = ERROR_SEVERITY.MEDIUM,
  context = {}
) {
  try {
    return await promise;
  } catch (error) {
    const processedError = handleError(error, category, severity, context);
    // Re-throw with additional context for upstream handling
    const enhancedError = new Error(processedError.userMessage);
    enhancedError.originalError = error;
    enhancedError.processedInfo = processedError;
    throw enhancedError;
  }
}

/**
 * Error boundary compatible error processor
 * @param {Error} error - React error boundary error
 * @param {Object} errorInfo - React error info
 * @returns {Object} - Processed error for error boundary
 */
export function processErrorBoundaryError(error, errorInfo) {
  return handleError(error, ERROR_CATEGORIES.COMPONENT, ERROR_SEVERITY.HIGH, {
    componentStack: errorInfo?.componentStack,
    errorBoundary: true
  });
}

/**
 * Network-specific error handler with retry logic
 * @param {Response} response - Fetch response object
 * @param {Object} context - Request context
 * @returns {Object} - Processed network error
 */
export function handleNetworkError(response, context = {}) {
  let severity = ERROR_SEVERITY.MEDIUM;

  // Determine severity based on status code
  if (response.status >= 500) {
    severity = ERROR_SEVERITY.HIGH;
  } else if (response.status === 401 || response.status === 403) {
    severity = ERROR_SEVERITY.HIGH;
    context.category = ERROR_CATEGORIES.AUTHENTICATION;
  } else if (response.status >= 400) {
    severity = ERROR_SEVERITY.MEDIUM;
  }

  const error = new Error(`HTTP ${response.status}: ${response.statusText}`);

  return handleError(error, context.category || ERROR_CATEGORIES.NETWORK, severity, {
    ...context,
    status: response.status,
    statusText: response.statusText,
    url: response.url
  });
}

/**
 * Create a standardized retry function
 * @param {Function} operation - Function to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @param {number} delay - Delay between retries in ms
 * @param {string} category - Error category for logging
 * @returns {Promise} - Promise that resolves with operation result
 */
export async function withRetry(
  operation,
  maxRetries = 3,
  delay = 1000,
  category = ERROR_CATEGORIES.UNKNOWN
) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        handleError(error, category, ERROR_SEVERITY.HIGH, {
          operation: operation.name || 'anonymous',
          attemptsMade: attempt,
          maxRetries
        });
        throw error;
      }

      // Log retry attempt
      handleError(error, category, ERROR_SEVERITY.LOW, {
        operation: operation.name || 'anonymous',
        attempt,
        maxRetries,
        retryingIn: delay
      });

      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }

  throw lastError;
}

/**
 * Graceful degradation wrapper for non-critical operations
 * @param {Function} operation - Operation to attempt
 * @param {*} fallbackValue - Value to return if operation fails
 * @param {string} category - Error category
 * @returns {*} - Operation result or fallback value
 */
export async function withFallback(operation, fallbackValue, category = ERROR_CATEGORIES.UNKNOWN) {
  try {
    return await operation();
  } catch (error) {
    handleError(error, category, ERROR_SEVERITY.LOW, {
      operation: operation.name || 'anonymous',
      fallbackUsed: true
    });
    return fallbackValue;
  }
}

// Export error handling hook for React components
export { useErrorHandler } from './hooks/useErrorHandler.jsx';
