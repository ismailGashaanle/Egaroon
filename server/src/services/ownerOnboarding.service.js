const crypto = require('crypto');
const OwnerOnboarding = require('../models/OwnerOnboarding');
const User = require('../models/User');
const Stadium = require('../models/Stadium');
const Field = require('../models/Field');
const FieldSubscriptionPeriod = require('../models/FieldSubscriptionPeriod');
const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { FIELD_TYPES, capacityForType } = require('../constants/fieldFormats');
const { normalizeSomaliPhone, formatDisplay, phoneLookupVariants } = require('../utils/somaliPhone');
const { getBusiness } = require('./platformSettings.service');
const siteContentService = require('./siteContent.service');

const EDITABLE_STATUSES = new Set(['draft', 'awaiting_signatures']);

function moneyRound(n) {
  return Math.round(Number(n || 0) * 100) / 100;
}

function slugifyEmailLocal(name) {
  return String(name || 'owner')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 40) || 'owner';
}

function generateTempPassword() {
  // Readable but not guessable — never logged or persisted.
  const part = crypto.randomBytes(5).toString('base64url').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8);
  return `Own${part}!${String(Date.now()).slice(-3)}`;
}

async function generateUniqueOwnerEmail(name, phone) {
  const local = slugifyEmailLocal(name);
  const phoneDigits = String(phone || '').replace(/\D/g, '').slice(-8);
  const candidates = [
    `${local}.${phoneDigits || 'new'}@owners.kulansiiye.com`,
    `${local}.${crypto.randomBytes(2).toString('hex')}@owners.kulansiiye.com`,
    `owner.${Date.now()}@owners.kulansiiye.com`,
  ];
  for (const email of candidates) {
    const exists = await User.findOne({ email }).select('_id').lean();
    if (!exists) {
      const draftHit = await OwnerOnboarding.findOne({
        'owner.email': email,
        status: { $nin: ['cancelled', 'active'] },
      })
        .select('_id')
        .lean();
      if (!draftHit) return email;
    }
  }
  return `owner.${crypto.randomBytes(4).toString('hex')}@owners.kulansiiye.com`;
}

function normalizeOwnerPatch(raw = {}) {
  const out = {};
  if (raw.name !== undefined) out.name = String(raw.name || '').trim();
  if (raw.avatarUrl !== undefined) out.avatarUrl = String(raw.avatarUrl || '').trim();
  if (raw.email !== undefined) {
    out.email = String(raw.email || '').trim().toLowerCase();
  }
  if (raw.phone !== undefined) {
    const normalized = normalizeSomaliPhone(raw.phone);
    out.phone = normalized || String(raw.phone || '').trim();
  }
  return out;
}

function normalizeStadiumPatch(raw = {}) {
  const out = {};
  for (const k of [
    'name',
    'description',
    'city',
    'region',
    'area',
    'address',
    'openingTime',
    'closingTime',
  ]) {
    if (raw[k] !== undefined) out[k] = String(raw[k] || '').trim();
  }
  if (raw.images !== undefined) {
    if (!Array.isArray(raw.images)) throw ApiError.badRequest('stadium.images must be an array');
    out.images = raw.images.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 24);
  }
  if (raw.facilities !== undefined) {
    if (!Array.isArray(raw.facilities)) throw ApiError.badRequest('stadium.facilities must be an array');
    out.facilities = raw.facilities.map((f) => String(f || '').trim()).filter(Boolean);
  }
  if (raw.latLng !== undefined || raw.lat !== undefined || raw.lng !== undefined) {
    const lat = raw.latLng?.lat ?? raw.lat;
    const lng = raw.latLng?.lng ?? raw.lng;
    out.latLng = {
      lat: lat !== undefined && lat !== '' ? Number(lat) : undefined,
      lng: lng !== undefined && lng !== '' ? Number(lng) : undefined,
    };
  }
  return out;
}

