const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const egaroonWalletService = require('../services/egaroonWallet.service');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const WalletTransaction = require('../models/WalletTransaction');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const ApiError = require('../utils/ApiError');

// Owner Endpoints
const getOwnerWallet = asyncHandler(async (req, res) => {
  const data = await egaroonWalletService.getOwnerWalletSummary(req.user, {
    stadiumId: req.query.stadiumId,
  });
  sendSuccess(res, 200, data);
});

const getOwnerTransactions = asyncHandler(async (req, res) => {
  const { stadiumId, type, limit = 30, page = 1 } = req.query;
  const query = { owner: req.user.id };
  if (stadiumId) {
    const Stadium = require('../models/Stadium');
    const owned = await Stadium.exists({ _id: stadiumId, owner: req.user.id });
    if (!owned) throw ApiError.forbidden('Not your stadium');
    query.stadium = stadiumId;
  }
  if (type) query.type = String(type);

  const pageSize = Math.min(100, Math.max(1, Number(limit) || 30));
  const pageNo = Math.max(1, Number(page) || 1);
  const total = await WalletTransaction.countDocuments(query);
  const transactions = await WalletTransaction.find(query)
    .sort({ createdAt: -1 })
    .skip((pageNo - 1) * pageSize)
    .limit(pageSize)
    .populate(egaroonWalletService.TX_POPULATE);

  sendSuccess(res, 200, { transactions, total, page: pageNo, pageSize });
});

const submitKyc = asyncHandler(async (req, res) => {
  const result = await egaroonWalletService.submitOwnerKyc(req.user.id, req.body);
  sendSuccess(res, 200, result);
});

const initiateWithdrawal = asyncHandler(async (req, res) => {
  const result = await egaroonWalletService.initiateWithdrawal(req.user, req.body);
  sendSuccess(res, 200, result);
});

const verifyWithdrawalOtp = asyncHandler(async (req, res) => {
  const result = await egaroonWalletService.verifyWithdrawalOtp(req.user, req.body);
  sendSuccess(res, 200, result);
});

const cancelWithdrawal = asyncHandler(async (req, res) => {
  const result = await egaroonWalletService.cancelWithdrawal(req.user, {
    withdrawalId: req.params.id,
  });
  sendSuccess(res, 200, result);
});

const listOwnerWithdrawals = asyncHandler(async (req, res) => {
  const query = { owner: req.user.id };
  if (req.query.stadiumId) query.stadium = req.query.stadiumId;
  const withdrawals = await WithdrawalRequest.find(query)
    .populate('stadium', 'name')
    .sort({ createdAt: -1 });
  sendSuccess(res, 200, { withdrawals });
});

// Admin / Department of Finance Endpoints
const getFinanceOverview = asyncHandler(async (req, res) => {
  const EGaroonWallet = require('../models/EGaroonWallet');
  const [wallets, pendingCount, settings] = await Promise.all([
    EGaroonWallet.find(),
    WithdrawalRequest.countDocuments({ status: { $in: ['pending_approval', 'processing'] } }),
    PlatformSettings.findOne({ key: 'default' }),
  ]);

  let totalEscrowHeld = 0;
  let totalAvailable = 0;
  let totalProcessing = 0;
  let totalWithdrawn = 0;
  let totalLifetimeEarned = 0;

  wallets.forEach((w) => {
    totalEscrowHeld += w.balanceHeld || 0;
    totalAvailable += w.balanceAvailable || 0;
    totalProcessing += w.balanceProcessing || 0;
    totalWithdrawn += w.totalWithdrawn || 0;
    totalLifetimeEarned += w.totalEarned || 0;
  });

  const pendingKycCount = await User.countDocuments({ 'kyc.status': 'pending' });

  sendSuccess(res, 200, {
    totalEscrowHeld: Math.round(totalEscrowHeld * 100) / 100,
    totalAvailable: Math.round(totalAvailable * 100) / 100,
    totalProcessing: Math.round(totalProcessing * 100) / 100,
    totalWithdrawn: Math.round(totalWithdrawn * 100) / 100,
    totalLifetimeEarned: Math.round(totalLifetimeEarned * 100) / 100,
    pendingWithdrawalsCount: pendingCount,
    pendingKycCount,
    masterAccounts: settings?.masterAccounts || {},
  });
});

const listFinanceWithdrawals = asyncHandler(async (req, res) => {
  const query = {};
  if (req.query.status) {
    query.status = req.query.status;
  }
  const withdrawals = await WithdrawalRequest.find(query)
    .populate('stadium', 'name')
    .populate('owner', 'name phone email kyc payoutAccount')
    .sort({ createdAt: -1 });

  sendSuccess(res, 200, { withdrawals });
});

