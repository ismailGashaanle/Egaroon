import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  FiBarChart2,
  FiCalendar,
  FiDollarSign,
  FiStar,
  FiClock,
  FiLayers,
  FiDownload,
  FiUsers,
  FiPercent,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import Button from '../../components/common/Button';
import { Skeleton, SkeletonStatRow, SkeletonTable } from '../../components/common/Skeleton';
import { ownerApi } from '../../api/bookingApi';
import { stadiumApi } from '../../api/stadiumApi';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';
import { useTranslation } from '../../i18n/LanguageContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import ReportKpiCard from '../../components/owner/ReportKpiCard';
import ReportHistoryTable from '../../components/owner/ReportHistoryTable';
import ReportTable from '../../components/common/ReportTable';
import { Stagger, StaggerItem } from '../../components/common/Stagger';
import {
  ReportBarChart,
  ReportAreaChart,
  ReportHorizontalBars,
  ReportPanel,
  ReportPeakHours,
  ReportStatusPills,
} from '../../components/owner/ReportCharts';
import { REPORT_BRAND, money } from '../../components/owner/reportBrand';

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const fieldClass =
  'w-full rounded-2xl border border-black/[0.06] bg-white px-3.5 py-2.5 text-sm text-[#18201C] outline-none transition-colors focus:border-[#176B45] focus:ring-2 focus:ring-[#176B45]/15 dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text dark:focus:border-dark-primary';

