import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiCheck, FiX, FiSlash } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import { FullPageSpinner } from '../../components/common/Spinner';
import { stadiumApi } from '../../api/stadiumApi';

export default function AdminStadiums() {
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await stadiumApi.list({});
      setStadiums(data.data.stadiums);
    } catch {
      toast.error('Failed to load stadiums');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (stadium, status) => {
    try {
      await stadiumApi.setStatus(stadium._id, status);
      toast.success(`Stadium ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error?.message || 'Failed to update stadium');
    }
  };

  if (loading) return <FullPageSpinner />;

  return (
    <PageTransition>
      <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">Stadiums</h1>
      <p className="mt-1 text-sm text-muted dark:text-dark-muted">Verify new listings and manage existing ones.</p>

      <div className="mt-6 space-y-2">
        {stadiums.map((s) => (
          <Card key={s._id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold text-charcoal dark:text-dark-text">{s.name}</p>
              <p className="text-xs text-muted dark:text-dark-muted capitalize">
                {s.location?.city || 'No city'} · {s.status}
              </p>
            </div>
            <div className="flex gap-2">
              {s.status !== 'approved' && (
                <Button size="sm" icon={<FiCheck />} onClick={() => setStatus(s, 'approved')}>
                  Approve
                </Button>
              )}
              {s.status !== 'rejected' && (
                <Button size="sm" variant="outline" icon={<FiX />} onClick={() => setStatus(s, 'rejected')}>
                  Reject
                </Button>
              )}
              {s.status !== 'suspended' && (
                <Button size="sm" variant="danger" icon={<FiSlash />} onClick={() => setStatus(s, 'suspended')}>
                  Suspend
                </Button>
              )}
            </div>
          </Card>
        ))}
        {stadiums.length === 0 && <p className="text-sm text-muted dark:text-dark-muted">No stadiums found.</p>}
      </div>
    </PageTransition>
  );
}
