import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Card from '../../components/common/Card';
import ReportTable from '../../components/common/ReportTable';
import { SkeletonTable } from '../../components/common/Skeleton';
import axiosClient from '../../api/axiosClient';
import { paymentApi } from '../../api/bookingApi';
import { useTranslation } from '../../i18n/LanguageContext';

export default function AdminBookings() {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axiosClient.get('/admin/bookings');
      setBookings(data.data.bookings || []);
    } catch {
      toast.error(t('admin.loadBookingsFail'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- initial load only

  const settle = useCallback(
    async (bookingId) => {
      setBusyId(bookingId);
      try {
        await paymentApi.settleBooking(bookingId);
        toast.success(t('admin.settled'));
        load();
      } catch (err) {
        toast.error(err.response?.data?.message || err.response?.data?.error?.message || t('admin.settleFail'));
      } finally {
        setBusyId(null);
      }
    },
    [load, t]
  );

  const expireHolds = async () => {
    try {
      const { data } = await paymentApi.expireStaleHolds();
      toast.success(t('admin.expiredHolds', { n: data.data.expiredCount }));
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || t('admin.expireFail'));
    }
  };

  const columns = useMemo(
    () => [
      {
        id: 'venue',
        accessorFn: (b) => `${b.stadium?.name || ''} ${b.field?.name || ''}`,
        header: t('admin.stadium'),
        cell: (info) => {
          const b = info.row.original;
          return (
            <span className="font-medium">
              {b.stadium?.name} · {b.field?.name}
            </span>
          );
        },
      },
      {
        accessorKey: 'startTime',
        header: t('admin.when'),
        cell: (info) => (
          <span className="text-sm text-muted dark:text-dark-muted">
            {info.getValue() ? new Date(info.getValue()).toLocaleString() : '—'}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('admin.status'),
        cell: (info) => <Badge>{info.getValue()}</Badge>,
      },
      {
        id: 'actions',
        header: t('admin.actions'),
        enableSorting: false,
        cell: (info) => {
          const b = info.row.original;
          if (b.status !== 'COMPLETED') return null;
          return (
            <Button size="sm" loading={busyId === b._id} onClick={() => settle(b._id)}>
              {t('admin.settle')}
            </Button>
          );
        },
      },
    ],
    [t, busyId, settle]
  );

  return (
    <PageTransition>
      <PageHeader
        title={t('admin.bookingsTitle')}
        description={t('admin.bookingsDesc')}
        actions={
          <Button variant="outline" size="sm" onClick={expireHolds}>
            {t('admin.expireHolds')}
          </Button>
        }
      />

      {loading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : (
        <Card className="p-4">
          <ReportTable
            columns={columns}
            data={bookings}
            getRowId={(row) => row._id}
            emptyLabel={t('admin.noBookings')}
          />
        </Card>
      )}
    </PageTransition>
  );
}
