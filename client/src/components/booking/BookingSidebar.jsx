import Select from '../common/Select';
import Button from '../common/Button';
import { formatLabel, formatTeamPricingBreakdown } from '../../lib/slotUtils';
import { useTranslation } from '../../i18n/LanguageContext';
import PricingBreakdown from './PricingBreakdown';

export default function BookingSidebar({
  fields,
  selectedField,
  onFieldChange,
  selectedSlot,
  isAuthenticated,
  isCaptain,
  loading,
  onContinue,
  matchedArea,
}) {
  const { t } = useTranslation();
  const breakdown = selectedField
    ? formatTeamPricingBreakdown(selectedField, selectedSlot?.pricing)
    : null;
  const slotPricing = selectedSlot?.pricing;

  return (
    <div className="rounded-2xl border border-border bg-white p-5 shadow-card dark:border-dark-border dark:bg-dark-surface-2">
      <h4 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">{t('booking.bookSlot')}</h4>
      <p className="mt-1 text-xs text-muted dark:text-dark-muted">{t('booking.eachPays')}</p>

      <div className="mt-4 space-y-4">
        <Select label={t('booking.field')} value={selectedField?._id || ''} onChange={(e) => onFieldChange(e.target.value)}>
          <option value="">{t('booking.field')}</option>
          {fields.map((f) => (
            <option key={f._id} value={f._id}>
              {f.name} ({f.type})
            </option>
          ))}
        </Select>

        {matchedArea && (
          <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 px-3 py-2 text-xs font-medium text-brand-green">
            {t('search.matchedArea')}: {matchedArea}
          </div>
        )}

        <div className="rounded-xl bg-warmwhite p-3 text-sm dark:bg-dark-surface">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-dark-muted">{t('booking.timeSlot')}</p>
          <p className="mt-1 font-bold text-charcoal dark:text-dark-text">
            {selectedSlot
              ? `${formatLabel(selectedSlot.start)} → ${formatLabel(selectedSlot.end)}`
              : t('booking.pickSlot')}
          </p>
        </div>

        {selectedField && breakdown && (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              {selectedField.type} · {breakdown.capacity} vs {breakdown.capacity}
              {breakdown.perPlayer != null && ` · $${breakdown.perPlayer.toFixed(2)}/player`}
            </p>
            <div className="rounded-xl border border-border p-3 dark:border-dark-border">
              <PricingBreakdown
                pricing={
                  slotPricing?.totalPrice != null
                    ? slotPricing
                    : {
                        totalPrice: breakdown.matchTotal,
                        baseTotalPrice: breakdown.baseTotal,
                        discountAmount: breakdown.discountAmount,
                        discountPercent: breakdown.discountPercent,
                        discountName: breakdown.discountName,
                        teamShare: breakdown.teamA,
                      }
                }
                t={t}
                ns="booking"
                compact
              />
            </div>
          </div>
        )}

        <div className="rounded-xl bg-forest/5 p-4 dark:bg-dark-primary/10">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted dark:text-dark-muted">{t('booking.youPay')}</span>
            <span className="font-display text-xl font-bold text-forest dark:text-dark-primary">
              {breakdown ? `$${breakdown.teamA.toFixed(2)}` : '—'}
            </span>
          </div>
        </div>

        <Button className="w-full bg-lime-accent text-charcoal hover:bg-lime-accent/90" size="lg" loading={loading} onClick={onContinue}>
          {!isAuthenticated ? t('booking.loginToContinue') : t('booking.holdAndPay')}
        </Button>

        {isAuthenticated && !isCaptain && (
          <p className="text-center text-xs text-status-cancelled-text">{t('booking.onlyCaptains')}</p>
        )}
      </div>
    </div>
  );
}
