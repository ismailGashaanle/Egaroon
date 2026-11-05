/**
 * Captain-facing price lines from server pricing only — never recalculate charges.
 * Shows:
 * 1. Base price & discount %/$ (when discount applied)
 * 2. Stadium Rent (full match or team share)
 * 3. E-Garoon service fee (per team or full match)
 * 4. Total due / payable
 * 5. Team shares
 */
function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export function hasServerDiscount(pricing) {
  const total = Number(pricing?.totalPrice || 0);
  const base = Number(pricing?.baseTotalPrice ?? total);
  const amount = Number(pricing?.discountAmount || 0);
  return amount > 0 && base > total;
}

/** Label like "−20%" or "−$10.00" (plus amount in parens for %). */
export function formatDiscountLabel(pricing) {
  const amount = Number(pricing?.discountAmount || 0);
  const pct = pricing?.discountPercent != null ? Number(pricing.discountPercent) : null;
  if (pct != null && pct > 0) {
    return `−${pct}% (−${money(amount)})`;
  }
  return `−${money(amount)}`;
}

/**
 * @param {object} props
 * @param {object} props.pricing — booking or slot pricing from API
 * @param {(key: string) => string} props.t
 * @param {'payment'|'booking'} [props.ns='payment'] — i18n key prefix
 * @param {boolean} [props.showShares=true]
 * @param {boolean} [props.coverFullMatch=false]
 * @param {boolean} [props.compact=false]
 */
export default function PricingBreakdown({
  pricing,
  t,
  ns = 'payment',
  showShares = true,
  coverFullMatch = false,
  compact = false,
}) {
  const rentTotal = Number(pricing?.stadiumRentTotal ?? pricing?.totalPrice ?? 0);
  const rentBase = Number(pricing?.baseTotalPrice ?? rentTotal);
  const rentShare = Number(pricing?.teamShare ?? rentTotal / 2);

  // Platform fee detection (transparent breakdown)
  const derivedFeePerTeam =
    pricing?.payableTeamShare != null && pricing?.teamShare != null
      ? Math.max(0, Math.round((Number(pricing.payableTeamShare) - Number(pricing.teamShare)) * 100) / 100)
      : 0;
  const platformFeePerTeam = Number(pricing?.platformFee ?? derivedFeePerTeam ?? 0);
  const derivedFeeFull =
    pricing?.payableFullMatch != null && pricing?.totalPrice != null
      ? Math.max(0, Math.round((Number(pricing.payableFullMatch) - Number(pricing.totalPrice)) * 100) / 100)
      : platformFeePerTeam * 2;
  const platformFeeFull = Number(
    pricing?.platformFeeFullMatch ?? derivedFeeFull ?? platformFeePerTeam * 2
  );

  const activeFee = coverFullMatch ? platformFeeFull : platformFeePerTeam;
  const activeRent = coverFullMatch ? rentTotal : rentShare;
  const totalDue = coverFullMatch
    ? Number(pricing?.payableFullMatch ?? rentTotal + platformFeeFull)
    : Number(pricing?.payableTeamShare ?? rentShare + platformFeePerTeam);

  const discounted = hasServerDiscount(pricing);
  const row = compact ? 'text-xs' : 'text-sm';

  return (
    <div className={`space-y-1.5 ${row}`}>
      {discounted && (
        <>
          <div className="flex justify-between gap-2">
            <span className="text-muted">{t(`${ns}.basePrice`)}</span>
            <span className="font-medium tabular-nums">{money(rentBase)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted">
              {pricing?.discountName || t(`${ns}.discount`)}
            </span>
            <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatDiscountLabel(pricing)}
            </span>
          </div>
        </>
      )}

      {/* Stadium Rent */}
      <div className="flex justify-between gap-2">
        <span className="text-muted">
          {t(`${ns}.stadiumRent`)}
          {!coverFullMatch && (
            <span className="ml-1 text-xs text-disabled">
              ({(() => {
                const label = t(`${ns}.yourShareDue`) || t('payment.yourShareDue');
                return (!label || label.includes('.')) ? 'Qaybtaada' : label;
              })()})
            </span>
          )}
        </span>
        <span className="font-medium tabular-nums">{money(activeRent)}</span>
      </div>

      {/* E-Garoon Service Fee */}
      {activeFee > 0 && (
        <div className="flex justify-between gap-2 text-brand-green dark:text-brand-green/90">
          <span className="flex items-center gap-1 font-medium">
            <span>{t(`${ns}.platformFee`)}</span>
            <span className="text-[11px] opacity-80">
              ({coverFullMatch ? t(`${ns}.feeBothTeams`) : t(`${ns}.feePerTeam`)})
            </span>
          </span>
          <span className="font-semibold tabular-nums">+{money(activeFee)}</span>
        </div>
      )}

      {/* Total Due */}
      <div className="flex justify-between gap-2 border-t border-border/50 pt-1.5 dark:border-dark-border/50">
        <span className="font-semibold">
          {t(`${ns}.totalDue`) || t(`${ns}.totalPrice`)}
        </span>
        <span className="font-display font-bold tabular-nums text-brand-green">
          {money(totalDue)}
        </span>
      </div>

      {/* Show shares breakdown if split */}
      {showShares && !coverFullMatch && (
        <div className="mt-2 space-y-1 rounded-lg bg-black/[0.02] p-2 text-xs dark:bg-white/[0.02]">
          <div className="flex justify-between gap-2">
            <span className="text-muted">{t(`${ns}.teamAShare`)}</span>
            <span className="font-medium tabular-nums">
              {money(pricing?.payableTeamShare ?? rentShare + platformFeePerTeam)}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted">{t(`${ns}.teamBShare`)}</span>
            <span className="font-medium tabular-nums">
              {money(pricing?.payableTeamShare ?? rentShare + platformFeePerTeam)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
