import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useErrorHandler } from '../utils/hooks/useErrorHandler.jsx';
import { ERROR_CATEGORIES, ERROR_SEVERITY } from '../utils/errorHandling.jsx';
import safeLocalStorage from '../utils/safeLocalStorage';

const TasksSettingsContext = createContext({
  tasksEnabled: true,
  setTasksEnabled: () => {},
  toggleTasksEnabled: () => {},
  isTaskMasterInstalled: null,
  isTaskMasterReady: null,
  installationStatus: null,
  isCheckingInstallation: true
});

export const useTasksSettings = () => {
  const context = useContext(TasksSettingsContext);
  if (!context) {
    throw new Error('useTasksSettings must be used within a TasksSettingsProvider');
  }
  return context;
};

export const TasksSettingsProvider = ({ children }) => {
  const [tasksEnabled, setTasksEnabled] = useState(() => {
    // Load from localStorage on initialization
    const saved = safeLocalStorage.getItem('tasks-enabled');
    return saved !== null ? JSON.parse(saved) : true; // Default to true
  });

  const [isTaskMasterInstalled, setIsTaskMasterInstalled] = useState(null);
  const [isTaskMasterReady, setIsTaskMasterReady] = useState(null);
  const [installationStatus, setInstallationStatus] = useState(null);
  const [isCheckingInstallation, setIsCheckingInstallation] = useState(true);

  // Initialize error handling for TaskMaster operations
  const errorHandler = useErrorHandler({
    defaultCategory: ERROR_CATEGORIES.EXTERNAL_SERVICE,
    defaultSeverity: ERROR_SEVERITY.LOW, // TaskMaster failures shouldn't be critical
    autoReset: true, // Auto-reset errors for background checks
    onError: (processedError) => {
      // For TaskMaster errors, we generally want graceful degradation
      if (processedError.severity === ERROR_SEVERITY.HIGH) {
        console.warn('TaskMaster service issue:', processedError.userMessage);
      }
    }
  });

  // Save to localStorage whenever tasksEnabled changes
  useEffect(() => {
    safeLocalStorage.setJSON('tasks-enabled', tasksEnabled);
  }, [tasksEnabled]);

  // Check TaskMaster installation status asynchronously on component mount
  const checkInstallation = useCallback(async () => {
    try {
      // Use graceful fallback for TaskMaster status check (non-critical)
      const installationData = await errorHandler.executeWithFallback(
        async () => {
          const response = await errorHandler.fetchWithErrorHandling(
            '/api/taskmaster/installation-status',
            {
              method: 'GET'
            }
          );
          return response.json();
        },
        // Fallback: assume TaskMaster is not available
        {
          installation: { isInstalled: false },
          isReady: false,
          fallback: true
        },
        ERROR_CATEGORIES.EXTERNAL_SERVICE
      );

      setInstallationStatus(installationData);
      setIsTaskMasterInstalled(installationData.installation?.isInstalled || false);
      setIsTaskMasterReady(installationData.isReady || false);

      // If TaskMaster is not installed and user hasn't explicitly enabled tasks,
      // disable tasks automatically
      const userEnabledTasks = safeLocalStorage.getItem('tasks-enabled');
      if (!installationData.installation?.isInstalled && !userEnabledTasks) {
        setTasksEnabled(false);
      }

      // Log successful check with fallback indicator
      if (installationData.fallback) {
        errorHandler.reportError(
          new Error('TaskMaster service unavailable'),
          ERROR_CATEGORIES.EXTERNAL_SERVICE,
          ERROR_SEVERITY.LOW,
          {
            operation: 'installation check',
            fallbackUsed: true,
            impact: 'tasks disabled'
          }
        );
      }
    } catch (error) {
      // This should rarely happen due to fallback, but handle gracefully
      errorHandler.reportError(error, ERROR_CATEGORIES.EXTERNAL_SERVICE, ERROR_SEVERITY.MEDIUM, {
        operation: 'installation check',
        critical: false
      });

      // Set safe defaults
      setIsTaskMasterInstalled(false);
      setIsTaskMasterReady(false);
      setInstallationStatus(null);
    } finally {
      setIsCheckingInstallation(false);
    }
  }, [errorHandler]);

  useEffect(() => {
    // DISABLED: TaskMaster integration disabled to prevent 401 errors
    // setTimeout(checkInstallation, 0);

    // Set safe defaults - TaskMaster disabled
    setIsTaskMasterInstalled(false);
    setIsTaskMasterReady(false);
    setInstallationStatus({ installation: { isInstalled: false }, isReady: false, disabled: true });
    setIsCheckingInstallation(false);
    setTasksEnabled(false);
  }, []);

  const toggleTasksEnabled = () => {
    setTasksEnabled((prev) => !prev);
  };

  const contextValue = {
    tasksEnabled,
    setTasksEnabled,
    toggleTasksEnabled,
    isTaskMasterInstalled,
    isTaskMasterReady,
    installationStatus,
    isCheckingInstallation
  };

  return (
    <TasksSettingsContext.Provider value={contextValue}>{children}</TasksSettingsContext.Provider>
  );
};

export default TasksSettingsContext;
