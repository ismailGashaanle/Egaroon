import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Select from '../../components/common/Select';
import ReportTable from '../../components/common/ReportTable';
import { SkeletonTable } from '../../components/common/Skeleton';
import { adminApi } from '../../api/adminApi';
import { useTranslation } from '../../i18n/LanguageContext';

export default function AdminPayments() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [reviewFilter, setReviewFilter] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = {};
      if (statusFilter) q.status = statusFilter;
      if (reviewFilter) q.reviewStatus = reviewFilter;
      const { data } = await adminApi.listPayments(q);
      setPayments(data.data.payments || []);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('admin.loadPaymentsFail'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, reviewFilter, t]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  const review = useCallback(
    async (id, status) => {
      setBusyId(id);
      try {
        await adminApi.reviewPayment(id, { status });
        toast.success(
          status === 'ok' ? t('admin.markedOk') : status === 'flagged' ? t('admin.flaggedToast') : t('admin.reset')
        );
        load();
      } catch (err) {
        toast.error(err.response?.data?.error?.message || t('admin.reviewFail'));
      } finally {
        setBusyId(null);
      }
    },
    [load, t]
  );

  const columns = useMemo(
    () => [
      {
        accessorKey: 'amount',
        header: t('admin.amount'),
        cell: (info) => {
          const p = info.row.original;
          const isSll = p.currency === 'SLL' || p.payCurrency === 'SLL';
          return (
            <span className="font-semibold">
              {isSll
                ? `${Number(p.amountSll || p.amount).toLocaleString()} SlSh${p.amountUsd ? ` ($${Number(p.amountUsd).toFixed(2)})` : ''}`
                : `$${Number(p.amountUsd || p.amount || 0).toFixed(2)} USD`}
              {p.coverFullMatch ? ` · ${t('admin.fullMatch')}` : ''}
            </span>
          );
        },
      },
      {
        id: 'method',
        accessorFn: (p) => p.operator || p.provider || '',
        header: t('admin.method'),
        cell: (info) => {
          const p = info.row.original;
          return `${p.operator || p.provider || '—'} · ${p.side || '—'}`;
        },
      },
      {
        id: 'payer',
        accessorFn: (p) => p.payerName || p.payer?.name || '',
        header: t('admin.payer'),
        cell: (info) => {
          const p = info.row.original;
          return (
            <span>
              <span className="block">{p.payerName || p.payer?.name || '—'}</span>
              <span className="text-xs text-muted dark:text-dark-muted">
                {p.payerPhone || p.payer?.phone || '—'}
              </span>
            </span>
          );
        },
      },
      {
        id: 'venue',
        accessorFn: (p) => `${p.booking?.stadium || ''} ${p.booking?.field || ''}`,
        header: t('admin.venue'),
        cell: (info) => {
          const p = info.row.original;
          return (
            <span className="text-sm text-muted dark:text-dark-muted">
              {p.booking?.stadium || '—'} / {p.booking?.field || '—'}
              {p.booking?.startTime ? (
                <span className="block text-xs">{new Date(p.booking.startTime).toLocaleString()}</span>
              ) : null}
            </span>
          );
        },
      },
      {
        accessorKey: 'status',
        header: t('admin.status'),
        cell: (info) => <Badge status={info.getValue()}>{info.getValue()}</Badge>,
      },
      {
        accessorKey: 'adminReviewStatus',
        header: t('admin.review'),
        cell: (info) => (
          <Badge variant="neutral">
            {t('admin.review')}: {info.getValue() || 'pending'}
          </Badge>
        ),
      },
      {
        id: 'actions',
        header: t('admin.actions'),
        enableSorting: false,
        cell: (info) => {
          const p = info.row.original;
          return (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<FiCheck />} loading={busyId === p.id} onClick={() => review(p.id, 'ok')}>
                {t('admin.ok')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                icon={<FiAlertTriangle />}
                loading={busyId === p.id}
                onClick={() => review(p.id, 'flagged')}
              >
                {t('admin.flag')}
              </Button>
            </div>
          );
        },
      },
    ],
    [t, busyId, review]
  );

  return (
    <PageTransition>
      <PageHeader
        title={t('admin.paymentsTitle')}
        description={t('admin.paymentsDesc')}
        breadcrumbs={[
          { label: t('admin.console'), to: '/admin' },
          { label: t('admin.paymentsNav') },
        ]}
        actions={
          <Button variant="outline" size="sm" icon={<FiRefreshCw />} onClick={load}>
            {t('admin.refresh')}
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap gap-3 p-4">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} containerClassName="w-40">
          <option value="">{t('admin.allPayStatus')}</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="HELD">HELD</option>
          <option value="PENDING">PENDING</option>
          <option value="FAILED">FAILED</option>
        </Select>
        <Select value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)} containerClassName="w-40">
          <option value="">{t('admin.allReviews')}</option>
          <option value="pending">{t('admin.pendingReviewOpt')}</option>
          <option value="ok">{t('admin.ok')}</option>
          <option value="flagged">{t('admin.flagged')}</option>
        </Select>
        <Button type="button" onClick={load}>
          {t('admin.apply')}
        </Button>
      </Card>

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : (
        <Card className="p-4">
          <ReportTable
            columns={columns}
            data={payments}
            getRowId={(row) => row.id}
            emptyLabel={t('admin.noPayments')}
            minWidth="880px"
          />
        </Card>
      )}
    </PageTransition>
  );
}
