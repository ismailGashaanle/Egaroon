import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiSearch, FiUsers } from 'react-icons/fi';
import toast from 'react-hot-toast';
import FormationPitch from '../components/booking/FormationPitch';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { lineupApi } from '../api/lineupApi';
import { useAuth } from '../hooks/useAuth';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { useTranslation } from '../i18n/LanguageContext';
import { normalizeCapacity, defaultFormationKey } from '../lib/formationLayouts';

/**
 * Lineup discovery: My teams (auth) + search published boards by name.
 * Edit remains captain + BR-007 gated on booking pages.
 */
export default function TeamLineups() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { lineupEnabled, loaded } = useAuthFeatures();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialTab = searchParams.get('tab') === 'search' ? 'search' : 'mine';

  const [tab, setTab] = useState(isAuthenticated ? initialTab : 'search');
  const [q, setQ] = useState(initialQ);
  const [mineResults, setMineResults] = useState([]);
  const [mineTeams, setMineTeams] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadMine = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoadingMine(true);
    try {
      const { data } = await lineupApi.mine();
      const list = data.data?.results || [];
      setMineResults(list);
      setMineTeams(data.data?.teams || []);
      setSelected((prev) => {
        if (prev && list.some((r) => r.id === prev.id)) return prev;
        return list[0] || null;
      });
    } catch (err) {
      setMineResults([]);
      setMineTeams([]);
      toast.error(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          t('lineupSearch.failMine')
      );
    } finally {
      setLoadingMine(false);
    }
  }, [isAuthenticated, t]);

  const runSearch = useCallback(
    async (term) => {
      const query = String(term || '').trim();
      if (query.length < 2) {
        toast.error(t('lineupSearch.minChars'));
        return;
      }
      setLoadingSearch(true);
      setSearched(true);
      setSearchParams(query ? { tab: 'search', q: query } : { tab: 'search' });
      try {
        const { data } = await lineupApi.search(query);
        const list = data.data?.results || [];
        setSearchResults(list);
        setSelected(list[0] || null);
        if (!list.length) toast(t('lineupSearch.noResults'));
      } catch (err) {
        setSearchResults([]);
        setSelected(null);
        toast.error(
          err.response?.data?.error?.message ||
            err.response?.data?.message ||
            t('lineupSearch.fail')
        );
      } finally {
        setLoadingSearch(false);
      }
    },
    [setSearchParams, t]
  );

  useEffect(() => {
    if (!lineupEnabled) return;
    if (isAuthenticated) loadMine();
  }, [lineupEnabled, isAuthenticated, loadMine]);

  useEffect(() => {
    if (initialQ.trim().length >= 2 && lineupEnabled) {
      setTab('search');
      runSearch(initialQ);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot from URL
  }, [lineupEnabled]);

  const switchTab = (next) => {
    setTab(next);
    setSelected(null);
    if (next === 'mine') {
      setSearchParams({});
      setSelected(mineResults[0] || null);
    } else {
      setSearchParams(q.trim() ? { tab: 'search', q: q.trim() } : { tab: 'search' });
      if (searched && searchResults.length) setSelected(searchResults[0] || null);
    }
  };

  if (!loaded) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-muted">
        {t('common.loading')}
      </div>
    );
  }

  if (!lineupEnabled) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <FiUsers className="mx-auto mb-4 text-4xl text-muted opacity-40" />
        <h1 className="font-display text-2xl font-bold text-charcoal dark:text-dark-text">
          {t('lineup.disabledTitle')}
        </h1>
        <p className="mt-2 text-sm text-muted dark:text-dark-muted">{t('lineup.disabledDesc')}</p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-forest">
          {t('common.back')}
        </Link>
      </div>
    );
  }

  const results = tab === 'mine' ? mineResults : searchResults;
  const loading = tab === 'mine' ? loadingMine : loadingSearch;
  const capacity = normalizeCapacity(selected?.capacity || 7);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 max-w-xl">
        <p className="text-xs font-bold uppercase tracking-widest text-forest dark:text-dark-primary">
          E-Garoon
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-charcoal dark:text-dark-text sm:text-4xl">
          {t('lineupSearch.title')}
        </h1>
        <p className="mt-2 text-sm text-muted dark:text-dark-muted">{t('lineupSearch.subtitle')}</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {isAuthenticated ? (
          <button
            type="button"
            onClick={() => switchTab('mine')}
            className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === 'mine'
                ? 'border-forest bg-forest text-white'
                : 'border-border bg-white text-charcoal hover:border-forest/40 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text'
            }`}
          >
            {t('lineupSearch.tabMine')}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => switchTab('search')}
          className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
            tab === 'search'
              ? 'border-forest bg-forest text-white'
              : 'border-border bg-white text-charcoal hover:border-forest/40 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text'
          }`}
        >
          {t('lineupSearch.tabSearch')}
        </button>
      </div>

      {tab === 'mine' ? (
        <p className="mb-4 text-sm text-muted dark:text-dark-muted">{t('lineupSearch.mineHint')}</p>
      ) : (
        <form
          className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            runSearch(q);
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              label={t('lineupSearch.teamName')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t('lineupSearch.placeholder')}
              autoComplete="off"
            />
          </div>
          <Button type="submit" icon={<FiSearch />} loading={loadingSearch} className="sm:mb-0.5">
            {t('common.search')}
          </Button>
        </form>
      )}

      {tab === 'mine' && !loadingMine && isAuthenticated && !mineTeams.length ? (
        <p className="rounded-xl border border-dashed border-border bg-warmwhite/60 px-4 py-8 text-center text-sm text-muted dark:border-dark-border dark:bg-dark-surface-2">
          {t('lineupSearch.noTeams')}
        </p>
      ) : null}

      {tab === 'mine' && !loadingMine && mineTeams.length > 0 && !mineResults.length ? (
        <p className="rounded-xl border border-dashed border-border bg-warmwhite/60 px-4 py-8 text-center text-sm text-muted dark:border-dark-border dark:bg-dark-surface-2">
          {t('lineupSearch.noMineLineups')}
        </p>
      ) : null}

      {tab === 'search' && searched && !loadingSearch && searchResults.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-warmwhite/60 px-4 py-8 text-center text-sm text-muted dark:border-dark-border dark:bg-dark-surface-2">
          {t('lineupSearch.emptyHint')}
        </p>
      )}

      {results.length > 0 && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,14rem)_1fr]">
          <aside className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              {t('lineupSearch.results')} ({results.length})
              {loading ? '…' : ''}
            </p>
            {results.map((r) => {
              const id = r.id || r.team?._id;
              const active =
                selected && (selected.id === r.id || selected.team?._id === r.team?._id);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(r)}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                    active
                      ? 'border-forest bg-forest/10 font-semibold text-charcoal dark:border-dark-primary dark:bg-dark-primary/15 dark:text-dark-text'
                      : 'border-border bg-white hover:border-forest/40 dark:border-dark-border dark:bg-dark-surface'
                  }`}
                >
                  {r.team?.logoUrl ? (
                    <img src={r.team.logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest/15 text-xs font-bold text-forest">
                      {(r.team?.name || '?').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate">{r.team?.name}</span>
                </button>
              );
            })}
          </aside>

          {selected && (
            <section>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-bold text-charcoal dark:text-dark-text">
                    {selected.team?.name}
                  </h2>
                  <p className="text-sm text-muted">
                    {t('lineup.formation')}: <strong>{selected.formation}</strong>
                    {' · '}
                    {capacity}v{capacity}
                    {' · '}
                    {t('lineupSearch.readOnly')}
                  </p>
                </div>
              </div>
              <FormationPitch
                formationKey={selected.formation || defaultFormationKey(capacity)}
                capacity={capacity}
                players={
                  selected.players || [...(selected.starters || []), ...(selected.bench || [])]
                }
                editable={false}
                showBench
              />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
