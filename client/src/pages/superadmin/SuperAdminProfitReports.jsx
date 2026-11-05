import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  FiBarChart2,
  FiDownload,
  FiDollarSign,
  FiPercent,
  FiLayers,
  FiRefreshCw,
  FiEye,
  FiPrinter,
  FiFileText,
  FiMapPin,
  FiClock,
  FiAward,
} from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card, { CardTitle } from '../../components/common/Card';
import StatCard from '../../components/common/StatCard';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import ReportTable from '../../components/common/ReportTable';
import { Stagger, StaggerItem } from '../../components/common/Stagger';
import { SkeletonStatRow } from '../../components/common/Skeleton';
import ProfitReportDocument from '../../components/admin/ProfitReportDocument';
import { ReportBarChart, ReportAreaChart } from '../../components/owner/ReportCharts';
import { REPORT_BRAND } from '../../components/owner/reportBrand';
import { adminApi } from '../../api/adminApi';
import { toastApiError } from '../../lib/support';
import { useTranslation } from '../../i18n/LanguageContext';

const PERIOD_VALUES = ['day', 'week', 'month', 'quarter', 'semiannual', 'year', 'custom'];

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function money(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export default function SuperAdminProfitReports() {
  const { t } = useTranslation();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [period, setPeriod] = useState('month');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');

  const queryParams = useMemo(() => {
    const params = { period };
    if (period === 'custom') {
      if (from) params.from = from;
      if (to) params.to = to;
    }
    if (city) params.city = city;
    if (region) params.region = region;
    return params;
  }, [period, from, to, city, region]);

  const load = useCallback(async () => {
    if (period === 'custom' && (!from || !to)) {
      toast.error(t('profit.customRangeNeedDates'));
      return;
    }
    setLoading(true);
    try {
      const { data } = await adminApi.getProfitReport(queryParams);
      setReport(data.data.report);
    } catch (err) {
      toastApiError(err, t('profit.loadFail'));
    } finally {
      setLoading(false);
    }
  }, [queryParams, period, from, to, t]);

  useEffect(() => {
    if (period === 'custom' && (!from || !to)) return;
    load();
  }, [load, period, from, to]);

  const exportReport = async (format) => {
    if (period === 'custom' && (!from || !to)) {
      toast.error(t('profit.customRangeNeedDates'));
      return;
    }
    setExporting(format);
    try {
      const res = await adminApi.exportProfitReport({ ...queryParams, format });
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(res.data, `egaroon-profit-${stamp}.${format}`);
      toast.success(t('profit.downloadOk', { format: format.toUpperCase() }));
    } catch (err) {
      toastApiError(err, t('profit.exportFail'));
    } finally {
      setExporting(null);
    }
  };

  const printReport = () => {
    window.print();
  };

  const backfill = async () => {
    try {
      const { data } = await adminApi.backfillCommission({ dryRun: false, limit: 500 });
      toast.success(t('profit.backfillOk', { n: data.data.backfill.updated }));
      load();
    } catch (err) {
      toastApiError(err, t('profit.backfillFail'));
    }
  };

  const stadiumColumns = useMemo(
    () => [
      { accessorKey: 'stadiumName', header: t('profit.stadium') },
      {
        accessorKey: 'city',
        header: t('profit.cityCol'),
        cell: (info) => info.getValue() || '—',
      },
      { accessorKey: 'bookings', header: t('profit.bookings') },
      {
        accessorKey: 'commission',
        header: t('profit.commission'),
        cell: (info) => money(info.getValue()),
      },
      {
        accessorKey: 'subscriptionOwed',
        header: t('profit.subOwed'),
        cell: (info) => money(info.getValue()),
      },
      {
        accessorKey: 'subscriptionPaid',
        header: t('profit.subPaid'),
        cell: (info) => money(info.getValue()),
      },
      {
        accessorKey: 'profit',
        header: t('profit.profitLabel'),
        cell: (info) => <span className="font-semibold">{money(info.getValue())}</span>,
      },
    ],
    [t]
  );

  const fieldColumns = useMemo(
    () => [
      { accessorKey: 'fieldName', header: t('profit.field') },
      { accessorKey: 'stadiumName', header: t('profit.stadium') },
      { accessorKey: 'bookings', header: t('profit.bookings') },
      {
        accessorKey: 'commission',
        header: t('profit.commission'),
        cell: (info) => money(info.getValue()),
      },
      {
        accessorKey: 'subscriptionPaid',
        header: t('profit.subPaid'),
        cell: (info) => money(info.getValue()),
      },
      {
        accessorKey: 'profit',
        header: t('profit.profitLabel'),
        cell: (info) => <span className="font-semibold">{money(info.getValue())}</span>,
      },
    ],
    [t]
  );

  const series = report?.series || [];
  const insights = report?.insights || {};
  const top10 = insights.topStadiumsByCommission || [];
  const peakHours = insights.peakHours || [];
  const peakWeekdays = insights.peakWeekdays || [];
  const geoCities = report?.geoOptions?.cities || [];
  const geoRegions = report?.geoOptions?.regions || [];
  const peakHourSorted = [...peakHours].sort((a, b) => b.commission - a.commission);
  const topPeakHour = peakHourSorted[0];
  const peakDaySorted = [...peakWeekdays].sort((a, b) => b.commission - a.commission);
  const topPeakDay = peakDaySorted[0];

  return (
    <PageTransition>
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #profit-report-print, #profit-report-print * { visibility: visible !important; }
          #profit-report-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            background: #FFFEFA !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      <div className="print:hidden">
        <PageHeader
          title={t('profit.title')}
          description={t('profit.desc')}
          breadcrumbs={[
            { label: t('profit.breadcrumb'), to: '/super-admin' },
            { label: t('profit.breadcrumbProfit') },
          ]}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={<FiRefreshCw />} onClick={backfill}>
                {t('profit.backfill')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FiEye />}
                disabled={!report || loading}
                onClick={() => setViewOpen(true)}
              >
                {t('profit.viewReport')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FiDownload />}
                loading={exporting === 'xlsx'}
                onClick={() => exportReport('xlsx')}
              >
                {t('profit.excel')}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<FiFileText />}
                loading={exporting === 'pdf'}
                onClick={() => exportReport('pdf')}
              >
                {t('profit.pdf')}
              </Button>
            </div>
          }
        />

        <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
          <Select
            label={t('profit.period')}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="min-w-[160px]"
          >
            {PERIOD_VALUES.map((value) => (
              <option key={value} value={value}>
                {t(`profit.period_${value}`)}
              </option>
            ))}
          </Select>
          {period === 'custom' && (
            <>
              <Input label={t('profit.from')} type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              <Input label={t('profit.to')} type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </>
          )}
          <Select
            label={t('profit.city')}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="min-w-[140px]"
          >
            <option value="">{t('profit.allCities')}</option>
            {geoCities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select
            label={t('profit.region')}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="min-w-[160px]"
          >
            <option value="">{t('profit.allRegions')}</option>
            {geoRegions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
          <Button onClick={load}>{t('profit.apply')}</Button>
          {(city || region) && (
            <Button
              variant="secondary"
              onClick={() => {
                setCity('');
                setRegion('');
              }}
            >
              {t('profit.clearGeo')}
            </Button>
          )}
        </Card>

        {loading || !report ? (
          <SkeletonStatRow />
        ) : (
          <>
            {(report.geo?.city || report.geo?.region) && (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
                <FiMapPin className="text-brand-green" />
                {t('profit.filteredTo')}{' '}
                {[report.geo.city, report.geo.region].filter(Boolean).join(' · ')}
                {' — '}
                {report.geo.stadiumCount} {t('profit.stadiums')}
                {' · '}
                {t('profit.commission')} {money(report.totals.commission)} · {t('profit.profitLabel')}{' '}
                {money(report.totals.profit)}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-green/20 bg-brand-green/5 p-4 text-xs text-charcoal shadow-sm dark:border-brand-green/20 dark:bg-brand-green/10 dark:text-dark-text">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-green text-white font-bold text-xs">
                  SlSh
                </span>
                <span>
                  <strong>Sarifka Maanta (Dynamic Exchange Rate):</strong> $1.00 USD = {Number(report.sllPerUsd || 8500).toLocaleString()} SlSh
                </span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <span>Dakhliga Guud (SlSh):</span>
                <span className="rounded-lg bg-white px-2.5 py-1 font-semibold text-brand-green shadow-sm dark:bg-dark-surface dark:text-brand-green">
                  {Number(report.totals?.profitSll || Math.round(report.totals?.profit * (report.sllPerUsd || 8500))).toLocaleString()} SlSh
                </span>
              </div>
            </div>

            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StaggerItem>
                <StatCard
                  icon={<FiDollarSign />}
                  label={t('profit.profitLabel')}
                  value={`${money(report.totals.profit)} (${Number(report.totals.profitSll || Math.round(report.totals.profit * (report.sllPerUsd || 8500))).toLocaleString()} SlSh)`}
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  icon={<FiPercent />}
                  label={t('profit.commission')}
                  value={`${money(report.totals.commission)} (${Number(report.totals.commissionSll || Math.round(report.totals.commission * (report.sllPerUsd || 8500))).toLocaleString()} SlSh)`}
                  accent="olive"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  icon={<FiLayers />}
                  label={t('profit.subscriptionPaid')}
                  value={money(report.totals.subscriptionPaid)}
                  accent="olive"
                />
              </StaggerItem>
              <StaggerItem>
                <StatCard
                  icon={<FiBarChart2 />}
                  label={t('profit.bookings')}
                  value={report.totals.bookingCount}
                  accent="accent"
                />
              </StaggerItem>
            </Stagger>

            <p className="mt-3 text-xs text-muted">
              {t('profit.policy')}: {t('profit.commissionPct', { n: report.policy.platformCommissionPercent })}
              {report.policy.fieldSubscriptionEnabled
                ? ` · ${t('profit.subOn', { amount: report.policy.fieldSubscriptionAmount })}`
                : ` · ${t('profit.subOff')}`}
              {' · '}
              {t('profit.subOwed')} {money(report.totals.subscriptionOwed)}
              {' · '}
              {report.commissionSources.storedSnapshots} {t('profit.stored')} / {report.commissionSources.estimated}{' '}
              {t('profit.estimated')}
            </p>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <Card className="overflow-hidden p-0 lg:col-span-1">
                <div className="border-b border-charcoal/10 bg-gradient-to-br from-brand-green/10 to-transparent px-5 py-4 dark:border-white/10">
                  <div className="flex items-center gap-2">
                    <FiAward className="text-brand-green" />
                    <CardTitle>{t('profit.top10')}</CardTitle>
                  </div>
                  <p className="mt-1 text-xs text-muted">{t('profit.top10Hint')}</p>
                </div>
                <div className="divide-y divide-charcoal/5 dark:divide-white/5">
                  {top10.length === 0 ? (
                    <p className="p-5 text-sm text-muted">{t('profit.noCommission')}</p>
                  ) : (
                    top10.map((r) => (
                      <div key={r.stadiumId} className="flex items-center gap-3 px-5 py-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                            r.rank <= 3
                              ? 'bg-brand-green text-white'
                              : 'bg-charcoal/5 text-muted dark:bg-white/10'
                          }`}
                        >
                          {r.rank}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{r.stadiumName}</p>
                          <p className="truncate text-xs text-muted">
                            {[r.city, r.region].filter(Boolean).join(' · ') || '—'} · {r.bookings} {t('profit.bookings')}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-brand-green">{money(r.commission)}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-5 lg:col-span-2">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <FiClock className="text-brand-green" />
                      <CardTitle>{t('profit.peakHours')}</CardTitle>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {t('profit.peakHoursHint')} ·{' '}
                      {topPeakHour?.commission
                        ? t('profit.peak', { label: topPeakHour.label, amount: money(topPeakHour.commission) })
                        : t('profit.noData')}
                    </p>
                  </div>
                </div>
                {peakHours.every((h) => !h.commission) ? (
                  <p className="text-sm text-muted">{t('profit.noSlotData')}</p>
                ) : (
                  <ReportBarChart
                    data={peakHours}
                    valueKey="commission"
                    labelKey="label"
                    color={REPORT_BRAND.orange}
                    emptyLabel={t('profit.noSlotData')}
                    formatLabel={(raw) => String(raw).slice(0, 2)}
                  />
                )}
              </Card>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <Card className="p-5">
                <CardTitle>{t('profit.peakWeekdays')}</CardTitle>
                <p className="mb-3 text-xs text-muted">
                  {t('profit.weekdayHint')} ·{' '}
                  {topPeakDay?.commission
                    ? t('profit.strongest', { label: topPeakDay.label, amount: money(topPeakDay.commission) })
                    : t('profit.noData')}
                </p>
                {peakWeekdays.every((d) => !d.commission) ? (
                  <p className="text-sm text-muted">{t('profit.noWeekday')}</p>
                ) : (
                  <ReportBarChart
                    data={peakWeekdays}
                    valueKey="commission"
                    labelKey="label"
                    color={REPORT_BRAND.forest}
                    emptyLabel={t('profit.noWeekday')}
                    formatLabel={(raw) => String(raw).slice(0, 3)}
                  />
                )}
              </Card>
              <Card className="p-5">
                <CardTitle>{t('profit.profitOverTime')}</CardTitle>
                <p className="mb-3 text-xs text-muted">{t('profit.profitOverTimeHint')}</p>
                {series.length === 0 ? (
                  <p className="text-sm text-muted">{t('profit.noRangeData')}</p>
                ) : (
                  <ReportAreaChart
                    data={series}
                    valueKey="profit"
                    labelKey="key"
                    color={REPORT_BRAND.forest}
                    emptyLabel={t('profit.noRangeData')}
                    formatLabel={(raw) => {
                      const s = String(raw || '');
                      return s.length > 7 ? s.slice(5) : s;
                    }}
                  />
                )}
              </Card>
            </div>

            <Card className="mt-6 overflow-x-auto p-0">
              <div className="border-b border-charcoal/10 px-5 py-3 dark:border-white/10">
                <CardTitle>{t('profit.byStadium')}</CardTitle>
              </div>
              <div className="px-5 py-2">
                <ReportTable
                  columns={stadiumColumns}
                  data={report.byStadium || []}
                  getRowId={(row) => row.stadiumId}
                  emptyLabel={t('profit.noStadiumBreakdown')}
                />
              </div>
            </Card>

            <Card className="mt-6 overflow-x-auto p-0">
              <div className="border-b border-charcoal/10 px-5 py-3 dark:border-white/10">
                <CardTitle>{t('profit.byField')}</CardTitle>
              </div>
              <div className="px-5 py-2">
                <ReportTable
                  columns={fieldColumns}
                  data={(report.byField || []).slice(0, 40)}
                  getRowId={(row) => row.fieldId}
                  emptyLabel={t('profit.noRangeData')}
                />
              </div>
            </Card>
          </>
        )}
      </div>

      <Modal
        open={viewOpen && !!report}
        onClose={() => setViewOpen(false)}
        title={t('profit.modalTitle')}
        size="full"
        className="!p-0 sm:!p-0"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button variant="secondary" size="sm" icon={<FiPrinter />} onClick={printReport}>
              {t('profit.print')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FiFileText />}
              loading={exporting === 'pdf'}
              onClick={() => exportReport('pdf')}
            >
              {t('profit.downloadPdf')}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<FiDownload />}
              loading={exporting === 'xlsx'}
              onClick={() => exportReport('xlsx')}
            >
              {t('profit.downloadExcel')}
            </Button>
            <Button size="sm" onClick={() => setViewOpen(false)}>
              {t('profit.close')}
            </Button>
          </div>
        }
      >
        <div className="max-h-[70vh] overflow-y-auto bg-charcoal/5 p-3 dark:bg-black/20 print:max-h-none print:overflow-visible print:bg-transparent print:p-0">
          <ProfitReportDocument report={report} />
        </div>
      </Modal>
    </PageTransition>
  );
}