function normalizeField(raw = {}, index = 0) {
  const name = String(raw.name || '').trim() || `Field ${index + 1}`;
  const type = String(raw.type || '').trim();
  if (!FIELD_TYPES.includes(type)) {
    throw ApiError.badRequest(`Field type must be one of: ${FIELD_TYPES.join(', ')}`);
  }
  const pricingMode = raw.pricingMode === 'fixed' ? 'fixed' : 'per_player';
  const field = {
    name,
    type,
    pricingMode,
    images: Array.isArray(raw.images)
      ? raw.images.map((u) => String(u || '').trim()).filter(Boolean).slice(0, 12)
      : [],
    openingTime: raw.openingTime ? String(raw.openingTime).trim() : undefined,
    closingTime: raw.closingTime ? String(raw.closingTime).trim() : undefined,
    slotDurationMinutes: Number(raw.slotDurationMinutes) || 60,
  };
  if (pricingMode === 'per_player') {
    const price = Number(raw.pricePerPlayer);
    if (!Number.isFinite(price) || price < 0) {
      throw ApiError.badRequest(`fields[${index}].pricePerPlayer is required`);
    }
    field.pricePerPlayer = moneyRound(price);
  } else {
    const price = Number(raw.fixedPrice);
    if (!Number.isFinite(price) || price < 0) {
      throw ApiError.badRequest(`fields[${index}].fixedPrice is required`);
    }
    field.fixedPrice = moneyRound(price);
  }
  return field;
}

function validateReadyForSignatures(doc) {
  if (!doc.owner?.name?.trim()) throw ApiError.badRequest('Owner name is required');
  if (!doc.owner?.phone?.trim()) throw ApiError.badRequest('Owner phone is required');
  if (!doc.owner?.email?.trim()) throw ApiError.badRequest('Owner email is required');
  if (!doc.stadium?.name?.trim()) throw ApiError.badRequest('Stadium name is required');
  if (!doc.stadium?.city?.trim()) throw ApiError.badRequest('Stadium city is required');
  if (!Array.isArray(doc.fields) || doc.fields.length < 1) {
    throw ApiError.badRequest('At least one field is required');
  }
  for (let i = 0; i < doc.fields.length; i += 1) {
    normalizeField(doc.fields[i].toObject ? doc.fields[i].toObject() : doc.fields[i], i);
  }
}

function toPublic(doc, { includeCredentialsHint = false } = {}) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  const biz = getBusiness();
  const amount =
    o.subscription?.amountPerField != null
      ? moneyRound(o.subscription.amountPerField)
      : moneyRound(biz.fieldSubscriptionAmount);
  const fieldCount = Array.isArray(o.fields) ? o.fields.length : 0;
  const months = Number(o.subscription?.monthsPaid) || 1;

  return {
    id: o._id,
    status: o.status,
    createdBy: o.createdBy,
    owner: o.owner,
    stadium: o.stadium,
    fields: o.fields,
    subscription: {
      ...o.subscription,
      amountPerField: amount,
      currency: o.subscription?.currency || biz.fieldSubscriptionCurrency || 'USD',
      monthsPaid: months,
      estimatedTotal: moneyRound(amount * fieldCount * months),
      platformEnabled: Boolean(biz.fieldSubscriptionEnabled),
      platformDefaultAmount: moneyRound(biz.fieldSubscriptionAmount),
    },
    agreement: {
      termsSnapshot: o.agreement?.termsSnapshot,
      privacySnapshot: o.agreement?.privacySnapshot,
      ownerAgreementSnapshot: o.agreement?.ownerAgreementSnapshot,
      superAdminSignatureUrl: o.agreement?.superAdminSignatureUrl || '',
      ownerSignatureUrl: o.agreement?.ownerSignatureUrl || '',
      superAdminSignedAt: o.agreement?.superAdminSignedAt || null,
      ownerSignedAt: o.agreement?.ownerSignedAt || null,
      signedBySuperAdminId: o.agreement?.signedBySuperAdminId || null,
    },
    provisioned: {
      userId: o.provisioned?.userId || null,
      stadiumId: o.provisioned?.stadiumId || null,
      fieldIds: o.provisioned?.fieldIds || [],
      activatedAt: o.provisioned?.activatedAt || null,
      credentialsRevealed: Boolean(o.provisioned?.credentialsRevealedAt),
    },
    cancelReason: o.cancelReason || null,
    cancelledAt: o.cancelledAt || null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    ...(includeCredentialsHint
      ? {
          credentialsHint:
            o.status === 'active' && o.provisioned?.credentialsRevealedAt
              ? 'Temporary password was already shown once. Use password reset if needed.'
              : null,
        }
      : {}),
  };
}

