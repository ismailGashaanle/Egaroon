const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const ownerOnboardingService = require('../services/ownerOnboarding.service');
const ownerAgreementPdfService = require('../services/ownerAgreementPdf.service');

const list = asyncHandler(async (req, res) => {
  const results = await ownerOnboardingService.listOnboardings(req.query);
  sendSuccess(res, 200, { onboardings: results });
});

const getOne = asyncHandler(async (req, res) => {
  const onboarding = await ownerOnboardingService.getOnboarding(req.params.onboardingId);
  sendSuccess(res, 200, { onboarding });
});

const create = asyncHandler(async (req, res) => {
  const onboarding = await ownerOnboardingService.createDraft(req.user.id, req.body);
  sendSuccess(res, 201, { onboarding });
});

const update = asyncHandler(async (req, res) => {
  const onboarding = await ownerOnboardingService.updateDraft(req.params.onboardingId, req.body);
  sendSuccess(res, 200, { onboarding });
});

const submitSignatures = asyncHandler(async (req, res) => {
  const onboarding = await ownerOnboardingService.submitForSignatures(req.params.onboardingId);
  sendSuccess(res, 200, { onboarding });
});

const sign = asyncHandler(async (req, res) => {
  const onboarding = await ownerOnboardingService.captureSignatures(
    req.params.onboardingId,
    req.user.id,
    req.body
  );
  sendSuccess(res, 200, { onboarding });
});

const activate = asyncHandler(async (req, res) => {
  const result = await ownerOnboardingService.confirmAndActivate(
    req.params.onboardingId,
    req.user.id,
    req.body
  );
  sendSuccess(res, 200, result);
});

const cancel = asyncHandler(async (req, res) => {
  const onboarding = await ownerOnboardingService.cancelOnboarding(
    req.params.onboardingId,
    req.body?.reason
  );
  sendSuccess(res, 200, { onboarding });
});

const suggestEmail = asyncHandler(async (req, res) => {
  const email = await ownerOnboardingService.generateUniqueOwnerEmail(
    req.query.name,
    req.query.phone
  );
  sendSuccess(res, 200, { email });
});

const agreementPdfTemplate = asyncHandler(async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'so';
  const { buffer, contentType, filename } = await ownerAgreementPdfService.buildTemplatePdf({
    lang,
  });
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

const agreementPdfFilled = asyncHandler(async (req, res) => {
  const lang = req.query.lang === 'en' ? 'en' : 'so';
  const { buffer, contentType, filename } = await ownerAgreementPdfService.buildFilledPdf(
    req.params.onboardingId,
    { lang }
  );
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
});

module.exports = {
  list,
  getOne,
  create,
  update,
  submitSignatures,
  sign,
  activate,
  cancel,
  suggestEmail,
  agreementPdfTemplate,
  agreementPdfFilled,
};