const approveWithdrawal = asyncHandler(async (req, res) => {
  const result = await egaroonWalletService.financeApproveWithdrawal(req.user, {
    withdrawalId: req.params.id,
    disbursementReference: req.body.disbursementReference,
    masterAccountUsed: req.body.masterAccountUsed || req.body.disbursementMasterAccount,
    notes: req.body.notes,
  });
  sendSuccess(res, 200, result);
});

const rejectWithdrawal = asyncHandler(async (req, res) => {
  const result = await egaroonWalletService.financeRejectWithdrawal(req.user, {
    withdrawalId: req.params.id,
    reason: req.body.reason || req.body.rejectionReason,
  });
  sendSuccess(res, 200, result);
});

const listFinanceKyc = asyncHandler(async (req, res) => {
  const query = { role: 'stadium_owner' };
  if (req.query.status) {
    query['kyc.status'] = req.query.status;
  } else {
    query['kyc.status'] = { $in: ['pending', 'verified', 'rejected'] };
  }

  const users = await User.find(query)
    .select('name email phone kyc payoutAccount selfRegistered createdAt')
    .sort({ 'kyc.submittedAt': -1, createdAt: -1 })
    .lean();

  // Show each owner's stadiums so the reviewer knows what goes live on approval.
  const Stadium = require('../models/Stadium');
  const counts = await Stadium.aggregate([
    { $match: { owner: { $in: users.map((u) => u._id) } } },
    { $group: { _id: '$owner', total: { $sum: 1 }, pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } } } },
  ]);
  const byOwner = Object.fromEntries(counts.map((c) => [String(c._id), c]));
  const enriched = users.map((u) => ({
    ...u,
    stadiumCount: byOwner[String(u._id)]?.total || 0,
    pendingStadiumCount: byOwner[String(u._id)]?.pending || 0,
  }));
  sendSuccess(res, 200, { users: enriched });
});

const reviewKyc = asyncHandler(async (req, res) => {
  const result = await egaroonWalletService.financeReviewKyc(req.user, {
    userId: req.params.userId,
    status: req.body.status,
    rejectionReason: req.body.rejectionReason,
  });
  sendSuccess(res, 200, result);
});

/** Finance manually releases a booking's escrow (required when escrowReleaseTrigger is 'manual'). */
const releaseEscrow = asyncHandler(async (req, res) => {
  const Booking = require('../models/Booking');
  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) throw ApiError.notFound('Booking not found');
  const result = await egaroonWalletService.releaseBookingEscrow(booking, { source: 'manual' });
  sendSuccess(res, 200, { released: Boolean(result), wallet: result?.wallet || null });
});

const getMasterAccounts = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.findOne({ key: 'default' });
  sendSuccess(res, 200, {
    masterAccounts: settings?.masterAccounts || {},
    minWithdrawalUsd: settings?.minWithdrawalUsd || 10,
    escrowReleaseTrigger: settings?.escrowReleaseTrigger || 'on_checkin',
  });
});

const updateMasterAccounts = asyncHandler(async (req, res) => {
  const settings = await PlatformSettings.findOne({ key: 'default' }) || new PlatformSettings({ key: 'default' });

  if (req.body.masterAccounts) {
    settings.masterAccounts = {
      ...settings.masterAccounts,
      ...req.body.masterAccounts,
    };
  }
  if (req.body.minWithdrawalUsd) {
    settings.minWithdrawalUsd = Number(req.body.minWithdrawalUsd);
  }
  if (req.body.escrowReleaseTrigger) {
    settings.escrowReleaseTrigger = req.body.escrowReleaseTrigger;
  }
  settings.updatedBy = req.user.id;
  await settings.save();

  sendSuccess(res, 200, {
    masterAccounts: settings.masterAccounts,
    minWithdrawalUsd: settings.minWithdrawalUsd,
    escrowReleaseTrigger: settings.escrowReleaseTrigger,
    message: 'E-Garoon Master Accounts updated successfully',
  });
});

module.exports = {
  getOwnerWallet,
  getOwnerTransactions,
  submitKyc,
  initiateWithdrawal,
  verifyWithdrawalOtp,
  cancelWithdrawal,
  listOwnerWithdrawals,
  getFinanceOverview,
  listFinanceWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  releaseEscrow,
  listFinanceKyc,
  reviewKyc,
  getMasterAccounts,
  updateMasterAccounts,
};