async function createDraft(actorId, payload = {}) {
  const owner = normalizeOwnerPatch(payload.owner || {});
  if (!owner.email && owner.name) {
    owner.email = await generateUniqueOwnerEmail(owner.name, owner.phone);
  }
  const stadium = normalizeStadiumPatch(payload.stadium || {});
  let fields = [];
  if (Array.isArray(payload.fields) && payload.fields.length) {
    fields = payload.fields.map((f, i) => normalizeField(f, i));
  }

  const biz = getBusiness();
  const doc = await OwnerOnboarding.create({
    createdBy: actorId,
    status: 'draft',
    owner,
    stadium,
    fields,
    subscription: {
      amountPerField: moneyRound(biz.fieldSubscriptionAmount),
      currency: biz.fieldSubscriptionCurrency || 'USD',
      monthsPaid: 1,
      collectionMethod: 'manual',
    },
  });
  return toPublic(doc);
}

async function listOnboardings(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.q) {
    const q = String(query.q).trim();
    filter.$or = [
      { 'owner.name': new RegExp(q, 'i') },
      { 'owner.email': new RegExp(q, 'i') },
      { 'owner.phone': new RegExp(q, 'i') },
      { 'stadium.name': new RegExp(q, 'i') },
      { 'stadium.city': new RegExp(q, 'i') },
    ];
  }
  const rows = await OwnerOnboarding.find(filter).sort({ createdAt: -1 }).limit(200);
  return rows.map((r) => toPublic(r, { includeCredentialsHint: true }));
}

async function getOnboarding(id) {
  const doc = await OwnerOnboarding.findById(id);
  if (!doc) throw ApiError.notFound('Onboarding not found');
  return toPublic(doc, { includeCredentialsHint: true });
}

async function updateDraft(id, payload = {}) {
  const doc = await OwnerOnboarding.findById(id);
  if (!doc) throw ApiError.notFound('Onboarding not found');
  if (doc.status === 'active' || doc.status === 'cancelled') {
    throw ApiError.badRequest(`Cannot edit onboarding in status "${doc.status}"`);
  }
  if (doc.status === 'subscription_pending') {
    // Only subscription notes / amount tweaks before confirm
    if (payload.subscription) {
      applySubscriptionPatch(doc, payload.subscription);
      await doc.save();
      return toPublic(doc);
    }
    throw ApiError.badRequest('Only subscription details can be updated after signatures');
  }

  if (payload.owner) {
    const owner = normalizeOwnerPatch(payload.owner);
    Object.assign(doc.owner, owner);
    if (!doc.owner.email && doc.owner.name) {
      doc.owner.email = await generateUniqueOwnerEmail(doc.owner.name, doc.owner.phone);
    }
  }
  if (payload.stadium) {
    Object.assign(doc.stadium, normalizeStadiumPatch(payload.stadium));
  }
  if (payload.fields !== undefined) {
    if (!Array.isArray(payload.fields)) throw ApiError.badRequest('fields must be an array');
    if (payload.fields.length > 40) throw ApiError.badRequest('Maximum 40 fields per stadium');
    doc.fields = payload.fields.map((f, i) => normalizeField(f, i));
  }
  if (payload.subscription) {
    applySubscriptionPatch(doc, payload.subscription);
  }

  await doc.save();
  return toPublic(doc);
}

