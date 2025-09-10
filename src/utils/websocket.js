import { useState, useEffect, useRef } from 'react';
import { api } from './api';

export function useWebSocket() {
  const [ws, setWs] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectTimeoutRef = useRef(null);
  const wsRef = useRef(null); // Store WebSocket instance for proper cleanup

  useEffect(() => {
    connect();

    return () => {
      // Clear reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      // Close WebSocket using ref (not stale state)
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []); // Empty dependency array is correct with ref-based cleanup

  const connect = async () => {
    try {
      // Clear any existing reconnection timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close existing WebSocket connection if any
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
        setWs(null);
        setIsConnected(false);
      }

      // Get authentication token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        console.warn('No authentication token found for WebSocket connection');
        return;
      }

      // Fetch server configuration to get the correct WebSocket URL
      let wsBaseUrl;
      try {
        const configResponse = await api.config();
        const config = await configResponse.json();
        wsBaseUrl = config.wsUrl;

        // If the config returns localhost but we're not on localhost, use current host but with API server port
        if (wsBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
          console.warn(
            'Config returned localhost, using current host with API server port instead'
          );
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          // For development, API server is typically on port 3002 when Vite is on 3001
          const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
          wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
        }
      } catch (error) {
        console.warn(
          'Could not fetch server config, falling back to current host with API server port'
        );
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // For development, API server is typically on port 3002 when Vite is on 3001
        const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
        wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
      }

      // Include token in WebSocket URL as query parameter
      const wsUrl = `${wsBaseUrl}/ws?token=${encodeURIComponent(token)}`;
      const websocket = new WebSocket(wsUrl);

      // Store WebSocket instance in ref for proper cleanup
      wsRef.current = websocket;

      websocket.onopen = () => {
        // Only update state if this is still the current WebSocket instance
        if (wsRef.current === websocket) {
          setIsConnected(true);
          setWs(websocket);
        }
      };

      websocket.onmessage = (event) => {
        // Only process messages if this is still the current WebSocket instance
        if (wsRef.current === websocket) {
          try {
            const data = JSON.parse(event.data);
            setMessages((prev) => [...prev, data]);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
          }
        }
      };

      websocket.onclose = () => {
        // Only handle close if this is still the current WebSocket instance
        if (wsRef.current === websocket) {
          wsRef.current = null;
          setIsConnected(false);
          setWs(null);

          // Attempt to reconnect after 3 seconds
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, 3000);
        }
      };

      websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Error creating WebSocket connection:', error);
    }
  };

  const sendMessage = (message) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  };

  return {
    ws,
    sendMessage,
    messages,
    isConnected
  };
}
