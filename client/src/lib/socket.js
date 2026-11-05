import { io } from 'socket.io-client';

function resolveSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  // In Vite dev, talk to the current origin so /socket.io is proxied.
  if (import.meta.env.DEV && typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:5000';
}

export const SOCKET_URL = resolveSocketUrl();

// Vercel serverless can't host Socket.IO; set VITE_DISABLE_SOCKET=true and the app runs without live updates.
const SOCKET_DISABLED = import.meta.env.VITE_DISABLE_SOCKET === 'true';

const noopSocket = {
  connected: false,
  auth: {},
  connect() {},
  disconnect() {},
  on() { return this; },
  off() { return this; },
  once() { return this; },
  emit() { return this; },
};

let socket = null;

// Lazily creates a single shared socket connection, re-authenticating
// whenever the access token changes (see useSocket / authSlice).
export function getSocket(token) {
  if (SOCKET_DISABLED) return noopSocket;
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: { token },
    });
  } else {
    socket.auth = { token };
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
}
