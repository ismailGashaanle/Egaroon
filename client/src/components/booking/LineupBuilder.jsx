import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiLock,
  FiSave,
  FiUserPlus,
  FiUsers,
  FiCamera,
  FiRefreshCw,
  FiEye,
} from 'react-icons/fi';
import { FaUserInjured } from 'react-icons/fa';
import FormationPitch from './FormationPitch';
import Select from '../common/Select';
import Input from '../common/Input';
import Button from '../common/Button';
import Card, { CardContent, CardHeader, CardTitle } from '../common/Card';
import {
  formationsForCapacity,
  defaultFormationKey,
  slotsForFormation,
  normalizeCapacity,
} from '../../lib/formationLayouts';
import { bookingApi } from '../../api/bookingApi';
import { uploadApi } from '../../api/uploadApi';
import { useBookingLineupSubscription } from '../../hooks/useSocket';
import { useTranslation } from '../../i18n/LanguageContext';

/** Soft cap aligned with server MAX_BENCH */
const MAX_BENCH = 30;

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function uploadLineupPhoto(file) {
  if (!file || !file.type?.startsWith('image/')) throw new Error('Not an image');
  if (file.size > 8 * 1024 * 1024) throw new Error('Image too large');
  const { data } = await uploadApi.uploadFile(file, { folder: 'lineups', resourceType: 'image' });
  return data.data.upload.url;
}

function teamIdOf(lineup) {
  return String(lineup?.team?._id || lineup?.team || '');
}

function partyTeamId(booking, side) {
  return String(booking?.[side]?.team?._id || booking?.[side]?.team || '');
}

/**
 * BR-007 gated dual-team lineup builder.
 * Both captains set formation/lineup/bench; each can see the other's board live.
 */
