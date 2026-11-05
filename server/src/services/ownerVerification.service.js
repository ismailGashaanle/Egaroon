const User = require('../models/User');
const Stadium = require('../models/Stadium');
const ApiError = require('../utils/ApiError');
const { isOwnerRestricted } = require('../utils/ownerVerification');

const RESTRICTED_DETAILS = {
  code: 'OWNER_VERIFICATION_REQUIRED',
  messageEn: 'Your account must be verified by E-Garoon before you can do this.',
  messageSo: 'Akoonkaaga waa in uu xaqiijiyaa E-Garoon ka hor intaadan sameyn tan.',
};

/** Throws 403 when the owner is self-registered and not yet verified. */
async function assertOwnerVerified(userId) {
  const owner = await User.findById(userId).select('role selfRegistered kyc');
  if (isOwnerRestricted(owner)) {
    throw ApiError.forbidden(`${RESTRICTED_DETAILS.messageEn} ${RESTRICTED_DETAILS.messageSo}`, RESTRICTED_DETAILS);
  }
}

/** A Super Admin may only publish a stadium once its owner passed verification. */
async function assertStadiumApprovable(stadium) {
  const owner = await User.findById(stadium.owner).select('role selfRegistered kyc');
  if (isOwnerRestricted(owner)) {
    throw ApiError.conflict('Verify the stadium owner first (Finance → KYC) before approving this stadium.', {
      code: 'OWNER_NOT_VERIFIED',
    });
  }
}

/** Verified owner → their submitted stadiums go live in the public list. */
async function publishOwnerStadiums(ownerId) {
  const result = await Stadium.updateMany({ owner: ownerId, status: 'pending' }, { $set: { status: 'approved' } });
  return result.modifiedCount || 0;
}

module.exports = { assertOwnerVerified, assertStadiumApprovable, publishOwnerStadiums };
