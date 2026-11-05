/**
 * Mobile-money wallets an owner can be paid to, keyed by carrier id (see utils/somaliPhone CARRIERS).
 * `gateway` is the Sifalo gateway family the payout would belong to.
 */
const PAYOUT_METHODS = {
  telesom: { value: 'telesom_zaad', label: 'Telesom ZAAD', gateway: 'waafi' },
  hormuud: { value: 'hormuud_evc', label: 'Hormuud EVC', gateway: 'waafi' },
  somtel: { value: 'somtel_edahab', label: 'Somtel eDahab', gateway: 'edahab' },
  golis: { value: 'golis_sahal', label: 'Golis SAHAL', gateway: 'waafi' },
};

const PAYOUT_METHOD_VALUES = Object.values(PAYOUT_METHODS).map((m) => m.value);

function payoutMethodLabel(value) {
  return Object.values(PAYOUT_METHODS).find((m) => m.value === value)?.label || value;
}

module.exports = { PAYOUT_METHODS, PAYOUT_METHOD_VALUES, payoutMethodLabel };
