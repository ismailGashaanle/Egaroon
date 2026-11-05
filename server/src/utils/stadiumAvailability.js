const ApiError = require('./ApiError');

/**
 * Stadium owner ops: online / offline (manual or scheduled window).
 * Used by booking + public stadium listing.
 */
function getStadiumOpsStatus(stadium, now = new Date()) {
  if (!stadium) {
    return {
      bookable: false,
      isOnline: false,
      reopenAt: null,
      secondsUntilReopen: null,
      reason: null,
      messageSo: 'Garoonka lama helin',
      messageEn: 'Stadium not found',
    };
  }

  const nowMs = now.getTime();
  const from = stadium.offlineFrom ? new Date(stadium.offlineFrom) : null;
  const until = stadium.offlineUntil ? new Date(stadium.offlineUntil) : null;
  const reason = stadium.offlineReason || null;

  // Scheduled window takes effect even if isOnline was left true
  const inScheduledWindow =
    from && until && !Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime())
      ? nowMs >= from.getTime() && nowMs < until.getTime()
      : false;

  // Manual offline: isOnline === false
  let manuallyOffline = stadium.isOnline === false;
  if (manuallyOffline && until && nowMs >= until.getTime()) {
    // Window ended — treat as open (lazy auto-reopen for booking checks)
    manuallyOffline = false;
  }

  const closed = manuallyOffline || inScheduledWindow;
  if (!closed) {
    return {
      bookable: true,
      isOnline: true,
      reopenAt: null,
      secondsUntilReopen: null,
      reason: null,
      messageSo: null,
      messageEn: null,
      offlineFrom: from ? from.toISOString() : null,
      offlineUntil: until ? until.toISOString() : null,
    };
  }

  const reopenAt = until && !Number.isNaN(until.getTime()) ? until : null;
  const secondsUntilReopen = reopenAt
    ? Math.max(0, Math.ceil((reopenAt.getTime() - nowMs) / 1000))
    : null;

  const reopenLabel = reopenAt
    ? reopenAt.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const messageSo = reopenLabel
    ? `Garoonku wuu xidhan yahay · wuxuu dib u furmayaa ${reopenLabel}. Fadlan dooro stadium kale ama sug.`
    : 'Garoonku wuu xidhan yahay ee dooro stadium kale';

  const messageEn = reopenLabel
    ? `This stadium is closed and reopens at ${reopenLabel}. Please pick another stadium or wait.`
    : 'This stadium is closed. Please choose another stadium.';

  return {
    bookable: false,
    isOnline: false,
    reopenAt: reopenAt ? reopenAt.toISOString() : null,
    secondsUntilReopen,
    reason,
    messageSo,
    messageEn,
    offlineFrom: from ? from.toISOString() : null,
    offlineUntil: until ? until.toISOString() : null,
  };
}

function assertStadiumBookable(stadium, now = new Date()) {
  const ops = getStadiumOpsStatus(stadium, now);
  if (!ops.bookable) {
    throw ApiError.conflict(ops.messageSo || ops.messageEn || 'Stadium is offline', {
      code: 'STADIUM_OFFLINE',
      ...ops,
    });
  }
  return ops;
}

module.exports = {
  getStadiumOpsStatus,
  assertStadiumBookable,
};
