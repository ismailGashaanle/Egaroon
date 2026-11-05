const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const bookingPolicyService = require('../services/bookingPolicy.service');

const getStadiumPolicy = asyncHandler(async (req, res) => {
  const policy = await bookingPolicyService.getStadiumPolicy(req.params.stadiumId);
  sendSuccess(res, 200, { policy });
});

const updateStadiumPolicy = asyncHandler(async (req, res) => {
  const policy = await bookingPolicyService.updateStadiumPolicy(
    req.params.stadiumId,
    req.user,
    req.body
  );
  sendSuccess(res, 200, { policy });
});

const saveDraftPolicy = asyncHandler(async (req, res) => {
  const policy = await bookingPolicyService.saveDraftPolicy(
    req.params.stadiumId,
    req.user,
    req.body
  );
  sendSuccess(res, 200, { policy });
});

const publishPolicy = asyncHandler(async (req, res) => {
  const policy = await bookingPolicyService.publishPolicy(
    req.params.stadiumId,
    req.user,
    req.body
  );
  sendSuccess(res, 200, { policy });
});

const createRescheduleRequest = asyncHandler(async (req, res) => {
  const request = await bookingPolicyService.createRescheduleRequest({
    bookingId: req.params.bookingId,
    user: req.user,
    proposedDate: req.body.proposedDate,
    proposedStartTime: req.body.proposedStartTime,
    proposedEndTime: req.body.proposedEndTime,
    proposedFieldId: req.body.proposedFieldId,
    reason: req.body.reason,
  });
  sendSuccess(res, 201, { changeRequest: request });
});

const respondToChangeRequest = asyncHandler(async (req, res) => {
  const result = await bookingPolicyService.respondToChangeRequest({
    requestId: req.params.requestId,
    user: req.user,
    action: req.body.action, // 'ACCEPT' or 'REJECT'
    responseNote: req.body.responseNote,
  });
  sendSuccess(res, 200, result);
});

const cancelBookingWithPolicy = asyncHandler(async (req, res) => {
  const result = await bookingPolicyService.cancelBookingWithPolicy({
    bookingId: req.params.bookingId,
    user: req.user,
    reason: req.body.reason,
  });
  sendSuccess(res, 200, result);
});

const listBookingChangeRequests = asyncHandler(async (req, res) => {
  const requests = await bookingPolicyService.listChangeRequestsForBooking(req.params.bookingId);
  sendSuccess(res, 200, { changeRequests: requests });
});

const listOwnerChangeRequests = asyncHandler(async (req, res) => {
  const requests = await bookingPolicyService.listOwnerChangeRequests(req.user.id);
  sendSuccess(res, 200, { changeRequests: requests });
});

module.exports = {
  getStadiumPolicy,
  updateStadiumPolicy,
  saveDraftPolicy,
  publishPolicy,
  createRescheduleRequest,
  respondToChangeRequest,
  cancelBookingWithPolicy,
  listBookingChangeRequests,
  listOwnerChangeRequests,
};