function applySubscriptionPatch(doc, patch = {}) {
  if (patch.amountPerField !== undefined) {
    const n = Number(patch.amountPerField);
    if (!Number.isFinite(n) || n < 0) throw ApiError.badRequest('Invalid amountPerField');
    doc.subscription.amountPerField = moneyRound(n);
  }
  if (patch.currency !== undefined) {
    doc.subscription.currency = String(patch.currency || 'USD').trim() || 'USD';
  }
  if (patch.monthsPaid !== undefined) {
    const m = Number(patch.monthsPaid);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      throw ApiError.badRequest('monthsPaid must be 1–12');
    }
    doc.subscription.monthsPaid = m;
  }
  if (patch.notes !== undefined) doc.subscription.notes = String(patch.notes || '').trim();
  if (patch.collectionMethod !== undefined) {
    const allowed = ['manual', 'waived', 'transfer', 'cash', 'other'];
    if (!allowed.includes(patch.collectionMethod)) {
      throw ApiError.badRequest(`collectionMethod must be one of: ${allowed.join(', ')}`);
    }
    doc.subscription.collectionMethod = patch.collectionMethod;
  }
}

async function submitForSignatures(id) {
  const doc = await OwnerOnboarding.findById(id);
  if (!doc) throw ApiError.notFound('Onboarding not found');
  if (!EDITABLE_STATUSES.has(doc.status)) {
    throw ApiError.badRequest(`Cannot submit from status "${doc.status}"`);
  }

  validateReadyForSignatures(doc);

  // Uniqueness checks before freezing agreement
  await assertOwnerIdentityAvailable(doc);

  const content = await siteContentService.getContent();
  doc.agreement.termsSnapshot = content.policies?.terms || { so: '', en: '', ar: '' };
  doc.agreement.privacySnapshot = content.policies?.privacy || { so: '', en: '', ar: '' };
  doc.agreement.ownerAgreementSnapshot = content.policies?.ownerAgreement || {
    so: '',
    en: '',
    ar: '',
  };
  doc.status = 'awaiting_signatures';
  await doc.save();
  return toPublic(doc);
}

async function assertOwnerIdentityAvailable(doc, { excludeUserId } = {}) {
  const email = String(doc.owner.email || '').toLowerCase().trim();
  const phone = doc.owner.phone;
  if (email) {
    const q = { email };
    if (excludeUserId) q._id = { $ne: excludeUserId };
    const existing = await User.findOne(q).select('_id email').lean();
    if (existing) throw ApiError.conflict('Owner email is already registered');
  }
  if (phone) {
    const variants = phoneLookupVariants(phone);
    const existingPhone = await User.findOne({
      phone: { $in: variants },
      ...(excludeUserId ? { _id: { $ne: excludeUserId } } : {}),
    })
      .select('_id phone')
      .lean();
    if (existingPhone) {
      throw ApiError.conflict(`Phone ${formatDisplay(phone) || phone} is already registered`);
    }
  }
}

