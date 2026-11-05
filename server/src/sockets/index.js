const { Server } = require('socket.io');
const { verifyAccessToken } = require('../utils/tokens');
const env = require('../config/env');

let io = null;

function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (token) {
        const payload = verifyAccessToken(token);
        socket.userId = payload.sub;
        socket.userRole = payload.role;
      }
    } catch (_err) {
      next(); // allow anonymous connections (e.g. public availability updates)
      return;
    }
    next();
  });

  io.on('connection', (socket) => {
    if (socket.userId) {
      socket.join(`user:${socket.userId}`);
    }

    // Clients join a room per field to get live availability/booking updates.
    socket.on('field:subscribe', (fieldId) => {
      if (fieldId) socket.join(`field:${fieldId}`);
    });
    socket.on('field:unsubscribe', (fieldId) => {
      if (fieldId) socket.leave(`field:${fieldId}`);
    });

    socket.on('stadium:subscribe', (stadiumId) => {
      if (stadiumId) socket.join(`stadium:${stadiumId}`);
    });
    socket.on('stadium:unsubscribe', (stadiumId) => {
      if (stadiumId) socket.leave(`stadium:${stadiumId}`);
    });

    socket.on('booking:subscribe', (bookingId) => {
      if (bookingId) socket.join(`booking:${bookingId}`);
    });
    socket.on('booking:unsubscribe', (bookingId) => {
      if (bookingId) socket.leave(`booking:${bookingId}`);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.IO has not been initialized yet');
  return io;
}

// Call this after any booking create/update/cancel so subscribed clients
// immediately see the slot's new state without polling.
function emitFieldUpdate(fieldId, event, payload) {
  if (!io || !fieldId) return;
  io.to(`field:${fieldId}`).emit(event, payload);
}

function emitStadiumUpdate(stadiumId, event, payload) {
  if (!io || !stadiumId) return;
  io.to(`stadium:${stadiumId}`).emit(event, payload);
}

function emitUserEvent(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${userId}`).emit(event, payload);
}

module.exports = {
  initSockets,
  getIO,
  emitFieldUpdate,
  emitStadiumUpdate,
  emitUserEvent,
};
