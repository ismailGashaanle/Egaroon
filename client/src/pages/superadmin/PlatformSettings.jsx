import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiPercent,
  FiClock,
  FiShield,
  FiMapPin,
  FiMail,
  FiPhone,
  FiSave,
  FiUsers,
  FiGrid,
  FiDollarSign,
  FiFileText,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import { FullPageSpinner } from '../../components/common/Spinner';
import { adminApi } from '../../api/adminApi';
import WeatherRiskBoard from '../../components/weather/WeatherRiskBoard';
import { toastApiError } from '../../lib/support';
import { useTranslation } from '../../i18n/LanguageContext';

const EMPTY = {
  // ── Revenue Policy ─────────────────────────────────────────────────────────
  revenueModelMode: 'flexible',
  bookingFeeEnabled: true,
  bookingFeeAmount: 1000,
  bookingFeeCurrency: 'SLL',
  bookingFeePayer: 'each_team',
  sllPerUsd: 20000,
  stadiumSubscriptionEnabled: true,
  stadiumSubscriptionAmount: 7,
  stadiumSubscriptionCurrency: 'USD',
  subscriptionGraceDays: 4,
  subscriptionAutoLockEnabled: true,
  subscriptionScope: 'stadium',
  commissionEnabled: false,
  allowCombineBookingFeeAndCommission: false,
  requireStadiumAgreement: false,
  policyEffectiveAt: '',
  // ── Existing fields ────────────────────────────────────────────────────────
  platformCommissionPercent: 4,
  fieldSubscriptionEnabled: false,
  fieldSubscriptionAmount: 7,
  fieldSubscriptionCurrency: 'USD',
  bookingHoldMinutes: 10,
  bookingHoldGraceMinutes: 2,
  teamBPaymentDeadlineMinutes: 12,
  teamBPriorityMinutes: 12,
  teamBGraceMinutes: 10,
  teamBMaxGraceExtensions: 2,
  teamBFinalGraceMinutes: 3,
  slotDemandTtlSeconds: 180,
  autoRefundTeamAOnTeamBTimeout: true,
  preferWalletCreditOnDemandRelease: true,
  releaseSlotOnPartialPaymentTimeout: true,
  ownerPayoutDelayMinutes: 60,
  noShowGraceMinutes: 15,
  maxMatchDistanceKm: 30,
  lineupEnabled: false,
  giftEnabled: false,
  weatherEnabled: false,
  ownerCommissionVisible: false,
  publicOwnerSignup: false,
  supportEmail: '',
  supportPhone: '',
  supportWhatsapp: '',
};

