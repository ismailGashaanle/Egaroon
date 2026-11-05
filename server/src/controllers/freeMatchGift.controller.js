const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const freeMatchGiftService = require('../services/freeMatchGift.service');

const createCampaign = asyncHandler(async (req, res) => {
  const campaign = await freeMatchGiftService.createCampaign(req.user.id, req.body);
  sendSuccess(res, 201, { campaign });
});

const listCampaigns = asyncHandler(async (req, res) => {
  const campaigns = await freeMatchGiftService.listCampaigns(req.query);
  sendSuccess(res, 200, { campaigns });
});

const endCampaign = asyncHandler(async (req, res) => {
  const campaign = await freeMatchGiftService.endCampaign(req.params.campaignId);
  sendSuccess(res, 200, { campaign });
});

const activateCampaign = asyncHandler(async (req, res) => {
  const campaign = await freeMatchGiftService.activateCampaign(req.params.campaignId);
  sendSuccess(res, 200, { campaign });
});

const listActiveForMe = asyncHandler(async (req, res) => {
  const data = await freeMatchGiftService.listActiveForCaptain(req.user.id);
  sendSuccess(res, 200, data);
});

const enterCampaign = asyncHandler(async (req, res) => {
  const result = await freeMatchGiftService.enterCampaign({
    userId: req.user.id,
    campaignId: req.params.campaignId,
    teamId: req.body?.teamId,
  });
  sendSuccess(res, 200, result);
});

const listMyVouchers = asyncHandler(async (req, res) => {
  const vouchers = await freeMatchGiftService.listMyVouchers(req.user.id);
  sendSuccess(res, 200, { vouchers });
});

const previewVoucher = asyncHandler(async (req, res) => {
  const preview = await freeMatchGiftService.previewVoucher({
    userId: req.user.id,
    voucherCode: req.body?.voucherCode || req.query?.code,
  });
  sendSuccess(res, 200, { preview });
});

const redeemVoucher = asyncHandler(async (req, res) => {
  const result = await freeMatchGiftService.redeemVoucherOnBooking({
    userId: req.user.id,
    bookingId: req.params.bookingId,
    voucherCode: req.body?.voucherCode,
  });
  sendSuccess(res, 200, result);
});

module.exports = {
  createCampaign,
  listCampaigns,
  endCampaign,
  activateCampaign,
  listActiveForMe,
  enterCampaign,
  listMyVouchers,
  previewVoucher,
  redeemVoucher,
};
