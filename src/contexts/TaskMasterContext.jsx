import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from '../utils/api';
import { useAuth } from './AuthContext';
import { useWebSocketContext } from './WebSocketContext';
import { useMultipleLoadingStates } from '../utils/hooks/useLoadingState';

const TaskMasterContext = createContext({
  // TaskMaster project state
  projects: [],
  currentProject: null,
  projectTaskMaster: null,

  // MCP server state
  mcpServerStatus: null,

  // Tasks state
  tasks: [],
  nextTask: null,

  // Loading states
  isLoading: false,
  isLoadingTasks: false,
  isLoadingMCP: false,

  // Error state
  error: null,

  // Actions
  refreshProjects: () => {},
  setCurrentProject: () => {},
  refreshTasks: () => {},
  refreshMCPStatus: () => {},
  clearError: () => {}
});

export const useTaskMaster = () => {
  const context = useContext(TaskMasterContext);
  if (!context) {
    throw new Error('useTaskMaster must be used within a TaskMasterProvider');
  }
  return context;
};

export const TaskMasterProvider = ({ children }) => {
  // Get WebSocket messages from shared context to avoid duplicate connections
  const { messages } = useWebSocketContext();

  // Authentication context
  const { user, token, isLoading: authLoading } = useAuth();

  // State
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProjectState] = useState(null);
  const [projectTaskMaster, setProjectTaskMaster] = useState(null);
  const [mcpServerStatus, setMCPServerStatus] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [nextTask, setNextTask] = useState(null);
  const [error, setError] = useState(null);

  // Use standardized loading state management with race condition protection
  const {
    projectsLoading: isLoading,
    tasksLoading: isLoadingTasks,
    mcpLoading: isLoadingMCP,
    executeNamedAsync,
    setProjectsLoading: setIsLoading,
    setTasksLoading: setIsLoadingTasks,
    setMcpLoading: setIsLoadingMCP
  } = useMultipleLoadingStates(['projects', 'tasks', 'mcp']);

  // Helper to handle API errors
  const handleError = (error, context) => {
    console.error(`TaskMaster ${context} error:`, error);
    setError({
      message: error.message || `Failed to ${context}`,
      context,
      timestamp: new Date().toISOString()
    });
  };

  // Clear error state
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // This will be defined after the functions are declared

  // Refresh projects with TaskMaster metadata
  const refreshProjects = useCallback(async () => {
    // Only make API calls if user is authenticated
    if (!user || !token) {
      setProjects([]);
      setCurrentProjectState(null);
      return;
    }

    try {
      await executeNamedAsync(
        async () => {
          clearError();
          const projectsData = await api.get('/projects');

          // Check if projectsData is an array
          if (!Array.isArray(projectsData)) {
            console.error('Projects API returned non-array data:', projectsData);
            setProjects([]);
            return;
          }

          // Filter and enrich projects with TaskMaster data
          const enrichedProjects = projectsData.map((project) => ({
            ...project,
            taskMasterConfigured: project.taskmaster?.hasTaskmaster || false,
            taskMasterStatus: project.taskmaster?.status || 'not-configured',
            taskCount: project.taskmaster?.metadata?.taskCount || 0,
            completedCount: project.taskmaster?.metadata?.completed || 0
          }));

          setProjects(enrichedProjects);

          // If current project is set, update its TaskMaster data
          // Access currentProject from state instead of depending on it
          setCurrentProjectState((prev) => {
            if (prev) {
              const updatedCurrent = enrichedProjects.find((p) => p.name === prev.name);
              if (updatedCurrent) {
                setProjectTaskMaster(updatedCurrent.taskmaster);
                return updatedCurrent;
              }
            }
            return prev;
          });
        },
        'projects',
        'refresh-projects'
      );
    } catch (err) {
      handleError(err, 'load projects');
    }
  }, [user, token, executeNamedAsync, clearError]); // Removed currentProject to break circular dependency

  // Set current project and load its TaskMaster details
  const setCurrentProject = useCallback(async (project) => {
    try {
      setCurrentProjectState(project);

      // Clear previous project's data immediately when switching projects
      setTasks([]);
      setNextTask(null);
      setProjectTaskMaster(null); // Clear previous TaskMaster data

      // Try to fetch fresh TaskMaster detection data for the project
      if (project?.name) {
        try {
          const detectionData = await api.get(
            `/taskmaster/detect/${encodeURIComponent(project.name)}`
          );
          setProjectTaskMaster(detectionData.taskmaster);
        } catch (error) {
          // If individual detection fails, fall back to project data from /api/projects
          console.warn(
            'Individual TaskMaster detection failed, using project data:',
            error.message
          );
          setProjectTaskMaster(project.taskmaster || null);
        }
      } else {
        setProjectTaskMaster(null);
      }
    } catch (err) {
      console.error('Error in setCurrentProject:', err);
      handleError(err, 'set current project');
      // Fall back to project data if available
      setProjectTaskMaster(project?.taskmaster || null);
    }
  }, []);

  // Refresh MCP server status
  const refreshMCPStatus = useCallback(async () => {
    // Only make API calls if user is authenticated
    if (!user || !token) {
      setMCPServerStatus(null);
      return;
    }

    try {
      await executeNamedAsync(
        async () => {
          clearError();
          const mcpStatus = await api.get('/mcp-utils/taskmaster-server');
          setMCPServerStatus(mcpStatus);
        },
        'mcp',
        'refresh-mcp-status'
      );
    } catch (err) {
      handleError(err, 'check MCP server status');
    }
  }, [user, token, executeNamedAsync, clearError]);

  // Refresh tasks for current project - load real TaskMaster data
  const refreshTasks = useCallback(async () => {
    if (!currentProject) {
      setTasks([]);
      setNextTask(null);
      return;
    }

    // Only make API calls if user is authenticated
    if (!user || !token) {
      setTasks([]);
      setNextTask(null);
      return;
    }

    try {
      await executeNamedAsync(
        async () => {
          clearError();

          // Load tasks from the TaskMaster API endpoint
          const data = await api.get(
            `/taskmaster/tasks/${encodeURIComponent(currentProject.name)}`
          );

          setTasks(data.tasks || []);

          // Find next task (pending or in-progress)
          const nextTask =
            data.tasks?.find(
              (task) => task.status === 'pending' || task.status === 'in-progress'
            ) || null;
          setNextTask(nextTask);
        },
        'tasks',
        'refresh-tasks'
      );
    } catch (err) {
      console.error('Error loading tasks:', err);
      handleError(err, 'load tasks');
      // Set empty state on error
      setTasks([]);
      setNextTask(null);
    }
  }, [user, token, executeNamedAsync, clearError]); // Removed currentProject to break circular dependency

  // Load initial data on mount or when auth changes
  useEffect(() => {
    if (!authLoading && user && token) {
      refreshProjects();
      refreshMCPStatus();
    } else {
      console.log('Auth not ready or no user, skipping project load:', {
        authLoading,
        user: !!user,
        token: !!token
      });
    }
  }, [authLoading, user, token]); // Fixed: Remove function dependencies to prevent circular dependency

  // Clear errors when authentication changes
  useEffect(() => {
    if (user && token) {
      clearError();
    }
  }, [user, token, clearError]);

  // Refresh tasks when current project changes
  useEffect(() => {
    if (currentProject?.name && user && token) {
      refreshTasks();
    }
  }, [currentProject?.name, user, token]); // Removed refreshTasks to break circular dependency

  // Handle WebSocket messages for TaskMaster updates
  useEffect(() => {
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage) return;

    // Only process TaskMaster-specific messages to prevent infinite loops
    const isTaskMasterMessage = [
      'taskmaster-project-updated',
      'taskmaster-tasks-updated', 
      'taskmaster-mcp-status-changed'
    ].includes(latestMessage.type);

    if (!isTaskMasterMessage) return;

    switch (latestMessage.type) {
      case 'taskmaster-project-updated':
        // Refresh projects when TaskMaster state changes
        if (latestMessage.projectName) {
          refreshProjects();
        }
        break;

      case 'taskmaster-tasks-updated':
        // Refresh tasks for the current project
        if (latestMessage.projectName === currentProject?.name) {
          refreshTasks();
        }
        break;

      case 'taskmaster-mcp-status-changed':
        // Refresh MCP server status
        refreshMCPStatus();
        break;

      default:
        // This shouldn't be reached due to isTaskMasterMessage check
        break;
    }
  }, [messages?.length, currentProject?.name]); // Only depend on messages length and current project name

  // Context value
  const contextValue = {
    // State
    projects,
    currentProject,
    projectTaskMaster,
    mcpServerStatus,
    tasks,
    nextTask,
    isLoading,
    isLoadingTasks,
    isLoadingMCP,
    error,

    // Actions
    refreshProjects,
    setCurrentProject,
    refreshTasks,
    refreshMCPStatus,
    clearError
  };

  return <TaskMasterContext.Provider value={contextValue}>{children}</TaskMasterContext.Provider>;
};

export default TaskMasterContext;
