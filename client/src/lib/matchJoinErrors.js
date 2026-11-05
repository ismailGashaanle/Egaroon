/** Somali copy for Match Code join / preview API errors. */
export const MATCH_JOIN_MSGS = {
  MATCH_CODE_NOT_FOUND: 'Ma jiro code-kani',
  TEAM_A_PHONE_MISMATCH: 'Lambarka lacagta laga diray waa khalad',
  MATCH_JOIN_LOCKOUT: 'Isku dayo badan oo khaldan — sug 15 daqiiqo ka dib isku day.',
  MATCH_INVITE_PHONE_LOCKED:
    'Match Code-kan wuxuu u xidhan yahay telefoon kale — isticmaal akoonka Team B la casuumay.',
  MATCH_JOIN_DENIED: 'Match Code ama telefoonka Team A waa khalad. Hubi oo isku day mar kale.',
};

export function apiErrorCode(err) {
  const d = err?.response?.data?.error?.details;
  if (d && typeof d === 'object' && d.code) return d.code;
  return err?.response?.data?.error?.code || null;
}

export function joinMatchErrorMessage(err, fallback = MATCH_JOIN_MSGS.MATCH_JOIN_DENIED) {
  const code = apiErrorCode(err);
  if (code && MATCH_JOIN_MSGS[code]) return MATCH_JOIN_MSGS[code];
  return (
    err?.response?.data?.error?.details?.messageSo ||
    err?.response?.data?.error?.message ||
    err?.message ||
    fallback
  );
}

/**
 * Payment progress from preview booking or full booking detail.
 * Team A paid → ~50%; both paid / coverFull → 100%.
 */
export function matchPaymentProgress(bookingOrPreview) {
  const b = bookingOrPreview?.booking || bookingOrPreview || {};
  const fromApi = b.paymentProgress || bookingOrPreview?.paymentProgress;
  if (fromApi && typeof fromApi.percent === 'number') return fromApi;

  const total = Number(b.pricing?.totalPrice || 0);
  const teamShare = Number(b.pricing?.teamShare ?? (total ? total / 2 : 0));
  const paidStatuses = new Set(['HELD', 'SUCCESS', 'SETTLED']);
  const teamAPaid =
    paidStatuses.has(b.teamA?.paymentStatus) || Boolean(b.teamAPaidAt);
  const teamBPaid = b.coveredFullMatch
    ? true
    : paidStatuses.has(b.teamB?.paymentStatus) || Boolean(b.teamBPaidAt);

  let paidAmount = 0;
  if (teamAPaid) paidAmount += Number(b.teamA?.amountDue ?? teamShare);
  if (b.coveredFullMatch) paidAmount = total;
  else if (teamBPaid) paidAmount += Number(b.teamB?.amountDue ?? teamShare);

  const percent =
    total > 0
      ? Math.min(100, Math.round((paidAmount / total) * 100))
      : teamAPaid && teamBPaid
        ? 100
        : teamAPaid
          ? 50
          : 0;

  return {
    percent,
    paidAmount,
    remainingAmount: Math.max(0, total - paidAmount),
    totalPrice: total,
    teamAPaid,
    teamBPaid: Boolean(teamBPaid),
    currency: b.pricing?.currency || 'USD',
  };
}
