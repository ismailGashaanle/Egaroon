import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiActivity,
  FiBarChart2,
  FiClock,
  FiDollarSign,
  FiHome,
  FiLayers,
  FiPercent,
  FiPlay,
  FiSunrise,
  FiSunset,
  FiMoon,
  FiSun,
} from 'react-icons/fi';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
} from 'recharts';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Input from '../../components/common/Input';
import ReportTable from '../../components/common/ReportTable';
import { Stagger, StaggerItem } from '../../components/common/Stagger';
import { ReportBarChart } from '../../components/owner/ReportCharts';
import { REPORT_BRAND } from '../../components/owner/reportBrand';
import { useChartTheme } from '../../hooks/useChartTheme';
import { adminApi } from '../../api/adminApi';
import { toastApiError } from '../../lib/support';
import { useTranslation } from '../../i18n/LanguageContext';

const PERIOD_VALUES = ['day', 'week', 'month', 'quarter', 'semiannual', 'year'];
const BANDS = ['morning', 'afternoon', 'evening', 'night'];
const BAND_COLORS = {
  morning: '#f59e0b',
  afternoon: '#10B981',
  evening: '#0284c7',
  night: '#818cf8',
};
const FORMULA_NAMES = [
  'gmv',
  'commission',
  'subscription',
  'profit',
  'bookings',
  'occupancy',
  'fields',
  'afternoonGmv',
  'eveningGmv',
  'nightGmv',
];

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

function BandIcon({ band, size = 14 }) {
  if (band === 'morning') return <FiSunrise size={size} />;
  if (band === 'afternoon') return <FiSun size={size} />;
  if (band === 'evening') return <FiSunset size={size} />;
  return <FiMoon size={size} />;
}

