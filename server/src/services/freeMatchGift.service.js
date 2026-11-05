const crypto = require('crypto');
const FreeMatchCampaign = require('../models/FreeMatchCampaign');
const FreeMatchEntry = require('../models/FreeMatchEntry');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Team = require('../models/Team');
const ApiError = require('../utils/ApiError');
const { BOOKING_STATUS } = require('../constants/bookingStatus');
const { PAYMENT_STATUS } = require('../constants/paymentStatus');
const { emitFieldUpdate } = require('../sockets');
const { getBusiness } = require('./platformSettings.service');

function assertGiftFeatureEnabled() {
  if (!getBusiness().giftEnabled) {
    throw ApiError.forbidden(
      'Free match gifts are disabled by platform settings (giftEnabled=false)'
    );
  }
}

function normalizeGeo(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  return s || null;
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function geoMatches(campaign, city, region) {
  const cCity = normalizeGeo(campaign.city);
  const cRegion = normalizeGeo(campaign.region);
  if (!cCity && !cRegion) return true;
  const uCity = normalizeGeo(city);
  const uRegion = normalizeGeo(region);
  if (cCity && (!uCity || uCity.toLowerCase() !== cCity.toLowerCase())) return false;
  if (cRegion && (!uRegion || uRegion.toLowerCase() !== cRegion.toLowerCase())) return false;
  return true;
}

function generateVoucherCode() {
  const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `FREE-${raw.slice(0, 4)}-${raw.slice(4, 8)}`;
}

function serializeCampaign(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    _id: o._id,
    name: o.name,
    city: o.city || null,
    region: o.region || null,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    maxWinners: o.maxWinners,
    winnersCount: o.winnersCount || 0,
    remainingWinners: Math.max(0, (o.maxWinners || 0) - (o.winnersCount || 0)),
    winRatePercent: o.winRatePercent,
    status: o.status,
    notes: o.notes || null,
    createdBy: o.createdBy,
    endedAt: o.endedAt || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function serializeEntry(doc) {
  const o = doc.toObject ? doc.toObject() : doc;
  return {
    id: String(o._id),
    _id: o._id,
    campaign: o.campaign,
    user: o.user,
    team: o.team || null,
    won: Boolean(o.won),
    voucherCode: o.voucherCode || null,
    voucherStatus: o.voucherStatus,
    usedAt: o.usedAt || null,
    booking: o.booking || null,
    enteredAt: o.enteredAt,
  };
}

async function createCampaign(adminId, body = {}) {
  const name = String(body.name || '').trim();
  if (!name) throw ApiError.badRequest('name is required');

  const startsAt = body.startsAt ? new Date(body.startsAt) : new Date();
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (!endsAt || Number.isNaN(endsAt.getTime())) {
    throw ApiError.badRequest('endsAt is required (ISO date)');
  }
  if (Number.isNaN(startsAt.getTime()) || startsAt >= endsAt) {
    throw ApiError.badRequest('startsAt must be before endsAt');
  }

  const maxWinners = Number(body.maxWinners);
  if (!Number.isFinite(maxWinners) || maxWinners < 1) {
    throw ApiError.badRequest('maxWinners must be >= 1');
  }

  const winRatePercent = body.winRatePercent != null ? Number(body.winRatePercent) : 10;
  if (!Number.isFinite(winRatePercent) || winRatePercent < 0 || winRatePercent > 100) {
    throw ApiError.badRequest('winRatePercent must be 0–100');
  }

  const status = body.status === 'draft' ? 'draft' : 'active';

  const campaign = await FreeMatchCampaign.create({
    name,
    city: normalizeGeo(body.city),
    region: normalizeGeo(body.region),
    startsAt,
    endsAt,
    maxWinners,
    winnersCount: 0,
    winRatePercent,
    status,
    createdBy: adminId,
    notes: body.notes ? String(body.notes).trim() : undefined,
  });

  return serializeCampaign(campaign);
}

async function listCampaigns(query = {}) {
  const filter = {};
  if (query.status) filter.status = String(query.status);
  if (query.city) filter.city = new RegExp(`^${escapeRe(String(query.city).trim())}$`, 'i');
  if (query.region) filter.region = new RegExp(`^${escapeRe(String(query.region).trim())}$`, 'i');

  const rows = await FreeMatchCampaign.find(filter).sort({ createdAt: -1 }).limit(100).lean();
  return rows.map(serializeCampaign);
}

async function endCampaign(campaignId) {
  const campaign = await FreeMatchCampaign.findById(campaignId);
  if (!campaign) throw ApiError.notFound('Campaign not found');
  if (campaign.status === 'ended') return serializeCampaign(campaign);
  campaign.status = 'ended';
  campaign.endedAt = new Date();
  await campaign.save();
  return serializeCampaign(campaign);
}

async function activateCampaign(campaignId) {
  const campaign = await FreeMatchCampaign.findById(campaignId);
  if (!campaign) throw ApiError.notFound('Campaign not found');
  if (campaign.status === 'ended') {
    throw ApiError.conflict('Cannot reactivate an ended campaign');
  }
  campaign.status = 'active';
  await campaign.save();
  return serializeCampaign(campaign);
}

/**
 * Live campaigns visible to a captain based on their team city/region
 * (or platform-wide when campaign has no geo).
 * When giftEnabled=false, returns empty so captains cannot enter.
 */
async function listActiveForCaptain(userId) {
  if (!getBusiness().giftEnabled) {
    return { campaigns: [], teams: [] };
  }

  const now = new Date();
  const teams = await Team.find({ captain: userId }).select('city region name').lean();
  const campaigns = await FreeMatchCampaign.find({
    status: 'active',
    startsAt: { $lte: now },
    endsAt: { $gte: now },
  })
    .sort({ endsAt: 1 })
    .lean();

  const entries = await FreeMatchEntry.find({
    user: userId,
    campaign: { $in: campaigns.map((c) => c._id) },
  }).lean();
  const entryByCampaign = new Map(entries.map((e) => [String(e.campaign), e]));

  const visible = [];
  for (const c of campaigns) {
    const scoped = normalizeGeo(c.city) || normalizeGeo(c.region);
    let eligible = !scoped;
    if (scoped) {
      eligible = teams.some((t) => geoMatches(c, t.city, t.region));
    }
    if (!eligible) continue;

    const entry = entryByCampaign.get(String(c._id));
    visible.push({
      ...serializeCampaign(c),
      alreadyEntered: Boolean(entry),
      myEntry: entry ? serializeEntry(entry) : null,
    });
  }

  return { campaigns: visible, teams };
}

/**
 * Instant lottery on enter. One entry per user per campaign.
 * Secure random via crypto.randomInt; winners capped with atomic increment.
 */
async function enterCampaign({ userId, campaignId, teamId }) {
  assertGiftFeatureEnabled();

  const campaign = await FreeMatchCampaign.findById(campaignId);
  if (!campaign) throw ApiError.notFound('Campaign not found');

  const now = new Date();
  if (campaign.status !== 'active') {
    throw ApiError.conflict('Campaign is not active');
  }
  if (campaign.startsAt > now || campaign.endsAt < now) {
    throw ApiError.conflict('Campaign is outside its active window');
  }

  const teams = await Team.find({ captain: userId }).select('_id city region name').lean();
  if (!teams.length) {
    throw ApiError.badRequest('Create a team before entering the gift draw');
  }

  let team = null;
  if (teamId) {
    team = teams.find((t) => String(t._id) === String(teamId));
    if (!team) throw ApiError.forbidden('Team not found or not yours');
  } else {
    team = teams[0];
  }

  if (!geoMatches(campaign, team.city, team.region)) {
    throw ApiError.forbidden(
      'Your team city/region does not match this campaign. Update team location or pick another campaign.'
    );
  }

  const existing = await FreeMatchEntry.findOne({ campaign: campaign._id, user: userId });
  if (existing) {
    throw ApiError.conflict('You already entered this campaign', {
      code: 'ALREADY_ENTERED',
      entry: serializeEntry(existing),
    });
  }

  const remaining = Math.max(0, campaign.maxWinners - (campaign.winnersCount || 0));
  let won = false;
  if (remaining > 0 && Number(campaign.winRatePercent) > 0) {
    const roll = crypto.randomInt(0, 10000);
    const threshold = Math.round(Number(campaign.winRatePercent) * 100);
    won = roll < threshold;
  }

  let voucherCode = null;
  let voucherStatus = 'none';

  if (won) {
    const claimed = await FreeMatchCampaign.findOneAndUpdate(
      {
        _id: campaign._id,
        status: 'active',
        winnersCount: { $lt: campaign.maxWinners },
      },
      { $inc: { winnersCount: 1 } },
      { returnDocument: 'after' }
    );
    if (!claimed) {
      won = false;
    } else {
      voucherCode = generateVoucherCode();
      voucherStatus = 'issued';
    }
  }

  let entry;
  try {
    entry = await FreeMatchEntry.create({
      campaign: campaign._id,
      user: userId,
      team: team._id,
      won,
      voucherCode: voucherCode || undefined,
      voucherStatus,
      enteredAt: now,
    });
  } catch (err) {
    if (err && err.code === 11000) {
      const again = await FreeMatchEntry.findOne({ campaign: campaign._id, user: userId });
      throw ApiError.conflict('You already entered this campaign', {
        code: 'ALREADY_ENTERED',
        entry: again ? serializeEntry(again) : null,
      });
    }
    if (won && voucherCode) {
      await FreeMatchCampaign.updateOne({ _id: campaign._id }, { $inc: { winnersCount: -1 } });
    }
    throw err;
  }

  return {
    won,
    entry: serializeEntry(entry),
    campaign: serializeCampaign(
      (await FreeMatchCampaign.findById(campaign._id).lean()) || campaign
    ),
    message: won
      ? 'Congratulations! You won a free match voucher.'
      : 'Thanks for entering — better luck next time.',
  };
}

async function listMyVouchers(userId) {
  if (!getBusiness().giftEnabled) return [];

  const entries = await FreeMatchEntry.find({
    user: userId,
    won: true,
    voucherStatus: { $in: ['issued', 'redeemed'] },
  })
    .populate('campaign', 'name city region endsAt status')
    .sort({ createdAt: -1 })
    .lean();

  return entries.map((e) => ({
    ...serializeEntry(e),
    campaign: e.campaign
      ? {
          id: String(e.campaign._id),
          name: e.campaign.name,
          city: e.campaign.city || null,
          region: e.campaign.region || null,
          endsAt: e.campaign.endsAt,
          status: e.campaign.status,
        }
      : null,
  }));
}

async function findIssuedVoucher(code, userId) {
  assertGiftFeatureEnabled();

  const normalized = String(code || '')
    .trim()
    .toUpperCase();
  if (!normalized) throw ApiError.badRequest('voucherCode is required');

  const entry = await FreeMatchEntry.findOne({
    voucherCode: normalized,
    user: userId,
    won: true,
  }).populate('campaign');

  if (!entry) throw ApiError.notFound('Voucher not found');
  if (entry.voucherStatus === 'redeemed') {
    throw ApiError.conflict('Voucher already redeemed');
  }
  if (entry.voucherStatus !== 'issued') {
    throw ApiError.conflict('Voucher is not redeemable');
  }

  const campaign = entry.campaign;
  if (!campaign) throw ApiError.notFound('Campaign missing for voucher');

  return { entry, campaign, code: normalized };
}

/**
 * Apply 100% gift voucher to a HELD/PAYMENT_PENDING booking owned by the captain.
 * Backend SoT: zeroes pricing + amountDue, marks coveredFullMatch, creates gift payment, confirms.
 */
async function redeemVoucherOnBooking({ userId, bookingId, voucherCode }) {
  assertGiftFeatureEnabled();

  const { entry, campaign, code } = await findIssuedVoucher(voucherCode, userId);

  const booking = await Booking.findById(bookingId).populate('stadium', 'city region name');
  if (!booking) throw ApiError.notFound('Booking not found');

  const captainId = (booking.teamA?.captain?._id || booking.teamA?.captain)?.toString?.();
  if (captainId !== String(userId)) {
    throw ApiError.forbidden('Only Team A captain can redeem a free-match voucher on this booking');
  }

  if (![BOOKING_STATUS.HELD, BOOKING_STATUS.PAYMENT_PENDING].includes(booking.status)) {
    throw ApiError.conflict('Voucher can only be redeemed on an open hold / payment-pending booking');
  }
  if (booking.holdExpiresAt && booking.holdExpiresAt < new Date()) {
    throw ApiError.conflict('Hold expired — book a new slot then redeem');
  }
  if (booking.coveredFullMatch || booking.teamA?.paymentStatus === PAYMENT_STATUS.HELD) {
    throw ApiError.conflict('Booking is already paid');
  }

  const stadiumCity = booking.stadium?.city;
  const stadiumRegion = booking.stadium?.region;
  if (!geoMatches(campaign, stadiumCity, stadiumRegion)) {
    throw ApiError.forbidden(
      `This voucher is for ${[campaign.city, campaign.region].filter(Boolean).join(' / ') || 'selected regions'} — stadium does not match`
    );
  }

  const baseTotal =
    Number(booking.pricing?.baseTotalPrice) || Number(booking.pricing?.totalPrice) || 0;

  booking.pricing.baseTotalPrice = baseTotal;
  booking.pricing.discountAmount = baseTotal;
  booking.pricing.discountPercent = 100;
  booking.pricing.discountName = `Free match gift (${code})`;
  booking.pricing.discountId = undefined;
  booking.pricing.totalPrice = 0;
  booking.pricing.teamShare = 0;
  booking.teamA.amountDue = 0;
  if (booking.teamB) booking.teamB.amountDue = 0;
  booking.coveredFullMatch = true;
  booking.teamA.paymentStatus = PAYMENT_STATUS.HELD;
  if (booking.teamB) booking.teamB.paymentStatus = PAYMENT_STATUS.HELD;
  booking.teamAPaidAt = new Date();
  booking.status = BOOKING_STATUS.CONFIRMED;
  booking.holdExpiresAt = undefined;
  booking.commissionPercent = booking.commissionPercent ?? 0;
  booking.commissionAmount = 0;
  booking.ownerPayoutAmount = 0;

  await booking.save();

  await Payment.create({
    booking: booking._id,
    team: booking.teamA.team,
    payer: userId,
    side: 'teamA',
    amount: 0,
    currency: booking.pricing.currency || 'USD',
    status: PAYMENT_STATUS.HELD,
    provider: 'gift_voucher',
    providerReference: code,
    idempotencyKey: `gift:${code}:${booking._id}`,
    coverFullMatch: true,
    paidAt: new Date(),
    commissionPercent: 0,
    commissionAmount: 0,
    netToOwner: 0,
  });

  entry.voucherStatus = 'redeemed';
  entry.usedAt = new Date();
  entry.booking = booking._id;
  await entry.save();

  try {
    emitFieldUpdate(String(booking.field), 'booking:updated', {
      bookingId: booking._id,
      status: booking.status,
    });
  } catch {
    /* non-fatal */
  }

  return {
    booking,
    entry: serializeEntry(entry),
    message: 'Free match voucher applied — booking confirmed at $0.',
  };
}

async function previewVoucher({ userId, voucherCode }) {
  const { entry, campaign, code } = await findIssuedVoucher(voucherCode, userId);
  return {
    code,
    valid: true,
    entry: serializeEntry(entry),
    campaign: serializeCampaign(campaign),
  };
}

module.exports = {
  createCampaign,
  listCampaigns,
  endCampaign,
  activateCampaign,
  listActiveForCaptain,
  enterCampaign,
  listMyVouchers,
  redeemVoucherOnBooking,
  previewVoucher,
  geoMatches,
  serializeCampaign,
  serializeEntry,
  assertGiftFeatureEnabled,
};
