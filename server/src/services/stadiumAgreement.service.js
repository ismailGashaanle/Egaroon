const Stadium = require('../models/Stadium');
const StadiumAgreement = require('../models/StadiumAgreement');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { AGREEMENT_STATUS } = require('../constants/revenue');
const { recordAudit } = require('./auditLog.service');
const { notifyUser } = require('./notification.service');
const {
  policyFromBusiness,
  rulesFromPolicy,
  validateRulesAgainstPolicy,
  policyPreview,
} = require('./revenuePolicy.service');

function moneyRound(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function toPublic(doc) {
  if (!doc) return null;
  const o = doc.toObject ? doc.toObject() : { ...doc };
  return {
    id: o._id,
    stadium: o.stadium,
    version: o.version,
    status: o.status,
    rules: o.rules,
    notes: o.notes,
    effectiveFrom: o.effectiveFrom,
    effectiveTo: o.effectiveTo,
    createdBy: o.createdBy,
    sentAt: o.sentAt,
    acceptedAt: o.acceptedAt,
    acceptedBy: o.acceptedBy,
    rejectedAt: o.rejectedAt,
    rejectReason: o.rejectReason,
    supersededBy: o.supersededBy,
    supersedes: o.supersedes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function mergeRules(bodyRules, policy) {
  const base = rulesFromPolicy(policy, bodyRules?.model);
  if (!bodyRules) return base;
  const next = { ...base };
  const keys = [
    'model',
    'bookingFeeEnabled',
    'bookingFeeAmount',
    'bookingFeeCurrency',
    'bookingFeePayer',
    'subscriptionEnabled',
    'subscriptionAmount',
    'subscriptionCurrency',
    'subscriptionScope',
    'commissionEnabled',
    'commissionPercent',
    'sllPerUsd',
  ];
  for (const key of keys) {
    if (bodyRules[key] !== undefined && bodyRules[key] !== null && bodyRules[key] !== '') {
      next[key] = bodyRules[key];
    }
  }
  if (typeof next.bookingFeeEnabled === 'string') next.bookingFeeEnabled = next.bookingFeeEnabled === 'true';
  next.bookingFeeEnabled = Boolean(next.bookingFeeEnabled);
  next.subscriptionEnabled = Boolean(next.subscriptionEnabled);
  next.commissionEnabled = Boolean(next.commissionEnabled);
  next.bookingFeeAmount = moneyRound(next.bookingFeeAmount);
  next.subscriptionAmount = moneyRound(next.subscriptionAmount);
  next.commissionPercent = Number(next.commissionPercent);
  next.sllPerUsd = Number(next.sllPerUsd);
  validateRulesAgainstPolicy(next, policy);
  return next;
}

async function listAgreements(query = {}) {
  const filter = {};
  if (query.stadiumId) filter.stadium = query.stadiumId;
  if (query.status) filter.status = query.status;
  const rows = await StadiumAgreement.find(filter)
    .sort({ updatedAt: -1 })
    .limit(500)
    .populate('stadium', 'name city status owner')
    .lean();
  return rows.map((r) => ({
    ...toPublic(r),
    stadiumName: r.stadium?.name,
    stadiumCity: r.stadium?.city,
    stadiumStatus: r.stadium?.status,
  }));
}

async function getAgreement(id) {
  const doc = await StadiumAgreement.findById(id).populate('stadium', 'name city status owner');
  if (!doc) throw ApiError.notFound('Stadium agreement not found');
  return toPublic(doc);
}

async function createAgreement({ actorId, stadiumId, rules, notes, effectiveFrom, send = false }) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');

  const policy = policyFromBusiness();
  const merged = mergeRules(rules, policy);
  const last = await StadiumAgreement.findOne({ stadium: stadiumId }).sort({ version: -1 });
  const version = last ? last.version + 1 : 1;

  const doc = await StadiumAgreement.create({
    stadium: stadiumId,
    version,
    status: send ? AGREEMENT_STATUS.PENDING_ACCEPTANCE : AGREEMENT_STATUS.DRAFT,
    rules: merged,
    notes,
    effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
    createdBy: actorId,
    sentAt: send ? new Date() : undefined,
    sentBy: send ? actorId : undefined,
    policySnapshot: policyPreview(policy),
    supersedes: last?._id,
  });

  await recordAudit({
    actorId,
    action: send ? 'stadium_agreement.create_and_send' : 'stadium_agreement.create',
    entityType: 'StadiumAgreement',
    entityId: doc._id,
    after: toPublic(doc),
  });

  if (send) {
    await notifyOwner(stadium, doc);
  }

  return toPublic(doc);
}

async function sendAgreement({ actorId, agreementId }) {
  const doc = await StadiumAgreement.findById(agreementId);
  if (!doc) throw ApiError.notFound('Stadium agreement not found');
  if (![AGREEMENT_STATUS.DRAFT, AGREEMENT_STATUS.REJECTED].includes(doc.status)) {
    throw ApiError.conflict('Only draft or rejected agreements can be sent for acceptance');
  }
  const policy = policyFromBusiness();
  validateRulesAgainstPolicy(doc.rules, policy);
  doc.status = AGREEMENT_STATUS.PENDING_ACCEPTANCE;
  doc.sentAt = new Date();
  doc.sentBy = actorId;
  await doc.save();

  const stadium = await Stadium.findById(doc.stadium);
  await notifyOwner(stadium, doc);
  await recordAudit({
    actorId,
    action: 'stadium_agreement.send',
    entityType: 'StadiumAgreement',
    entityId: doc._id,
    after: { status: doc.status },
  });
  return toPublic(doc);
}

async function suspendAgreement({ actorId, agreementId, note }) {
  const doc = await StadiumAgreement.findById(agreementId);
  if (!doc) throw ApiError.notFound('Stadium agreement not found');
  if (doc.status !== AGREEMENT_STATUS.ACTIVE) {
    throw ApiError.conflict('Only an active agreement can be suspended');
  }
  doc.status = AGREEMENT_STATUS.SUSPENDED;
  if (note) doc.notes = [doc.notes, note].filter(Boolean).join('\n');
  await doc.save();
  await recordAudit({
    actorId,
    action: 'stadium_agreement.suspend',
    entityType: 'StadiumAgreement',
    entityId: doc._id,
    after: { status: doc.status, note },
  });
  return toPublic(doc);
}

async function createVersionFromActive({ actorId, agreementId, rules, notes, effectiveFrom, send = true }) {
  const current = await StadiumAgreement.findById(agreementId);
  if (!current) throw ApiError.notFound('Stadium agreement not found');
  if (![AGREEMENT_STATUS.ACTIVE, AGREEMENT_STATUS.SUSPENDED].includes(current.status)) {
    throw ApiError.conflict('New versions start from an active or suspended agreement');
  }
  return createAgreement({
    actorId,
    stadiumId: current.stadium,
    rules: { ...current.rules.toObject?.() || current.rules, ...rules },
    notes: notes || `Version of agreement ${current._id}`,
    effectiveFrom,
    send,
  });
}

async function notifyOwner(stadium, agreement) {
  if (!stadium?.owner) return;
  try {
    await notifyUser({
      userId: stadium.owner,
      type: 'GENERAL',
      title: 'Heshiis cusub / New stadium agreement',
      body: `${stadium.name}: review and accept the E-Garoon revenue agreement (v${agreement.version}) before it applies to new bookings.`,
      meta: { agreementId: String(agreement._id), stadiumId: String(stadium._id) },
      dedupeKey: `agreement_pending:${agreement._id}`,
    });
  } catch (err) {
    console.warn('[agreement] owner notify failed', err.message);
  }
}

async function acceptAgreement({ user, agreementId }) {
  const doc = await StadiumAgreement.findById(agreementId);
  if (!doc) throw ApiError.notFound('Stadium agreement not found');
  const stadium = await Stadium.findById(doc.stadium);
  if (!stadium) throw ApiError.notFound('Stadium not found');
  if (String(stadium.owner) !== String(user.id) && user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.forbidden('Only the stadium owner can accept this agreement');
  }
  if (doc.status !== AGREEMENT_STATUS.PENDING_ACCEPTANCE && user.role !== ROLES.SUPER_ADMIN) {
    throw ApiError.conflict('This agreement is not waiting for acceptance');
  }

  const now = new Date();
  const effective = doc.effectiveFrom && doc.effectiveFrom > now ? doc.effectiveFrom : now;

  await StadiumAgreement.updateMany(
    {
      stadium: doc.stadium,
      _id: { $ne: doc._id },
      status: AGREEMENT_STATUS.ACTIVE,
    },
    {
      $set: {
        status: AGREEMENT_STATUS.SUPERSEDED,
        effectiveTo: effective,
        supersededBy: doc._id,
      },
    }
  );

  doc.status = AGREEMENT_STATUS.ACTIVE;
  doc.acceptedAt = now;
  doc.acceptedBy = user.id;
  doc.effectiveFrom = effective;
  await doc.save();

  await recordAudit({
    actorId: user.id,
    action: 'stadium_agreement.accept',
    entityType: 'StadiumAgreement',
    entityId: doc._id,
    after: { status: doc.status, effectiveFrom: doc.effectiveFrom },
  });
  return toPublic(doc);
}

async function rejectAgreement({ user, agreementId, reason }) {
  const doc = await StadiumAgreement.findById(agreementId);
  if (!doc) throw ApiError.notFound('Stadium agreement not found');
  const stadium = await Stadium.findById(doc.stadium);
  if (!stadium) throw ApiError.notFound('Stadium not found');
  if (String(stadium.owner) !== String(user.id)) {
    throw ApiError.forbidden('Only the stadium owner can reject this agreement');
  }
  if (doc.status !== AGREEMENT_STATUS.PENDING_ACCEPTANCE) {
    throw ApiError.conflict('This agreement is not waiting for acceptance');
  }
  doc.status = AGREEMENT_STATUS.REJECTED;
  doc.rejectedAt = new Date();
  doc.rejectedBy = user.id;
  doc.rejectReason = reason || '';
  await doc.save();
  await recordAudit({
    actorId: user.id,
    action: 'stadium_agreement.reject',
    entityType: 'StadiumAgreement',
    entityId: doc._id,
    after: { status: doc.status, reason },
  });
  return toPublic(doc);
}

async function listOwnerAgreements(userId) {
  const stadiums = await Stadium.find({ owner: userId }).select('_id name city');
  const ids = stadiums.map((s) => s._id);
  if (!ids.length) return [];
  const rows = await StadiumAgreement.find({ stadium: { $in: ids } })
    .sort({ updatedAt: -1 })
    .lean();
  const byId = Object.fromEntries(stadiums.map((s) => [String(s._id), s]));
  return rows.map((r) => ({
    ...toPublic(r),
    stadiumName: byId[String(r.stadium)]?.name,
    stadiumCity: byId[String(r.stadium)]?.city,
  }));
}

async function createDefaultForStadium({ actorId, stadiumId, send = false, activate = false }) {
  const policy = policyFromBusiness();
  const doc = await createAgreement({
    actorId,
    stadiumId,
    rules: rulesFromPolicy(policy),
    notes: 'Created from current platform revenue policy',
    send,
  });
  if (activate) {
    return acceptAgreement({ user: { id: actorId, role: ROLES.SUPER_ADMIN }, agreementId: doc.id });
  }
  return doc;
}

module.exports = {
  toPublic,
  listAgreements,
  getAgreement,
  createAgreement,
  sendAgreement,
  suspendAgreement,
  createVersionFromActive,
  acceptAgreement,
  rejectAgreement,
  listOwnerAgreements,
  createDefaultForStadium,
};
