import { io } from 'socket.io-client';
import { API_BASE_URL, getAccessToken } from '../api/client';

function resolveSocketUrl() {
  if (process.env.EXPO_PUBLIC_SOCKET_URL) return process.env.EXPO_PUBLIC_SOCKET_URL;
  // API is …/api — Socket.IO mounts on the same host root
  return String(API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
}

export const SOCKET_URL = resolveSocketUrl();

let socket = null;

export function getSocket(token) {
  const authToken = token || getAccessToken();
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      auth: { token: authToken },
    });
  } else if (authToken) {
    socket.auth = { token: authToken };
  }
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
