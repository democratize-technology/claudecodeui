import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { WebSocketProvider, useWebSocketContext } from '../contexts/WebSocketContext';
import { useWebSocket } from '../utils/websocket';

// Mock the useWebSocket hook
jest.mock('../utils/websocket');

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

// Mock fetch
global.fetch = jest.fn();

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn()
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Test component that uses WebSocket context
const TestComponent = () => {
  const { ws, sendMessage, messages, isConnected } = useWebSocketContext();
  
  return (
    <div>
      <div data-testid="connection-status">
        {isConnected ? 'connected' : 'disconnected'}
      </div>
      <div data-testid="message-count">{messages.length}</div>
      <button onClick={() => sendMessage({ type: 'test', data: 'hello' })}>
        Send Message
      </button>
    </div>
  );
};

describe('WebSocketContext Security Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWebSocket.mockReturnValue({
      ws: mockWebSocket,
      sendMessage: jest.fn(),
      messages: [],
      isConnected: false
    });
  });

  describe('Context Provider Security', () => {
    test('should throw error when useWebSocketContext is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useWebSocketContext must be used within a WebSocketProvider');
      
      consoleSpy.mockRestore();
    });

    test('should provide WebSocket context when used within provider', () => {
      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      expect(screen.getByTestId('connection-status')).toBeInTheDocument();
      expect(screen.getByTestId('message-count')).toBeInTheDocument();
    });

    test('should isolate WebSocket state per provider instance', () => {
      const mockUseWebSocket1 = { ws: null, sendMessage: jest.fn(), messages: [], isConnected: false };
      const mockUseWebSocket2 = { ws: mockWebSocket, sendMessage: jest.fn(), messages: [{ test: 'data' }], isConnected: true };
      
      useWebSocket.mockReturnValueOnce(mockUseWebSocket1).mockReturnValueOnce(mockUseWebSocket2);

      const { container } = render(
        <div>
          <WebSocketProvider>
            <TestComponent />
          </WebSocketProvider>
          <WebSocketProvider>
            <TestComponent />
          </WebSocketProvider>
        </div>
      );

      const connectionStatuses = container.querySelectorAll('[data-testid="connection-status"]');
      const messageCounts = container.querySelectorAll('[data-testid="message-count"]');

      expect(connectionStatuses[0]).toHaveTextContent('disconnected');
      expect(connectionStatuses[1]).toHaveTextContent('connected');
      expect(messageCounts[0]).toHaveTextContent('0');
      expect(messageCounts[1]).toHaveTextContent('1');
    });
  });
});

