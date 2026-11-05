const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const stadiumAgreementService = require('../services/stadiumAgreement.service');

// ─── Super Admin ──────────────────────────────────────────────────────────────

const listAgreements = asyncHandler(async (req, res) => {
  const { stadiumId, status } = req.query;
  const data = await stadiumAgreementService.listAgreements({ stadiumId, status });
  sendSuccess(res, 200, { agreements: data });
});

const createAgreement = asyncHandler(async (req, res) => {
  const { stadiumId, rules, notes, effectiveFrom, send } = req.body;
  const agreement = await stadiumAgreementService.createAgreement({
    actorId: req.user.id,
    stadiumId,
    rules,
    notes,
    effectiveFrom,
    send: Boolean(send),
  });
  sendSuccess(res, 201, { agreement });
});

const getAgreement = asyncHandler(async (req, res) => {
  const agreement = await stadiumAgreementService.getAgreement(req.params.agreementId);
  sendSuccess(res, 200, { agreement });
});

const sendAgreement = asyncHandler(async (req, res) => {
  const agreement = await stadiumAgreementService.sendAgreement({
    actorId: req.user.id,
    agreementId: req.params.agreementId,
  });
  sendSuccess(res, 200, { agreement });
});

const suspendAgreement = asyncHandler(async (req, res) => {
  const { note } = req.body;
  const agreement = await stadiumAgreementService.suspendAgreement({
    actorId: req.user.id,
    agreementId: req.params.agreementId,
    note,
  });
  sendSuccess(res, 200, { agreement });
});

const createVersion = asyncHandler(async (req, res) => {
  const { rules, notes, effectiveFrom, send } = req.body;
  const agreement = await stadiumAgreementService.createVersionFromActive({
    actorId: req.user.id,
    agreementId: req.params.agreementId,
    rules,
    notes,
    effectiveFrom,
    send: send !== false, // defaults to true
  });
  sendSuccess(res, 201, { agreement });
});

const createDefaultForStadium = asyncHandler(async (req, res) => {
  const { send, activate } = req.body;
  const agreement = await stadiumAgreementService.createDefaultForStadium({
    actorId: req.user.id,
    stadiumId: req.params.stadiumId,
    send: Boolean(send),
    activate: Boolean(activate),
  });
  sendSuccess(res, 201, { agreement });
});

// ─── Owner ────────────────────────────────────────────────────────────────────

const listOwnerAgreements = asyncHandler(async (req, res) => {
  const data = await stadiumAgreementService.listOwnerAgreements(req.user.id);
  sendSuccess(res, 200, { agreements: data });
});

const acceptAgreement = asyncHandler(async (req, res) => {
  const agreement = await stadiumAgreementService.acceptAgreement({
    user: req.user,
    agreementId: req.params.agreementId,
  });
  sendSuccess(res, 200, { agreement });
});

const rejectAgreement = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const agreement = await stadiumAgreementService.rejectAgreement({
    user: req.user,
    agreementId: req.params.agreementId,
    reason,
  });
  sendSuccess(res, 200, { agreement });
});

module.exports = {
  listAgreements,
  createAgreement,
  getAgreement,
  sendAgreement,
  suspendAgreement,
  createVersion,
  createDefaultForStadium,
  listOwnerAgreements,
  acceptAgreement,
  rejectAgreement,
};
