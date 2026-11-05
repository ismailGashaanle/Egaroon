const ApiError = require('./ApiError');

/**
 * Field owner ops: online / offline (manual or scheduled window).
 * Parallel to stadium ops — does not replace AvailabilityBlock time locks.
 */
function getFieldOpsStatus(field, now = new Date()) {
  if (!field) {
    return {
      bookable: false,
      isOnline: false,
      reopenAt: null,
      secondsUntilReopen: null,
      reason: null,
      messageSo: 'Field-ka lama helin',
      messageEn: 'Field not found',
      scope: 'field',
    };
  }

  const nowMs = now.getTime();
  const from = field.offlineFrom ? new Date(field.offlineFrom) : null;
  const until = field.offlineUntil ? new Date(field.offlineUntil) : null;
  const reason = field.offlineReason || null;

  const inScheduledWindow =
    from && until && !Number.isNaN(from.getTime()) && !Number.isNaN(until.getTime())
      ? nowMs >= from.getTime() && nowMs < until.getTime()
      : false;

  let manuallyOffline = field.isOnline === false;
  if (manuallyOffline && until && nowMs >= until.getTime()) {
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
      scope: 'field',
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

  const fieldName = field.name ? String(field.name).trim() : null;
  const nameBit = fieldName ? ` (${fieldName})` : '';

  const messageSo = reopenLabel
    ? `Field-kan${nameBit} wuu xidhan yahay · wuxuu dib u furmayaa ${reopenLabel}. Fadlan dooro field kale ama sug.`
    : `Field-kan${nameBit} wuu xidhan yahay ee dooro field kale`;

  const messageEn = reopenLabel
    ? `This field${nameBit} is closed and reopens at ${reopenLabel}. Please pick another field or wait.`
    : `This field${nameBit} is closed. Please choose another field.`;

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
    scope: 'field',
  };
}

function assertFieldBookable(field, now = new Date()) {
  const ops = getFieldOpsStatus(field, now);
  if (!ops.bookable) {
    throw ApiError.conflict(ops.messageSo || ops.messageEn || 'Field is offline', {
      code: 'FIELD_OFFLINE',
      ...ops,
    });
  }
  return ops;
}

/**
 * Stadium offline blocks all fields; field offline blocks only that field.
 * Check stadium first so captains see stadium-level Somali copy when whole venue is closed.
 */
function assertStadiumAndFieldBookable(stadium, field, now = new Date()) {
  const { assertStadiumBookable } = require('./stadiumAvailability');
  assertStadiumBookable(stadium, now);
  return assertFieldBookable(field, now);
}

function attachFieldOps(field) {
  if (!field) return field;
  const obj = typeof field.toObject === 'function' ? field.toObject() : { ...field };
  obj.ops = getFieldOpsStatus(obj);
  return obj;
}

module.exports = {
  getFieldOpsStatus,
  assertFieldBookable,
  assertStadiumAndFieldBookable,
  attachFieldOps,
};
