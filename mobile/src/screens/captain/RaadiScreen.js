import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Chip from '../../components/Chip';
import StadiumCard from '../../components/StadiumCard';
import { stadiumsApi } from '../../api/stadiums';
import { useTheme } from '../../context/ThemeContext';
import { radii, spacing, typography } from '../../theme';

const DEBOUNCE_MS = 350;

/**
 * Captain Find / Raadi — stadium-first discovery with live filters.
 * Stadium → FieldSelect → SlotSelect.
 */
export default function RaadiScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const initial = route?.params || {};

  const [q, setQ] = useState(initial.q || '');
  const [city, setCity] = useState(initial.city || '');
  const [region, setRegion] = useState(initial.region || '');
  const [showPlaceFilters, setShowPlaceFilters] = useState(
    Boolean(initial.city || initial.region)
  );
  const [availableNow, setAvailableNow] = useState(Boolean(initial.availableNow));
  const [nearestOn, setNearestOn] = useState(
    Boolean(initial.lat != null && initial.lng != null) || initial.sort === 'nearest'
  );
  const [coords, setCoords] = useState(
    initial.lat != null && initial.lng != null
      ? { lat: initial.lat, lng: initial.lng }
      : null
  );
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [locBusy, setLocBusy] = useState(false);
  const debounceRef = useRef(null);
  const [debouncedQ, setDebouncedQ] = useState(q);
  const [debouncedCity, setDebouncedCity] = useState(city.trim());
  const [debouncedRegion, setDebouncedRegion] = useState(region.trim());

  // Tab may stay mounted — sync when Hoyga / deep-link params arrive.
  useEffect(() => {
    const p = route?.params;
    if (!p) return;
    if (p.q != null) setQ(String(p.q));
    if (p.city != null) setCity(String(p.city));
    if (p.region != null) setRegion(String(p.region));
    if (p.availableNow != null) setAvailableNow(Boolean(p.availableNow));
    if (p.lat != null && p.lng != null) {
      setCoords({ lat: p.lat, lng: p.lng });
      setNearestOn(true);
    } else if (p.sort === 'nearest') {
      setNearestOn(true);
    }
    if (p.city || p.region) setShowPlaceFilters(true);
  }, [route?.params]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(q.trim());
      setDebouncedCity(city.trim());
      setDebouncedRegion(region.trim());
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, city, region]);

  const ensureGps = useCallback(async () => {
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'GPS waa la diiday',
          text2: 'Oggolow goobta si aad u hesho ugudhow',
        });
        setNearestOn(false);
        return null;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setCoords(next);
      return next;
    } catch (e) {
      Toast.show({ type: 'error', text1: 'GPS ma shaqeyn', text2: e.message });
      setNearestOn(false);
      return null;
    } finally {
      setLocBusy(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let geo = coords;
      if (nearestOn && (!geo || geo.lat == null)) {
        geo = await ensureGps();
        if (!geo) {
          setStadiums([]);
          return;
        }
      }

      const params = {};
      if (debouncedQ) params.q = debouncedQ;
      if (debouncedCity) params.city = debouncedCity;
      if (debouncedRegion) params.region = debouncedRegion;
      if (availableNow) params.availableNow = 'true';
      if (nearestOn && geo) {
        params.lat = geo.lat;
        params.lng = geo.lng;
        params.sort = 'nearest';
        if (initial.radiusKm != null) params.radiusKm = initial.radiusKm;
      }

      const data = await stadiumsApi.list(params);
      setStadiums(data.stadiums || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Garoonnada lama soo qaadin', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [
    debouncedQ,
    debouncedCity,
    debouncedRegion,
    availableNow,
    nearestOn,
    coords,
    ensureGps,
    initial.radiusKm,
  ]);

  useEffect(() => {
    load();
  }, [load]);

  const onToggleNearest = async () => {
    if (nearestOn) {
      setNearestOn(false);
      return;
    }
    setNearestOn(true);
    if (!coords) await ensureGps();
  };

  const openStadium = (item) => {
    navigation.navigate('FieldSelect', {
      stadiumId: String(item._id || item.id),
      stadiumName: item.name,
      images: item.images || [],
      sizePrices: item.sizePrices || [],
      startingPrice: item.startingPrice ?? item.priceFrom ?? item.minPrice ?? null,
      ops: item.ops || null,
    });
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Raadi" subtitle="Dooro garoonka · ka dib field-ka" variant="green" />

        <View style={styles.filters}>
          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={20} color={colors.muted} />
            <TextInput
              style={styles.searchInput}
              value={q}
              onChangeText={setQ}
              placeholder="Magac garoonka…"
              placeholderTextColor={colors.muted}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            {q ? (
              <Pressable onPress={() => setQ('')} hitSlop={8}>
                <Ionicons name="close-circle" size={20} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.chipRow}>
            <Chip
              label="Magaalo / Gobol"
              selected={showPlaceFilters}
              onPress={() => setShowPlaceFilters((v) => !v)}
              style={styles.chip}
            />
            <Chip
              label={locBusy ? 'GPS…' : 'Ugudhow'}
              selected={nearestOn}
              onPress={onToggleNearest}
              style={styles.chip}
            />
            <Chip
              label="Hadda banaan"
              selected={availableNow}
              onPress={() => setAvailableNow((v) => !v)}
              style={styles.chip}
            />
          </View>

          {showPlaceFilters ? (
            <View style={styles.placeBox}>
              <Text style={styles.inputLabel}>Magaalada</Text>
              <TextInput
                style={styles.input}
                value={city}
                onChangeText={setCity}
                placeholder="Muqdisho / Hargeysa"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.inputLabel}>Gobolka (region)</Text>
              <TextInput
                style={[styles.input, styles.inputLast]}
                value={region}
                onChangeText={setRegion}
                placeholder="Banaadir"
                placeholderTextColor={colors.muted}
              />
            </View>
          ) : null}
        </View>

        {loading && !stadiums.length ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={stadiums}
            keyExtractor={(item) => String(item._id || item.id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>
                {availableNow
                  ? 'Hadda ma jiro garoon banaan. Isku day filter kale.'
                  : 'Garoon lama helin. Beddel raadinta ama GPS.'}
              </Text>
            }
            renderItem={({ item }) => (
              <StadiumCard stadium={item} onPress={() => openStadium(item)} />
            )}
          />
        )}
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    filters: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 10,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.surfaceInset,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    searchInput: {
      flex: 1,
      fontSize: 15,
      color: colors.text,
      padding: 0,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    chip: { flexGrow: 0, minWidth: 0, paddingHorizontal: 12 },
    placeBox: { marginTop: 4 },
    inputLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 4,
    },
    input: {
      backgroundColor: colors.surfaceInset,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      fontSize: 15,
      marginBottom: 10,
    },
    inputLast: { marginBottom: 0 },
    list: { padding: spacing.md, paddingBottom: 32, gap: 12 },
    empty: {
      textAlign: 'center',
      color: colors.muted,
      marginTop: 48,
      ...typography.body,
      paddingHorizontal: 24,
    },
  });
}
