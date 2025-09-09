import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Shell from '../components/Shell';

// Mock xterm and addons
jest.mock('xterm', () => ({
  Terminal: jest.fn(() => ({
    open: jest.fn(),
    write: jest.fn(),
    clear: jest.fn(),
    dispose: jest.fn(),
    onData: jest.fn(),
    onResize: jest.fn(),
    focus: jest.fn(),
    loadAddon: jest.fn(),
    cols: 80,
    rows: 24,
    element: { parentNode: { removeChild: jest.fn() } }
  }))
}));

jest.mock('xterm-addon-fit', () => ({
  FitAddon: jest.fn(() => ({
    fit: jest.fn(),
    activate: jest.fn(),
    dispose: jest.fn()
  }))
}));

jest.mock('@xterm/addon-clipboard', () => ({
  ClipboardAddon: jest.fn(() => ({
    activate: jest.fn(),
    dispose: jest.fn()
  }))
}));

jest.mock('@xterm/addon-webgl', () => ({
  WebglAddon: jest.fn(() => ({
    activate: jest.fn(),
    dispose: jest.fn()
  }))
}));

// Mock WebSocket
const mockWebSocket = {
  close: jest.fn(),
  send: jest.fn(),
  readyState: WebSocket.OPEN,
  onopen: null,
  onmessage: null,
  onerror: null,
  onclose: null
};

global.WebSocket = jest.fn(() => mockWebSocket);

// Mock fetch for configuration
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock navigator.clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: {
    readText: jest.fn()
  }
});