export default function OwnerReports() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const { ownerCommissionVisible } = useAuthFeatures();
  const isOwner = role === ROLES.STADIUM_OWNER;
  const showCommission = isOwner && ownerCommissionVisible;
  const [reports, setReports] = useState(null);
  const [slotReport, setSlotReport] = useState(null);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [currencyMode, setCurrencyMode] = useState('DUAL'); // 'DUAL' | 'USD' | 'SLL'
  const [stadiumId, setStadiumId] = useState('');
  const [days, setDays] = useState('14');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const queryParams = useMemo(() => {
    const params = {};
    if (stadiumId) params.stadiumId = stadiumId;
    if (from && to) {
      params.from = from;
      params.to = to;
    } else {
      params.days = Number(days) || 14;
    }
    return params;
  }, [stadiumId, days, from, to]);

  useEffect(() => {
    stadiumApi
      .list({ mine: 'true' })
      .then((res) => setStadiums(res.data.data.stadiums || []))
      .catch(() => setStadiums([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, slotRes] = await Promise.all([
        ownerApi.reports(queryParams),
        ownerApi.slotReports(queryParams).catch(() => null),
      ]);
      setReports(data.data.reports);
      setSlotReport(slotRes?.data?.data?.report || null);
    } catch {
      toast.error(t('owner.reportsFail'));
    } finally {
      setLoading(false);
    }
  }, [queryParams, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const res = await ownerApi.exportReports({ ...queryParams, format });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data, `egaroon-report-${stamp}.${format}`);
      toast.success(t('owner.exportOk'));
    } catch {
      toast.error(t('owner.exportFail'));
    } finally {
      setExporting(null);
    }
  };

  const statusBars = useMemo(() => reports?.bookingsByStatus || [], [reports]);
  const hourData = useMemo(() => (reports?.bookingsByHour || []).filter((h) => h.count > 0), [reports]);
  const revenueBars = useMemo(
    () => (reports?.bookingsByDay || []).map((d) => ({ date: d.date, revenue: Number(d.revenue) || 0 })),
    [reports]
  );
  const periodDays = reports?.days || Number(days) || 14;
  const kpiCols = showCommission ? 'lg:grid-cols-5' : 'lg:grid-cols-4';
  const formatReportRevenue = useCallback(
    (usdAmount, sllAmount) => {
      if (usdAmount == null && sllAmount == null) return '—';
      const rate = Number(reports?.sllPerUsd || 8500);
      const usd = Number(usdAmount || 0);
      const sll = sllAmount != null ? Number(sllAmount) : Math.round(usd * rate);

      if (currencyMode === 'USD') return `$${usd.toFixed(2)}`;
      if (currencyMode === 'SLL') return `${sll.toLocaleString()} SlSh`;
      return `$${usd.toFixed(2)} (${sll.toLocaleString()} SlSh)`;
    },
    [reports?.sllPerUsd, currencyMode]
  );

  const weekColumns = useMemo(
    () => [
      { accessorKey: 'weekStart', header: t('owner.week') },
      { accessorKey: 'count', header: t('owner.bookingsPeriod') },
      {
        accessorKey: 'revenue',
        header: t('owner.revenue'),
        cell: (info) => {
          const v = info.getValue();
          const row = info.row?.original;
          return formatReportRevenue(v, row?.revenueSll);
        },
      },
    ],
    [t, formatReportRevenue]
  );

  return (
    <PageTransition>
      <div
        className="-mx-4 -mt-6 min-h-full space-y-7 bg-[#F7F6F1] px-4 py-6 sm:-mx-6 sm:px-6 sm:py-8 lg:-mx-8 lg:px-8 dark:bg-dark-bg"
      >
        <header className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#176B45] dark:text-dark-primary">
              {t('owner.reportsEyebrow')}
            </p>
            <h1 className="mt-1.5 font-display text-3xl font-bold tracking-tight text-[#18201C] sm:text-4xl dark:text-dark-text">
              {t('owner.reportsTitle')}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted dark:text-dark-muted">{t('owner.reportsDesc')}</p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <label className="min-w-[9.5rem] flex-1 sm:flex-none">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-dark-muted">
                  {t('owner.filterStadium')}
                </span>
                <select
                  value={stadiumId}
                  onChange={(e) => setStadiumId(e.target.value)}
                  className={fieldClass}
                >
                  <option value="">{t('owner.allStadiums')}</option>
                  {stadiums.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="w-[7.5rem]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-dark-muted">
                  {t('owner.rangeDays')}
                </span>
                <select
                  value={days}
                  onChange={(e) => {
                    setDays(e.target.value);
                    setFrom('');
                    setTo('');
                  }}
                  className={fieldClass}
                >
                  <option value="7">7 {t('owner.days')}</option>
                  <option value="14">14 {t('owner.days')}</option>
                  <option value="30">30 {t('owner.days')}</option>
                  <option value="90">90 {t('owner.days')}</option>
                </select>
              </label>
              <label className="w-[9.5rem]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-dark-muted">
                  {t('owner.from')}
                </span>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass} />
              </label>
              <label className="w-[9.5rem]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-dark-muted">
                  {t('owner.to')}
                </span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass} />
              </label>
              <label className="w-[11.5rem]">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-muted dark:text-dark-muted">
                  Lacagta (Currency)
                </span>
                <select
                  value={currencyMode}
                  onChange={(e) => setCurrencyMode(e.target.value)}
                  className={fieldClass}
                >
                  <option value="DUAL">Labada Lacagood (Dual)</option>
                  <option value="USD">USD ($ kaliya)</option>
                  <option value="SLL">SlSh (Shilin kaliya)</option>
                </select>
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button as={Link} to="/owner/bookings" size="sm" variant="ghost">
                {t('owner.gateToday')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<FiDownload />}
                loading={exporting === 'xlsx'}
                onClick={() => handleExport('xlsx')}
              >
                {t('owner.exportExcelShort')}
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon={<FiDownload />}
                loading={exporting === 'pdf'}
                onClick={() => handleExport('pdf')}
              >
                {t('owner.exportPdfShort')}
              </Button>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="space-y-6">
            <SkeletonStatRow count={showCommission ? 5 : 4} />
            <div className="grid gap-5 lg:grid-cols-2">
              <Skeleton className="h-72 rounded-[1.75rem]" />
              <Skeleton className="h-72 rounded-[1.75rem]" />
            </div>
            <SkeletonTable rows={6} cols={4} />
          </div>
        ) : reports ? (
          <>
            {/* Dynamic Exchange Rate & Multi-Currency Indicator */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-green/20 bg-white/70 p-4 text-xs text-charcoal shadow-sm dark:border-dark-border dark:bg-dark-surface dark:text-dark-text">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green/10 text-brand-green font-bold text-xs">
                  SlSh
                </span>
                <span>
                  <strong>Sarifka Maanta (Dynamic Exchange Rate):</strong> $1.00 USD = {Number(reports.sllPerUsd || 8500).toLocaleString()} SlSh
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-muted">
                <span>Lacag-bixinnada nidaamka:</span>
                <span className="rounded-lg bg-surface-inset px-2.5 py-1 font-semibold text-charcoal dark:bg-dark-surface-2 dark:text-white">
                  💵 {reports.currencyBreakdown?.countPaidUsd || 0} USD
                </span>
                <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                  SlSh: {reports.currencyBreakdown?.countPaidSll || 0} bixineed ({Number(reports.currencyBreakdown?.totalPaidSll || 0).toLocaleString()} SlSh)
                </span>
              </div>
            </div>

            <Stagger className={`grid gap-4 sm:grid-cols-2 ${kpiCols}`}>
              <StaggerItem>
                <ReportKpiCard
                  icon={<FiCalendar />}
                  label={t('owner.todayMatches')}
                  value={reports.todayBookings ?? 0}
                  hint={t('owner.kpiTodayHint')}
                />
              </StaggerItem>
              <StaggerItem>
                <ReportKpiCard
                  icon={<FiLayers />}
                  label={t('owner.bookingsPeriod')}
                  value={reports.totalBookings ?? 0}
                  hint={t('owner.kpiPeriodHint', { n: periodDays })}
                  tone="olive"
                />
              </StaggerItem>
              <StaggerItem>
                <ReportKpiCard
                  icon={<FiDollarSign />}
                  label={t('owner.revenue')}
                  value={isOwner && reports.revenueSettled != null ? formatReportRevenue(reports.revenueSettled, reports.revenueSettledSll) : '—'}
                  hint={t('owner.kpiRevenueHint')}
                  tone="orange"
                />
              </StaggerItem>
              {showCommission && (
                <StaggerItem>
                  <ReportKpiCard
                    icon={<FiPercent />}
                    label={t('owner.commissionPaid')}
                    value={reports.commissionTotal != null ? money(reports.commissionTotal) : '—'}
                    tone="charcoal"
                  />
                </StaggerItem>
              )}
              <StaggerItem>
                <ReportKpiCard
                  icon={<FiStar />}
                  label={t('owner.rating')}
                  value={reports.avgRating || '—'}
                  hint={t('owner.kpiRatingHint', { n: reports.reviewCount || 0 })}
                  tone="olive"
                />
              </StaggerItem>
            </Stagger>

            {slotReport?.totals ? (
              <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StaggerItem>
                  <ReportKpiCard
                    icon={<FiLayers />}
                    label={t('owner.slotBooked')}
                    value={slotReport.totals.bookedSlots}
                    tone="forest"
                  />
                </StaggerItem>
                <StaggerItem>
                  <ReportKpiCard
                    icon={<FiClock />}
                    label={t('owner.slotAvailable')}
                    value={slotReport.totals.availableRemaining}
                    tone="olive"
                  />
                </StaggerItem>
                <StaggerItem>
                  <ReportKpiCard
                    icon={<FiCalendar />}
                    label={t('owner.lostSlots')}
                    value={slotReport.totals.lostSlots}
                    tone="orange"
                  />
                </StaggerItem>
                <StaggerItem>
                  <ReportKpiCard
                    icon={<FiBarChart2 />}
                    label={t('owner.utilization')}
                    value={`${slotReport.totals.utilizationPercent ?? 0}%`}
                    hint={t('owner.unbookedDaysHint', { n: slotReport.totals.unbookedDayCount || 0 })}
                  />
                </StaggerItem>
              </Stagger>
            ) : null}

            <div className="grid gap-5 lg:grid-cols-2">
              <ReportPanel title={t('owner.chartBookings')} icon={<FiBarChart2 />}>
                <ReportBarChart
                  data={reports.bookingsByDay || []}
                  color={REPORT_BRAND.forest}
                  emptyLabel={t('owner.noData')}
                />
              </ReportPanel>
              <ReportPanel title={t('owner.chartRevenue')} icon={<FiDollarSign />}>
                {isOwner ? (
                  <ReportAreaChart
                    data={revenueBars}
                    valueKey="revenue"
                    color={REPORT_BRAND.olive}
                    emptyLabel={t('owner.noData')}
                  />
                ) : (
                  <p className="py-16 text-center text-sm text-muted dark:text-dark-muted">
                    {t('owner.revenueOwnerOnly')}
                  </p>
                )}
              </ReportPanel>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              <ReportPanel title={t('owner.statusMix')} icon={<FiLayers />}>
                <ReportStatusPills items={statusBars} emptyLabel={t('owner.noData')} />
              </ReportPanel>
              <ReportPanel title={t('owner.topFields')} icon={<FiLayers />}>
                <ReportHorizontalBars
                  data={(reports.byField || []).slice(0, 6)}
                  emptyLabel={t('owner.noData')}
                />
              </ReportPanel>
              <ReportPanel title={t('owner.peakHours')} icon={<FiClock />}>
                <ReportPeakHours data={hourData} emptyLabel={t('owner.noData')} />
              </ReportPanel>
            </div>

            {slotReport?.byDay?.length ? (
              <div className="grid gap-5 lg:grid-cols-2">
                <ReportPanel title={t('owner.lostByDay')} icon={<FiBarChart2 />}>
                  <ReportBarChart
                    data={slotReport.byDay}
                    valueKey="lost"
                    color={REPORT_BRAND.orange}
                    emptyLabel={t('owner.noData')}
                  />
                </ReportPanel>
                <ReportPanel title={t('owner.fieldsLostUtil')} icon={<FiLayers />}>
                  <ReportHorizontalBars
                    data={(slotReport.byField || []).slice(0, 8).map((f) => ({
                      name: `${f.fieldName} (${f.utilizationPercent}%)`,
                      bookings: f.lostSlots,
                    }))}
                    barColor={REPORT_BRAND.orange}
                    emptyLabel={t('owner.noData')}
                  />
                </ReportPanel>
              </div>
            ) : null}

            <ReportPanel
              title={t('owner.bookingHistory')}
              action={
                slotReport?.bookingHistory?.length ? (
                  <span className="text-sm text-muted dark:text-dark-muted">
                    {t('owner.historyCount', { n: Math.min(slotReport.bookingHistory.length, 25) })}
                  </span>
                ) : null
              }
            >
              <ReportHistoryTable rows={(slotReport?.bookingHistory || []).slice(0, 25)} t={t} />
            </ReportPanel>

            <div className="grid gap-5 lg:grid-cols-2">
              <ReportPanel title={t('owner.chartCaptains')} icon={<FiUsers />}>
                <ReportHorizontalBars
                  data={(reports.captains || []).slice(0, 8).map((c) => ({
                    name: c.name,
                    bookings: c.bookings,
                  }))}
                  emptyLabel={t('owner.noData')}
                />
              </ReportPanel>
              {(reports.bookingsByWeek || []).length > 0 && (
                <ReportPanel title={t('owner.chartWeek')}>
                  <ReportTable
                    columns={weekColumns}
                    data={reports.bookingsByWeek}
                    getRowId={(row) => row.weekStart}
                    emptyLabel={t('owner.noData')}
                    minWidth="320px"
                  />
                </ReportPanel>
              )}
            </div>
          </>
        ) : null}
      </div>
    </PageTransition>
  );
}
