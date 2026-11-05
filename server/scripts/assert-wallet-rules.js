/**
 * Wallet money-safety assertions. Needs a throwaway MongoDB:
 *   WALLET_TEST_MONGO_URI=mongodb://localhost:27017/egaroon_wallet_test npm run test:wallet
 * Refuses to run without that variable so it can never touch the real database.
 */
const assert = require('assert');
const mongoose = require('mongoose');

const uri = process.env.WALLET_TEST_MONGO_URI;
if (!uri) {
  console.error('Set WALLET_TEST_MONGO_URI to a throwaway database (it is wiped).');
  process.exit(1);
}

const Stadium = require('../src/models/Stadium');
const EGaroonWallet = require('../src/models/EGaroonWallet');
const WalletTransaction = require('../src/models/WalletTransaction');
const WithdrawalRequest = require('../src/models/WithdrawalRequest');
const User = require('../src/models/User');
const walletService = require('../src/services/egaroonWallet.service');

const oid = () => new mongoose.Types.ObjectId();

async function main() {
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await EGaroonWallet.init();
  await WalletTransaction.init();

  const owner = oid();
  const stadium = oid();
  await mongoose.connection.collection(Stadium.collection.name).insertOne({ _id: stadium, owner, name: 'Test Stadium' });

  const booking = { _id: oid(), stadium, bookingCode: 'T-1' };
  const payment = { _id: oid() };
  const wallet = () => EGaroonWallet.findOne({ stadium }).lean();

  // 1. Duplicate payment confirmation credits escrow once.
  await Promise.all([
    walletService.holdBookingPayment(booking, 40, payment),
    walletService.holdBookingPayment(booking, 40, payment),
  ]);
  let w = await wallet();
  assert.strictEqual(w.balanceHeld, 40, 'duplicate hold must credit once');

  // 2. Check-in and settlement racing release the money once.
  await Promise.all([
    walletService.releaseBookingEscrow(booking, { source: 'checkin' }),
    walletService.releaseBookingEscrow(booking, { source: 'settle' }),
    walletService.releaseBookingEscrow(booking, { source: 'settle' }),
  ]);
  w = await wallet();
  assert.deepStrictEqual([w.balanceHeld, w.balanceAvailable], [0, 40], 'release must move money once');

  // 3. Refund after release takes it back out of Available, exactly once.
  await Promise.all([
    walletService.reverseBookingEscrow(payment),
    walletService.reverseBookingEscrow(payment),
  ]);
  w = await wallet();
  assert.deepStrictEqual([w.balanceAvailable, w.totalEarned], [0, 0], 'refund must debit once');

  // 4. Refund while still in escrow debits Held.
  const b2 = { _id: oid(), stadium, bookingCode: 'T-2' };
  const p2 = { _id: oid() };
  await walletService.holdBookingPayment(b2, 25, p2);
  await walletService.reverseBookingEscrow(p2);
  w = await wallet();
  assert.strictEqual(w.balanceHeld, 0, 'refund of held escrow clears Held');

  // 5. Finance approve vs reject racing on one withdrawal: exactly one wins, balances stay consistent.
  await EGaroonWallet.updateOne({ stadium }, { $set: { balanceProcessing: 50 } });
  const wd = await WithdrawalRequest.create({
    reference: 'WTH-TEST-1',
    wallet: w._id,
    stadium,
    owner,
    amount: 50,
    payoutMethod: 'telesom_zaad',
    payoutPhone: '252634000000',
    status: 'pending_approval',
  });
  const admin = { id: oid() };
  const results = await Promise.allSettled([
    walletService.financeApproveWithdrawal(admin, { withdrawalId: wd._id }),
    walletService.financeRejectWithdrawal(admin, { withdrawalId: wd._id, reason: 'test' }),
  ]);
  assert.strictEqual(results.filter((r) => r.status === 'fulfilled').length, 1, 'only one finance action may win');
  w = await wallet();
  assert.strictEqual(w.balanceProcessing, 0);
  assert.strictEqual(w.totalWithdrawn + w.balanceAvailable, 50, 'the 50 is either paid out or returned, never both');

  // 6. Withdrawal flow: KYC gate, ownership, minimum, balance, OTP lock, cancel.
  await EGaroonWallet.updateOne({ stadium }, { $set: { balanceAvailable: 100, balanceProcessing: 0 } });
  await mongoose.connection.collection(User.collection.name).insertOne({
    _id: owner,
    name: 'Test Owner',
    email: 'owner@test.local',
    phone: '0634111222',
    role: 'stadium_owner',
    kyc: { status: 'unsubmitted' },
  });
  const ownerUser = { id: owner.toString() };
  const withdraw = (user, amount, extra = {}) =>
    walletService.initiateWithdrawal(user, { stadiumId: stadium, amount, payoutMethod: 'telesom_zaad', ...extra });
  const rejects = async (promise, msg) => {
    let threw = false;
    try {
      await promise;
    } catch {
      threw = true;
    }
    assert.ok(threw, msg);
  };

  await rejects(withdraw(ownerUser, 30), 'unverified KYC must not withdraw');
  await mongoose.connection.collection(User.collection.name).updateOne({ _id: owner }, { $set: { 'kyc.status': 'verified' } });
  await rejects(withdraw({ id: oid().toString() }, 30), 'non-owner must not withdraw');
  await rejects(withdraw(ownerUser, 5), 'below minimum must be rejected');
  await rejects(withdraw(ownerUser, 500), 'above available must be rejected');

  const started = await withdraw(ownerUser, 30);
  assert.ok(started.devCode, 'mock OTP provider should expose devCode in test');
  w = await wallet();
  assert.strictEqual(w.balanceAvailable, 100, 'funds are not locked until the OTP is confirmed');

  await rejects(
    walletService.verifyWithdrawalOtp(ownerUser, { withdrawalId: started.withdrawalId, otpCode: '000000' }),
    'wrong OTP must be rejected'
  );
  await walletService.verifyWithdrawalOtp(ownerUser, { withdrawalId: started.withdrawalId, otpCode: started.devCode });
  w = await wallet();
  assert.deepStrictEqual([w.balanceAvailable, w.balanceProcessing], [70, 30], 'OTP confirmation locks funds');

  await rejects(
    walletService.verifyWithdrawalOtp(ownerUser, { withdrawalId: started.withdrawalId, otpCode: started.devCode }),
    'a confirmed withdrawal cannot be confirmed twice'
  );

  await Promise.all([
    walletService.cancelWithdrawal(ownerUser, { withdrawalId: started.withdrawalId }),
    walletService.cancelWithdrawal(ownerUser, { withdrawalId: started.withdrawalId }).catch(() => null),
  ]);
  w = await wallet();
  assert.deepStrictEqual([w.balanceAvailable, w.balanceProcessing], [100, 0], 'cancel returns funds exactly once');

  console.log('wallet rules OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
