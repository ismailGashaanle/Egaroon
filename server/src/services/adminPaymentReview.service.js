const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');

function assertStaff(actor) {
  if (![ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(actor?.role)) {
    throw ApiError.forbidden();
  }
}

/**
 * List payments for Admin review (captain MM payments, amounts, phones).
 */
async function listPayments(actor, query = {}) {
  assertStaff(actor);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.reviewStatus) filter.adminReviewStatus = query.reviewStatus;
  if (query.provider) filter.provider = query.provider;

  const payments = await Payment.find(filter)
    .populate('payer', 'name email phone role')
    .populate('team', 'name')
    .populate({
      path: 'booking',
      select: 'status startTime endTime stadium field totalPrice bookingCode matchCode',
      populate: [
        { path: 'stadium', select: 'name city' },
        { path: 'field', select: 'name' },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(query.limit) || 100, 300))
    .lean();

  return payments.map((p) => ({
    id: String(p._id),
    amount: p.amount,
    currency: p.currency || 'USD',
    status: p.status,
    provider: p.provider,
    operator: p.operator,
    payerPhone: p.payerPhone || p.msisdn,
    payerName: p.payerName,
    side: p.side,
    coverFullMatch: Boolean(p.coverFullMatch),
    paidAt: p.paidAt,
    createdAt: p.createdAt,
    providerReference: p.providerReference,
    adminReviewStatus: p.adminReviewStatus || 'pending',
    adminReviewedAt: p.adminReviewedAt,
    adminReviewNote: p.adminReviewNote,
    payer: p.payer
      ? { id: String(p.payer._id), name: p.payer.name, email: p.payer.email, phone: p.payer.phone }
      : null,
    team: p.team ? { id: String(p.team._id), name: p.team.name } : null,
    booking: p.booking
      ? {
          id: String(p.booking._id),
          status: p.booking.status,
          startTime: p.booking.startTime,
          endTime: p.booking.endTime,
          stadium: p.booking.stadium?.name,
          field: p.booking.field?.name,
          city: p.booking.stadium?.city,
          bookingCode: p.booking.bookingCode,
        }
      : null,
  }));
}

/**
 * Mark payment reviewed OK or flagged (does not change money amounts — review only).
 */
async function reviewPayment(actor, paymentId, body = {}) {
  assertStaff(actor);
  const status = body.status || body.adminReviewStatus;
  if (!['ok', 'flagged', 'pending'].includes(status)) {
    throw ApiError.badRequest('status must be ok, flagged, or pending');
  }
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');

  payment.adminReviewStatus = status;
  payment.adminReviewedAt = status === 'pending' ? undefined : new Date();
  payment.adminReviewedBy = status === 'pending' ? undefined : actor.id;
  if (body.note != null) {
    payment.adminReviewNote = String(body.note).trim().slice(0, 300);
  }
  await payment.save();

  return {
    id: String(payment._id),
    adminReviewStatus: payment.adminReviewStatus,
    adminReviewedAt: payment.adminReviewedAt,
    adminReviewNote: payment.adminReviewNote,
    status: payment.status,
    amount: payment.amount,
  };
}

module.exports = {
  listPayments,
  reviewPayment,
  PAYMENT_STATUS,
};
