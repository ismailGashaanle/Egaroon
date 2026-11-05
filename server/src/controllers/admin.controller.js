const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const platformSettingsService = require('../services/platformSettings.service');
const bookingService = require('../services/booking.service');
const adminUserService = require('../services/adminUser.service');
const profitReportService = require('../services/profitReport.service');
const fieldSubscriptionService = require('../services/fieldSubscription.service');
const stadiumSubscriptionService = require('../services/stadiumSubscription.service');
const adminPaymentReviewService = require('../services/adminPaymentReview.service');
const businessPlannerService = require('../services/businessPlanner.service');

const listUsers = asyncHandler(async (req, res) => {
  const users = await adminUserService.listUsers(req.user, req.query);
  sendSuccess(res, 200, { users });
});

const createUser = asyncHandler(async (req, res) => {
  const result = await adminUserService.createUser(req.user, req.body);
  // temporaryPassword returned once — never logged by this layer
  sendSuccess(res, 201, result);
});

const getPlatformSettings = asyncHandler(async (req, res) => {
  const settings = await platformSettingsService.getSettings();
  sendSuccess(res, 200, { settings });
});

const updatePlatformSettings = asyncHandler(async (req, res) => {
  const settings = await platformSettingsService.updateSettings(req.body, req.user.id);
  sendSuccess(res, 200, { settings });
});

const setUserStatus = asyncHandler(async (req, res) => {
  const user = await adminUserService.setUserStatus(req.user, req.params.userId, req.body.status);
  sendSuccess(res, 200, { user });
});

const setUserRole = asyncHandler(async (req, res) => {
  const user = await adminUserService.setUserRole(req.user, req.params.userId, req.body.role);
  sendSuccess(res, 200, { user });
});

const updateUser = asyncHandler(async (req, res) => {
  const user = await adminUserService.updateUser(req.user, req.params.userId, req.body);
  sendSuccess(res, 200, { user });
});

const softDeleteUser = asyncHandler(async (req, res) => {
  const user = await adminUserService.softDeleteUser(req.user, req.params.userId);
  sendSuccess(res, 200, { user });
});

const restoreUser = asyncHandler(async (req, res) => {
  const user = await adminUserService.restoreUser(req.user, req.params.userId);
  sendSuccess(res, 200, { user });
});

const expireStaleHolds = asyncHandler(async (req, res) => {
  const expired = await bookingService.expireStaleHolds();
  sendSuccess(res, 200, { expiredCount: expired.length, expired });
});

const forceClearHolds = asyncHandler(async (req, res) => {
  const { fieldId, includeActive } = req.body || {};
  const result = await bookingService.forceClearHolds({
    fieldId: fieldId || undefined,
    includeActive: Boolean(includeActive),
  });
  sendSuccess(res, 200, result);
});

const getProfitReport = asyncHandler(async (req, res) => {
  const report = await profitReportService.buildProfitReport(req.query);
  sendSuccess(res, 200, { report });
});

const getProfitInsights = asyncHandler(async (req, res) => {
  const insights = await profitReportService.buildProfitInsights(req.query);
  sendSuccess(res, 200, { insights });
});

const exportProfitReport = asyncHandler(async (req, res) => {
  const { buffer, contentType, ext } = await profitReportService.buildExportBuffer(req.query);
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="egaroon-profit-${stamp}.${ext}"`);
  res.send(buffer);
});

const backfillCommission = asyncHandler(async (req, res) => {
  const result = await profitReportService.backfillCommissionSnapshots({
    dryRun: Boolean(req.body?.dryRun),
    limit: Number(req.body?.limit) || 500,
  });
  sendSuccess(res, 200, { backfill: result });
});

const listSubscriptions = asyncHandler(async (req, res) => {
  if (req.query.ensure === 'true') {
    const { from, to } = profitReportService.resolvePeriodRange({
      period: req.query.period || 'year',
      from: req.query.from,
      to: req.query.to,
    });
    await stadiumSubscriptionService.ensurePeriodsForRange(from, to);
  }
  const subscriptions = await stadiumSubscriptionService.listSubscriptions(req.query);
  sendSuccess(res, 200, { subscriptions });
});

const markSubscription = asyncHandler(async (req, res) => {
  const period = await stadiumSubscriptionService.markPeriod(req.params.periodId, req.user.id, req.body);
  sendSuccess(res, 200, { period });
});

const approveSubscription = asyncHandler(async (req, res) => {
  const result = await stadiumSubscriptionService.approveSubscriptionBySuperAdmin({
    periodId: req.params.periodId,
    adminId: req.user.id,
    notes: req.body?.notes,
  });
  sendSuccess(res, 200, result);
});

const listPayments = asyncHandler(async (req, res) => {
  const payments = await adminPaymentReviewService.listPayments(req.user, req.query);
  sendSuccess(res, 200, { payments });
});

const reviewPayment = asyncHandler(async (req, res) => {
  const payment = await adminPaymentReviewService.reviewPayment(
    req.user,
    req.params.paymentId,
    req.body
  );
  sendSuccess(res, 200, { payment });
});

const getBusinessPlan = asyncHandler(async (req, res) => {
  const plan = await businessPlannerService.runPlan(req.query, {});
  sendSuccess(res, 200, { plan });
});

const runBusinessPlan = asyncHandler(async (req, res) => {
  const body = req.body || {};
  const query = {
    period: body.period || req.query.period,
    from: body.from || req.query.from,
    to: body.to || req.query.to,
    city: body.city || req.query.city,
    region: body.region || req.query.region,
  };
  const plan = await businessPlannerService.runPlan(query, body.scenario || {});
  sendSuccess(res, 200, { plan });
});

module.exports = {
  listUsers,
  createUser,
  setUserStatus,
  setUserRole,
  updateUser,
  softDeleteUser,
  restoreUser,
  getPlatformSettings,
  updatePlatformSettings,
  expireStaleHolds,
  forceClearHolds,
  getProfitReport,
  getProfitInsights,
  exportProfitReport,
  backfillCommission,
  listSubscriptions,
  markSubscription,
  approveSubscription,
  listPayments,
  reviewPayment,
  getBusinessPlan,
  runBusinessPlan,
};
