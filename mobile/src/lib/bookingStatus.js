/** Booking / payment status helpers for captain mobile UI. */

const PAID = ['SUCCESS', 'HELD', 'SETTLED'];
const CONFIRMED_STATUSES = [
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'SETTLED',
];

export function isPartyPaid(party) {
  return PAID.includes(party?.paymentStatus);
}

export function captainIdOf(party) {
  if (!party?.captain) return null;
  const c = party.captain;
  return String(c._id || c.id || c);
}

export function isConfirmedBooking(status) {
  return CONFIRMED_STATUSES.includes(String(status || '').toUpperCase());
}

/**
 * Somali status copy — match is only “kiraystay” once both sides paid (CONFIRMED+).
 */
export function bookingStatusLabel(booking) {
  const status = String(booking?.status || '').toUpperCase();
  const teamAPaid = isPartyPaid(booking?.teamA);
  const teamBPaid = booking?.teamB ? isPartyPaid(booking.teamB) : false;
  const covered = Boolean(booking?.coveredFullMatch);

  if (['CANCELLED', 'EXPIRED', 'NO_SHOW'].includes(status)) {
    if (status === 'EXPIRED') return 'Waqtigii wuu dhacay';
    if (status === 'CANCELLED') return 'Waa la joojiyay';
    return status;
  }

  if (isConfirmedBooking(status) || (covered && teamAPaid)) {
    return 'Waa la kiraystay';
  }

  if (teamAPaid && booking?.teamB && !teamBPaid) {
    return 'Waa la doortay · sug Team B';
  }

  if (teamAPaid && !booking?.teamB) {
    return 'Waa la doortay · casuum Team B';
  }

  if (['HELD', 'PAYMENT_PENDING'].includes(status)) {
    return 'Waa la doortay · bixi lacagta';
  }

  return status || '—';
}

export function sameUserId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}
