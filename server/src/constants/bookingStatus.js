// Booking lifecycle state machine.
// AVAILABLE is implicit (no booking document exists for that slot).
const BOOKING_STATUS = {
  HELD: 'HELD', // temporary hold while Team A is invited/paying
  PAYMENT_PENDING: 'PAYMENT_PENDING', // Team A paid, waiting on Team B (or single-team payment)
  CONFIRMED: 'CONFIRMED', // all required payments received
  CHECKED_IN: 'CHECKED_IN', // at least one team checked in via QR
  IN_PROGRESS: 'IN_PROGRESS', // match started
  COMPLETED: 'COMPLETED', // match finished, awaiting settlement
  SETTLED: 'SETTLED', // funds released to owner (minus commission)
  EXPIRED: 'EXPIRED', // hold expired before payment
  CANCELLED: 'CANCELLED', // cancelled by captain/owner/admin before match
  NO_SHOW: 'NO_SHOW', // one or both teams did not check in
  DISPUTED: 'DISPUTED', // under admin review
};

// Valid forward transitions, used for guard checks in the booking service.
const BOOKING_TRANSITIONS = {
  HELD: ['PAYMENT_PENDING', 'EXPIRED', 'CANCELLED'],
  PAYMENT_PENDING: ['CONFIRMED', 'EXPIRED', 'CANCELLED'],
  CONFIRMED: ['CHECKED_IN', 'CANCELLED', 'DISPUTED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'DISPUTED'],
  IN_PROGRESS: ['COMPLETED', 'DISPUTED'],
  COMPLETED: ['SETTLED', 'DISPUTED'],
  SETTLED: [],
  EXPIRED: [],
  CANCELLED: [],
  NO_SHOW: ['DISPUTED', 'SETTLED'],
  DISPUTED: ['SETTLED', 'CANCELLED'],
};

module.exports = { BOOKING_STATUS, BOOKING_TRANSITIONS };
