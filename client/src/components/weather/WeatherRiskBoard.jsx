import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import clsx from 'clsx';
import { FiCloud, FiPlus, FiRefreshCw, FiTrash2, FiAlertTriangle } from 'react-icons/fi';
import Card, { CardTitle } from '../common/Card';
import Input from '../common/Input';
import Button from '../common/Button';
import { weatherApi } from '../../api/weatherApi';
import { toastApiError } from '../../lib/support';
import { useTranslation } from '../../i18n/LanguageContext';

const PLAY = {
  good: 'bg-[#176B45]/10 text-[#176B45] dark:bg-[#176B45]/20 dark:text-[#7dcaa6]',
  caution: 'bg-[#D98A3A]/15 text-[#94652a] dark:text-[#e8b06a]',
  poor: 'bg-[#a33a32]/12 text-[#a33a32]',
  unplayable: 'bg-[#a33a32]/18 text-[#a33a32]',
};

const PLAY_LABEL = {
  good: 'Wanaagsan',
  caution: 'Taxaddar',
  poor: 'Xun',
  unplayable: 'Lama ciyaari karo',
};

export default function WeatherRiskBoard() {
  const { t } = useTranslation();
  const [cities, setCities] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [nameSo, setNameSo] = useState('');
  const [region, setRegion] = useState('');

  const load = async () => {
    const { data } = await weatherApi.alerts();
    const payload = data?.data || {};
    setCities(payload.cities || []);
    setAlerts(payload.alerts || []);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        toastApiError(err, t('platformSettings.weatherBoardFail'));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const { data } = await weatherApi.refresh();
      const payload = data?.data || {};
      setCities(payload.cities || []);
      setAlerts(payload.alerts || []);
      toast.success(t('platformSettings.weatherRefreshed'));
    } catch (err) {
      toastApiError(err, t('platformSettings.weatherBoardFail'));
    } finally {
      setRefreshing(false);
    }
  };

  const onAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    try {
      await weatherApi.addCity({
        name: name.trim(),
        nameSo: nameSo.trim() || undefined,
        region: region.trim() || undefined,
      });
      setName('');
      setNameSo('');
      setRegion('');
      await load();
      toast.success(t('platformSettings.weatherCityAdded'));
    } catch (err) {
      toastApiError(err, t('platformSettings.weatherAddFail'));
    } finally {
      setAdding(false);
    }
  };

  const onRemove = async (city) => {
    if (city.isDefault) return;
    try {
      await weatherApi.removeCity(city.id);
      await load();
      toast.success(t('platformSettings.weatherCityRemoved'));
    } catch (err) {
      toastApiError(err, t('platformSettings.weatherRemoveFail'));
    }
  };

  return (
    <Card className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-muted">
          <FiCloud />
          <CardTitle>{t('platformSettings.weatherBoardTitle')}</CardTitle>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          loading={refreshing}
          onClick={onRefresh}
          icon={<FiRefreshCw />}
        >
          {t('platformSettings.weatherRefresh')}
        </Button>
      </div>
      <p className="text-sm text-muted">{t('platformSettings.weatherBoardHelp')}</p>

      {loading ? (
        <p className="text-sm text-muted">{t('platformSettings.weatherLoading')}</p>
      ) : (
        <>
          {alerts.length ? (
            <ul className="space-y-2">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start gap-2 rounded-xl border border-[#a33a32]/20 bg-[#a33a32]/8 px-3 py-2.5 text-sm"
                >
                  <FiAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#a33a32]" />
                  <div>
                    <p className="font-semibold text-[#18201C] dark:text-dark-text">{a.headlineSo || a.headline}</p>
                    <p className="text-xs text-muted">
                      {PLAY_LABEL[a.level] || a.level}
                      {a.risks?.[0] ? ` · ${a.risks[0].titleSo || a.risks[0].title}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl bg-[#176B45]/8 px-3 py-2 text-sm text-[#176B45]">
              {t('platformSettings.weatherNoAlerts')}
            </p>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            {cities.map((city) => {
              const snap = city.lastSnapshot || {};
              const level = snap.play?.level || city.lastPlayLevel || 'good';
              const rain = snap.summary?.rainMm;
              const chance = snap.summary?.rainChance;
              return (
                <div
                  key={city.id}
                  className="flex items-start justify-between gap-2 rounded-xl border border-black/[0.06] bg-[#F7F6F1] px-3 py-3 dark:border-dark-border dark:bg-dark-surface-2"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[#18201C] dark:text-dark-text">
                      {city.nameSo || city.name}
                      {city.region ? (
                        <span className="ms-1 text-xs font-normal text-muted">· {city.region}</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      {rain != null ? `${Number(rain).toFixed(1)} mm` : '—'}
                      {chance != null ? ` · ${Math.round(chance)}%` : ''}
                    </p>
                    <span
                      className={clsx(
                        'mt-1.5 inline-block rounded-full px-2 py-0.5 text-[11px] font-extrabold',
                        PLAY[level] || PLAY.good
                      )}
                    >
                      {PLAY_LABEL[level] || level}
                    </span>
                  </div>
                  {!city.isDefault ? (
                    <button
                      type="button"
                      className="rounded-lg p-1.5 text-muted hover:bg-white hover:text-[#a33a32] dark:hover:bg-dark-surface"
                      onClick={() => onRemove(city)}
                      aria-label={t('platformSettings.weatherRemove')}
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <form onSubmit={onAdd} className="space-y-3 border-t border-black/[0.06] pt-4 dark:border-dark-border">
            <p className="text-sm font-medium text-charcoal dark:text-dark-text">
              {t('platformSettings.weatherAddTitle')}
            </p>
            <p className="text-xs text-muted">{t('platformSettings.weatherAddHelp')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label={t('platformSettings.weatherCity')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Berbera"
                required
              />
              <Input
                label={t('platformSettings.weatherCitySo')}
                value={nameSo}
                onChange={(e) => setNameSo(e.target.value)}
                placeholder="Barbara"
              />
              <Input
                label={t('platformSettings.weatherRegion')}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="Saaxil"
              />
            </div>
            <Button type="submit" size="sm" loading={adding} icon={<FiPlus />}>
              {t('platformSettings.weatherAddCity')}
            </Button>
          </form>
        </>
      )}
    </Card>
  );
}
