const Notification = require('../models/Notification');
const Stadium = require('../models/Stadium');
const StadiumManager = require('../models/StadiumManager');

function emitToUser(userId, event, payload) {
  try {
    const { emitUserEvent } = require('../sockets');
    emitUserEvent(userId, event, payload);
  } catch {
    /* sockets optional */
  }
}

function emitStadium(stadiumId, event, payload) {
  try {
    const { emitStadiumUpdate } = require('../sockets');
    emitStadiumUpdate(stadiumId, event, payload);
  } catch {
    /* sockets optional */
  }
}

async function notifyUser({ userId, type, title, body, bookingId, meta, dedupeKey }) {
  if (!userId) return null;

  const key = dedupeKey ? String(dedupeKey).trim() : '';

  if (key) {
    const existing = await Notification.findOne({ user: userId, dedupeKey: key });
    if (existing) return existing;
  }

  try {
    const doc = {
      user: userId,
      type: type || 'GENERAL',
      title,
      body,
      booking: bookingId,
      meta,
    };
    if (key) doc.dedupeKey = key;

    const n = await Notification.create(doc);
    emitToUser(String(userId), 'notification:new', {
      id: n._id,
      type: n.type,
      title: n.title,
      body: n.body,
      bookingId: bookingId || null,
      meta: n.meta,
    });
    return n;
  } catch (err) {
    // Never fail the parent business action (check-in, invite, payment) on notify dupes.
    if (err.code === 11000) {
      if (key) {
        return Notification.findOne({ user: userId, dedupeKey: key });
      }
      console.warn('[notifyUser] E11000 ignored (no dedupeKey)', {
        userId: String(userId),
        type,
        keyValue: err.keyValue,
      });
      return null;
    }
    console.warn('[notifyUser] failed', err.message);
    return null;
  }
}

/** Owner + active managers for a stadium (deduped). */
async function stadiumStaffUserIds(stadiumId) {
  const stadium = await Stadium.findById(stadiumId).select('owner');
  if (!stadium) return [];
  const ids = new Set([String(stadium.owner)]);
  const managers = await StadiumManager.find({ stadium: stadiumId, status: 'active' }).select('user');
  for (const m of managers) {
    if (m.user) ids.add(String(m.user));
  }
  return [...ids];
}

/**
 * One notification per staff user per dedupeKey (idempotent).
 * Also emits socketEvent to each user room + stadium room (near-real-time).
 * Titles/bodies should be Somali-friendly short strings.
 *
 * @param {object} opts
 * @param {string} [opts.socketEvent] e.g. booking:created | booking:confirmed | match:started
 */
async function notifyStadiumStaff({
  stadiumId,
  type,
  title,
  body,
  bookingId,
  meta,
  eventKey,
  socketEvent,
}) {
  const userIds = await stadiumStaffUserIds(stadiumId);
  const results = [];
  const socketPayload = {
    stadiumId: String(stadiumId),
    bookingId: bookingId ? String(bookingId) : null,
    type: type || 'GENERAL',
    title,
    body,
    meta: { ...meta, eventKey },
    at: new Date().toISOString(),
  };

  for (const userId of userIds) {
    const dedupeKey = eventKey ? `${eventKey}:${userId}` : undefined;
    const n = await notifyUser({
      userId,
      type,
      title,
      body,
      bookingId,
      meta: { ...meta, eventKey },
      dedupeKey,
    });
    if (n) results.push(n);
    if (socketEvent) {
      emitToUser(userId, socketEvent, socketPayload);
    }
  }

  if (socketEvent) {
    emitStadium(stadiumId, socketEvent, socketPayload);
  }

  return results;
}

/**
 * Notify owner + managers that a match started (gate check-in or scheduler).
 * Idempotent via eventKey match_started:<bookingId>.
 */
async function notifyMatchStarted({ stadiumId, bookingId, stadiumName, fieldName }) {
  const place = [stadiumName, fieldName].filter(Boolean).join(' · ') || 'Garoon';
  return notifyStadiumStaff({
    stadiumId,
    type: 'MATCH_STARTED',
    title: 'Ciyaarta waa bilowday',
    body: `${place}: check-in / IN_PROGRESS.`,
    bookingId,
    eventKey: `match_started:${bookingId}`,
    socketEvent: 'match:started',
    meta: { fieldName, stadiumName },
  });
}

async function listForUser(userId, { limit = 50 } = {}) {
  return Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(limit);
}

async function markRead(notificationId, userId) {
  const n = await Notification.findOne({ _id: notificationId, user: userId });
  if (!n) return null;
  n.readAt = new Date();
  await n.save();
  return n;
}

module.exports = {
  notifyUser,
  notifyStadiumStaff,
  notifyMatchStarted,
  stadiumStaffUserIds,
  listForUser,
  markRead,
};