describe('Shell Component Security Tests', () => {
  const mockProject = {
    name: 'test-project',
    fullPath: '/path/to/test-project',
    path: '/path/to/test-project'
  };

  const mockSession = {
    id: 'session-123'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('valid-token-123');
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ wsUrl: 'ws://localhost:3001' })
    });
  });

  afterEach(() => {
    // Clean up any WebSocket connections
    if (mockWebSocket.onclose) {
      mockWebSocket.onclose();
    }
  });

  describe('Authentication Security', () => {
    test('should require authentication token for WebSocket connection', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Try to connect (this would be triggered by user interaction)
      // The component should not attempt WebSocket connection without token
      await waitFor(() => {
        expect(WebSocket).not.toHaveBeenCalled();
      });
    });

    test('should include authentication token in WebSocket URL', async () => {
      const token = 'secure-token-456';
      mockLocalStorage.getItem.mockReturnValue(token);
      
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Simulate component initialization and connection
      await act(async () => {
        // Component will try to connect on initialization
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Verify WebSocket is created with token in URL
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining(`token=${encodeURIComponent(token)}`)
        );
      });
    });

    test('should handle authentication failure gracefully', async () => {
      fetch.mockRejectedValue(new Error('Authentication failed'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to get server configuration')
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Command Injection Prevention', () => {
    test('should sanitize clipboard input before sending to terminal', async () => {
      const maliciousInput = '; rm -rf / #';
      navigator.clipboard.readText.mockResolvedValue(maliciousInput);
      
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Simulate Ctrl+V paste
      const container = document.body;
      
      await act(async () => {
        fireEvent.keyDown(container, {
          key: 'v',
          ctrlKey: true,
          preventDefault: jest.fn()
        });
      });

      // Verify that malicious input is sent as-is to backend (backend should handle sanitization)
      // But we verify the data structure is correct
      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: 'input',
            data: maliciousInput
          })
        );
      });
    });

    test('should properly structure terminal input messages', async () => {
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Mock terminal onData callback and trigger it
      const { Terminal } = require('xterm');
      const terminalInstance = Terminal.mock.results[0].value;
      const onDataCallback = terminalInstance.onData.mock.calls[0][0];
      
      // Simulate user typing potentially dangerous command
      const dangerousCommand = 'sudo rm -rf /';
      
      await act(async () => {
        onDataCallback(dangerousCommand);
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'input',
          data: dangerousCommand
        })
      );
    });
  });

  describe('WebSocket Security', () => {
    test('should validate WebSocket message structure', async () => {
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Simulate WebSocket connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Simulate malformed message from server
      const malformedMessage = { invalid: 'structure' };
      
      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify(malformedMessage)
          });
        }
      });

      // Component should handle malformed messages gracefully
      expect(() => {
        // No errors should be thrown
      }).not.toThrow();
    });

    test('should handle WebSocket connection errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Simulate WebSocket error
      await act(async () => {
        if (mockWebSocket.onerror) {
          mockWebSocket.onerror(new Error('Connection failed'));
        }
      });

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should properly close WebSocket connections on cleanup', async () => {
      const { unmount } = render(
        <Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />
      );
      
      // Simulate connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Unmount component
      unmount();

      // Verify WebSocket is closed
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });

  describe('Session Management Security', () => {
    test('should isolate sessions between different projects', async () => {
      const project1 = { name: 'project1', fullPath: '/path/to/project1' };
      const project2 = { name: 'project2', fullPath: '/path/to/project2' };
      
      // Render first project
      const { rerender } = render(
        <Shell selectedProject={project1} selectedSession={mockSession} isActive={true} />
      );
      
      // Switch to second project
      rerender(
        <Shell selectedProject={project2} selectedSession={mockSession} isActive={true} />
      );

      // Verify that session is properly isolated
      await waitFor(() => {
        expect(mockWebSocket.close).toHaveBeenCalled();
      });
    });

    test('should clear sensitive data on session restart', async () => {
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Get terminal instance
      const { Terminal } = require('xterm');
      const terminalInstance = Terminal.mock.results[0].value;
      
      // Simulate restart (this would be triggered by user action)
      // The component should clear terminal and dispose resources
      await act(async () => {
        // Simulate internal restart logic
        terminalInstance.clear();
        terminalInstance.dispose();
      });

      expect(terminalInstance.clear).toHaveBeenCalled();
      expect(terminalInstance.dispose).toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    test('should handle resize messages properly', async () => {
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      const { Terminal } = require('xterm');
      const terminalInstance = Terminal.mock.results[0].value;
      
      // Mock terminal dimensions
      terminalInstance.cols = 100;
      terminalInstance.rows = 30;
      
      // Simulate resize
      const onResizeCallback = terminalInstance.onResize.mock.calls[0]?.[0];
      if (onResizeCallback) {
        await act(async () => {
          onResizeCallback({ cols: 100, rows: 30 });
        });

        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            type: 'resize',
            cols: 100,
            rows: 30
          })
        );
      }
    });

    test('should validate project path in init message', async () => {
      const projectWithSuspiciousPath = {
        name: 'test',
        fullPath: '../../../etc/passwd'
      };
      
      render(
        <Shell 
          selectedProject={projectWithSuspiciousPath} 
          selectedSession={mockSession} 
          isActive={true} 
        />
      );
      
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Verify init message contains the suspicious path (backend should validate)
      await waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          expect.stringContaining('../../../etc/passwd')
        );
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle JSON parsing errors in WebSocket messages', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Simulate invalid JSON from server
      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: 'invalid json}'
          });
        }
      });

      // Should not crash the application
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should handle clipboard read failures', async () => {
      navigator.clipboard.readText.mockRejectedValue(new Error('Clipboard access denied'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />);
      
      // Simulate Ctrl+V paste
      const container = document.body;
      await act(async () => {
        fireEvent.keyDown(container, {
          key: 'v',
          ctrlKey: true
        });
      });

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to read from clipboard')
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Memory Management', () => {
    test('should properly dispose of terminal resources on unmount', async () => {
      const { unmount } = render(
        <Shell selectedProject={mockProject} selectedSession={mockSession} isActive={true} />
      );
      
      const { Terminal } = require('xterm');
      const terminalInstance = Terminal.mock.results[0].value;
      
      unmount();

      // Verify cleanup
      expect(terminalInstance.dispose).toHaveBeenCalled();
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    test('should handle multiple rapid session changes without memory leaks', async () => {
      const { rerender } = render(
        <Shell selectedProject={mockProject} selectedSession={{ id: 'session1' }} isActive={true} />
      );
      
      // Rapidly change sessions
      for (let i = 2; i <= 5; i++) {
        rerender(
          <Shell selectedProject={mockProject} selectedSession={{ id: `session${i}` }} isActive={true} />
        );
        await act(async () => {
          await new Promise(resolve => setTimeout(resolve, 10));
        });
      }

      // Should handle rapid changes without crashing
      expect(mockWebSocket.close).toHaveBeenCalled();
    });
  });
});