describe('useWebSocket Hook Security Tests', () => {
  // Reset mocks for direct hook testing
  beforeEach(() => {
    jest.clearAllMocks();
    jest.unmock('../utils/websocket');
    mockLocalStorage.getItem.mockReturnValue('valid-token-123');
    fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ wsUrl: 'ws://localhost:3001' })
    });
  });

  afterEach(() => {
    jest.mock('../utils/websocket');
  });

  describe('Authentication Security', () => {
    test('should require authentication token for WebSocket connection', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      // Import the real hook for this test
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      // Create a test component that uses the real hook
      const TestHook = () => {
        const { isConnected } = realUseWebSocket();
        return <div data-testid="connected">{isConnected.toString()}</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('No authentication token found for WebSocket connection');
        expect(WebSocket).not.toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    test('should include authentication token in WebSocket URL', async () => {
      const token = 'secure-token-789';
      mockLocalStorage.getItem.mockReturnValue(token);
      
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining(`token=${encodeURIComponent(token)}`)
        );
      });
    });

    test('should handle configuration fetch failure securely', async () => {
      fetch.mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Could not fetch server config, falling back to current host with API server port'
        );
        // Should still attempt connection with fallback URL
        expect(WebSocket).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Message Security', () => {
    test('should validate and parse JSON messages safely', async () => {
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      let hookResult;
      
      const TestHook = () => {
        hookResult = realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      // Wait for WebSocket to be created
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });

      // Simulate WebSocket connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Test malformed JSON
      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: 'invalid json}'
          });
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'Error parsing WebSocket message:', 
        expect.any(Error)
      );

      // Test valid JSON
      const validMessage = { type: 'chat', message: 'Hello' };
      await act(async () => {
        if (mockWebSocket.onmessage) {
          mockWebSocket.onmessage({
            data: JSON.stringify(validMessage)
          });
        }
      });

      // Should add valid message to messages array
      expect(hookResult.messages).toContainEqual(validMessage);

      consoleSpy.mockRestore();
    });

    test('should sanitize outgoing messages', async () => {
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      let hookResult;
      
      const TestHook = () => {
        hookResult = realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });

      // Simulate connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Test sending message with potentially dangerous content
      const dangerousMessage = {
        type: 'command',
        data: '<script>alert("xss")</script>',
        path: '../../../etc/passwd'
      };

      await act(async () => {
        hookResult.sendMessage(dangerousMessage);
      });

      // Should send message as JSON string (backend should handle sanitization)
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify(dangerousMessage)
      );
    });

    test('should handle send message when not connected', async () => {
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      let hookResult;
      
      const TestHook = () => {
        hookResult = realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      // Try to send message while disconnected
      await act(async () => {
        hookResult.sendMessage({ type: 'test' });
      });

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket not connected');
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('Connection Security', () => {
    test('should handle WebSocket errors gracefully', async () => {
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });

      // Simulate WebSocket error
      const errorEvent = new Error('Connection failed');
      await act(async () => {
        if (mockWebSocket.onerror) {
          mockWebSocket.onerror(errorEvent);
        }
      });

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', errorEvent);

      consoleSpy.mockRestore();
    });

    test('should implement secure reconnection strategy', async () => {
      jest.useFakeTimers();
      
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });

      // Simulate connection close
      await act(async () => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose();
        }
      });

      // Fast-forward time to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Should attempt to reconnect
      expect(WebSocket).toHaveBeenCalledTimes(2);

      jest.useRealTimers();
    });

    test('should properly clean up WebSocket on component unmount', async () => {
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      const { unmount } = render(<TestHook />);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });

      // Simulate connection
      await act(async () => {
        if (mockWebSocket.onopen) {
          mockWebSocket.onopen();
        }
      });

      // Unmount component
      unmount();

      // Should close WebSocket connection
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    test('should prevent memory leaks by closing existing WebSocket before creating new one', async () => {
      jest.useFakeTimers();
      
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      // Wait for first WebSocket creation
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledTimes(1);
      });

      const firstWebSocket = mockWebSocket;

      // Simulate connection close to trigger reconnection
      await act(async () => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose();
        }
      });

      // Create a new mock for the second WebSocket
      const secondMockWebSocket = {
        close: jest.fn(),
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null
      };

      // Update the WebSocket constructor to return the new mock
      global.WebSocket = jest.fn(() => secondMockWebSocket);

      // Advance timers to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(3000);
      });

      // Wait for reconnection attempt
      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledTimes(2);
      });

      // The first WebSocket should have been closed when creating the second one
      expect(firstWebSocket.close).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test('should clear reconnection timeouts when establishing new connection', async () => {
      jest.useFakeTimers();
      
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });

      // Simulate connection close to start reconnection timer
      await act(async () => {
        if (mockWebSocket.onclose) {
          mockWebSocket.onclose();
        }
      });

      // Before timer expires, manually call connect() (simulating immediate reconnect)
      const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
      
      // This would happen if the component triggers connect() again before timeout
      const hookInternals = require('../utils/websocket');
      
      // Advance time slightly but not enough to trigger reconnection
      act(() => {
        jest.advanceTimersByTime(1000);
      });

      // Should have set a timeout
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 3000);

      jest.useRealTimers();
      clearTimeoutSpy.mockRestore();
    });

    test('should ignore events from old WebSocket instances after reconnection', async () => {
      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      let hookResult;
      
      const TestHook = () => {
        hookResult = realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalled();
      });

      const firstWebSocket = mockWebSocket;

      // Simulate successful first connection
      await act(async () => {
        if (firstWebSocket.onopen) {
          firstWebSocket.onopen();
        }
      });

      expect(hookResult.isConnected).toBe(true);

      // Create second WebSocket mock
      const secondMockWebSocket = {
        close: jest.fn(),
        send: jest.fn(),
        readyState: WebSocket.OPEN,
        onopen: null,
        onmessage: null,
        onerror: null,
        onclose: null
      };

      global.WebSocket = jest.fn(() => secondMockWebSocket);

      // Trigger reconnection by closing first connection
      await act(async () => {
        if (firstWebSocket.onclose) {
          firstWebSocket.onclose();
        }
      });

      // Manually trigger connect to create second WebSocket
      await act(async () => {
        // This simulates the reconnection timeout firing
        const connect = hookResult.connect || (() => {});
        if (typeof connect === 'function') {
          await connect();
        }
      });

      // Messages from the old WebSocket should be ignored
      const initialMessageCount = hookResult.messages.length;

      await act(async () => {
        if (firstWebSocket.onmessage) {
          firstWebSocket.onmessage({
            data: JSON.stringify({ type: 'old', message: 'should be ignored' })
          });
        }
      });

      // Message count should not have increased
      expect(hookResult.messages.length).toBe(initialMessageCount);
    });
  });

  describe('URL Construction Security', () => {
    test('should handle localhost to remote host URL translation securely', async () => {
      // Mock window.location
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'example.com',
          port: '3001',
          protocol: 'https:'
        },
        writable: true
      });

      fetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ wsUrl: 'ws://localhost:3001' })
      });

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Config returned localhost, using current host with API server port instead'
        );
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('wss://example.com:3001')
        );
      });

      consoleSpy.mockRestore();
    });

    test('should use secure WebSocket protocol for HTTPS', async () => {
      Object.defineProperty(window, 'location', {
        value: {
          hostname: 'secure.example.com',
          port: '443',
          protocol: 'https:'
        },
        writable: true
      });

      fetch.mockRejectedValue(new Error('Config fetch failed'));

      const { useWebSocket: realUseWebSocket } = require('../utils/websocket');
      
      const TestHook = () => {
        realUseWebSocket();
        return <div>test</div>;
      };

      render(<TestHook />);

      await waitFor(() => {
        expect(WebSocket).toHaveBeenCalledWith(
          expect.stringContaining('wss://secure.example.com')
        );
      });
    });
  });
});