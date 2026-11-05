const AdminAuditLog = require('../models/AdminAuditLog');

async function recordAudit({ actorId, action, entityType, entityId, before, after, note }) {
  try {
    await AdminAuditLog.create({
      actor: actorId || undefined,
      action,
      entityType,
      entityId: entityId != null ? String(entityId) : undefined,
      before,
      after,
      note,
    });
  } catch (err) {
    console.warn('[audit] write failed', err.message);
  }
}

async function listAudit({ entityType, entityId, action, limit = 100 } = {}) {
  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (entityId) filter.entityId = String(entityId);
  if (action) filter.action = action;
  return AdminAuditLog.find(filter)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 100, 500))
    .populate('actor', 'name email role')
    .lean();
}

module.exports = { recordAudit, listAudit };
