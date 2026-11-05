const mongoose = require('mongoose');
const EGaroonWallet = require('../models/EGaroonWallet');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const WalletTransaction = require('../models/WalletTransaction');
const Stadium = require('../models/Stadium');
const User = require('../models/User');
const PlatformSettings = require('../models/PlatformSettings');
const ApiError = require('../utils/ApiError');
const otpService = require('./otp.service');
const env = require('../config/env');
const { getOtpProvider } = require('./otpProviders');
const { PAYOUT_METHODS, payoutMethodLabel } = require('../constants/payoutMethods');
const { normalizeSomaliPhone, detectCarrier, formatDisplay } = require('../utils/somaliPhone');
const { notifyUser } = require('./notification.service');

function generateWithdrawalReference() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const r = Math.floor(100000 + Math.random() * 900000);
  return `WTH-EGR-${y}${m}-${r}`;
}

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/**
 * Gets or creates an E-Garoon wallet for a given stadium.
 * Upsert keeps concurrent first payments from racing on the unique stadium index.
 */
async function getOrCreateWallet(stadiumId, ownerId) {
  const find = () =>
    EGaroonWallet.findOneAndUpdate(
      { stadium: stadiumId },
      { $setOnInsert: { owner: ownerId, currency: 'USD' } },
      { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
  try {
    return await find();
  } catch (err) {
    if (err.code === 11000) return EGaroonWallet.findOne({ stadium: stadiumId });
    throw err;
  }
}

/** Atomic $inc on a wallet; `guard` conditions make the update a no-op (null) when they fail. */
function adjustWallet(walletId, inc, guard = {}) {
  return EGaroonWallet.findOneAndUpdate({ _id: walletId, ...guard }, { $inc: inc }, { returnDocument: 'after' });
}

/** Atomic debit of one balance that clamps at zero. Returns the wallet as it was before the debit. */
function clampedDebit(walletId, field, amount, extra = {}) {
  const set = { [field]: { $max: [0, { $subtract: [`$${field}`, amount] }] } };
  for (const [k, v] of Object.entries(extra)) {
    set[k] = { $max: [0, { $subtract: [`$${k}`, v] }] };
  }
  return EGaroonWallet.findOneAndUpdate({ _id: walletId }, [{ $set: set }], { returnDocument: 'before', updatePipeline: true });
}

/**
 * Called when a customer pays for a booking into E-Garoon Master Accounts.
 * Stadium rent share is credited to `balanceHeld` (Escrow).
 * Idempotent per payment: a repeated call for the same payment is a no-op.
 */
async function holdBookingPayment(booking, rentAmount, payment) {
  const amount = round2(rentAmount);
  if (!booking || !booking.stadium || !(amount > 0)) return null;

  const stadium = await Stadium.findById(booking.stadium).select('owner name');
  if (!stadium) return null;

  const wallet = await getOrCreateWallet(stadium._id, stadium.owner);

  let tx;
  try {
    tx = await WalletTransaction.create({
      wallet: wallet._id,
      stadium: stadium._id,
      owner: stadium.owner,
      booking: booking._id,
      payment: payment?._id,
      type: 'booking_escrow_credit',
      amount,
      currency: 'USD',
      targetBalance: 'held',
      direction: 'credit',
      status: 'held',
      description: `Lacagta ballanka oo ku xarootay E-Garoon Master Account (${stadium.name} · #${booking.bookingCode || booking._id.toString().slice(-6)})`,
      referenceCode: booking.bookingCode || null,
    });
  } catch (err) {
    if (err.code === 11000) return null; // already credited for this payment
    throw err;
  }

  const updated = await adjustWallet(wallet._id, { balanceHeld: amount, totalEarned: amount });
  if (!updated) {
    await WalletTransaction.deleteOne({ _id: tx._id });
    throw ApiError.notFound('Wallet not found');
  }

  return { wallet: updated, tx };
}

/**
 * Whether a release attempt from `source` is allowed under the platform's escrowReleaseTrigger.
 *  - on_checkin:   gate check-in releases; settlement sweeps up anything left
 *  - on_match_end: only settlement releases
 *  - manual:       only a Finance action releases
 */
function releaseAllowed(trigger, source) {
  if (source === 'manual') return true;
  if (trigger === 'manual') return false;
  if (source === 'checkin') return trigger === 'on_checkin';
  return true; // settle
}

/**
 * Moves each held escrow credit of the booking to `balanceAvailable`.
 * Each credit is claimed atomically (held -> completed) so check-in and settlement
 * can both call this without ever releasing the same money twice.
 */
async function releaseBookingEscrow(booking, { source = 'settle' } = {}) {
  if (!booking || !booking.stadium) return null;

  const settings = await PlatformSettings.findOne({ key: 'default' }).select('escrowReleaseTrigger');
  if (!releaseAllowed(settings?.escrowReleaseTrigger || 'on_checkin', source)) return null;

  const stadium = await Stadium.findById(booking.stadium).select('owner name');
  if (!stadium) return null;

  const heldTxs = await WalletTransaction.find({
    booking: booking._id,
    type: 'booking_escrow_credit',
    status: 'held',
  }).select('_id');

  let released = 0;
  let wallet = null;
  let tx = null;

  for (const { _id } of heldTxs) {
    const claimed = await WalletTransaction.findOneAndUpdate(
      { _id, status: 'held' },
      { $set: { status: 'completed' } },
      { returnDocument: 'after' }
    );
    if (!claimed) continue; // someone else released it

    wallet = await adjustWallet(
      claimed.wallet,
      { balanceHeld: -claimed.amount, balanceAvailable: claimed.amount },
      { balanceHeld: { $gte: claimed.amount } }
    );
    if (!wallet) {
      // Held balance is inconsistent with the ledger — put the credit back and surface it.
      await WalletTransaction.updateOne({ _id }, { $set: { status: 'held' } });
      console.warn('[wallet] release skipped, balanceHeld < credit', claimed._id.toString());
      continue;
    }
    released = round2(released + claimed.amount);
  }

  if (!(released > 0)) return null;

  tx = await WalletTransaction.create({
    wallet: wallet._id,
    stadium: stadium._id,
    owner: stadium.owner,
    booking: booking._id,
    type: 'escrow_released',
    amount: released,
    currency: 'USD',
    targetBalance: 'available',
    direction: 'transfer',
    status: 'completed',
    description: `Ciyaartu way qabsoontay · Lacagta waxaa laga wareejiyay Escrow loona shubay Available Balance (${stadium.name})`,
    referenceCode: booking.bookingCode || null,
  });

  try {
    await notifyUser({
      userId: stadium.owner,
      type: 'PAYOUT',
      title: 'Lacag diyaar ah (E-Garoon Wallet)',
      body: `$${released.toFixed(2)} USD ayaa hadda diyaar u ah bixid (${stadium.name}).`,
      bookingId: booking._id,
    });
  } catch (_e) {
    /* ignore notification fail */
  }

  return { wallet, tx };
}

/**
 * Called when a customer payment is refunded. Takes the stadium's share back out of the
 * wallet — from Held if still in escrow, otherwise from Available (clamped at zero, with
 * any shortfall recorded on the transaction for Finance to follow up).
 */
async function reverseBookingEscrow(payment) {
  if (!payment?._id) return null;

  const credit = await WalletTransaction.findOne({
    payment: payment._id,
    type: 'booking_escrow_credit',
    status: { $in: ['held', 'completed'] },
  });
  if (!credit) return null;

  const wasHeld = credit.status === 'held';
  const claimed = await WalletTransaction.findOneAndUpdate(
    { _id: credit._id, status: credit.status },
    { $set: { status: 'refunded' } },
    { returnDocument: 'after' }
  );
  if (!claimed) return null; // already reversed or released concurrently

  const field = wasHeld ? 'balanceHeld' : 'balanceAvailable';
  const before = await clampedDebit(claimed.wallet, field, claimed.amount, {
    totalEarned: claimed.amount,
  });
  const shortfall = round2(Math.max(0, claimed.amount - (before?.[field] || 0)));

  return WalletTransaction.create({
    wallet: claimed.wallet,
    stadium: claimed.stadium,
    owner: claimed.owner,
    booking: claimed.booking,
    payment: payment._id,
    type: 'booking_refund_deduction',
    amount: claimed.amount,
    currency: 'USD',
    targetBalance: wasHeld ? 'held' : 'available',
    direction: 'debit',
    status: 'completed',
    description: `Ciyaartii waa la jabiyay · Lacagta waa laga jaray ${wasHeld ? 'Escrow' : 'Available Balance'}`,
    referenceCode: claimed.referenceCode,
    meta: shortfall > 0 ? { shortfall } : undefined,
  });
}

async function assertOwnsStadium(user, stadiumId) {
  const stadium = await Stadium.findById(stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');
  if (stadium.owner.toString() !== user.id.toString()) {
    throw ApiError.forbidden('Keliya milkiilaha garoonka ayaa la bixi kara lacagta');
  }
  return stadium;
}

/**
 * Where an owner's withdrawals are paid: the mobile-money number saved on their account
 * (payout account, else their registered phone). It is derived server-side — the browser can't
 * choose a different number. To change it the owner resubmits it in Verification, which puts
 * the account back under Finance review before any withdrawal is possible.
 * The wallet type comes from the number's own carrier prefix.
 */
function resolvePayoutDestination(owner) {
  const account = owner?.payoutAccount;
  const rawNumber = account?.accountNumber || owner?.phone;
  const number = normalizeSomaliPhone(rawNumber);
  if (!number) return null;
  const carrier = detectCarrier(number);
  const method = carrier ? PAYOUT_METHODS[carrier.id] : null;
  if (!method) return null;
  return {
    operator: carrier.id,
    method: method.value,
    methodLabel: method.label,
    number,
    display: formatDisplay(number),
    accountName: account?.accountName || owner?.name || '',
    source: account?.accountNumber ? 'payout_account' : 'registered_phone',
  };
}

/** Production without a real SMS provider can't deliver a withdrawal code — refuse up front. */
function assertWithdrawalOtpDeliverable() {
  if (env.nodeEnv !== 'production') return;
  if (getOtpProvider('phone').name === 'mock') {
    throw ApiError.serviceUnavailable
      ? ApiError.serviceUnavailable('SMS verification is not set up yet, so withdrawals are unavailable. Please contact support.')
      : ApiError.badRequest('SMS verification is not set up yet, so withdrawals are unavailable. Please contact support.');
  }
}

/**
 * Step 1: Owner initiates a withdrawal request.
 * Generates OTP sent to the owner's registered phone number (not the payout number),
 * so a stolen session cannot redirect money to a number the attacker controls.
 */
async function initiateWithdrawal(user, { stadiumId, amount }) {
  assertWithdrawalOtpDeliverable();
  const numAmount = round2(amount);
  if (!numAmount || numAmount <= 0) {
    throw ApiError.badRequest('Geli lacag sax ah oo aad la baxayso');
  }

  const settings = await PlatformSettings.findOne({ key: 'default' });
  const minWithdrawal = settings?.minWithdrawalUsd || 10;
  if (numAmount < minWithdrawal) {
    throw ApiError.badRequest(`Lacagta ugu yar ee la la bixi karo waa $${minWithdrawal} USD`);
  }

  const stadium = await assertOwnsStadium(user, stadiumId);

  const currentUser = await User.findById(user.id);
  if (currentUser?.kyc?.status !== 'verified') {
    throw ApiError.forbidden(
      'Aqoonsigaaga (KYC) weli lama xaqiijin. Fadlan dir dukumiintiyada oo sug ansixinta Waaxda Maaliyadda.'
    );
  }
  if (!currentUser.phone) {
    throw ApiError.badRequest('Fadlan ku dar nambarka taleefanka akoonkaaga si OTP laguu soo diro');
  }

  const wallet = await getOrCreateWallet(stadium._id, user.id);
  if (wallet.status !== 'active') {
    throw ApiError.forbidden(`Wallet-kaagu ma shaqeynayo: ${wallet.freezeReason || 'Under Review'}`);
  }

  if (numAmount > wallet.balanceAvailable) {
    throw ApiError.badRequest(
      `Haraagaaga diyaar ka ah waa $${wallet.balanceAvailable.toFixed(2)} USD. Ma la bixi kartid $${numAmount.toFixed(2)} USD.`
    );
  }

  const destination = resolvePayoutDestination(currentUser);
  if (!destination) {
    throw ApiError.badRequest(
      'Add a valid Telesom, Somtel, Hormuud or Golis mobile-money number to your account (Verification → payout number) before withdrawing.'
    );
  }

  // Only one un-confirmed request per wallet: supersede any stale OTP step.
  await WithdrawalRequest.updateMany(
    { wallet: wallet._id, status: 'pending_otp' },
    { $set: { status: 'cancelled', notes: 'Superseded by a newer request' } }
  );

  let otpResult;
  try {
    otpResult = await otpService.sendOtp({
      channel: 'phone',
      target: currentUser.phone,
      purpose: 'withdrawal',
    });
  } catch (err) {
    throw ApiError.badRequest(`OTP diristu way fashilantay: ${err.message}`);
  }

  const rate = settings?.sllPerUsd || 8500;

  const withdrawal = await WithdrawalRequest.create({
    reference: generateWithdrawalReference(),
    wallet: wallet._id,
    stadium: stadium._id,
    owner: user.id,
    amount: numAmount,
    amountSlsh: numAmount * rate,
    currency: 'USD',
    exchangeRate: rate,
    payoutMethod: destination.method,
    payoutPhone: destination.number,
    payoutAccountName: destination.accountName,
    status: 'pending_otp',
    otpPhone: currentUser.phone,
  });

  return {
    withdrawalId: withdrawal._id,
    reference: withdrawal.reference,
    amount: withdrawal.amount,
    currency: withdrawal.currency,
    payoutMethod: withdrawal.payoutMethod,
    payoutDestination: { methodLabel: destination.methodLabel, display: destination.display, accountName: destination.accountName },
    phone: otpResult.target || currentUser.phone,
    expiresAt: otpResult.expiresAt,
    devCode: otpResult.devCode || null,
    message: `Koodhka OTP (6-digit) waxaa loo soo diray ${otpResult.target || currentUser.phone}. Fadlan geli si aad u xaqiijiso codsigaaga.`,
  };
}

/**
 * Step 2: Owner enters OTP to confirm withdrawal request.
 * Moves funds from `balanceAvailable` to `balanceProcessing` and queues for Department of Finance.
 * The status claim and the balance lock are both atomic, so concurrent confirmations
 * cannot overdraw the wallet.
 */
async function verifyWithdrawalOtp(user, { withdrawalId, otpCode }) {
  const withdrawal = await WithdrawalRequest.findById(withdrawalId);
  if (!withdrawal) throw ApiError.notFound('Withdrawal request not found');
  if (withdrawal.owner.toString() !== user.id.toString()) {
    throw ApiError.forbidden('Not authorized');
  }
  if (withdrawal.status !== 'pending_otp') {
    throw ApiError.badRequest(`Withdrawal is already in status: ${withdrawal.status}`);
  }

  await otpService.verifyOtp({
    channel: 'phone',
    target: withdrawal.otpPhone,
    purpose: 'withdrawal',
    code: otpCode,
  });

  const claimed = await WithdrawalRequest.findOneAndUpdate(
    { _id: withdrawal._id, status: 'pending_otp' },
    { $set: { status: 'pending_approval', otpVerifiedAt: new Date() } },
    { returnDocument: 'after' }
  );
  if (!claimed) throw ApiError.conflict('Withdrawal was already confirmed');

  const wallet = await adjustWallet(
    claimed.wallet,
    { balanceAvailable: -claimed.amount, balanceProcessing: claimed.amount },
    { status: 'active', balanceAvailable: { $gte: claimed.amount } }
  );
  if (!wallet) {
    await WithdrawalRequest.updateOne(
      { _id: claimed._id },
      { $set: { status: 'cancelled', notes: 'Insufficient available balance or wallet not active at confirmation' } }
    );
    throw ApiError.badRequest('Haraaga Available ma ku filna');
  }

  await WalletTransaction.create({
    wallet: wallet._id,
    stadium: claimed.stadium,
    owner: user.id,
    withdrawal: claimed._id,
    type: 'withdrawal_locked',
    amount: claimed.amount,
    currency: 'USD',
    targetBalance: 'processing',
    direction: 'transfer',
    status: 'processing',
    description: `Codsiga lacag-bixidda waa la xaqiijiyay · Waxaa loo gudbiyay Waaxda Maaliyadda (${payoutMethodLabel(claimed.payoutMethod)} - ${claimed.payoutPhone})`,
    referenceCode: claimed.reference,
  });

  return {
    success: true,
    withdrawal: claimed,
    message: 'Codsigaaga lacag-bixidda si guul leh ayaa loo xaqiijiyay! Waaxda Maaliyadda ee E-Garoon ayaa si toos ah kuugu soo wareejinaysa.',
  };
}

/**
 * Owner cancels a withdrawal that Finance has not paid out yet.
 * If the funds were already locked (OTP confirmed), they return to Available.
 */
async function cancelWithdrawal(user, { withdrawalId }) {
  const before = await WithdrawalRequest.findOneAndUpdate(
    { _id: withdrawalId, owner: user.id, status: { $in: ['pending_otp', 'pending_approval'] } },
    { $set: { status: 'cancelled', notes: 'Cancelled by owner' } },
    { returnDocument: 'before' }
  );
  if (!before) {
    const existing = await WithdrawalRequest.findById(withdrawalId);
    if (!existing || existing.owner.toString() !== user.id.toString()) {
      throw ApiError.notFound('Withdrawal request not found');
    }
    throw ApiError.badRequest(`Cannot cancel withdrawal with status: ${existing.status}`);
  }

  if (before.status === 'pending_approval') {
    const wallet = await adjustWallet(
      before.wallet,
      { balanceProcessing: -before.amount, balanceAvailable: before.amount },
      { balanceProcessing: { $gte: before.amount } }
    );
    if (!wallet) {
      await WithdrawalRequest.updateOne({ _id: before._id }, { $set: { status: before.status } });
      throw ApiError.conflict('Wallet balance changed, please retry');
    }
    await WalletTransaction.create({
      wallet: wallet._id,
      stadium: before.stadium,
      owner: before.owner,
      withdrawal: before._id,
      type: 'withdrawal_refunded',
      amount: before.amount,
      currency: 'USD',
      targetBalance: 'available',
      direction: 'transfer',
      status: 'cancelled',
      description: 'Codsiga lacag-bixidda waad joojisay · Lacagtii dib ayaa loogu celiyay Available Balance',
      referenceCode: before.reference,
    });
  }

  return { success: true, withdrawal: await WithdrawalRequest.findById(before._id) };
}

/**
 * Super Admin / Department of Finance confirms disbursement from E-Garoon Master Account.
 */
async function financeApproveWithdrawal(adminUser, { withdrawalId, disbursementReference, masterAccountUsed, notes }) {
  const current = await WithdrawalRequest.findById(withdrawalId);
  if (!current) throw ApiError.notFound('Withdrawal request not found');

  const withdrawal = await WithdrawalRequest.findOneAndUpdate(
    { _id: withdrawalId, status: { $in: ['pending_approval', 'processing'] } },
    {
      $set: {
        status: 'completed',
        disbursementReference: disbursementReference || `TX-EGR-${Date.now().toString().slice(-6)}`,
        disbursementMasterAccount:
          masterAccountUsed ||
          (current.payoutMethod === 'somtel_edahab' ? 'E-Garoon Master eDahab' : 'E-Garoon Master ZAAD'),
        disbursedBy: adminUser.id,
        disbursedAt: new Date(),
        notes: notes || 'Lacagta waxaa laga wareejiyay E-Garoon Master Account',
      },
    },
    { returnDocument: 'after' }
  );
  if (!withdrawal) {
    throw ApiError.badRequest(`Withdrawal is not pending approval (current: ${current.status})`);
  }

  const wallet = await adjustWallet(
    withdrawal.wallet,
    { balanceProcessing: -withdrawal.amount, totalWithdrawn: withdrawal.amount },
    { balanceProcessing: { $gte: withdrawal.amount } }
  );
  if (!wallet) {
    await WithdrawalRequest.updateOne({ _id: withdrawal._id }, { $set: { status: current.status } });
    throw ApiError.conflict('Wallet processing balance is lower than the withdrawal; investigate before paying out');
  }

  await WalletTransaction.create({
    wallet: wallet._id,
    stadium: withdrawal.stadium,
    owner: withdrawal.owner,
    withdrawal: withdrawal._id,
    type: 'withdrawal_disbursed',
    amount: withdrawal.amount,
    currency: 'USD',
    targetBalance: 'withdrawn',
    direction: 'debit',
    status: 'completed',
    description: `Lacagta waxaa si rasmi ah loogu wareejiyay ${withdrawal.payoutAccountName || 'Owner'} (${withdrawal.payoutPhone} - Ref: ${withdrawal.disbursementReference})`,
    referenceCode: withdrawal.disbursementReference,
  });

  try {
    await notifyUser({
      userId: withdrawal.owner,
      type: 'PAYOUT',
      title: 'Lacagtaadii waa la soo wareejiyay! 🟢',
      body: `Waaxda Maaliyadda ee E-Garoon waxay $${withdrawal.amount} USD ku shubtay ${withdrawal.payoutPhone} (${withdrawal.disbursementReference}).`,
    });
  } catch (_e) {
    /* ignore */
  }

  return { success: true, withdrawal };
}

/**
 * Super Admin / Department of Finance rejects withdrawal and refunds to available balance.
 */
async function financeRejectWithdrawal(adminUser, { withdrawalId, reason }) {
  const current = await WithdrawalRequest.findById(withdrawalId);
  if (!current) throw ApiError.notFound('Withdrawal request not found');

  const withdrawal = await WithdrawalRequest.findOneAndUpdate(
    { _id: withdrawalId, status: { $in: ['pending_approval', 'processing'] } },
    {
      $set: {
        status: 'rejected',
        rejectionReason: reason || 'Codsigii lacag-bixidda waa la diiday',
        disbursedBy: adminUser.id,
        disbursedAt: new Date(),
      },
    },
    { returnDocument: 'after' }
  );
  if (!withdrawal) {
    throw ApiError.badRequest(`Cannot reject withdrawal with status: ${current.status}`);
  }

  const wallet = await adjustWallet(
    withdrawal.wallet,
    { balanceProcessing: -withdrawal.amount, balanceAvailable: withdrawal.amount },
    { balanceProcessing: { $gte: withdrawal.amount } }
  );
  if (!wallet) {
    await WithdrawalRequest.updateOne({ _id: withdrawal._id }, { $set: { status: current.status } });
    throw ApiError.conflict('Wallet processing balance is lower than the withdrawal; investigate before rejecting');
  }

  await WalletTransaction.create({
    wallet: wallet._id,
    stadium: withdrawal.stadium,
    owner: withdrawal.owner,
    withdrawal: withdrawal._id,
    type: 'withdrawal_refunded',
    amount: withdrawal.amount,
    currency: 'USD',
    targetBalance: 'available',
    direction: 'transfer',
    status: 'refunded',
    description: `Codsigii lacag-bixidda waa la diiday · Lacagtii dib ayaa loogu celiyay Available Balance (Sabab: ${reason || 'N/A'})`,
    referenceCode: withdrawal.reference,
  });

  try {
    await notifyUser({
      userId: withdrawal.owner,
      type: 'PAYOUT',
      title: 'Codsiga lacag-bixidda waa la diiday 🔴',
      body: `Sabab: ${reason || 'Fadlan la xiriir maamulka'}. Lacagtii $${withdrawal.amount} dib ayaa loogu celiyay Wallet-kaaga.`,
    });
  } catch (_e) {
    /* ignore */
  }

  return { success: true, withdrawal };
}

/**
 * Stadium Owner submits KYC document & Payout details.
 */
async function submitOwnerKyc(userId, { idType, idNumber, businessName, documentUrl, payoutOperator, payoutAccountNumber, payoutAccountName }) {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('User not found');

  // Self-registered owners are verified from these documents, so they must actually provide them.
  const hasDocs = Boolean((idNumber || user.kyc?.idNumber) && (documentUrl || user.kyc?.documentUrl));
  if (user.selfRegistered && !hasDocs) {
    throw ApiError.badRequest('Upload your ID document and enter the ID number to request verification.');
  }

  user.kyc = {
    idType: idType || 'national_id',
    idNumber: idNumber ? String(idNumber).trim() : user.kyc?.idNumber,
    businessName: businessName ? String(businessName).trim() : user.kyc?.businessName,
    documentUrl: documentUrl ? String(documentUrl).trim() : user.kyc?.documentUrl,
    status: 'pending',
    submittedAt: new Date(),
    rejectionReason: null,
  };

  if (payoutAccountNumber) {
    const normalizedPayout = normalizeSomaliPhone(payoutAccountNumber);
    if (!normalizedPayout || !detectCarrier(normalizedPayout)) {
      throw ApiError.badRequest('Enter a valid Somali mobile-money number (Telesom 063, Somtel 065, Hormuud 061 or Golis 090).');
    }
    user.payoutAccount = {
      operator: detectCarrier(normalizedPayout).id,
      accountNumber: normalizedPayout,
      accountName: payoutAccountName ? String(payoutAccountName).trim() : user.name,
      isVerified: false, // flips to true when Finance verifies the KYC
      lastUpdated: new Date(),
    };
  }

  await user.save();
  return { success: true, user: user.toSafeJSON() };
}

/**
 * Super Admin reviews KYC.
 */
async function financeReviewKyc(adminUser, { userId, status, rejectionReason }) {
  const target = await User.findById(userId);
  if (!target) throw ApiError.notFound('User not found');

  if (!['verified', 'rejected'].includes(status)) {
    throw ApiError.badRequest('Status must be verified or rejected');
  }

  target.kyc = target.kyc || {};
  target.kyc.status = status;
  target.kyc.verifiedBy = adminUser.id;
  target.kyc.verifiedAt = new Date();
  if (target.payoutAccount?.accountNumber) {
    target.payoutAccount.isVerified = status === 'verified';
  }
  if (status === 'rejected') {
    target.kyc.rejectionReason = rejectionReason || 'Document could not be verified';
  } else {
    target.kyc.rejectionReason = null;
  }

  await target.save();

  // A verified self-registered owner's submitted stadiums go live in the public list.
  let publishedStadiums = 0;
  if (status === 'verified' && target.selfRegistered) {
    publishedStadiums = await require('./ownerVerification.service').publishOwnerStadiums(target._id);
  }

  try {
    await notifyUser({
      userId: target._id,
      type: 'SYSTEM',
      title: status === 'verified' ? 'Aqoonsigaaga waa la xaqiijiyay! 🟢' : 'Aqoonsigaaga waa la diiday 🔴',
      body: status === 'verified'
        ? 'E-Garoon waxay xaqiijisay akoonkaaga. Garoomadaada hadda waa muuqdaan, waxaadna la bixi kartaa lacagahaaga.'
        : `Sabab: ${rejectionReason || 'Fadlan dib u soo geli dukumiinti sax ah.'}`,
    });
  } catch (_e) {
    /* ignore */
  }

  return { success: true, user: target.toSafeJSON(), publishedStadiums };
}

/** Populate used wherever a transaction is shown: which booking / field / stadium it came from. */
const TX_POPULATE = [
  { path: 'stadium', select: 'name' },
  {
    path: 'booking',
    select: 'bookingCode startTime endTime field status',
    populate: { path: 'field', select: 'name type' },
  },
];

/**
 * Wallet overview for an owner: totals across ALL their stadiums (or one, when `stadiumId` is
 * given), a per-stadium breakdown, recent transactions, open withdrawals, and where money is paid.
 * `wallet` / `recentTransactions` keep their old meaning for older clients.
 */
async function getOwnerWalletSummary(user, { stadiumId } = {}) {
  const owner = await User.findById(user.id).select('name phone kyc payoutAccount selfRegistered role');
  const settings = await PlatformSettings.findOne({ key: 'default' });
  const stadiums = await Stadium.find({ owner: user.id }).select('name status').sort({ createdAt: 1 });

  let selected = null;
  if (stadiumId) {
    selected = stadiums.find((st) => String(st._id) === String(stadiumId));
    if (!selected) throw ApiError.forbidden('Keliya milkiilaha garoonka ayaa arki kara lacagtan');
  }

  const wallets = [];
  for (const st of stadiums) {
    const w = (await getOrCreateWallet(st._id, user.id)).toObject();
    wallets.push({ ...w, stadiumName: st.name, stadiumStatus: st.status });
  }
  const scope = selected ? wallets.filter((w) => String(w.stadium) === String(selected._id)) : wallets;

  const sum = (key) => round2(scope.reduce((acc, w) => acc + Number(w[key] || 0), 0));
  const totals = {
    held: sum('balanceHeld'),
    available: sum('balanceAvailable'),
    processing: sum('balanceProcessing'),
    withdrawn: sum('totalWithdrawn'),
    earned: sum('totalEarned'),
  };
  // "Total balance": everything the owner is owed right now (not yet paid out).
  totals.balance = round2(totals.held + totals.available + totals.processing);

  const walletIds = scope.map((w) => w._id);
  const [recentTransactions, pendingWithdrawals] = await Promise.all([
    WalletTransaction.find({ wallet: { $in: walletIds } })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate(TX_POPULATE),
    WithdrawalRequest.find({
      wallet: { $in: walletIds },
      status: { $in: ['pending_otp', 'pending_approval', 'processing'] },
    })
      .sort({ createdAt: -1 })
      .populate('stadium', 'name'),
  ]);

  const kyc = owner?.kyc || { status: 'unsubmitted' };
  const destination = resolvePayoutDestination(owner);

  return {
    totals,
    wallets,
    selectedStadiumId: selected ? String(selected._id) : null,
    wallet: scope[0] || null, // legacy shape
    kyc,
    payoutAccount: owner?.payoutAccount || {},
    payoutDestination: destination,
    canWithdraw: kyc.status === 'verified' && Boolean(destination),
    pendingWithdrawals,
    recentTransactions,
    masterAccounts: settings?.masterAccounts || {},
    minWithdrawalUsd: settings?.minWithdrawalUsd || 10,
    sllPerUsd: Number(settings?.sllPerUsd || 8500),
  };
}

module.exports = {
  getOrCreateWallet,
  holdBookingPayment,
  releaseBookingEscrow,
  reverseBookingEscrow,
  cancelWithdrawal,
  initiateWithdrawal,
  verifyWithdrawalOtp,
  financeApproveWithdrawal,
  financeRejectWithdrawal,
  submitOwnerKyc,
  financeReviewKyc,
  getOwnerWalletSummary,
  resolvePayoutDestination,
  TX_POPULATE,
};
