import React, { createContext, useContext, useEffect } from 'react';
import { useWebSocket } from '../utils/websocket';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const useWebSocketContext = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within a WebSocketProvider');
  }
  return context;
};

export const WebSocketProvider = ({ children }) => {
  const webSocketData = useWebSocket();
  const { user, token, isLoading: authLoading } = useAuth();

  // Connect WebSocket when user logs in
  useEffect(() => {
    if (!authLoading && user && token && !webSocketData.isConnected) {
      webSocketData.connect();
    }
  }, [user, token, authLoading, webSocketData.isConnected, webSocketData.connect]);

  return <WebSocketContext.Provider value={webSocketData}>{children}</WebSocketContext.Provider>;
};

export default WebSocketContext;