async function captureSignatures(id, actorId, payload = {}) {
  const doc = await OwnerOnboarding.findById(id);
  if (!doc) throw ApiError.notFound('Onboarding not found');
  if (doc.status !== 'awaiting_signatures' && doc.status !== 'subscription_pending') {
    throw ApiError.badRequest(`Cannot capture signatures in status "${doc.status}"`);
  }
  if (doc.status === 'subscription_pending' && doc.agreement?.superAdminSignatureUrl && doc.agreement?.ownerSignatureUrl) {
    return toPublic(doc);
  }

  const saUrl = String(payload.superAdminSignatureUrl || '').trim();
  const ownerUrl = String(payload.ownerSignatureUrl || '').trim();
  if (!saUrl && !ownerUrl) {
    throw ApiError.badRequest('Provide superAdminSignatureUrl and/or ownerSignatureUrl');
  }

  if (saUrl) {
    if (!/^https?:\/\//i.test(saUrl)) {
      throw ApiError.badRequest('superAdminSignatureUrl must be an http(s) Cloudinary URL');
    }
    doc.agreement.superAdminSignatureUrl = saUrl;
    doc.agreement.superAdminSignedAt = new Date();
    doc.agreement.signedBySuperAdminId = actorId;
  }
  if (ownerUrl) {
    if (!/^https?:\/\//i.test(ownerUrl)) {
      throw ApiError.badRequest('ownerSignatureUrl must be an http(s) Cloudinary URL');
    }
    doc.agreement.ownerSignatureUrl = ownerUrl;
    doc.agreement.ownerSignedAt = new Date();
  }

  if (doc.agreement.superAdminSignatureUrl && doc.agreement.ownerSignatureUrl) {
    doc.status = 'subscription_pending';
  }

  await doc.save();
  return toPublic(doc);
}

/**
 * Confirm subscription collection and provision User + Stadium + Fields.
 * Returns temporaryPassword only on first successful activate.
 */