export default function SuperAdminBusinessPlanner() {
  const { t } = useTranslation();
  const theme = useChartTheme();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [period, setPeriod] = useState('month');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [days, setDays] = useState(30);
  const [commissionPercent, setCommissionPercent] = useState(4);
  const [subscriptionAmount, setSubscriptionAmount] = useState(7);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [extraFields, setExtraFields] = useState(0);
  const [extraStadiums, setExtraStadiums] = useState(0);
  const [extraFieldBasePrice, setExtraFieldBasePrice] = useState('');
  const [occupancyMaster, setOccupancyMaster] = useState('');
  const [occupancyByBand, setOccupancyByBand] = useState({
    morning: 20,
    afternoon: 35,
    evening: 55,
    night: 40,
  });
  const [multipliers, setMultipliers] = useState({
    morning: 1,
    afternoon: 1,
    evening: 1.5,
    night: 1.7,
  });
  const [formula, setFormula] = useState('(commission + subscription) * 12');

  const geoOptions = plan?.baseline?.geoOptions || { cities: [], regions: [] };

  const applyPlanForm = useCallback((next) => {
    const sc = next.scenario || {};
    setDays(sc.days || 30);
    setCommissionPercent(sc.commissionPercent ?? 4);
    setSubscriptionAmount(sc.subscriptionAmount ?? 0);
    setSubscriptionEnabled(Boolean(sc.subscriptionEnabled));
    setExtraFields(sc.extraFields || 0);
    setExtraStadiums(sc.extraStadiums || 0);
    setExtraFieldBasePrice(sc.extraFieldBasePrice != null ? String(sc.extraFieldBasePrice) : '');
    setOccupancyByBand({
      morning: sc.occupancyByBand?.morning ?? 20,
      afternoon: sc.occupancyByBand?.afternoon ?? 35,
      evening: sc.occupancyByBand?.evening ?? 55,
      night: sc.occupancyByBand?.night ?? 40,
    });
    setMultipliers({
      morning: sc.multipliers?.morning ?? 1,
      afternoon: sc.multipliers?.afternoon ?? 1,
      evening: sc.multipliers?.evening ?? 1.5,
      night: sc.multipliers?.night ?? 1.7,
    });
    setFormula(sc.formula || '(commission + subscription) * 12');
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getBusinessPlan({ period, city, region });
      const next = data.data.plan;
      setPlan(next);
      applyPlanForm(next);
    } catch (err) {
      toastApiError(err, t('planner.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [period, city, region, t, applyPlanForm]);

  useEffect(() => {
    load();
  }, [load]);

  const scenarioPayload = useMemo(
    () => ({
      days: Number(days) || 30,
      commissionPercent: Number(commissionPercent) || 0,
      subscriptionAmount: Number(subscriptionAmount) || 0,
      subscriptionEnabled,
      extraFields: Number(extraFields) || 0,
      extraStadiums: Number(extraStadiums) || 0,
      extraFieldBasePrice:
        extraFieldBasePrice === '' ? undefined : Number(extraFieldBasePrice),
      occupancyPct: occupancyMaster === '' ? undefined : Number(occupancyMaster),
      occupancyByBand: occupancyMaster === '' ? occupancyByBand : undefined,
      multipliers,
      formula,
    }),
    [
      days,
      commissionPercent,
      subscriptionAmount,
      subscriptionEnabled,
      extraFields,
      extraStadiums,
      extraFieldBasePrice,
      occupancyMaster,
      occupancyByBand,
      multipliers,
      formula,
    ]
  );

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const { data } = await adminApi.runBusinessPlan({
        period,
        city,
        region,
        scenario: scenarioPayload,
      });
      setPlan(data.data.plan);
    } catch (err) {
      toastApiError(err, t('planner.runFail'));
    } finally {
      setRunning(false);
    }
  }, [period, city, region, scenarioPayload, t]);

  const setBandOcc = (band, value) => {
    setOccupancyMaster('');
    setOccupancyByBand((prev) => ({ ...prev, [band]: Number(value) }));
  };

  const insertName = (name) => {
    setFormula((prev) => {
      const next = prev.trim();
      if (!next) return name;
      if (/[+\-*/^(]$/.test(next) || next.endsWith('(')) return `${next} ${name}`;
      return `${next} + ${name}`;
    });
  };

  const proj = plan?.projection;
  const inv = plan?.baseline?.inventory;
  const comparison = plan?.comparison;
  const insights = plan?.insights || [];
  const hours = plan?.baseline?.defaults?.bandHours || {};

  const bandChart = BANDS.map((band) => ({
    band,
    label: t(`planner.${band}`),
    gmv: proj?.byBand?.[band]?.gmv || 0,
    commission: proj?.byBand?.[band]?.commission || 0,
    bookings: proj?.byBand?.[band]?.bookings || 0,
  }));

  const fieldChart = (proj?.fields || []).slice(0, 8).map((f) => ({
    name: f.fieldName,
    gmv: f.gmv,
    base: f.baseTotal,
  }));

  const vsChart = comparison
    ? [
        { key: t('planner.gmv'), actual: comparison.actualCollected, planned: comparison.plannedGmv },
        {
          key: t('planner.plannedCommission'),
          actual: comparison.actualCommission,
          planned: comparison.plannedCommission,
        },
        { key: t('planner.plannedProfit'), actual: comparison.actualProfit, planned: comparison.plannedProfit },
      ]
    : [];

  const fieldColumns = [
    { header: t('planner.fieldTable'), accessorKey: 'fieldName' },
    { header: t('profit.stadium'), accessorKey: 'stadiumName' },
    { header: t('planner.base'), accessorKey: 'baseTotal', cell: (info) => money(info.getValue()) },
    {
      header: t('planner.afternoon'),
      accessorFn: (r) => r.byBand?.afternoon?.slotPrice,
      cell: (info) => money(info.getValue()),
    },
    {
      header: t('planner.evening'),
      accessorFn: (r) => r.byBand?.evening?.slotPrice,
      cell: (info) => money(info.getValue()),
    },
    {
      header: t('planner.night'),
      accessorFn: (r) => r.byBand?.night?.slotPrice,
      cell: (info) => money(info.getValue()),
    },
    { header: t('planner.gmv'), accessorKey: 'gmv', cell: (info) => money(info.getValue()) },
  ];

  return (
    <PageTransition>
      <PageHeader
        title={t('planner.title')}
        description={t('planner.desc')}
        breadcrumbs={[
          { label: t('planner.breadcrumb'), to: '/super-admin' },
          { label: t('planner.nav') },
        ]}
        actions={
          <Button size="sm" icon={<FiPlay />} onClick={run} disabled={running || loading}>
            {t('planner.run')}
          </Button>
        }
      />

      <Card className="p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select label={t('planner.period')} value={period} onChange={(e) => setPeriod(e.target.value)}>
            {PERIOD_VALUES.map((p) => (
              <option key={p} value={p}>
                {t(`profit.period_${p}`)}
              </option>
            ))}
          </Select>
          <Select label={t('profit.city')} value={city} onChange={(e) => setCity(e.target.value)}>
            <option value="">{t('profit.allCities')}</option>
            {(geoOptions.cities || []).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select label={t('profit.region')} value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t('profit.allRegions')}</option>
            {(geoOptions.regions || []).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Input
            label={t('planner.days')}
            type="number"
            min={1}
            max={366}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </div>

        {inv ? (
          <p className="mt-4 text-sm text-muted dark:text-dark-muted">
            <span className="font-semibold text-charcoal dark:text-dark-text">{t('planner.inventory')}:</span>{' '}
            {inv.stadiums} {t('profit.stadiums')} · {inv.activeFields} fields ·{' '}
            {t('planner.priceRange', {
              min: money(inv.priceMin),
              max: money(inv.priceMax),
              median: money(inv.priceMedian),
            })}
          </p>
        ) : null}
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <CardTitle>{t('planner.multipliers')}</CardTitle>
          <p className="mt-1 text-xs leading-relaxed text-muted dark:text-dark-muted">{t('planner.multipliersHint')}</p>
          <div className="mt-4 space-y-3">
            {BANDS.map((band) => (
              <label key={band} className="block">
                <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-charcoal dark:text-dark-text">
                  <BandIcon band={band} />
                  {t(`planner.${band}`)}
                  <span className="font-ui text-[11px] font-normal text-muted">{hours[band]}</span>
                </span>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="10"
                  value={multipliers[band]}
                  onChange={(e) => setMultipliers((prev) => ({ ...prev, [band]: Number(e.target.value) }))}
                  className="focus-ring w-full rounded-xl border border-border bg-white px-3 py-2 text-sm tabular-nums dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text"
                />
              </label>
            ))}
          </div>

          <CardTitle className="mt-6">{t('planner.occupancyBands')}</CardTitle>
          <Input
            className="mt-3"
            label={t('planner.occupancyMaster')}
            hint={t('planner.occupancyMasterHint')}
            type="number"
            min={0}
            max={100}
            placeholder="—"
            value={occupancyMaster}
            onChange={(e) => setOccupancyMaster(e.target.value)}
          />
          <div className="mt-3 space-y-3">
            {BANDS.map((band) => (
              <label key={band} className="block">
                <span className="mb-1 flex items-center justify-between text-sm font-medium text-charcoal dark:text-dark-text">
                  <span className="flex items-center gap-1.5">
                    <BandIcon band={band} />
                    {t(`planner.${band}`)}
                  </span>
                  <span className="tabular-nums text-muted">{occupancyByBand[band]}%</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={occupancyByBand[band]}
                  onChange={(e) => setBandOcc(band, e.target.value)}
                  className="w-full accent-brand-green"
                />
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label={t('planner.commission')}
              type="number"
              step="0.1"
              min={0}
              max={40}
              value={commissionPercent}
              onChange={(e) => setCommissionPercent(e.target.value)}
            />
            <Input
              label={t('planner.subscription')}
              type="number"
              step="0.5"
              min={0}
              value={subscriptionAmount}
              onChange={(e) => setSubscriptionAmount(e.target.value)}
            />
            <Input
              label={t('planner.extraFields')}
              type="number"
              min={0}
              value={extraFields}
              onChange={(e) => setExtraFields(e.target.value)}
            />
            <Input
              label={t('planner.extraStadiums')}
              type="number"
              min={0}
              value={extraStadiums}
              onChange={(e) => setExtraStadiums(e.target.value)}
            />
            <Input
              label={t('planner.extraPrice')}
              hint={t('planner.extraPriceHint')}
              type="number"
              step="0.01"
              min={0}
              value={extraFieldBasePrice}
              onChange={(e) => setExtraFieldBasePrice(e.target.value)}
            />
            <label className="flex items-center gap-2 pt-7 text-sm font-medium text-charcoal dark:text-dark-text">
              <input
                type="checkbox"
                checked={subscriptionEnabled}
                onChange={(e) => setSubscriptionEnabled(e.target.checked)}
                className="h-4 w-4 accent-brand-green"
              />
              {t('planner.subOn')}
            </label>
          </div>

          <div className="mt-4">
            <Input
              label={t('planner.formula')}
              hint={t('planner.formulaHint')}
              value={formula}
              onChange={(e) => setFormula(e.target.value)}
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {FORMULA_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => insertName(name)}
                  className="font-ui rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted transition-colors hover:border-brand-green hover:text-brand-green dark:border-dark-border dark:text-dark-muted"
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <Stagger className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StaggerItem>
          <StatCard icon={<FiDollarSign />} label={t('planner.gmv')} value={proj ? money(proj.gmv) : '—'} />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={<FiPercent />}
            label={t('planner.plannedCommission')}
            value={proj ? money(proj.commission) : '—'}
            accent="olive"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard icon={<FiHome />} label={t('planner.ownerPayout')} value={proj ? money(proj.ownerPayout) : '—'} />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={<FiLayers />}
            label={t('planner.plannedSub')}
            value={proj ? money(proj.subscription) : '—'}
            accent="olive"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={<FiActivity />}
            label={t('planner.plannedProfit')}
            value={proj ? money(proj.profit) : '—'}
            trend={
              comparison && comparison.actualProfit
                ? Math.round((comparison.profitDelta / Math.max(comparison.actualProfit, 0.01)) * 100)
                : undefined
            }
            trendLabel={t('planner.vsActual')}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            icon={proj?.formula?.ok ? <FiBarChart2 /> : <FiClock />}
            label={proj?.formula?.ok ? t('planner.formulaResult') : t('planner.plannedBookings')}
            value={proj?.formula?.ok ? money(proj.formula.value) : proj ? Math.round(proj.bookings) : '—'}
            hint={!proj?.formula?.ok && proj?.formula?.error ? proj.formula.error : undefined}
            accent={proj?.formula && !proj.formula.ok ? 'accent' : 'forest'}
          />
        </StaggerItem>
      </Stagger>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <CardTitle>{t('planner.bandMix')}</CardTitle>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={bandChart} dataKey="gmv" nameKey="label" innerRadius={48} outerRadius={78} paddingAngle={2}>
                    {bandChart.map((row) => (
                      <Cell key={row.band} fill={BAND_COLORS[row.band]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={theme.tooltip}
                    formatter={(v, name) => [money(v), name]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bandChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={theme.grid} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: theme.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: theme.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={36} />
                  <Tooltip contentStyle={theme.tooltip} formatter={(v) => money(v)} />
                  <Bar dataKey="gmv" radius={[6, 6, 0, 0]} maxBarSize={28}>
                    {bandChart.map((row) => (
                      <Cell key={row.band} fill={BAND_COLORS[row.band]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <CardTitle>{t('planner.vsActual')}</CardTitle>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vsChart} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke={theme.grid} vertical={false} />
                <XAxis dataKey="key" tick={{ fill: theme.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: theme.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip contentStyle={theme.tooltip} formatter={(v) => money(v)} />
                <Bar dataKey="actual" fill={REPORT_BRAND.olive} radius={[6, 6, 0, 0]} maxBarSize={22} name="actual" />
                <Line type="monotone" dataKey="planned" stroke={REPORT_BRAND.forest} strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {comparison ? (
            <p className="mt-2 text-xs text-muted dark:text-dark-muted">
              {t('planner.actualCollected')} {money(comparison.actualCollected)} · {t('planner.actualCommission')}{' '}
              {money(comparison.actualCommission)} · {t('planner.actualProfit')} {money(comparison.actualProfit)}
            </p>
          ) : null}
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <CardTitle>{t('planner.fieldMix')}</CardTitle>
        {fieldChart.length ? (
          <ReportBarChart data={fieldChart} valueKey="gmv" labelKey="name" formatLabel={(v) => v} />
        ) : (
          <p className="py-10 text-center text-sm text-muted">{t('planner.noFields')}</p>
        )}
      </Card>

      <Card className="mt-4 p-5">
        <CardTitle>{t('planner.recs')}</CardTitle>
        <ul className="mt-4 space-y-3">
          {insights.map((item) => (
            <li
              key={item.title}
              className={`rounded-xl border px-4 py-3 ${
                item.tone === 'warn'
                  ? 'border-status-cancelled-text/20 bg-status-cancelled-bg dark:border-red-400/20 dark:bg-red-950/30'
                  : item.tone === 'good'
                    ? 'border-brand-green/25 bg-brand-green/8 dark:bg-brand-green/10'
                    : 'border-border bg-warmwhite dark:border-dark-border dark:bg-dark-surface-2'
              }`}
            >
              <p className="font-display text-sm font-bold text-charcoal dark:text-dark-text">{item.title}</p>
              <p className="font-ui mt-1 text-sm leading-relaxed text-muted dark:text-dark-muted">{item.body}</p>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="px-5 pt-5">
          <CardTitle>{t('planner.fieldTable')}</CardTitle>
        </div>
        <div className="mt-3">
          <ReportTable columns={fieldColumns} data={proj?.fields || []} emptyLabel={t('planner.noFields')} />
        </div>
      </Card>
    </PageTransition>
  );
}
