import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useErrorHandler } from '../utils/hooks/useErrorHandler.jsx';
import { ERROR_CATEGORIES, ERROR_SEVERITY, withRetry } from '../utils/errorHandling.jsx';
import safeLocalStorage from '../utils/safeLocalStorage';

const AuthContext = createContext({
  user: null,
  token: null,
  login: () => {},
  register: () => {},
  logout: () => {},
  isLoading: true,
  needsSetup: false,
  error: null
});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(safeLocalStorage.getItem('auth-token'));
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [error, setError] = useState(null);

  // Initialize standardized error handling for authentication operations
  const errorHandler = useErrorHandler({
    defaultCategory: ERROR_CATEGORIES.AUTHENTICATION,
    defaultSeverity: ERROR_SEVERITY.MEDIUM,
    autoReset: false, // Keep auth errors persistent until resolved
    onError: (processedError) => {
      // Map standardized errors back to component state for backward compatibility
      setError(processedError.userMessage);
    }
  });

  const checkAuthStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      errorHandler.resetError();

      // Check if system needs setup with retry logic for network issues
      const statusOperation = async () => {
        const statusResponse = await errorHandler.fetchWithErrorHandling('/api/auth/status', {
          method: 'GET'
        });
        return statusResponse.json();
      };

      const statusData = await withRetry(statusOperation, 3, 1000, ERROR_CATEGORIES.NETWORK);

      if (statusData.needsSetup) {
        setNeedsSetup(true);
        setIsLoading(false);
        return;
      }

      // If we have a token, verify it
      if (token) {
        try {
          const userOperation = async () => {
            const userResponse = await errorHandler.fetchWithErrorHandling('/api/auth/user', {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            return userResponse.json();
          };

          const userData = await userOperation();
          setUser(userData.user);
          setNeedsSetup(false);
        } catch (error) {
          // Token is invalid - handle gracefully
          errorHandler.reportError(error, ERROR_CATEGORIES.AUTHENTICATION, ERROR_SEVERITY.LOW, {
            operation: 'token verification',
            action: 'clearing_token'
          });
          safeLocalStorage.removeItem('auth-token');
          setToken(null);
          setUser(null);
        }
      }
    } catch (error) {
      errorHandler.reportError(error, ERROR_CATEGORIES.NETWORK, ERROR_SEVERITY.HIGH, {
        operation: 'auth status check',
        critical: true
      });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, [checkAuthStatus]);

  const login = async (username, password) => {
    try {
      setError(null);
      errorHandler.resetError();

      const loginOperation = async () => {
        const response = await errorHandler.fetchWithErrorHandling('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        // Handle authentication-specific error responses
        if (!response.ok) {
          const authError = new Error(data.error || 'Login failed');
          authError.status = response.status;
          authError.authFailure = true;
          throw authError;
        }

        return data;
      };

      const data = await loginOperation();

      // Success case
      setToken(data.token);
      setUser(data.user);
      safeLocalStorage.setItem('auth-token', data.token);
      return { success: true };
    } catch (error) {
      let severity = ERROR_SEVERITY.HIGH;
      let category = ERROR_CATEGORIES.AUTHENTICATION;

      // Determine appropriate error categorization
      if (error.authFailure) {
        severity = ERROR_SEVERITY.MEDIUM; // User credential errors
      } else if (error.status >= 500) {
        category = ERROR_CATEGORIES.NETWORK;
        severity = ERROR_SEVERITY.HIGH;
      }

      const processedError = errorHandler.reportError(error, category, severity, {
        operation: 'login',
        username: `${username?.substring(0, 3)}***`, // Log partial username for debugging
        status: error.status
      });

      return {
        success: false,
        error: processedError.userMessage,
        canRetry: processedError.shouldRetry
      };
    }
  };

  const register = async (username, password) => {
    try {
      setError(null);
      errorHandler.resetError();

      const registerOperation = async () => {
        const response = await errorHandler.fetchWithErrorHandling('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        // Handle registration-specific error responses
        if (!response.ok) {
          const regError = new Error(data.error || 'Registration failed');
          regError.status = response.status;
          regError.registrationFailure = true;

          // Determine if this is a validation error or system error
          if (response.status === 400 || response.status === 409) {
            regError.validationFailure = true;
          }

          throw regError;
        }

        return data;
      };

      const data = await registerOperation();

      // Success case
      setToken(data.token);
      setUser(data.user);
      setNeedsSetup(false);
      safeLocalStorage.setItem('auth-token', data.token);
      return { success: true };
    } catch (error) {
      let severity = ERROR_SEVERITY.HIGH;
      let category = ERROR_CATEGORIES.AUTHENTICATION;

      // Determine appropriate error categorization
      if (error.validationFailure) {
        category = ERROR_CATEGORIES.VALIDATION;
        severity = ERROR_SEVERITY.MEDIUM;
      } else if (error.registrationFailure) {
        severity = ERROR_SEVERITY.MEDIUM;
      } else if (error.status >= 500) {
        category = ERROR_CATEGORIES.NETWORK;
        severity = ERROR_SEVERITY.HIGH;
      }

      const processedError = errorHandler.reportError(error, category, severity, {
        operation: 'registration',
        username: `${username?.substring(0, 3)}***`,
        status: error.status,
        isSetup: true
      });

      return {
        success: false,
        error: processedError.userMessage,
        canRetry: processedError.shouldRetry
      };
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    safeLocalStorage.removeItem('auth-token');
    errorHandler.resetError();

    // Optional: Call logout endpoint for logging (non-critical operation)
    if (token) {
      errorHandler
        .executeWithFallback(
          async () => {
            const response = await errorHandler.fetchWithErrorHandling('/api/auth/logout', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            return response.json();
          },
          null, // fallback value - logout succeeds even if endpoint fails
          ERROR_CATEGORIES.NETWORK
        )
        .catch((error) => {
          // Log but don't show error to user - logout already succeeded locally
          errorHandler.reportError(error, ERROR_CATEGORIES.NETWORK, ERROR_SEVERITY.LOW, {
            operation: 'logout endpoint',
            critical: false
          });
        });
    }
  };

  const value = {
    user,
    token,
    login,
    register,
    logout,
    isLoading,
    needsSetup,
    error
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
