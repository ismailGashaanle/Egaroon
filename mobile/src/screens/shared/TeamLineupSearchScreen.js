import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Pressable,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import FormationPitch from '../../components/FormationPitch';
import { lineupsApi } from '../../api/lineups';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import {
  normalizeCapacity,
  defaultFormationKey,
} from '../../lib/formationLayouts';
import { colors, typography, spacing, radii } from '../../theme';

const TABS = [
  { id: 'mine', label: 'Kooxdayda' },
  { id: 'search', label: 'Raadi koox kale' },
];

/**
 * Lineup discovery for any logged-in role when lineupEnabled:
 * - Kooxdayda: caller's team boards (captains)
 * - Raadi koox kale: search published boards by team name (read-only pitch)
 */
export default function TeamLineupSearchScreen({ navigation }) {
  const { lineupEnabled, loaded } = useAuthFeatures();
  const [tab, setTab] = useState('mine');
  const [q, setQ] = useState('');
  const [mineResults, setMineResults] = useState([]);
  const [mineTeams, setMineTeams] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loadingMine, setLoadingMine] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searched, setSearched] = useState(false);

  const loadMine = useCallback(async () => {
    setLoadingMine(true);
    try {
      const data = await lineupsApi.mine();
      const list = data.results || [];
      setMineResults(list);
      setMineTeams(data.teams || []);
      if (tab === 'mine') {
        setSelected((prev) => {
          if (prev && list.some((r) => r.id === prev.id)) return prev;
          return list[0] || null;
        });
      }
    } catch (e) {
      setMineResults([]);
      setMineTeams([]);
      if (tab === 'mine') setSelected(null);
      Toast.show({
        type: 'error',
        text1: 'Kooxdayda lama soo saarin',
        text2: e.message,
      });
    } finally {
      setLoadingMine(false);
    }
  }, [tab]);

  useFocusEffect(
    useCallback(() => {
      if (!lineupEnabled) return;
      loadMine();
    }, [lineupEnabled, loadMine])
  );

  const runSearch = async () => {
    const query = q.trim();
    if (query.length < 2) {
      Toast.show({ type: 'error', text1: 'Geli ugu yaraan 2 xaraf' });
      return;
    }
    setLoadingSearch(true);
    setSearched(true);
    try {
      const data = await lineupsApi.search(query);
      const list = data.results || [];
      setSearchResults(list);
      setSelected(list[0] || null);
      if (!list.length) {
        Toast.show({ type: 'info', text1: 'Lineup la daabacay lama helin' });
      }
    } catch (e) {
      setSearchResults([]);
      setSelected(null);
      Toast.show({ type: 'error', text1: 'Raadinta way fashilantay', text2: e.message });
    } finally {
      setLoadingSearch(false);
    }
  };

  const switchTab = (next) => {
    setTab(next);
    setSelected(null);
    if (next === 'mine') {
      setSelected(mineResults[0] || null);
    } else if (searched && searchResults.length) {
      setSelected(searchResults[0] || null);
    }
  };

  if (!loaded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandGreen} />
      </View>
    );
  }

  if (!lineupEnabled) {
    return (
      <View style={styles.screen}>
        <Header
          title="Lineups"
          subtitle="Waa la damiyay"
          onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
        />
        <View style={styles.centered}>
          <Text style={styles.title}>Lineups waa la damiyay</Text>
          <Text style={styles.mutedCenter}>
            Fur lineupEnabled Platform Settings-ka (Super Admin).
          </Text>
        </View>
      </View>
    );
  }

  const list = tab === 'mine' ? mineResults : searchResults;
  const capacity = normalizeCapacity(selected?.capacity || 7);
  const players =
    selected?.players ||
    [...(selected?.starters || []), ...(selected?.bench || [])];

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title="Lineups"
          subtitle="Kooxdayda · raadi koox kale"
          onBack={navigation?.canGoBack?.() ? () => navigation.goBack() : undefined}
        />
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            tab === 'mine' ? (
              <RefreshControl refreshing={loadingMine} onRefresh={loadMine} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.tabs}>
            {TABS.map((t) => (
              <Chip
                key={t.id}
                label={t.label}
                selected={tab === t.id}
                onPress={() => switchTab(t.id)}
                style={styles.tabChip}
              />
            ))}
          </View>

          {tab === 'mine' ? (
            <>
              <Text style={styles.sectionHint}>
                Lineup-kii ugu dambeeyay ee kooxaha aad kabtan ka tahay (read-only halkan).
              </Text>
              {loadingMine && !mineResults.length ? (
                <ActivityIndicator color={colors.brandGreen} style={{ marginVertical: 16 }} />
              ) : null}
              {!loadingMine && !mineTeams.length ? (
                <Text style={styles.muted}>
                  Ma lihid koox — kabtanada ayaa arka Kooxdayda. Raadi koox kale si aad u
                  eegto formation la daabacay.
                </Text>
              ) : null}
              {!loadingMine && mineTeams.length > 0 && !mineResults.length ? (
                <Text style={styles.muted}>
                  Kooxahaaga weli ma laha lineup la kaydiyay. Kaydi formation Booking →
                  Lineup ka dib marka ballanku CONFIRMED yahay.
                </Text>
              ) : null}
            </>
          ) : (
            <>
              <Text style={styles.sectionHint}>
                Raadi magaca kooxda — eeg formation-ka ugu dambeeyay ee la daabacay.
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Magaca kooxda"
                placeholderTextColor={colors.muted}
                value={q}
                onChangeText={setQ}
                onSubmitEditing={runSearch}
                returnKeyType="search"
              />
              <Button
                title={loadingSearch ? 'Waa la raadinayaa…' : 'Raadi'}
                onPress={runSearch}
                disabled={loadingSearch}
              />
              {searched && !loadingSearch && searchResults.length === 0 ? (
                <Text style={styles.muted}>Natiijo ma jirto — isku day magac kale.</Text>
              ) : null}
            </>
          )}

          {list.length > 0 ? (
            <View style={styles.results}>
              {list.map((r) => {
                const active =
                  selected &&
                  (selected.id === r.id ||
                    String(selected.team?._id) === String(r.team?._id));
                return (
                  <Pressable
                    key={r.id || r.team?._id}
                    onPress={() => setSelected(r)}
                    style={[styles.resultRow, active && styles.resultActive]}
                  >
                    {r.team?.logoUrl ? (
                      <Image source={{ uri: r.team.logoUrl }} style={styles.logo} />
                    ) : (
                      <View style={styles.logoFallback}>
                        <Text style={styles.logoText}>
                          {(r.team?.name || '?').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.resultText}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {r.team?.name}
                      </Text>
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {r.formation} · {normalizeCapacity(r.capacity)}v
                        {normalizeCapacity(r.capacity)}
                        {r.published === false ? ' · qarsoon' : ''}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {selected ? (
            <View style={styles.board}>
              <Text style={styles.teamTitle}>{selected.team?.name}</Text>
              <Text style={styles.meta}>
                {selected.formation} · {capacity}v{capacity} · akhri keliya
              </Text>
              <FormationPitch
                formationKey={selected.formation || defaultFormationKey(capacity)}
                capacity={capacity}
                players={players}
                editable={false}
                showBench
              />
            </View>
          ) : null}
        </ScrollView>
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmwhite },
  scroll: { padding: spacing.md, paddingBottom: 48, gap: spacing.sm },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: colors.warmwhite,
  },
  title: { ...typography.h3, color: colors.brandNavy, textAlign: 'center' },
  sectionHint: { color: colors.muted, fontSize: 13, marginBottom: 4, lineHeight: 18 },
  muted: { color: colors.muted, fontSize: 13, marginTop: 8, lineHeight: 18 },
  mutedCenter: { color: colors.muted, fontSize: 13, textAlign: 'center', marginTop: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tabChip: { flexGrow: 1, minWidth: '45%' },
  input: {
    borderWidth: 1,
    borderColor: colors.border || '#e5e7eb',
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.charcoal,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  results: { marginTop: 12, gap: 8 },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: radii.md,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border || '#e5e7eb',
  },
  resultActive: {
    borderColor: colors.brandGreen,
    backgroundColor: '#ecfdf5',
  },
  logo: { width: 32, height: 32, borderRadius: 16 },
  logoFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontWeight: '800', fontSize: 11, color: colors.brandGreen },
  resultText: { flex: 1, minWidth: 0 },
  resultName: { fontWeight: '700', color: colors.charcoal },
  resultMeta: { marginTop: 2, fontSize: 12, color: colors.muted, fontWeight: '600' },
  board: { marginTop: 16 },
  teamTitle: { ...typography.h3, color: colors.brandNavy },
  meta: { color: colors.muted, marginBottom: 12, fontWeight: '600' },
});
