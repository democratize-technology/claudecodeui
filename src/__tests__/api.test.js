// Mock fetch first
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true
});

// Import after mocks are set up
import { authenticatedFetch, api } from '../utils/api.js';

describe('API utilities', () => {
  beforeEach(() => {
    fetch.mockClear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.clear.mockClear();
  });

  describe('authenticatedFetch', () => {
    it('should make a fetch request without token when no token in localStorage', async () => {
      localStorageMock.getItem.mockReturnValue(null);
      fetch.mockResolvedValue({ json: () => Promise.resolve({}) });

      await authenticatedFetch('/test-endpoint');

      expect(localStorageMock.getItem).toHaveBeenCalledWith('auth-token');
      expect(fetch).toHaveBeenCalledWith('/test-endpoint', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
    });

    it('should include Authorization header when token exists', async () => {
      const testToken = 'test-token-123';
      localStorageMock.getItem.mockReturnValue(testToken);
      fetch.mockResolvedValue({ json: () => Promise.resolve({}) });

      await authenticatedFetch('/test-endpoint');

      expect(fetch).toHaveBeenCalledWith('/test-endpoint', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testToken}`
        }
      });
    });

    it('should merge custom headers with default headers', async () => {
      localStorageMock.getItem.mockReturnValue('token');
      fetch.mockResolvedValue({ json: () => Promise.resolve({}) });

      await authenticatedFetch('/test-endpoint', {
        headers: {
          'Custom-Header': 'custom-value'
        },
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      });

      expect(fetch).toHaveBeenCalledWith('/test-endpoint', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token',
          'Custom-Header': 'custom-value'
        },
        method: 'POST',
        body: JSON.stringify({ test: 'data' })
      });
    });

    it('should allow overriding default headers', async () => {
      localStorageMock.getItem.mockReturnValue('token');
      fetch.mockResolvedValue({ json: () => Promise.resolve({}) });

      await authenticatedFetch('/test-endpoint', {
        headers: {
          'Content-Type': 'text/plain'
        }
      });

      expect(fetch).toHaveBeenCalledWith('/test-endpoint', {
        headers: {
          'Content-Type': 'text/plain',
          Authorization: 'Bearer token'
        }
      });
    });

    it('should not set Content-Type for FormData bodies', async () => {
      localStorageMock.getItem.mockReturnValue('token');
      fetch.mockResolvedValue({ json: () => Promise.resolve({}) });

      const formData = new FormData();
      formData.append('test', 'data');

      await authenticatedFetch('/test-endpoint', {
        method: 'POST',
        body: formData
      });

      expect(fetch).toHaveBeenCalledWith('/test-endpoint', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer token'
        }
      });
    });
  });

  describe('api.auth', () => {
    beforeEach(() => {
      fetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should call auth status endpoint', async () => {
      await api.auth.status();
      expect(fetch).toHaveBeenCalledWith('/api/auth/status');
    });

    it('should call login endpoint with credentials', async () => {
      await api.auth.login('testuser', 'testpass');
      expect(fetch).toHaveBeenCalledWith('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'testpass' })
      });
    });

    it('should call register endpoint with credentials', async () => {
      await api.auth.register('testuser', 'testpass');
      expect(fetch).toHaveBeenCalledWith('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'testuser', password: 'testpass' })
      });
    });
  });

  describe('api.sessionMessages', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue('token');
      fetch.mockResolvedValue({
        json: () => Promise.resolve({ messages: [] })
      });
    });

    it('should build URL without query params when limit is null', async () => {
      await api.sessionMessages('project1', 'session1', null, 0);

      expect(fetch).toHaveBeenCalledWith('/api/projects/project1/sessions/session1/messages', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        }
      });
    });

    it('should build URL with query params when limit is provided', async () => {
      await api.sessionMessages('project1', 'session1', 10, 5);

      expect(fetch).toHaveBeenCalledWith(
        '/api/projects/project1/sessions/session1/messages?limit=10&offset=5',
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token'
          }
        }
      );
    });

    it('should handle default parameters', async () => {
      await api.sessionMessages('project1', 'session1');

      expect(fetch).toHaveBeenCalledWith('/api/projects/project1/sessions/session1/messages', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        }
      });
    });
  });

  describe('api.transcribe', () => {
    it('should handle FormData correctly by not setting Content-Type', async () => {
      localStorageMock.getItem.mockReturnValue('token');
      fetch.mockResolvedValue({
        json: () => Promise.resolve({ transcription: 'test' })
      });

      const formData = new FormData();
      formData.append('audio', new Blob(['fake audio']), 'test.wav');

      await api.transcribe(formData);

      // The authenticatedFetch function should detect FormData and not set Content-Type,
      // allowing the browser to set the proper boundary parameter
      expect(fetch).toHaveBeenCalledWith('/api/transcribe', {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: 'Bearer token'
        }
      });
    });
  });

  describe('api.taskmaster', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue('token');
      fetch.mockResolvedValue({
        json: () => Promise.resolve({ success: true })
      });
    });

    it('should initialize TaskMaster for a project', async () => {
      await api.taskmaster.init('myproject');

      expect(fetch).toHaveBeenCalledWith('/api/taskmaster/init/myproject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        }
      });
    });

    it('should add a task with all parameters', async () => {
      const taskData = {
        prompt: 'Test task',
        title: 'Test Title',
        description: 'Test Description',
        priority: 'high',
        dependencies: ['task1', 'task2']
      };

      await api.taskmaster.addTask('myproject', taskData);

      expect(fetch).toHaveBeenCalledWith('/api/taskmaster/add-task/myproject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        },
        body: JSON.stringify(taskData)
      });
    });

    it('should parse PRD with correct parameters', async () => {
      const prdData = {
        fileName: 'requirements.md',
        numTasks: 5,
        append: true
      };

      await api.taskmaster.parsePRD('myproject', prdData);

      expect(fetch).toHaveBeenCalledWith('/api/taskmaster/parse-prd/myproject', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        },
        body: JSON.stringify(prdData)
      });
    });
  });

  describe('api.get', () => {
    it('should prepend /api to endpoint', async () => {
      localStorageMock.getItem.mockReturnValue('token');
      fetch.mockResolvedValue({
        json: () => Promise.resolve({ data: 'test' })
      });

      await api.get('/custom/endpoint');

      expect(fetch).toHaveBeenCalledWith('/api/custom/endpoint', {
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token'
        }
      });
    });
  });

  describe('URL encoding', () => {
    beforeEach(() => {
      localStorageMock.getItem.mockReturnValue('token');
      fetch.mockResolvedValue({
        json: () => Promise.resolve({ content: 'test' })
      });
    });

    it('should properly encode file paths in readFile', async () => {
      const filePath = 'src/components/Some File With Spaces.jsx';
      await api.readFile('myproject', filePath);

      const expectedEncodedPath = encodeURIComponent(filePath);
      expect(fetch).toHaveBeenCalledWith(
        `/api/projects/myproject/file?filePath=${expectedEncodedPath}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token'
          }
        }
      );
    });
  });
});
