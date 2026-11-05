import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiPlus, FiRefreshCw } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import EmptyState from '../../components/common/EmptyState';
import { FullPageSpinner } from '../../components/common/Spinner';
import { adminApi } from '../../api/adminApi';
import { toastApiError } from '../../lib/support';

const STATUS_VARIANT = {
  draft: 'neutral',
  awaiting_signatures: 'warning',
  subscription_pending: 'info',
  active: 'success',
  cancelled: 'error',
};

export default function OwnerOnboardingList() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listOwnerOnboardings({
        ...(status ? { status } : {}),
        ...(q.trim() ? { q: q.trim() } : {}),
      });
      setRows(data.data.onboardings || []);
    } catch (err) {
      toastApiError(err, 'Failed to load onboardings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <PageTransition>
      <PageHeader
        title="Register stadium owners"
        description="Preview the owner agreement, then onboard with stadium, fields, dual signatures, and subscription — credentials issued once."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" icon={<FiRefreshCw />} onClick={load}>
              Refresh
            </Button>
            <Link to="/super-admin/owner-onboardings/new">
              <Button icon={<FiPlus />}>New onboarding</Button>
            </Link>
          </div>
        }
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <Input
          label="Search"
          placeholder="Name, email, phone, stadium…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-w-[200px] flex-1"
        />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="awaiting_signatures">Awaiting signatures</option>
          <option value="subscription_pending">Subscription pending</option>
          <option value="active">Active</option>
          <option value="cancelled">Cancelled</option>
        </Select>
        <Button onClick={load}>Filter</Button>
      </Card>

      {loading ? (
        <FullPageSpinner />
      ) : !rows.length ? (
        <EmptyState
          title="No onboardings yet"
          description="Start by registering a stadium owner with their venue and fields."
          action={
            <Link to="/super-admin/owner-onboardings/new">
              <Button icon={<FiPlus />}>New onboarding</Button>
            </Link>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-charcoal/10 dark:border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-charcoal/5 text-xs uppercase text-muted dark:bg-white/5 dark:text-dark-muted">
              <tr>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Stadium</th>
                <th className="px-4 py-3">Fields</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-charcoal/5 dark:border-white/5">
                  <td className="px-4 py-3">
                    <div className="font-medium text-charcoal dark:text-dark-text">{row.owner?.name || '—'}</div>
                    <div className="text-xs text-muted dark:text-dark-muted">{row.owner?.email}</div>
                    <div className="text-xs text-muted dark:text-dark-muted">{row.owner?.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{row.stadium?.name || '—'}</div>
                    <div className="text-xs text-muted dark:text-dark-muted">
                      {[row.stadium?.city, row.stadium?.region].filter(Boolean).join(', ')}
                    </div>
                  </td>
                  <td className="px-4 py-3">{row.fields?.length || 0}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[row.status] || 'neutral'}>{row.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted dark:text-dark-muted">
                    {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/super-admin/owner-onboardings/${row.id}`}
                      className="font-semibold text-forest dark:text-dark-primary"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageTransition>
  );
}