export default function PlatformSettings() {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [revenuePreview, setRevenuePreview] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await adminApi.getSettings();
        const s = data.data.settings || {};
        setForm({
          // Revenue policy fields
          revenueModelMode: s.revenueModelMode || 'flexible',
          bookingFeeEnabled: s.bookingFeeEnabled !== false,
          bookingFeeAmount: s.bookingFeeAmount ?? 1000,
          bookingFeeCurrency: s.bookingFeeCurrency || 'SLL',
          bookingFeePayer: s.bookingFeePayer || 'each_team',
          sllPerUsd: s.sllPerUsd ?? 20000,
          stadiumSubscriptionEnabled: s.stadiumSubscriptionEnabled !== false,
          stadiumSubscriptionAmount: s.stadiumSubscriptionAmount ?? 7,
          stadiumSubscriptionCurrency: s.stadiumSubscriptionCurrency || 'USD',
          subscriptionGraceDays: s.subscriptionGraceDays ?? 4,
          subscriptionAutoLockEnabled: s.subscriptionAutoLockEnabled !== false,
          subscriptionScope: s.subscriptionScope || 'stadium',
          commissionEnabled: Boolean(s.commissionEnabled),
          allowCombineBookingFeeAndCommission: Boolean(s.allowCombineBookingFeeAndCommission),
          requireStadiumAgreement: Boolean(s.requireStadiumAgreement),
          policyEffectiveAt: s.policyEffectiveAt
            ? new Date(s.policyEffectiveAt).toISOString().slice(0, 10)
            : '',
          // Existing fields
          platformCommissionPercent: s.platformCommissionPercent ?? 4,
          fieldSubscriptionEnabled: Boolean(s.fieldSubscriptionEnabled),
          fieldSubscriptionAmount: s.fieldSubscriptionAmount ?? 7,
          fieldSubscriptionCurrency: s.fieldSubscriptionCurrency || 'USD',
          bookingHoldMinutes: s.bookingHoldMinutes ?? 10,
          bookingHoldGraceMinutes: s.bookingHoldGraceMinutes ?? 2,
          teamBPaymentDeadlineMinutes:
            s.teamBPaymentDeadlineMinutes ?? s.teamBPriorityMinutes ?? 12,
          teamBPriorityMinutes: s.teamBPriorityMinutes ?? s.teamBPaymentDeadlineMinutes ?? 12,
          teamBGraceMinutes: s.teamBGraceMinutes ?? 10,
          teamBMaxGraceExtensions: s.teamBMaxGraceExtensions ?? 2,
          teamBFinalGraceMinutes: s.teamBFinalGraceMinutes ?? 3,
          slotDemandTtlSeconds: s.slotDemandTtlSeconds ?? 180,
          autoRefundTeamAOnTeamBTimeout: s.autoRefundTeamAOnTeamBTimeout !== false,
          preferWalletCreditOnDemandRelease: s.preferWalletCreditOnDemandRelease !== false,
          releaseSlotOnPartialPaymentTimeout: s.releaseSlotOnPartialPaymentTimeout !== false,
          ownerPayoutDelayMinutes: s.ownerPayoutDelayMinutes ?? 60,
          noShowGraceMinutes: s.noShowGraceMinutes ?? 15,
          maxMatchDistanceKm: s.maxMatchDistanceKm ?? 30,
          lineupEnabled: Boolean(s.lineupEnabled),
          giftEnabled: Boolean(s.giftEnabled),
          weatherEnabled: Boolean(s.weatherEnabled),
          ownerCommissionVisible: Boolean(s.ownerCommissionVisible),
          publicOwnerSignup: Boolean(s.publicOwnerSignup),
          supportEmail: s.supportEmail || '',
          supportPhone: s.supportPhone || '',
          supportWhatsapp: s.supportWhatsapp || '',
        });
        if (data.data.revenuePreview) setRevenuePreview(data.data.revenuePreview);
        setUpdatedAt(s.updatedAt || null);
      } catch (err) {
        toastApiError(err, t('platformSettings.loadFail'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const set = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));
  const setBool = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.checked }));

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await adminApi.updateSettings({
        // Revenue policy
        revenueModelMode: form.revenueModelMode,
        bookingFeeEnabled: Boolean(form.bookingFeeEnabled),
        bookingFeeAmount: Number(form.bookingFeeAmount),
        bookingFeeCurrency: form.bookingFeeCurrency || 'SLL',
        bookingFeePayer: form.bookingFeePayer || 'each_team',
        sllPerUsd: Number(form.sllPerUsd),
        stadiumSubscriptionEnabled: Boolean(form.stadiumSubscriptionEnabled),
        stadiumSubscriptionAmount: Number(form.stadiumSubscriptionAmount),
        stadiumSubscriptionCurrency: form.stadiumSubscriptionCurrency || 'USD',
        subscriptionGraceDays: Number(form.subscriptionGraceDays ?? 4),
        subscriptionAutoLockEnabled: Boolean(form.subscriptionAutoLockEnabled),
        subscriptionScope: form.subscriptionScope || 'stadium',
        commissionEnabled: Boolean(form.commissionEnabled),
        allowCombineBookingFeeAndCommission: Boolean(form.allowCombineBookingFeeAndCommission),
        requireStadiumAgreement: Boolean(form.requireStadiumAgreement),
        policyEffectiveAt: form.policyEffectiveAt ? new Date(form.policyEffectiveAt).toISOString() : null,
        // Existing
        platformCommissionPercent: Number(form.platformCommissionPercent),
        fieldSubscriptionEnabled: Boolean(form.fieldSubscriptionEnabled),
        fieldSubscriptionAmount: Number(form.fieldSubscriptionAmount),
        fieldSubscriptionCurrency: form.fieldSubscriptionCurrency || 'USD',
        bookingHoldMinutes: Number(form.bookingHoldMinutes),
        bookingHoldGraceMinutes: Number(form.bookingHoldGraceMinutes),
        teamBPaymentDeadlineMinutes: Number(
          form.teamBPriorityMinutes || form.teamBPaymentDeadlineMinutes
        ),
        teamBPriorityMinutes: Number(
          form.teamBPriorityMinutes || form.teamBPaymentDeadlineMinutes
        ),
        teamBGraceMinutes: Number(form.teamBGraceMinutes),
        teamBMaxGraceExtensions: Number(form.teamBMaxGraceExtensions),
        teamBFinalGraceMinutes: Number(form.teamBFinalGraceMinutes),
        slotDemandTtlSeconds: Number(form.slotDemandTtlSeconds),
        autoRefundTeamAOnTeamBTimeout: Boolean(form.autoRefundTeamAOnTeamBTimeout),
        preferWalletCreditOnDemandRelease: Boolean(form.preferWalletCreditOnDemandRelease),
        releaseSlotOnPartialPaymentTimeout: Boolean(form.releaseSlotOnPartialPaymentTimeout),
        ownerPayoutDelayMinutes: Number(form.ownerPayoutDelayMinutes),
        noShowGraceMinutes: Number(form.noShowGraceMinutes),
        maxMatchDistanceKm: Number(form.maxMatchDistanceKm),
        lineupEnabled: Boolean(form.lineupEnabled),
        giftEnabled: Boolean(form.giftEnabled),
        weatherEnabled: Boolean(form.weatherEnabled),
        ownerCommissionVisible: Boolean(form.ownerCommissionVisible),
        publicOwnerSignup: Boolean(form.publicOwnerSignup),
        supportEmail: form.supportEmail,
        supportPhone: form.supportPhone,
        supportWhatsapp: form.supportWhatsapp,
      });
      const s = data.data.settings;
      setUpdatedAt(s.updatedAt);
      if (data.data.revenuePreview) setRevenuePreview(data.data.revenuePreview);
      toast.success(t('platformSettings.saved'));
    } catch (err) {
      toastApiError(err, t('platformSettings.saveFail'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <PageTransition className="max-w-2xl">
      <PageHeader
        title={t('platformSettings.title')}
        description={t('platformSettings.description')}
      />

      <form onSubmit={save} className="mt-6 space-y-5">
        {/* ── Separation of Powers Notice ─────────────────────────────────── */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-4 text-xs text-charcoal dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-dark-text">
          <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-400 text-sm">
            <FiShield className="text-base" />
            <span>Kala Xadaynta Nidaamka & Masuuliyadaha (Separation of Powers)</span>
          </div>
          <p className="mt-2 leading-relaxed text-muted">
            <strong className="text-charcoal dark:text-dark-text">Super Admin:</strong> Wuxuu maamulaa nidaamka guud, sarifka maanta ee lacagaha (Somaliland Shilling / USD), nidaamka dakhliga platform-ka (Subscription & Booking fee), iyo xuduudaha amniga. Super Admin-ku ma faragaliyo siyaasadaha u gaarka ah garoomada gaarka loo leeyahay.<br />
            <strong className="text-charcoal dark:text-dark-text">Stadium Owner & Manager:</strong> Iyagaa si madax-bannaan u maamula qiimaha kirada garoonkooda (Hourly prices), dhimisyada, jadwalka ciyaaraha, iyo siyaasadaha u gaarka ah garoonkooda (/owner/agreements).
          </p>
        </div>

        {/* ── Dynamic Daily Exchange Rate (Somaliland Shilling & USD) ──────── */}
        <Card className="space-y-4 p-6 border-l-4 border-l-brand-green">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiDollarSign className="text-brand-green text-lg" />
              <CardTitle>Qiimaha Sarifka Maanta (Daily Exchange Rate: SlSh / USD)</CardTitle>
            </div>
            <span className="rounded-full bg-brand-green/10 px-2.5 py-0.5 text-xs font-semibold text-brand-green">
              Dynamic Checkout Active
            </span>
          </div>
          <p className="text-sm text-muted">
            Somaliland waxa aad looga isticmaalaa <strong>Somaliland Shilling (SlSh)</strong> iyo <strong>USD ($)</strong>. Kabtanku marka uu bixinayo wuxuu dooran karaa midkood. Qiimahani wuxuu si toos ah (dynamic) u xisaabiyaa lacagta SlSh ee laga doonayo kabtanka Web-ka iyo Mobile App-ka labadaba. Hadii sarifku isbeddelo maalin kasta, halkan ka cusboonaysii.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <Input
              label="Sarifka Maanta: 1 USD = ? SlSh"
              icon={<FiDollarSign />}
              type="number"
              min={1}
              step="any"
              value={form.sllPerUsd}
              onChange={set('sllPerUsd')}
              hint="Tusaale: 8500 (1 USD = 8,500 SlSh)"
            />
            <div className="rounded-lg bg-surface-inset p-3 border border-border text-xs space-y-1">
              <div className="text-muted">Muqaalka Xisaabinta Maanta:</div>
              <div className="font-semibold text-charcoal dark:text-dark-text">
                $1.00 USD = {Number(form.sllPerUsd || 0).toLocaleString()} SlSh
              </div>
              <div className="text-muted">
                $10.00 USD ciyaar = {Number((form.sllPerUsd || 0) * 10).toLocaleString()} SlSh
              </div>
            </div>
          </div>
        </Card>

        {/* ── Revenue Policy ─────────────────────────────────────────────── */}
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-muted">
            <FiDollarSign />
            <CardTitle>Revenue Policy</CardTitle>
          </div>
          <p className="text-sm text-muted">
            Configure how the platform charges stadiums. These settings define the global policy.
            Each stadium agreement can further customise within allowed models.
          </p>

          {/* Revenue model mode */}
          <Select
            label="Revenue Model Mode"
            value={form.revenueModelMode}
            onChange={set('revenueModelMode')}
          >
            <option value="booking_fee_subscription">Booking Fee / Subscription only</option>
            <option value="commission">Commission only</option>
            <option value="flexible">Flexible (allow both)</option>
          </Select>

          {/* Booking Fee */}
          <div className="space-y-3 rounded-xl border border-border p-4 dark:border-dark-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Booking Fee</p>
            <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(form.bookingFeeEnabled)}
                onChange={setBool('bookingFeeEnabled')}
              />
              <span>
                <span className="font-medium">Enable booking fee</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Charge a flat fee per team per booking
                </span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Amount (${form.bookingFeeCurrency || 'SLL'})`}
                icon={<FiDollarSign />}
                type="number"
                min={0}
                step="any"
                value={form.bookingFeeAmount}
                onChange={set('bookingFeeAmount')}
                disabled={!form.bookingFeeEnabled}
              />
              <Select
                label="Currency"
                value={form.bookingFeeCurrency}
                onChange={set('bookingFeeCurrency')}
                disabled={!form.bookingFeeEnabled}
              >
                <option value="SLL">SLL</option>
                <option value="USD">USD</option>
              </Select>
            </div>
            <Select
              label="Fee Payer"
              value={form.bookingFeePayer}
              onChange={set('bookingFeePayer')}
              disabled={!form.bookingFeeEnabled}
            >
              <option value="each_team">Each team pays own fee</option>
              <option value="team_a_only">Team A pays for both</option>
              <option value="split">Split evenly between teams</option>
            </Select>
          </div>

          {/* Stadium Subscription */}
          <div className="space-y-3 rounded-xl border border-border p-4 dark:border-dark-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Stadium Subscription
            </p>
            <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(form.stadiumSubscriptionEnabled)}
                onChange={setBool('stadiumSubscriptionEnabled')}
              />
              <span>
                <span className="font-medium">Enable stadium subscription</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Charge stadiums a monthly subscription fee
                </span>
              </span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label={`Amount (${form.stadiumSubscriptionCurrency || 'USD'})`}
                icon={<FiDollarSign />}
                type="number"
                min={0}
                step="any"
                value={form.stadiumSubscriptionAmount}
                onChange={set('stadiumSubscriptionAmount')}
                disabled={!form.stadiumSubscriptionEnabled}
              />
              <Select
                label="Currency"
                value={form.stadiumSubscriptionCurrency}
                onChange={set('stadiumSubscriptionCurrency')}
                disabled={!form.stadiumSubscriptionEnabled}
              >
                <option value="USD">USD</option>
                <option value="SLL">SLL</option>
              </Select>
            </div>
            <Select
              label="Subscription scope"
              value={form.subscriptionScope}
              onChange={set('subscriptionScope')}
              disabled={!form.stadiumSubscriptionEnabled}
            >
              <option value="stadium">Per stadium</option>
              <option value="field">Per field</option>
            </Select>
            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/50 dark:border-dark-border/50">
              <Input
                label="Grace Days (Maalmaha Bilaashka ah)"
                type="number"
                min={0}
                max={30}
                value={form.subscriptionGraceDays}
                onChange={set('subscriptionGraceDays')}
                disabled={!form.stadiumSubscriptionEnabled}
                hint="Tusaale: 4 maalmood bilowga bisha ka hor auto-lock"
              />
              <div className="flex flex-col justify-center pt-2">
                <label className="flex items-start gap-2.5 text-xs text-charcoal dark:text-dark-text cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-border text-primary focus:ring-primary"
                    checked={Boolean(form.subscriptionAutoLockEnabled)}
                    onChange={setBool('subscriptionAutoLockEnabled')}
                    disabled={!form.stadiumSubscriptionEnabled}
                  />
                  <span>
                    <span className="font-semibold block">Toos u xidh (Auto-Lock)</span>
                    <span className="text-[11px] text-muted">Xidh ballamaha dadweynaha haddii subscription-ku dhaco</span>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Commission */}
          <div className="space-y-3 rounded-xl border border-border p-4 dark:border-dark-border">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">Commission</p>
            <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(form.commissionEnabled)}
                onChange={setBool('commissionEnabled')}
              />
              <span>
                <span className="font-medium">Enable commission</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Charge a % of stadium rental revenue
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(form.allowCombineBookingFeeAndCommission)}
                onChange={setBool('allowCombineBookingFeeAndCommission')}
                disabled={!form.commissionEnabled || !form.bookingFeeEnabled}
              />
              <span>
                <span className="font-medium">Allow combined booking fee + commission</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Permits stadium agreements to charge both at once
                </span>
              </span>
            </label>
          </div>

          {/* Agreement & effective date */}
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.requireStadiumAgreement)}
              onChange={setBool('requireStadiumAgreement')}
            />
            <span>
              <span className="font-medium">Require signed stadium agreement</span>
              <span className="mt-0.5 block text-xs text-muted">
                Stadium must have an accepted agreement before bookings apply revenue rules
              </span>
            </span>
          </label>
          <Input
            label="Policy effective from (optional)"
            icon={<FiFileText />}
            type="date"
            value={form.policyEffectiveAt}
            onChange={set('policyEffectiveAt')}
            hint="Leave blank to apply immediately"
          />

          {/* Revenue preview panel */}
          {revenuePreview && (
            <div className="rounded-xl border border-forest/30 bg-forest/5 p-4 dark:border-dark-primary/30 dark:bg-dark-primary/5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-forest dark:text-dark-primary">
                Revenue Policy Preview
              </p>
              <dl className="space-y-1 text-sm">
                <div className="flex gap-2">
                  <dt className="w-40 shrink-0 text-muted">Mode</dt>
                  <dd className="font-medium text-charcoal dark:text-dark-text">
                    {revenuePreview.mode}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-40 shrink-0 text-muted">Allowed models</dt>
                  <dd className="font-medium text-charcoal dark:text-dark-text">
                    {(revenuePreview.allowedModels || []).join(', ') || '—'}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-40 shrink-0 text-muted">Default model</dt>
                  <dd className="font-medium text-charcoal dark:text-dark-text">
                    {revenuePreview.defaultModel || '—'}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-40 shrink-0 text-muted">Booking fee</dt>
                  <dd className="font-medium text-charcoal dark:text-dark-text">
                    {revenuePreview.bookingFee}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-40 shrink-0 text-muted">Subscription</dt>
                  <dd className="font-medium text-charcoal dark:text-dark-text">
                    {revenuePreview.subscription}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-40 shrink-0 text-muted">Commission</dt>
                  <dd className="font-medium text-charcoal dark:text-dark-text">
                    {revenuePreview.commission}
                  </dd>
                </div>
                {revenuePreview.note && (
                  <p className="mt-2 text-xs text-muted">{revenuePreview.note}</p>
                )}
              </dl>
            </div>
          )}
        </Card>

        {/* ── Fees & Timing ──────────────────────────────────────────────── */}
        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-muted">
            <FiPercent />
            <CardTitle>{t('platformSettings.feesTitle')}</CardTitle>
          </div>
          <Input
            label={t('platformSettings.commission')}
            icon={<FiPercent />}
            type="number"
            min={0}
            max={50}
            step="any"
            value={form.platformCommissionPercent}
            onChange={set('platformCommissionPercent')}
            required
          />
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.ownerCommissionVisible)}
              onChange={setBool('ownerCommissionVisible')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.ownerCommissionVisible')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.ownerCommissionVisibleHint')}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.fieldSubscriptionEnabled)}
              onChange={setBool('fieldSubscriptionEnabled')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.fieldSubEnabled')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.fieldSubEnabledHint')}
              </span>
            </span>
          </label>
          <Input
            label={t('platformSettings.fieldSubAmount')}
            icon={<FiPercent />}
            type="number"
            min={0}
            max={10000}
            step="any"
            value={form.fieldSubscriptionAmount}
            onChange={set('fieldSubscriptionAmount')}
            hint={t('platformSettings.fieldSubAmountHint')}
            disabled={!form.fieldSubscriptionEnabled}
          />
          <Input
            label={t('platformSettings.holdMinutes')}
            icon={<FiClock />}
            type="number"
            min={1}
            max={120}
            value={form.bookingHoldMinutes}
            onChange={set('bookingHoldMinutes')}
            hint={t('platformSettings.holdHint')}
            error={
              Number(form.bookingHoldMinutes) < 5
                ? 'Under 5 minutes is too short: customers need time to open the PIN prompt on their phone and approve it. 10 is recommended.'
                : undefined
            }
            required
          />
          <Input
            label={t('platformSettings.holdGrace')}
            icon={<FiClock />}
            type="number"
            min={0}
            max={30}
            value={form.bookingHoldGraceMinutes}
            onChange={set('bookingHoldGraceMinutes')}
          />
          <Input
            label={t('platformSettings.payoutDelay')}
            icon={<FiClock />}
            type="number"
            min={5}
            value={form.ownerPayoutDelayMinutes}
            onChange={set('ownerPayoutDelayMinutes')}
            hint={t('platformSettings.payoutHint')}
          />
          <Input
            label={t('platformSettings.noShowGrace')}
            icon={<FiShield />}
            type="number"
            min={0}
            value={form.noShowGraceMinutes}
            onChange={set('noShowGraceMinutes')}
          />
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-muted">
            <FiUsers />
            <CardTitle>{t('platformSettings.teamBTitle')}</CardTitle>
          </div>
          <p className="text-sm text-muted">{t('platformSettings.teamBHelp')}</p>
          <Input
            label={t('platformSettings.teamBPriority')}
            icon={<FiClock />}
            type="number"
            min={2}
            max={120}
            value={form.teamBPriorityMinutes}
            onChange={set('teamBPriorityMinutes')}
            hint={t('platformSettings.teamBPriorityHint')}
            required
          />
          <Input
            label={t('platformSettings.teamBGrace')}
            icon={<FiClock />}
            type="number"
            min={1}
            max={60}
            value={form.teamBGraceMinutes}
            onChange={set('teamBGraceMinutes')}
            hint={t('platformSettings.teamBGraceHint')}
          />
          <Input
            label={t('platformSettings.teamBMaxExt')}
            icon={<FiClock />}
            type="number"
            min={0}
            max={10}
            value={form.teamBMaxGraceExtensions}
            onChange={set('teamBMaxGraceExtensions')}
          />
          <Input
            label={t('platformSettings.teamBFinalGrace')}
            icon={<FiClock />}
            type="number"
            min={1}
            max={30}
            value={form.teamBFinalGraceMinutes}
            onChange={set('teamBFinalGraceMinutes')}
          />
          <Input
            label={t('platformSettings.slotDemandTtl')}
            icon={<FiClock />}
            type="number"
            min={30}
            max={900}
            value={form.slotDemandTtlSeconds}
            onChange={set('slotDemandTtlSeconds')}
            hint={t('platformSettings.slotDemandTtlHint')}
          />
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.autoRefundTeamAOnTeamBTimeout)}
              onChange={setBool('autoRefundTeamAOnTeamBTimeout')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.autoRefund')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.autoRefundHint')}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.preferWalletCreditOnDemandRelease)}
              onChange={setBool('preferWalletCreditOnDemandRelease')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.preferCredit')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.preferCreditHint')}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.releaseSlotOnPartialPaymentTimeout)}
              onChange={setBool('releaseSlotOnPartialPaymentTimeout')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.releaseSlot')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.releaseSlotHint')}
              </span>
            </span>
          </label>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-muted">
            <FiMapPin />
            <CardTitle>{t('platformSettings.distanceTitle')}</CardTitle>
          </div>
          <Input
            label={t('platformSettings.maxDistance')}
            icon={<FiMapPin />}
            type="number"
            min={5}
            max={500}
            value={form.maxMatchDistanceKm}
            onChange={set('maxMatchDistanceKm')}
            hint={t('platformSettings.maxDistanceHint')}
          />
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-muted">
            <FiGrid />
            <CardTitle>{t('platformSettings.featuresTitle')}</CardTitle>
          </div>
          <p className="text-sm text-muted">{t('platformSettings.featuresHelp')}</p>
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.publicOwnerSignup)}
              onChange={setBool('publicOwnerSignup')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.publicOwnerSignup')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.publicOwnerSignupHint')}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.lineupEnabled)}
              onChange={setBool('lineupEnabled')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.lineupEnabled')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.lineupEnabledHint')}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.giftEnabled)}
              onChange={setBool('giftEnabled')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.giftEnabled')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.giftEnabledHint')}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm text-charcoal dark:text-dark-text">
            <input
              type="checkbox"
              className="mt-1"
              checked={Boolean(form.weatherEnabled)}
              onChange={setBool('weatherEnabled')}
            />
            <span>
              <span className="font-medium">{t('platformSettings.weatherEnabled')}</span>
              <span className="mt-0.5 block text-xs text-muted">
                {t('platformSettings.weatherEnabledHint')}
              </span>
            </span>
          </label>
        </Card>

        <WeatherRiskBoard />

        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-muted">
            <FiPhone />
            <CardTitle>{t('platformSettings.supportTitle')}</CardTitle>
          </div>
          <Input
            label={t('platformSettings.supportPhone')}
            icon={<FiPhone />}
            value={form.supportPhone}
            onChange={set('supportPhone')}
          />
          <Input
            label={t('platformSettings.supportEmail')}
            icon={<FiMail />}
            type="email"
            value={form.supportEmail}
            onChange={set('supportEmail')}
          />
          <Input
            label={t('platformSettings.whatsapp')}
            value={form.supportWhatsapp}
            onChange={set('supportWhatsapp')}
            placeholder="25261…"
          />
        </Card>

        {updatedAt && (
          <p className="text-xs text-muted">
            {t('platformSettings.lastSaved')}: {new Date(updatedAt).toLocaleString()}
          </p>
        )}

        <Button type="submit" icon={<FiSave />} loading={saving} className="w-full" size="lg">
          {t('platformSettings.save')}
        </Button>
      </form>
    </PageTransition>
  );
}
