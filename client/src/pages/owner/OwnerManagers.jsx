import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { FiUsers } from 'react-icons/fi';
import PageTransition from '../../components/common/PageTransition';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/common/Card';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import EmptyState from '../../components/common/EmptyState';
import { stadiumApi } from '../../api/stadiumApi';
import { useAuth } from '../../hooks/useAuth';
import { ROLES } from '../../lib/roles';
import { useTranslation } from '../../i18n/LanguageContext';

export default function OwnerManagers() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const isOwner = role === ROLES.STADIUM_OWNER;
  const [stadiums, setStadiums] = useState([]);
  const [stadiumId, setStadiumId] = useState('');
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ email: '', name: '', password: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    stadiumApi
      .list({ mine: 'true' })
      .then((res) => {
        const list = res.data.data.stadiums || [];
        setStadiums(list);
        if (list[0]) setStadiumId(list[0]._id);
      })
      .catch(() => toast.error(t('owner.loadFail')))
      .finally(() => setLoading(false));
  }, [t]);

  const loadManagers = async (id) => {
    if (!id || !isOwner) return;
    try {
      const { data } = await stadiumApi.listManagers(id);
      setManagers(data.data.managers || []);
    } catch {
      setManagers([]);
    }
  };

  useEffect(() => {
    loadManagers(stadiumId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stadiumId]);

  const invite = async (e) => {
    e.preventDefault();
    if (!stadiumId) return;
    setBusy(true);
    try {
      const { data } = await stadiumApi.inviteManager(stadiumId, form);
      toast.success(
        data.data.temporaryPassword
          ? `${t('owner.managerLinked')} · ${data.data.temporaryPassword}`
          : t('owner.managerLinked')
      );
      setForm({ email: '', name: '', password: '' });
      loadManagers(stadiumId);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.inviteFail'));
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (managerId) => {
    try {
      await stadiumApi.revokeManager(stadiumId, managerId);
      toast.success(t('owner.managerRevoked'));
      loadManagers(stadiumId);
    } catch (err) {
      toast.error(err.response?.data?.error?.message || t('owner.revokeFail'));
    }
  };

  if (!isOwner) {
    return (
      <PageTransition>
        <PageHeader title={t('owner.managersTitle')} description={t('owner.managersOwnerOnly')} />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title={t('owner.managersTitle')}
        description={t('owner.managersHint')}
        breadcrumbs={[
          { label: t('owner.navHome'), to: '/owner' },
          { label: t('owner.navManagers') },
        ]}
      />

      <Card className="mb-5 p-4 sm:max-w-sm">
        <Select
          label={t('owner.filterStadium')}
          value={stadiumId}
          onChange={(e) => setStadiumId(e.target.value)}
        >
          {stadiums.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Card>

      {loading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-border/40" />
      ) : stadiums.length === 0 ? (
        <EmptyState icon={<FiUsers size={22} />} title={t('owner.noStadiums')} description={t('owner.noStadiumsDesc')} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="mb-3 font-display font-bold">{t('owner.inviteManager')}</h2>
            <form onSubmit={invite} className="space-y-3">
              <Input
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label={t('owner.managerName')}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <Input
                label={t('owner.tempPassword')}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="optional"
              />
              <Button type="submit" loading={busy} className="w-full">
                {t('owner.inviteManager')}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 font-display font-bold">{t('owner.staffList')}</h2>
            {managers.length === 0 ? (
              <p className="text-sm text-muted">{t('owner.noManagers')}</p>
            ) : (
              <ul className="space-y-2">
                {managers.map((m) => (
                  <li
                    key={m._id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-warmwhite px-3 py-2.5 text-sm dark:bg-dark-surface-2"
                  >
                    <div>
                      <p className="font-medium">{m.user?.name || m.user?.email || m.email}</p>
                      <p className="text-xs text-muted">{m.user?.email || m.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="forest">{m.status || 'active'}</Badge>
                      <Button size="sm" variant="danger" onClick={() => revoke(m._id)}>
                        {t('owner.revoke')}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </PageTransition>
  );
}
