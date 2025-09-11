import safeLocalStorage from './safeLocalStorage';

// Utility function for authenticated API calls
export const authenticatedFetch = (url, options = {}) => {
  const token = safeLocalStorage.getItem('auth-token');

  const defaultHeaders = {};

  // Only add Content-Type if not explicitly overridden and body is not FormData
  if (!options.headers?.hasOwnProperty('Content-Type') && !(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  if (token) {
    defaultHeaders['Authorization'] = `Bearer ${token}`;
  }

  return fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers
    }
  });
};

// API endpoints
export const api = {
  // Auth endpoints (no token required)
  auth: {
    status: () => fetch('/api/auth/status'),
    login: (username, password) =>
      fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }),
    register: (username, password) =>
      fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }),
    user: () => authenticatedFetch('/api/auth/user'),
    logout: () => authenticatedFetch('/api/auth/logout', { method: 'POST' })
  },

  // Protected endpoints
  config: () => authenticatedFetch('/api/config'),
  projects: () => authenticatedFetch('/api/projects'),
  sessions: (projectName, limit = 5, offset = 0) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions?limit=${limit}&offset=${offset}`),
  sessionMessages: (projectName, sessionId, limit = null, offset = 0) => {
    const params = new URLSearchParams();
    if (limit !== null) {
      params.append('limit', limit);
      params.append('offset', offset);
    }
    const queryString = params.toString();
    const url = `/api/projects/${projectName}/sessions/${sessionId}/messages${queryString ? `?${queryString}` : ''}`;
    return authenticatedFetch(url);
  },
  renameProject: (projectName, displayName) =>
    authenticatedFetch(`/api/projects/${projectName}/rename`, {
      method: 'PUT',
      body: JSON.stringify({ displayName })
    }),
  deleteSession: (projectName, sessionId) =>
    authenticatedFetch(`/api/projects/${projectName}/sessions/${sessionId}`, {
      method: 'DELETE'
    }),
  deleteProject: (projectName) =>
    authenticatedFetch(`/api/projects/${projectName}`, {
      method: 'DELETE'
    }),
  createProject: (path) =>
    authenticatedFetch('/api/projects/create', {
      method: 'POST',
      body: JSON.stringify({ path })
    }),
  readFile: (projectName, filePath) =>
    authenticatedFetch(
      `/api/projects/${projectName}/file?filePath=${encodeURIComponent(filePath)}`
    ),
  saveFile: (projectName, filePath, content) =>
    authenticatedFetch(`/api/projects/${projectName}/file`, {
      method: 'PUT',
      body: JSON.stringify({ filePath, content })
    }),
  getFiles: (projectName) => authenticatedFetch(`/api/projects/${projectName}/files`),
  transcribe: (formData) =>
    authenticatedFetch('/api/transcribe', {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    }),

  // TaskMaster endpoints
  taskmaster: {
    // Initialize TaskMaster in a project
    init: (projectName) =>
      authenticatedFetch(`/api/taskmaster/init/${projectName}`, {
        method: 'POST'
      }),

    // Add a new task
    addTask: (projectName, { prompt, title, description, priority, dependencies }) =>
      authenticatedFetch(`/api/taskmaster/add-task/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ prompt, title, description, priority, dependencies })
      }),

    // Parse PRD to generate tasks
    parsePRD: (projectName, { fileName, numTasks, append }) =>
      authenticatedFetch(`/api/taskmaster/parse-prd/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ fileName, numTasks, append })
      }),

    // Get available PRD templates
    getTemplates: () => authenticatedFetch('/api/taskmaster/prd-templates'),

    // Apply a PRD template
    applyTemplate: (projectName, { templateId, fileName, customizations }) =>
      authenticatedFetch(`/api/taskmaster/apply-template/${projectName}`, {
        method: 'POST',
        body: JSON.stringify({ templateId, fileName, customizations })
      }),

    // Update a task
    updateTask: (projectName, taskId, updates) =>
      authenticatedFetch(`/api/taskmaster/update-task/${projectName}/${taskId}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      })
  },

  // MCP endpoints
  mcp: {
    config: {
      read: () => authenticatedFetch('/api/mcp/config/read')
    },
    cli: {
      list: () => authenticatedFetch('/api/mcp/cli/list'),
      add: (serverData) => 
        authenticatedFetch('/api/mcp/cli/add', {
          method: 'POST',
          body: JSON.stringify(serverData)
        }),
      addJson: (jsonData) =>
        authenticatedFetch('/api/mcp/cli/add-json', {
          method: 'POST',
          body: JSON.stringify(jsonData)
        }),
      remove: (serverId, scope = 'user') =>
        authenticatedFetch(`/api/mcp/cli/remove/${serverId}?scope=${scope}`, {
          method: 'DELETE'
        })
    },
    servers: {
      list: (scope = 'user') => authenticatedFetch(`/api/mcp/servers?scope=${scope}`),
      test: (serverId, scope = 'user') =>
        authenticatedFetch(`/api/mcp/servers/${serverId}/test?scope=${scope}`, {
          method: 'POST'
        }),
      tools: (serverId, scope = 'user') =>
        authenticatedFetch(`/api/mcp/servers/${serverId}/tools?scope=${scope}`, {
          method: 'POST'
        })
    }
  },

  // Cursor endpoints
  cursor: {
    config: () => authenticatedFetch('/api/cursor/config'),
    mcp: () => authenticatedFetch('/api/cursor/mcp')
  },

  // Project file operations
  uploadImages: (projectName, formData) =>
    authenticatedFetch(`/api/projects/${projectName}/upload-images`, {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    }),

  // Generic GET method for any endpoint
  get: (endpoint) => authenticatedFetch(`/api${endpoint}`)
};