export default function LineupBuilder({ booking, unlocked, teamSide }) {
  const { t } = useTranslation();
  const capacity = normalizeCapacity(booking?.field?.capacity || booking?.teamA?.playersCount || 7);

  const [formation, setFormation] = useState(() => defaultFormationKey(capacity));
  const [players, setPlayers] = useState([]);
  const [oppLineup, setOppLineup] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [jerseyDraft, setJerseyDraft] = useState('');
  const [photoDraft, setPhotoDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showOpponent, setShowOpponent] = useState(true);

  const formationMap = useMemo(() => formationsForCapacity(capacity), [capacity]);
  const slots = useMemo(() => slotsForFormation(formation, capacity), [formation, capacity]);

  const starters = useMemo(
    () => players.filter((p) => p.status === 'starter' && p.formationSlot && !p.injured),
    [players]
  );
  const bench = useMemo(() => players.filter((p) => p.status === 'bench'), [players]);
  const injuredOnPitch = useMemo(() => starters.filter((p) => p.injured), [starters]);
  const injuredOnBench = useMemo(() => bench.filter((p) => p.injured), [bench]);

  const canSave = useMemo(() => {
    if (!formationMap[formation]) return false;
    if (starters.length !== capacity) return false;
    if (starters.some((p) => !String(p.displayName || '').trim())) return false;
    if (bench.length > MAX_BENCH) return false;
    // All formation slots filled with named starters
    const filled = new Set(starters.map((p) => p.formationSlot));
    return slots.every((s) => filled.has(s.id));
  }, [formation, formationMap, starters, capacity, bench.length, slots]);

  const applyLineupsPayload = useCallback(
    (lineups, { overwriteMine = true } = {}) => {
      const myTeam = partyTeamId(booking, teamSide);
      const mine = (lineups || []).find((l) => teamIdOf(l) === myTeam);
      const opp = (lineups || []).find((l) => teamIdOf(l) !== myTeam);
      if (overwriteMine && mine) {
        setFormation(mine.formation || defaultFormationKey(capacity));
        setPlayers(
          (mine.players || []).map((p) => ({
            ...p,
            _key: p._id || newLocalId(),
            status: p.status || (p.formationSlot ? 'starter' : 'bench'),
          }))
        );
      }
      setOppLineup(opp || null);
    },
    [booking, teamSide, capacity]
  );

  const loadLineups = useCallback(async () => {
    if (!unlocked || !booking?._id) return;
    setLoading(true);
    try {
      const { data } = await bookingApi.getLineups(booking._id);
      applyLineupsPayload(data.data.lineups || [], { overwriteMine: true });
    } catch {
      /* empty until first save */
    } finally {
      setLoading(false);
    }
  }, [unlocked, booking?._id, applyLineupsPayload]);

  useEffect(() => {
    loadLineups();
  }, [loadLineups]);

  const onLiveUpdate = useCallback(
    (payload) => {
      // Live: refresh opponent board only — don't wipe local edits
      applyLineupsPayload(payload.lineups || [], { overwriteMine: false });
    },
    [applyLineupsPayload]
  );

  useBookingLineupSubscription(unlocked ? booking?._id : null, onLiveUpdate);

  // If field capacity changes, drop invalid formation keys
  useEffect(() => {
    if (!formationMap[formation]) {
      setFormation(defaultFormationKey(capacity));
    }
  }, [capacity, formation, formationMap]);

  // Formation change: keep valid starters; overflow → bench
  const handleFormationChange = (nextKey) => {
    if (!formationMap[nextKey]) {
      toast.error(t('lineup.invalidFormation', { formation: nextKey, n: capacity }));
      return;
    }
    const nextSlots = new Set(slotsForFormation(nextKey, capacity).map((s) => s.id));
    setFormation(nextKey);
    setSelectedSlot(null);
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.status === 'bench') return p;
        if (nextSlots.has(p.formationSlot)) return p;
        return {
          ...p,
          status: 'bench',
          formationSlot: '',
          position: 'SUB',
        };
      })
    );
  };

  const resetDraft = () => {
    setNameDraft('');
    setJerseyDraft('');
    setPhotoDraft('');
    setEditingId(null);
    setSelectedSlot(null);
  };

  const placeOnSelectedSlot = () => {
    if (!selectedSlot || !nameDraft.trim()) {
      return toast.error(t('lineup.needNameSlot'));
    }
    if (starters.length >= capacity && !players.find((p) => p.formationSlot === selectedSlot)) {
      return toast.error(t('lineup.fullStarters', { n: capacity }));
    }

    const slotMeta = slots.find((s) => s.id === selectedSlot);
    setPlayers((prev) => {
      const withoutSlot = prev.filter((p) => p.formationSlot !== selectedSlot);
      const rest = editingId ? withoutSlot.filter((p) => p._key !== editingId) : withoutSlot;
      return [
        ...rest,
        {
          _key: editingId || newLocalId(),
          displayName: nameDraft.trim(),
          jerseyNumber: Number(jerseyDraft) || rest.length + 1,
          position: slotMeta?.role || 'MF',
          formationSlot: selectedSlot,
          status: 'starter',
          photoUrl: photoDraft || '',
          injured: false,
          injuryNote: '',
        },
      ];
    });
    resetDraft();
  };

  const addToBench = () => {
    if (!nameDraft.trim()) return toast.error(t('lineup.needName'));
    if (bench.length >= MAX_BENCH) {
      return toast.error(t('lineup.benchFull', { n: MAX_BENCH }));
    }
    setPlayers((prev) => [
      ...prev,
      {
        _key: newLocalId(),
        displayName: nameDraft.trim(),
        jerseyNumber: Number(jerseyDraft) || prev.length + 1,
        position: 'SUB',
        formationSlot: '',
        status: 'bench',
        photoUrl: photoDraft || '',
        injured: false,
        injuryNote: '',
      },
    ]);
    resetDraft();
  };

  const onPhotoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await uploadLineupPhoto(file);
      setPhotoDraft(url);
      toast.success(t('lineup.photoReady'));
    } catch {
      toast.error(t('lineup.photoFail'));
    }
  };

  const markInjured = (key, injured = true) => {
    setPlayers((prev) =>
      prev.map((p) => {
        if (p._key !== key) return p;
        if (injured) {
          // Injury → move to bench + injury flag (empty pitch slot for replacement)
          return {
            ...p,
            injured: true,
            injuryNote: p.injuryNote || 'Injured',
            status: 'bench',
            formationSlot: '',
            position: 'SUB',
          };
        }
        return { ...p, injured: false, injuryNote: '' };
      })
    );
    if (injured) toast.success(t('lineup.movedToBench'));
  };

  const promoteBenchToSlot = (benchKey) => {
    if (!selectedSlot) return toast.error(t('lineup.pickSlotFirst'));
    const occupying = players.find((p) => p.formationSlot === selectedSlot);
    setPlayers((prev) =>
      prev.map((p) => {
        if (p._key === benchKey) {
          const slotMeta = slots.find((s) => s.id === selectedSlot);
          return {
            ...p,
            status: 'starter',
            formationSlot: selectedSlot,
            position: slotMeta?.role || 'MF',
            injured: false,
            injuryNote: '',
          };
        }
        if (occupying && p._key === occupying._key) {
          return { ...p, status: 'bench', formationSlot: '', position: 'SUB' };
        }
        return p;
      })
    );
    setSelectedSlot(null);
  };

  /** Bedel: move starter → bench (frees the slot). */
  const demoteToBench = (key) => {
    if (bench.length >= MAX_BENCH) {
      return toast.error(t('lineup.benchFull', { n: MAX_BENCH }));
    }
    setPlayers((prev) =>
      prev.map((p) =>
        p._key === key
          ? { ...p, status: 'bench', formationSlot: '', position: 'SUB' }
          : p
      )
    );
    if (editingId === key) resetDraft();
  };

  const removePlayer = (key) => {
    setPlayers((prev) => prev.filter((p) => p._key !== key));
  };

  const save = async () => {
    if (!canSave) {
      if (!formationMap[formation]) {
        return toast.error(t('lineup.invalidFormation', { formation, n: capacity }));
      }
      if (starters.length !== capacity) {
        return toast.error(t('lineup.mustStarters', { n: capacity, have: starters.length }));
      }
      return toast.error(t('lineup.saveBlocked'));
    }
    setSaving(true);
    try {
      const payload = players.map(({ _key, ...p }) => p);
      await bookingApi.upsertLineup(booking._id, { formation, players: payload });
      toast.success(t('lineup.saved'));
      await loadLineups();
    } catch (err) {
      toast.error(
        err.response?.data?.error?.message ||
          err.response?.data?.message ||
          t('lineup.saveFail')
      );
    } finally {
      setSaving(false);
    }
  };

  if (!unlocked) {
    return (
      <Card className="mt-8 p-6">
        <div className="flex items-start gap-3 text-muted">
          <FiLock className="mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display text-lg font-bold text-charcoal dark:text-dark-text">
              {t('lineup.lockedTitle')}
            </h3>
            <p className="mt-1 text-sm">{t('lineup.lockedDesc')}</p>
          </div>
        </div>
      </Card>
    );
  }

  const oppSide = teamSide === 'teamA' ? 'teamB' : 'teamA';

  return (
    <Card className="mt-8 p-6">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <FiUsers />
          {t('lineup.title')}
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 text-xs font-semibold text-forest dark:bg-dark-primary/15 dark:text-dark-primary">
            {capacity}v{capacity}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted dark:text-dark-muted">{t('lineup.subtitle', { n: capacity })}</p>

        {loading ? (
          <p className="text-sm text-muted">{t('common.loading')}</p>
        ) : (
          <div className="space-y-8">
            <div className="grid gap-8 lg:grid-cols-2">
              {/* Own board */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="font-display text-sm font-bold uppercase tracking-wide text-charcoal dark:text-dark-text">
                    {t('lineup.yourBoard')} · {booking[teamSide]?.team?.name || teamSide}
                  </h4>
                  <span
                    className={`text-xs font-semibold ${
                      starters.length === capacity ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {starters.length}/{capacity} {t('lineup.starters')}
                  </span>
                </div>

                <FormationPitch
                  formationKey={formation}
                  capacity={capacity}
                  players={players}
                  editable
                  selectedSlot={selectedSlot}
                  showBench={false}
                  onSlotClick={(slot) => {
                    setSelectedSlot(slot.id);
                    const existing = players.find((p) => p.formationSlot === slot.id);
                    if (existing) {
                      setEditingId(existing._key);
                      setNameDraft(existing.displayName || '');
                      setJerseyDraft(existing.jerseyNumber ? String(existing.jerseyNumber) : '');
                      setPhotoDraft(existing.photoUrl || '');
                    } else {
                      setEditingId(null);
                      setNameDraft('');
                      setJerseyDraft('');
                      setPhotoDraft('');
                    }
                  }}
                />

                <div className="mt-4 space-y-3">
                  <Select
                    label={t('lineup.formation')}
                    value={formation}
                    onChange={(e) => handleFormationChange(e.target.value)}
                  >
                    {Object.keys(formationMap).map((key) => (
                      <option key={key} value={key}>
                        {formationMap[key].label}
                      </option>
                    ))}
                  </Select>

                  <p className="text-xs text-muted">
                    {t('lineup.selectedSlot')}: <strong>{selectedSlot || t('lineup.tapPitch')}</strong>
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label={t('lineup.playerName')}
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      placeholder={t('lineup.playerNamePh')}
                    />
                    <Input
                      label={t('lineup.jersey')}
                      type="number"
                      min={1}
                      max={99}
                      value={jerseyDraft}
                      onChange={(e) => setJerseyDraft(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium dark:border-dark-border">
                      <FiCamera />
                      {t('lineup.addPhoto')}
                      <input type="file" accept="image/*" className="hidden" onChange={onPhotoFile} />
                    </label>
                    {photoDraft && (
                      <img src={photoDraft} alt="" className="h-10 w-10 rounded-full object-cover ring-2 ring-forest" />
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" onClick={placeOnSelectedSlot}>
                      {t('lineup.placePitch')}
                    </Button>
                    <Button type="button" variant="ghost" icon={<FiUserPlus />} onClick={addToBench}>
                      {t('lineup.addBench')}
                    </Button>
                    {editingId && players.find((p) => p._key === editingId)?.status === 'starter' && (
                      <Button type="button" variant="ghost" onClick={() => demoteToBench(editingId)}>
                        {t('lineup.toBench')}
                      </Button>
                    )}
                  </div>

                  <Button
                    className="w-full"
                    icon={<FiSave />}
                    loading={saving}
                    disabled={!canSave || saving}
                    onClick={save}
                  >
                    {t('lineup.save')}
                  </Button>
                  {!canSave && (
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {t('lineup.saveBlockedHint', { n: capacity, have: starters.length })}
                    </p>
                  )}
                </div>
              </div>

              {/* Opponent board (live) */}
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h4 className="flex items-center gap-2 font-display text-sm font-bold uppercase tracking-wide text-charcoal dark:text-dark-text">
                    <FiEye />
                    {t('lineup.opponentBoard')} · {booking[oppSide]?.team?.name || t('lineup.waitingOpp')}
                  </h4>
                  <Button type="button" size="sm" variant="ghost" icon={<FiRefreshCw />} onClick={loadLineups}>
                    {t('lineup.refresh')}
                  </Button>
                </div>

                {showOpponent && oppLineup ? (
                  <>
                    <p className="mb-2 text-xs text-muted">
                      {t('lineup.formation')}: <strong>{oppLineup.formation}</strong>
                    </p>
                    <FormationPitch
                      formationKey={oppLineup.formation || defaultFormationKey(capacity)}
                      capacity={capacity}
                      players={oppLineup.players || []}
                      editable={false}
                      compact
                      showBench
                    />
                  </>
                ) : (
                  <div className="flex aspect-[2/3] max-w-xs flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-warmwhite/50 p-6 text-center text-sm text-muted dark:border-dark-border dark:bg-dark-surface-2">
                    <FiUsers className="mb-2 text-2xl opacity-40" />
                    {t('lineup.oppEmpty')}
                  </div>
                )}
                <button
                  type="button"
                  className="mt-2 text-xs font-semibold text-forest dark:text-dark-primary"
                  onClick={() => setShowOpponent((v) => !v)}
                >
                  {showOpponent ? t('lineup.hideOpp') : t('lineup.showOpp')}
                </button>
              </div>
            </div>

            {/* Bench + injury */}
            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <h4 className="mb-3 font-display text-sm font-bold text-amber-900 dark:text-amber-200">
                  {t('lineup.bench')} ({bench.length})
                </h4>
                {bench.length === 0 ? (
                  <p className="text-sm text-muted">{t('lineup.benchEmpty')}</p>
                ) : (
                  <ul className="space-y-2">
                    <AnimatePresence initial={false}>
                      {bench.map((p) => (
                        <motion.li
                          key={p._key}
                          layout
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-100/70 px-3 py-2 text-sm dark:border-amber-800/40 dark:bg-amber-950/40"
                        >
                          {p.photoUrl ? (
                            <img src={p.photoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/25 text-xs font-bold text-amber-900 dark:text-amber-200">
                              {p.jerseyNumber || '?'}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 font-medium">
                            {p.displayName}
                            {p.injured && (
                              <FaUserInjured className="ml-1 inline text-red-600" title={t('lineup.injured')} />
                            )}
                          </span>
                          {!p.injured && (
                            <Button type="button" size="sm" variant="outline" onClick={() => promoteBenchToSlot(p._key)}>
                              {t('lineup.toPitch')}
                            </Button>
                          )}
                          <Button type="button" size="sm" variant="ghost" onClick={() => removePlayer(p._key)}>
                            ×
                          </Button>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ul>
                )}
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50/50 p-4 dark:border-red-900/40 dark:bg-red-950/20">
                <h4 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-red-800 dark:text-red-300">
                  <FaUserInjured />
                  {t('lineup.injuryTitle')}
                </h4>
                <p className="mb-3 text-xs text-red-700/80 dark:text-red-300/80">{t('lineup.injuryHint')}</p>

                {starters.map((p) => (
                  <div
                    key={p._key}
                    className="mb-2 flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-2 py-1.5 text-sm dark:bg-dark-surface/60"
                  >
                    <span className="font-medium">
                      {p.formationSlot}: {p.displayName}
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700"
                      onClick={() => markInjured(p._key, true)}
                    >
                      {t('lineup.markInjured')}
                    </Button>
                  </div>
                ))}

                {injuredOnBench.length > 0 && (
                  <ul className="mt-3 space-y-2 border-t border-red-200/60 pt-3 dark:border-red-900/40">
                    {injuredOnBench.map((p) => (
                      <li
                        key={p._key}
                        className="flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-2 py-1.5 text-sm dark:bg-dark-surface/60"
                      >
                        <FaUserInjured className="text-red-600" />
                        <span className="min-w-0 flex-1 font-medium">{p.displayName}</span>
                        <Button type="button" size="sm" variant="ghost" onClick={() => markInjured(p._key, false)}>
                          {t('lineup.clearInjury')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}

                {injuredOnBench.length === 0 && injuredOnPitch.length === 0 && (
                  <p className="text-xs text-muted">{t('lineup.noInjuries')}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
