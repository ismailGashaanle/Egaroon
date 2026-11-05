import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import FadeIn from '../../components/FadeIn';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import FormationPitch from '../../components/FormationPitch';
import { useAuth } from '../../context/AuthContext';
import { bookingsApi } from '../../api/bookings';
import { pickAndUploadImage } from '../../lib/pickUpload';
import {
  normalizeCapacity,
  formationsForCapacity,
  defaultFormationKey,
  slotsForFormation,
} from '../../lib/formationLayouts';
import { captainIdOf, sameUserId } from '../../lib/bookingStatus';
import { colors, typography, spacing, radii } from '../../theme';

const MAX_BENCH = 30;

function newLocalId() {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function partyTeamId(booking, side) {
  return String(booking?.[side]?.team?._id || booking?.[side]?.team || '');
}

function teamIdOf(lineup) {
  return String(lineup?.team?._id || lineup?.team || '');
}

/**
 * Captain lineup editor — BR-007 gated; requires lineupEnabled.
 * Dual-captain: each edits own side; GET returns both boards.
 */
export default function LineupScreen({ route }) {
  const { bookingId, teamSide: routeSide } = route.params || {};
  const { user } = useAuth();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formation, setFormation] = useState('2-3-1');
  const [players, setPlayers] = useState([]);
  const [oppLineup, setOppLineup] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [jerseyDraft, setJerseyDraft] = useState('');
  const [photoDraft, setPhotoDraft] = useState('');

  const capacity = normalizeCapacity(
    booking?.field?.capacity || booking?.teamA?.playersCount || 7
  );
  const formationMap = useMemo(() => formationsForCapacity(capacity), [capacity]);
  const slots = useMemo(() => slotsForFormation(formation, capacity), [formation, capacity]);

  const starters = useMemo(
    () => players.filter((p) => p.status === 'starter' && p.formationSlot && !p.injured),
    [players]
  );
  const bench = useMemo(() => players.filter((p) => p.status === 'bench'), [players]);

  const canSave = useMemo(() => {
    if (!formationMap[formation]) return false;
    if (starters.length !== capacity) return false;
    if (starters.some((p) => !String(p.displayName || '').trim())) return false;
    if (bench.length > MAX_BENCH) return false;
    const filled = new Set(starters.map((p) => p.formationSlot));
    return slots.every((s) => filled.has(s.id));
  }, [formation, formationMap, starters, capacity, bench.length, slots]);

  const userId = user?.id || user?._id;
  const teamSide =
    routeSide ||
    (sameUserId(captainIdOf(booking?.teamA), userId)
      ? 'teamA'
      : sameUserId(captainIdOf(booking?.teamB), userId)
        ? 'teamB'
        : 'teamA');
  const oppSide = teamSide === 'teamA' ? 'teamB' : 'teamA';

  const load = useCallback(async () => {
    try {
      const bData = await bookingsApi.get(bookingId);
      const b = bData.booking || bData;
      setBooking(b);
      const cap = normalizeCapacity(b?.field?.capacity || b?.teamA?.playersCount || 7);
      setFormation((prev) =>
        Object.keys(formationsForCapacity(cap)).includes(prev) ? prev : defaultFormationKey(cap)
      );

      const side =
        routeSide ||
        (sameUserId(captainIdOf(b?.teamA), userId)
          ? 'teamA'
          : sameUserId(captainIdOf(b?.teamB), userId)
            ? 'teamB'
            : 'teamA');

      try {
        const data = await bookingsApi.getLineups(bookingId);
        const myTeam = partyTeamId(b, side);
        const mine = (data.lineups || []).find((l) => teamIdOf(l) === myTeam);
        const opp = (data.lineups || []).find((l) => teamIdOf(l) !== myTeam);
        if (mine) {
          setFormation(mine.formation || defaultFormationKey(cap));
          setPlayers(
            (mine.players || []).map((p) => ({
              ...p,
              _key: p._id || newLocalId(),
              status: p.status || (p.formationSlot ? 'starter' : 'bench'),
            }))
          );
        }
        setOppLineup(opp || null);
      } catch {
        /* empty until first save / feature off */
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Lineup lama furin', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [bookingId, routeSide, userId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const handleFormationChange = (nextKey) => {
    if (!formationMap[nextKey]) {
      Toast.show({
        type: 'error',
        text1: `Formation ${nextKey} ma habboona ${capacity}v${capacity}`,
      });
      return;
    }
    const nextSlots = new Set(slotsForFormation(nextKey, capacity).map((s) => s.id));
    setFormation(nextKey);
    setSelectedSlot(null);
    setEditingId(null);
    setPlayers((prev) =>
      prev.map((p) => {
        if (p.status === 'bench') return p;
        if (nextSlots.has(p.formationSlot)) return p;
        return { ...p, status: 'bench', formationSlot: '', position: 'SUB' };
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

  const placeOnSlot = () => {
    if (!selectedSlot || !nameDraft.trim()) {
      Toast.show({ type: 'error', text1: 'Dooro boos oo geli magac' });
      return;
    }
    if (starters.length >= capacity && !players.find((p) => p.formationSlot === selectedSlot)) {
      Toast.show({ type: 'error', text1: `Starters waa ${capacity} — ku dar kayd` });
      return;
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
    if (!nameDraft.trim()) {
      Toast.show({ type: 'error', text1: 'Geli magaca' });
      return;
    }
    if (bench.length >= MAX_BENCH) {
      Toast.show({ type: 'error', text1: `Kaydka waa buuxay (max ${MAX_BENCH})` });
      return;
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

  const markInjuredToBench = (key) => {
    setPlayers((prev) =>
      prev.map((p) =>
        p._key === key
          ? {
              ...p,
              injured: true,
              injuryNote: 'Injured',
              status: 'bench',
              formationSlot: '',
              position: 'SUB',
            }
          : p
      )
    );
    Toast.show({ type: 'success', text1: 'Dhaawac → kayd' });
  };

  const promoteBench = (benchKey) => {
    if (!selectedSlot) {
      Toast.show({ type: 'error', text1: 'Marka hore dooro boos' });
      return;
    }
    const occupying = players.find((p) => p.formationSlot === selectedSlot);
    const slotMeta = slots.find((s) => s.id === selectedSlot);
    setPlayers((prev) =>
      prev.map((p) => {
        if (p._key === benchKey) {
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

  /** Bedel: starter → kayd */
  const demoteToBench = (key) => {
    if (bench.length >= MAX_BENCH) {
      Toast.show({ type: 'error', text1: `Kaydka waa buuxay (max ${MAX_BENCH})` });
      return;
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

  const onPickPhoto = async () => {
    try {
      const url = await pickAndUploadImage({ folder: 'lineups', aspect: [1, 1] });
      if (url) {
        setPhotoDraft(url);
        Toast.show({ type: 'success', text1: 'Sawir waa diyaar (Cloudinary)' });
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Sawir lama soo geliyin', text2: e.message });
    }
  };

  const save = async () => {
    if (!canSave) {
      if (!formationMap[formation]) {
        Toast.show({
          type: 'error',
          text1: `Formation ${formation} ma habboona ${capacity}v${capacity}`,
        });
        return;
      }
      Toast.show({
        type: 'error',
        text1: `Waa in ay noqdaan ${capacity} starters magac leh`,
        text2: `Hadda: ${starters.length}/${capacity}`,
      });
      return;
    }
    setSaving(true);
    try {
      const payload = players.map(({ _key, ...p }) => p);
      await bookingsApi.upsertLineup(bookingId, { formation, players: payload });
      Toast.show({ type: 'success', text1: 'Lineup waa la kaydiyay' });
      await load();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Kaydintu way fashilantay', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !booking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandGreen} />
      </View>
    );
  }

  return (
    <FadeIn>
      <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
        <Card style={styles.fullWidth}>
          <Text style={styles.title}>Formation & lineup</Text>
          <Text style={styles.sub}>
            Labada kabtanba — midkiiba shaxdiisa. {capacity}v{capacity} · {starters.length}/
            {capacity} starters
          </Text>
          <Text style={styles.hint}>
            Shaxdaada · {booking?.[teamSide]?.team?.name || teamSide}
          </Text>
        </Card>

        <Card style={styles.fullWidth}>
          <Text style={styles.label}>Dooro formation ({capacity} ciyaaryahan)</Text>
          <Text style={styles.formHint}>
            Kaliya formation-yada {capacity}v{capacity} — doorashadu waxay cusboonaysaa boosaska
            garoonka.
          </Text>
          <View style={styles.chips}>
            {Object.keys(formationMap).map((key) => (
              <Chip
                key={key}
                label={formationMap[key]?.label || key}
                selected={formation === key}
                onPress={() => handleFormationChange(key)}
              />
            ))}
          </View>
        </Card>

        <FormationPitch
          formationKey={formation}
          capacity={capacity}
          players={players}
          editable
          selectedSlot={selectedSlot}
          showBench={false}
          onSlotPress={(slot) => {
            setSelectedSlot(slot.id);
            const p = players.find((x) => x.formationSlot === slot.id);
            if (p) {
              setEditingId(p._key);
              setNameDraft(p.displayName || '');
              setJerseyDraft(p.jerseyNumber ? String(p.jerseyNumber) : '');
              setPhotoDraft(p.photoUrl || '');
            } else {
              setEditingId(null);
              setNameDraft('');
              setJerseyDraft('');
              setPhotoDraft('');
            }
          }}
        />

        <Text style={styles.slotHint}>Boos: {selectedSlot || 'taabo garoonka'}</Text>

        <Card style={styles.fullWidth}>
          <Text style={styles.label}>Ciyaaryahan</Text>
          <TextInput
            style={styles.input}
            placeholder="Magaca"
            placeholderTextColor={colors.muted}
            value={nameDraft}
            onChangeText={setNameDraft}
          />
          <TextInput
            style={styles.input}
            placeholder="Lambarka funaanadda"
            placeholderTextColor={colors.muted}
            keyboardType="number-pad"
            value={jerseyDraft}
            onChangeText={setJerseyDraft}
          />
          <View style={styles.row}>
            <Button title="Sawir" variant="outline" onPress={onPickPhoto} style={{ flex: 1 }} />
            {photoDraft ? (
              <Image source={{ uri: photoDraft }} style={styles.avatar} />
            ) : null}
          </View>
          <View style={[styles.row, { marginTop: 10 }]}>
            <Button title="Saar garoonka" onPress={placeOnSlot} style={{ flex: 1 }} />
            <Button title="Kayd" variant="outline" onPress={addToBench} style={{ flex: 1 }} />
          </View>
          {editingId && players.find((p) => p._key === editingId)?.status === 'starter' ? (
            <Button
              title="U rar kayd (bedel)"
              variant="outline"
              onPress={() => demoteToBench(editingId)}
              style={{ marginTop: 8 }}
            />
          ) : null}
        </Card>

        <Card style={[styles.fullWidth, styles.benchCard]}>
          <Text style={styles.label}>Kayd / Bench ({bench.length})</Text>
          {bench.length === 0 ? (
            <Text style={styles.muted}>Weli kayd ma jiro</Text>
          ) : (
            bench.map((p) => (
              <View key={p._key} style={styles.benchRow}>
                {p.photoUrl ? (
                  <Image source={{ uri: p.photoUrl }} style={styles.avatarSm} />
                ) : (
                  <View style={styles.jerseyBadge}>
                    <Text style={styles.jerseyText}>{p.jerseyNumber || '?'}</Text>
                  </View>
                )}
                <Text style={styles.benchName}>
                  {p.displayName}
                  {p.injured ? ' · dhaawac' : ''}
                </Text>
                {!p.injured ? (
                  <Pressable onPress={() => promoteBench(p._key)}>
                    <Text style={styles.link}>U geli</Text>
                  </Pressable>
                ) : (
                  <Ionicons name="medkit" size={16} color={colors.danger} />
                )}
              </View>
            ))
          )}
        </Card>

        {starters.length > 0 ? (
          <Card style={styles.fullWidth}>
            <Text style={styles.label}>Dhaawac → kayd</Text>
            {starters.map((p) => (
              <Pressable
                key={p._key}
                style={styles.injRow}
                onPress={() => markInjuredToBench(p._key)}
              >
                <Text style={styles.benchName}>
                  {p.formationSlot}: {p.displayName}
                </Text>
                <Ionicons name="medkit-outline" size={18} color={colors.danger} />
              </Pressable>
            ))}
          </Card>
        ) : null}

        <Button
          title={saving ? 'Waa la kaydinayaa…' : 'Kaydi lineup'}
          onPress={save}
          disabled={!canSave || saving}
          style={{ marginTop: 8 }}
        />
        {!canSave ? (
          <Text style={styles.saveHint}>
            Kaydi waa xiran illaa {capacity} starters magac leh ({starters.length}/{capacity})
          </Text>
        ) : null}

        {/* Opponent board (read-only) */}
        <Card style={styles.fullWidth}>
          <View style={styles.oppHeader}>
            <Text style={styles.label}>
              Shaxda kabtanka kale · {booking?.[oppSide]?.team?.name || 'Sugaya…'}
            </Text>
            <Pressable onPress={load}>
              <Text style={styles.link}>Cusbooneysii</Text>
            </Pressable>
          </View>
          {oppLineup ? (
            <>
              <Text style={styles.muted}>Formation: {oppLineup.formation}</Text>
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
            <Text style={styles.muted}>
              Kabtanka kale weli ma kaydin formation-kiisa.
            </Text>
          )}
        </Card>
      </ScrollView>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmwhite },
  scroll: { padding: spacing.md, paddingBottom: 40, gap: spacing.md },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fullWidth: { width: '100%' },
  title: { ...typography.h3, color: colors.brandNavy },
  sub: { marginTop: 4, color: colors.muted, fontWeight: '600' },
  hint: { marginTop: 6, fontSize: 12, fontWeight: '700', color: colors.brandGreen },
  formHint: { fontSize: 12, color: colors.muted, marginBottom: 10, lineHeight: 17 },
  label: { ...typography.overline, color: colors.muted, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotHint: { fontSize: 12, color: colors.muted, fontWeight: '600', textAlign: 'center' },
  input: {
    borderWidth: 1,
    borderColor: colors.border || '#e5e7eb',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    color: colors.charcoal,
    backgroundColor: '#fff',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarSm: { width: 28, height: 28, borderRadius: 14 },
  benchCard: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  benchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#fed7aa',
  },
  injRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border || '#e5e7eb',
  },
  benchName: { flex: 1, fontWeight: '600', color: colors.charcoal },
  jerseyBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fdba74',
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyText: { fontWeight: '800', fontSize: 11 },
  link: { color: colors.brandGreen, fontWeight: '700' },
  muted: { color: colors.muted, fontSize: 13, marginBottom: 8 },
  saveHint: {
    fontSize: 12,
    color: '#b45309',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  oppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
});
