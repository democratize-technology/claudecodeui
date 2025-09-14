/**
 * WebSocket Mock for Testing
 *
 * Provides a mock WebSocket implementation for testing scenarios.
 * Used in integration tests to prevent real WebSocket connections.
 */

class MockWebSocket {
  constructor(url, protocols) {
    this.url = url;
    this.protocols = protocols;
    this.readyState = MockWebSocket.CONNECTING;
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;

    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      if (this.onopen) {
        this.onopen({ type: 'open', target: this });
      }
    }, 10);
  }

  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Store sent data for testing
    MockWebSocket.lastSentData = data;
  }

  close(code, reason) {
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({ type: 'close', code, reason, target: this });
      }
    }, 10);
  }

  // Test utilities
  static simulateMessage(data) {
    if (MockWebSocket.lastInstance && MockWebSocket.lastInstance.onmessage) {
      MockWebSocket.lastInstance.onmessage({
        type: 'message',
        data,
        target: MockWebSocket.lastInstance
      });
    }
  }

  static simulateError(error) {
    if (MockWebSocket.lastInstance && MockWebSocket.lastInstance.onerror) {
      MockWebSocket.lastInstance.onerror({
        type: 'error',
        error,
        target: MockWebSocket.lastInstance
      });
    }
  }
}

// Track the last instance for testing
MockWebSocket.lastInstance = null;
MockWebSocket.lastSentData = null;

// Override constructor to track instances
const originalConstructor = MockWebSocket;
MockWebSocket = function(...args) {
  const instance = new originalConstructor(...args);
  MockWebSocket.lastInstance = instance;
  return instance;
};

// Copy static properties
Object.assign(MockWebSocket, originalConstructor);
MockWebSocket.prototype = originalConstructor.prototype;

module.exports = MockWebSocket;