const StadiumAgreement = require('../models/StadiumAgreement');
const ApiError = require('../utils/ApiError');
const { AGREEMENT_STATUS } = require('../constants/revenue');
const {
  moneyRound,
  policyFromBusiness,
  rulesFromPolicy,
  toUsd,
} = require('./revenuePolicy.service');

function bookingFeeUsdFromRules(rules) {
  if (!rules?.bookingFeeEnabled) return 0;
  return toUsd(rules.bookingFeeAmount, rules.bookingFeeCurrency, rules.sllPerUsd);
}

function feesForSide(rules, side, { coverFullMatch } = {}) {
  const perTeam = bookingFeeUsdFromRules(rules);
  if (!perTeam) return 0;
  const payer = rules.bookingFeePayer || 'each_team';
  if (coverFullMatch) {
    // When Team A covers the full match for both teams,
    // both Team A fee and Team B fee are charged so E-Garoon does not lose Team B's fee.
    return moneyRound(perTeam * 2);
  }
  if (payer === 'each_team') return perTeam;
  if (payer === 'team_a_only') return side === 'teamA' ? perTeam : 0;
  if (payer === 'split') return moneyRound(perTeam / 2);
  return perTeam;
}

function snapshotFromRules(rules, { agreement = null, source = 'platform_policy' } = {}) {
  return {
    agreementId: agreement?._id || null,
    agreementVersion: agreement?.version || null,
    source,
    model: rules.model,
    bookingFeeEnabled: Boolean(rules.bookingFeeEnabled),
    bookingFeeAmount: Number(rules.bookingFeeAmount || 0),
    bookingFeeCurrency: rules.bookingFeeCurrency || 'SLL',
    bookingFeePayer: rules.bookingFeePayer || 'each_team',
    bookingFeeUsd: bookingFeeUsdFromRules(rules),
    subscriptionEnabled: Boolean(rules.subscriptionEnabled),
    subscriptionAmount: Number(rules.subscriptionAmount || 0),
    subscriptionCurrency: rules.subscriptionCurrency || 'USD',
    subscriptionScope: rules.subscriptionScope || 'stadium',
    commissionEnabled: Boolean(rules.commissionEnabled),
    commissionPercent: Number(rules.commissionPercent || 0),
    sllPerUsd: Number(rules.sllPerUsd || 8000),
    capturedAt: new Date(),
  };
}

async function getActiveAgreement(stadiumId, at = new Date()) {
  if (!stadiumId) return null;
  return StadiumAgreement.findOne({
    stadium: stadiumId,
    status: AGREEMENT_STATUS.ACTIVE,
    effectiveFrom: { $lte: at },
    $or: [{ effectiveTo: null }, { effectiveTo: { $exists: false } }, { effectiveTo: { $gt: at } }],
  })
    .sort({ version: -1 })
    .lean();
}

async function resolveRulesForStadium(stadiumId, at = new Date()) {
  const policy = policyFromBusiness();
  const agreement = await getActiveAgreement(stadiumId, at);
  if (agreement) {
    return {
      rules: agreement.rules,
      agreement,
      source: 'stadium_agreement',
      policy,
    };
  }
  if (policy.requireStadiumAgreement) {
    throw ApiError.conflict(
      'This stadium has no accepted revenue agreement yet. Super Admin must send one and the owner must accept it.',
      { code: 'STADIUM_AGREEMENT_REQUIRED' }
    );
  }
  return {
    rules: rulesFromPolicy(policy),
    agreement: null,
    source: 'platform_policy',
    policy,
  };
}

function applyDues(snapshot, { teamAShare = 0, teamBShare = 0, coverFullMatch = false } = {}) {
  const rules = {
    bookingFeeEnabled: snapshot?.bookingFeeEnabled,
    bookingFeeAmount: snapshot?.bookingFeeAmount,
    bookingFeeCurrency: snapshot?.bookingFeeCurrency,
    bookingFeePayer: snapshot?.bookingFeePayer,
    sllPerUsd: snapshot?.sllPerUsd,
  };
  const teamAFee = feesForSide(rules, 'teamA', { coverFullMatch: false });
  const teamBFee = feesForSide(rules, 'teamB', { coverFullMatch: false });
  const fullFee = feesForSide(rules, 'teamA', { coverFullMatch: true });
  const rentA = moneyRound(teamAShare);
  const rentB = moneyRound(teamBShare);
  const rentTotal = moneyRound(rentA + rentB);
  return {
    rentTotal,
    rentTeamA: rentA,
    rentTeamB: rentB,
    platformFeeTeamA: teamAFee,
    platformFeeTeamB: teamBFee,
    platformFeeFullMatch: fullFee,
    teamADue: moneyRound(rentA + teamAFee),
    teamBDue: moneyRound(rentB + teamBFee),
    payableFullMatch: moneyRound(rentTotal + fullFee),
    payableTeamShare: moneyRound(rentA + teamAFee),
  };
}

async function buildForStadium(stadiumId, { rentTotal, teamShare, at } = {}) {
  const { rules, agreement, source } = await resolveRulesForStadium(stadiumId, at);
  const snapshot = snapshotFromRules(rules, { agreement, source });
  const half = teamShare != null ? Number(teamShare) : moneyRound(Number(rentTotal || 0) / 2);
  const other = moneyRound(Number(rentTotal || 0) - half);
  const dues = applyDues(snapshot, { teamAShare: half, teamBShare: other });
  return { snapshot, dues, rules, agreement };
}

function splitCollectedAmount(snapshot, amount, { coverFullMatch = false, side = 'teamA' } = {}) {
  const total = moneyRound(amount);
  const rules = snapshot || {};
  const fee = coverFullMatch
    ? feesForSide(rules, 'teamA', { coverFullMatch: true })
    : feesForSide(rules, side, { coverFullMatch: false });
  const platformBookingFeeAmount = Math.min(fee, total);
  const rentAmount = moneyRound(Math.max(0, total - platformBookingFeeAmount));
  return { rentAmount, platformBookingFeeAmount };
}

module.exports = {
  bookingFeeUsdFromRules,
  feesForSide,
  snapshotFromRules,
  getActiveAgreement,
  resolveRulesForStadium,
  applyDues,
  buildForStadium,
  splitCollectedAmount,
};
