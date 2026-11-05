const ApiError = require('../utils/ApiError');
const {
  loadActiveDiscountsForField,
  pickBestDiscount,
} = require('./discount.service');

/**
 * Server is the only source of truth for price — never trust a price from the client.
 *
 * Per-player (e.g. 7v7 @ $2):
 *   players per side = field.capacity (fixed — cannot book 3 players on a 7v7)
 *   team share       = capacity × pricePerPlayer
 *   total booking    = team share × 2  (full match both sides)
 *
 * Fixed field:
 *   total = fixedPrice (split 50/50 when Team B is on the booking)
 *
 * Discounts (owner rules):
 *   totalPrice = max(0, baseTotal − discountAmount)
 *   teamShare recalculated from discounted total (half each)
 */
function playersPerSide(field) {
  const capacity = Number(field.capacity);
  if (!capacity || capacity < 1) {
    throw ApiError.badRequest('Field capacity is not configured');
  }
  return capacity;
}

function calculatePrice(field, _ignoredPlayersCount) {
  if (field.pricingMode === 'per_player') {
    const perSide = playersPerSide(field);
    const unitPrice = Number(field.pricePerPlayer);
    if (unitPrice == null || Number.isNaN(unitPrice) || unitPrice < 0) {
      throw ApiError.badRequest('pricePerPlayer is not configured for this field');
    }
    const teamShare = Math.round(unitPrice * perSide * 100) / 100;
    const totalPrice = Math.round(teamShare * 2 * 100) / 100;
    return {
      mode: 'per_player',
      unitPrice,
      playersPerSide: perSide,
      teamShare,
      totalPrice,
      currency: field.currency || 'USD',
    };
  }

  return {
    mode: 'fixed',
    unitPrice: field.fixedPrice,
    playersPerSide: playersPerSide(field),
    teamShare: Math.round((Number(field.fixedPrice) / 2) * 100) / 100,
    totalPrice: field.fixedPrice,
    currency: field.currency || 'USD',
  };
}

/**
 * Apply a matched discount to a base price result.
 * Never trusts client-supplied discount amounts.
 */
function applyDiscountToPrice(basePrice, match) {
  const baseTotal = Number(basePrice.totalPrice) || 0;
  if (!match || !match.discountAmount || match.discountAmount <= 0) {
    return {
      ...basePrice,
      baseTotalPrice: baseTotal,
      discountAmount: 0,
      discountPercent: null,
      discountId: null,
      discountName: null,
    };
  }

  const discountAmount = Math.min(
    Math.round(Number(match.discountAmount) * 100) / 100,
    baseTotal
  );
  const totalPrice = Math.max(0, Math.round((baseTotal - discountAmount) * 100) / 100);
  const teamShare = Math.round((totalPrice / 2) * 100) / 100;
  const d = match.discount;
  const discountPercent =
    d?.percentOff != null && Number(d.percentOff) > 0 ? Number(d.percentOff) : null;

  return {
    ...basePrice,
    totalPrice,
    teamShare,
    baseTotalPrice: baseTotal,
    discountAmount,
    discountPercent,
    discountId: d?._id || d?.id || null,
    discountName: d?.name || null,
  };
}

/**
 * Base field price + best matching active discount for this slot start.
 */
async function calculatePriceForSlot({ field, startTime, discounts }) {
  const base = calculatePrice(field);
  const list =
    discounts ||
    (await loadActiveDiscountsForField(field));

  const match = pickBestDiscount(
    list,
    {
      fieldId: field._id,
      stadiumId: field.stadium,
      startTime,
    },
    base.totalPrice
  );

  return applyDiscountToPrice(base, match);
}

function splitBetweenTeams(totalPrice, hasTeamB, teamShareHint) {
  if (!hasTeamB) {
    // Solo hold: Team A is responsible for the full match price until Team B is invited.
    return { teamAShare: totalPrice, teamBShare: 0 };
  }
  if (teamShareHint != null) {
    const share = Math.round(Number(teamShareHint) * 100) / 100;
    return { teamAShare: share, teamBShare: Math.round((totalPrice - share) * 100) / 100 };
  }
  const half = Math.round((totalPrice / 2) * 100) / 100;
  return { teamAShare: half, teamBShare: Math.round((totalPrice - half) * 100) / 100 };
}

function calculateCommission(totalAmount, commissionPercent) {
  const commissionAmount = Math.round(((totalAmount * commissionPercent) / 100) * 100) / 100;
  const ownerPayoutAmount = Math.round((totalAmount - commissionAmount) * 100) / 100;
  return { commissionAmount, ownerPayoutAmount };
}

module.exports = {
  calculatePrice,
  calculatePriceForSlot,
  applyDiscountToPrice,
  splitBetweenTeams,
  calculateCommission,
  playersPerSide,
};