async function confirmAndActivate(id, actorId, payload = {}) {
  const doc = await OwnerOnboarding.findById(id);
  if (!doc) throw ApiError.notFound('Onboarding not found');

  // Idempotent re-entry after activate
  if (doc.status === 'active' && doc.provisioned?.userId) {
    return {
      onboarding: toPublic(doc, { includeCredentialsHint: true }),
      temporaryPassword: null,
      credentialsAlreadyRevealed: Boolean(doc.provisioned.credentialsRevealedAt),
    };
  }

  if (doc.status !== 'subscription_pending') {
    throw ApiError.badRequest(
      'Both signatures are required before subscription confirm. Status must be subscription_pending.'
    );
  }
  if (!doc.agreement?.superAdminSignatureUrl || !doc.agreement?.ownerSignatureUrl) {
    throw ApiError.badRequest('Dual signatures are required before activation');
  }

  validateReadyForSignatures(doc);
  await assertOwnerIdentityAvailable(doc);

  if (payload.subscription) {
    applySubscriptionPatch(doc, payload.subscription);
  }

  const biz = getBusiness();
  const amountPerField =
    doc.subscription.amountPerField != null
      ? moneyRound(doc.subscription.amountPerField)
      : moneyRound(biz.fieldSubscriptionAmount);
  const currency = doc.subscription.currency || biz.fieldSubscriptionCurrency || 'USD';
  const monthsPaid = Number(doc.subscription.monthsPaid) || 1;
  const waived = doc.subscription.collectionMethod === 'waived';

  const tempPassword = generateTempPassword();
  const passwordHash = await User.hashPassword(tempPassword);

  let user;
  let stadium;
  const createdFields = [];

  try {
    await assertOwnerIdentityAvailable(doc);

    user = await User.create({
      name: doc.owner.name.trim(),
      email: doc.owner.email.toLowerCase().trim(),
      phone: doc.owner.phone || undefined,
      avatarUrl: doc.owner.avatarUrl || undefined,
      passwordHash,
      role: ROLES.STADIUM_OWNER,
      status: 'active',
      mustChangePassword: true,
      isEmailVerified: true,
      city: doc.stadium.city || undefined,
      region: doc.stadium.region || undefined,
      area: doc.stadium.area || undefined,
    });

    stadium = await Stadium.create({
      owner: user._id,
      name: doc.stadium.name.trim(),
      description: doc.stadium.description || undefined,
      images: doc.stadium.images || [],
      address: doc.stadium.address || undefined,
      city: doc.stadium.city || undefined,
      region: doc.stadium.region || undefined,
      area: doc.stadium.area || undefined,
      latLng: doc.stadium.latLng,
      facilities: doc.stadium.facilities || [],
      openingTime: doc.stadium.openingTime || '06:00',
      closingTime: doc.stadium.closingTime || '23:00',
      status: 'approved',
      isOnline: true,
    });

    for (const f of doc.fields) {
      const field = await Field.create({
        stadium: stadium._id,
        name: f.name,
        type: f.type,
        capacity: capacityForType(f.type),
        images: f.images || [],
        pricingMode: f.pricingMode,
        pricePerPlayer: f.pricePerPlayer,
        fixedPrice: f.fixedPrice,
        openingTime: f.openingTime || stadium.openingTime,
        closingTime: f.closingTime || stadium.closingTime,
        slotDurationMinutes: f.slotDurationMinutes || 60,
        status: 'active',
        isOnline: true,
      });
      createdFields.push(field);
    }

    const now = new Date();
    let y = now.getUTCFullYear();
    let m = now.getUTCMonth() + 1;
    for (let i = 0; i < monthsPaid; i += 1) {
      for (const field of createdFields) {
        await FieldSubscriptionPeriod.findOneAndUpdate(
          { field: field._id, year: y, month: m },
          {
            $set: {
              stadium: stadium._id,
              amountDue: amountPerField,
              amountPaid: waived ? 0 : amountPerField,
              currency,
              status: waived ? 'waived' : 'paid',
              paidAt: waived ? undefined : new Date(),
              notes: doc.subscription.notes || 'Paid at owner onboarding',
              markedBy: actorId,
            },
            $setOnInsert: {
              field: field._id,
              year: y,
              month: m,
            },
          },
          { upsert: true, returnDocument: 'after' }
        );
      }
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }

    doc.subscription.amountPerField = amountPerField;
    doc.subscription.currency = currency;
    doc.subscription.confirmedAt = new Date();
    doc.subscription.confirmedBy = actorId;
    doc.provisioned = {
      userId: user._id,
      stadiumId: stadium._id,
      fieldIds: createdFields.map((f) => f._id),
      activatedAt: new Date(),
      credentialsRevealedAt: new Date(),
    };
    doc.status = 'active';
    await doc.save();
  } catch (err) {
    // Best-effort cleanup if provisioning partially succeeded
    try {
      if (createdFields.length) {
        await Field.deleteMany({ _id: { $in: createdFields.map((f) => f._id) } });
        await FieldSubscriptionPeriod.deleteMany({
          field: { $in: createdFields.map((f) => f._id) },
        });
      }
      if (stadium?._id) await Stadium.deleteOne({ _id: stadium._id });
      if (user?._id) await User.deleteOne({ _id: user._id });
    } catch (_cleanupErr) {
      // ignore cleanup errors
    }
    if (err.code === 11000) {
      throw ApiError.conflict('Owner email or phone already exists');
    }
    throw err;
  }

  // Do not log tempPassword
  return {
    onboarding: toPublic(doc),
    temporaryPassword: tempPassword,
    credentialsAlreadyRevealed: false,
    owner: user.toSafeJSON(),
    stadium: Stadium.attachLocation(stadium),
    fields: createdFields,
  };
}

async function cancelOnboarding(id, reason) {
  const doc = await OwnerOnboarding.findById(id);
  if (!doc) throw ApiError.notFound('Onboarding not found');
  if (doc.status === 'active') {
    throw ApiError.badRequest('Cannot cancel an active (provisioned) onboarding');
  }
  doc.status = 'cancelled';
  doc.cancelReason = String(reason || '').trim() || undefined;
  doc.cancelledAt = new Date();
  await doc.save();
  return toPublic(doc);
}

module.exports = {
  createDraft,
  listOnboardings,
  getOnboarding,
  updateDraft,
  submitForSignatures,
  captureSignatures,
  confirmAndActivate,
  cancelOnboarding,
  toPublic,
  generateUniqueOwnerEmail,
};
