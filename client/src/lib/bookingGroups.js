// Buckets the backend's fine-grained booking lifecycle statuses into the
// simple Upcoming / Completed / Cancelled groups used across the captain UI
// (dashboard stats, My Bookings tabs). Kept separate from statusStyles.js,
// which groups statuses for badge coloring, not lifecycle categorization.
export const BOOKING_GROUP = {
  HELD: 'upcoming',
  PAYMENT_PENDING: 'upcoming',
  CONFIRMED: 'upcoming',
  CHECKED_IN: 'upcoming',
  IN_PROGRESS: 'upcoming',
  COMPLETED: 'completed',
  SETTLED: 'completed',
  EXPIRED: 'cancelled',
  CANCELLED: 'cancelled',
  NO_SHOW: 'cancelled',
  DISPUTED: 'cancelled',
};

/** An unpaid hold whose timer ran out is already released, even if the server hasn't swept it yet. */
export function isHoldExpired(booking, now = Date.now()) {
  return (
    booking?.status === 'HELD' &&
    booking?.holdExpiresAt &&
    new Date(booking.holdExpiresAt).getTime() < now
  );
}

export function groupForBooking(booking) {
  if (isHoldExpired(booking)) return 'cancelled';
  return BOOKING_GROUP[booking?.status] || 'upcoming';
}

export function groupBookings(bookings = []) {
  return {
    upcoming: bookings.filter((b) => groupForBooking(b) === 'upcoming'),
    completed: bookings.filter((b) => groupForBooking(b) === 'completed'),
    cancelled: bookings.filter((b) => groupForBooking(b) === 'cancelled'),
  };
}
