const { ROLES } = require('../constants/roles');

/**
 * Self-registered stadium owners are restricted until a Super Admin verifies their documents.
 * Owners created by a Super Admin (onboarding wizard, admin tools) are already vouched for
 * and are never restricted — only users flagged `selfRegistered` go through verification.
 */
const VERIFICATION = {
  NOT_REQUIRED: 'not_required',
  REQUIRED: 'verification_required',
  UNDER_REVIEW: 'under_review',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
};

function verificationStatusOf(user) {
  if (!user || user.role !== ROLES.STADIUM_OWNER || !user.selfRegistered) {
    return VERIFICATION.NOT_REQUIRED;
  }
  switch (user.kyc?.status) {
    case 'verified':
      return VERIFICATION.VERIFIED;
    case 'pending':
      return VERIFICATION.UNDER_REVIEW;
    case 'rejected':
      return VERIFICATION.REJECTED;
    default:
      return VERIFICATION.REQUIRED;
  }
}

function isOwnerRestricted(user) {
  const status = verificationStatusOf(user);
  return status !== VERIFICATION.NOT_REQUIRED && status !== VERIFICATION.VERIFIED;
}

module.exports = { VERIFICATION, verificationStatusOf, isOwnerRestricted };
