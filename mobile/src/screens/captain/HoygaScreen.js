import { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import HoygaHero from '../../components/HoygaHero';
import HomeStadiumTile from '../../components/HomeStadiumTile';
import WeatherAlertBanner from '../../components/WeatherAlertBanner';
import { stadiumsApi } from '../../api/stadiums';
import { bookingsApi } from '../../api/bookings';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { bookingStatusLabel } from '../../lib/bookingStatus';
import { formatSlotSo } from '../../lib/ownerDisplay';
import { typography, radii, spacing } from '../../theme';

const DEAD = new Set(['CANCELLED', 'EXPIRED', 'NO_SHOW', 'COMPLETED', 'SETTLED']);

function dayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Subax wanaagsan';
  if (h < 17) return 'Galab wanaagsan';
  return 'Fiid wanaagsan';
}

function firstName(user) {
  const n = String(user?.name || '').trim();
  return n.split(/\s+/)[0] || 'Captain';
}

function initialsOf(user) {
  const parts = String(user?.name || 'K').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'K';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function pickNextBooking(list) {
  const now = Date.now() - 90 * 60 * 1000;
  return (
    (list || [])
      .filter((b) => {
        if (DEAD.has(String(b.status || '').toUpperCase())) return false;
        return new Date(b.startTime || 0).getTime() >= now;
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0] || null
  );
}

function tap() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export default function HoygaScreen({ navigation }) {
  const { colors, shadows } = useTheme();
  const { user } = useAuth();
  const styles = makeStyles(colors, shadows);
  const [locBusy, setLocBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [stadiums, setStadiums] = useState([]);
  const [nextBooking, setNextBooking] = useState(null);
  const [wxTick, setWxTick] = useState(0);
  const coordsRef = useRef(null);

  const greeting = useMemo(() => dayGreeting(), []);
  const name = firstName(user);

  const goRaadi = useCallback(
    (extra = {}) => {
      navigation.navigate('Tabs', {
        screen: 'Raadi',
        params: { ...extra },
      });
    },
    [navigation]
  );

  const loadHome = useCallback(async () => {
    try {
      const [stRes, bkRes] = await Promise.all([
        stadiumsApi.list().catch(() => ({ stadiums: [] })),
        bookingsApi.mine().catch(() => ({ bookings: [] })),
      ]);
      setStadiums((stRes.stadiums || []).slice(0, 8));
      setNextBooking(pickNextBooking(bkRes.bookings || []));
    } catch {
      /* toast only on pull-to-refresh failures below */
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHome();
    }, [loadHome])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadHome();
    setWxTick((n) => n + 1);
    setRefreshing(false);
  };

  const onGps = async () => {
    tap();
    setLocBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({
          type: 'error',
          text1: 'GPS waa la diiday',
          text2: 'Fadlan oggolow goobta si aad u hesho garoonno u dhow',
        });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      coordsRef.current = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      Toast.show({ type: 'success', text1: 'Goobtaada waa la helay' });
      goRaadi({
        lat: coordsRef.current.lat,
        lng: coordsRef.current.lng,
        sort: 'nearest',
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'GPS ma shaqeyn', text2: e.message });
    } finally {
      setLocBusy(false);
    }
  };

  const openStadium = (item) => {
    tap();
    navigation.navigate('FieldSelect', {
      stadiumId: String(item._id || item.id),
      stadiumName: item.name,
      images: item.images || [],
      sizePrices: item.sizePrices || [],
      startingPrice: item.startingPrice ?? item.priceFrom ?? item.minPrice ?? null,
      ops: item.ops || null,
    });
  };

  const ACTIONS = [
    {
      id: 'raadi',
      label: 'Raadi',
      hint: 'Dooro garoon',
      icon: 'search',
      tint: colors.brandGreen,
      onPress: () => {
        tap();
        goRaadi();
      },
    },
    {
      id: 'open',
      label: 'Banaan',
      hint: 'Hadda furan',
      icon: 'flash',
      tint: '#F59E0B',
      onPress: () => {
        tap();
        goRaadi({ availableNow: true });
      },
    },
    {
      id: 'gps',
      label: locBusy ? 'GPS…' : 'Ugudhow',
      hint: 'Garoonno ku dhow',
      icon: 'navigate',
      tint: colors.brandBlue,
      onPress: onGps,
    },
    {
      id: 'pay',
      label: 'Dhammee',
      hint: 'Match Code',
      icon: 'key',
      tint: '#A78BFA',
      onPress: () => {
        tap();
        navigation.navigate('JoinMatchCode');
      },
    },
  ];

  const stadiumName =
    typeof nextBooking?.stadium === 'object'
      ? nextBooking.stadium?.name
      : nextBooking?.stadiumName || 'Garoon';

  return (
    <FadeIn>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brandGreen}
            />
          }
        >
          <HoygaHero
            kicker="Hoyga · E-Garoon"
            greeting={greeting}
            name={name}
            subtitle="Raadi garoon, dooro field, ballanso saacad."
            initials={initialsOf(user)}
            onAvatarPress={() => navigation.navigate('Dheeraad')}
          >
            <Pressable
              onPress={() => {
                tap();
                goRaadi();
              }}
              style={({ pressed }) => [styles.searchPill, pressed && { opacity: 0.92 }]}
            >
              <View style={styles.searchIcon}>
                <Ionicons name="search" size={18} color={colors.brandNavy} />
              </View>
              <Text style={styles.searchPlaceholder}>Raadi garoon, magaalo…</Text>
              <View style={styles.searchGo}>
                <Ionicons name="arrow-forward" size={16} color="#fff" />
              </View>
            </Pressable>
          </HoygaHero>

          <View style={styles.sheet}>
            <WeatherAlertBanner refreshKey={wxTick} />
            <Animated.View entering={FadeInDown.delay(40).duration(380)} style={styles.grid}>
              {ACTIONS.map((a) => (
                <Pressable
                  key={a.id}
                  onPress={a.onPress}
                  style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
                >
                  <View style={[styles.actionIcon, { backgroundColor: `${a.tint}22` }]}>
                    <Ionicons name={a.icon} size={22} color={a.tint} />
                  </View>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                  <Text style={styles.actionHint}>{a.hint}</Text>
                </Pressable>
              ))}
            </Animated.View>

            {nextBooking ? (
              <Animated.View entering={FadeInDown.delay(90).duration(380)}>
                <Text style={styles.sectionTitle}>Ciyaarta xigta</Text>
                <Pressable
                  onPress={() => {
                    tap();
                    navigation.navigate('BookingDetail', { bookingId: nextBooking._id });
                  }}
                  style={({ pressed }) => [styles.matchCard, pressed && { opacity: 0.94 }]}
                >
                  <View style={styles.matchAccent} />
                  <View style={styles.matchBody}>
                    <Text style={styles.matchKicker}>{bookingStatusLabel(nextBooking)}</Text>
                    <Text style={styles.matchTitle} numberOfLines={1}>
                      {stadiumName}
                    </Text>
                    <Text style={styles.matchWhen} numberOfLines={2}>
                      {formatSlotSo(nextBooking.startTime, nextBooking.endTime)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.brandGreen} />
                </Pressable>
              </Animated.View>
            ) : null}

            <Animated.View entering={FadeInDown.delay(130).duration(380)}>
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Garoonno</Text>
                <Pressable
                  onPress={() => {
                    tap();
                    goRaadi();
                  }}
                  hitSlop={8}
                >
                  <Text style={styles.seeAll}>Dhammaan</Text>
                </Pressable>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tiles}
              >
                {stadiums.map((s) => (
                  <HomeStadiumTile
                    key={String(s._id || s.id)}
                    stadium={s}
                    onPress={() => openStadium(s)}
                  />
                ))}
                {!stadiums.length ? (
                  <Pressable onPress={() => goRaadi()} style={styles.emptyTile}>
                    <Ionicons name="football-outline" size={28} color={colors.brandGreen} />
                    <Text style={styles.emptyTileText}>Raadi garoonno</Text>
                  </Pressable>
                ) : null}
              </ScrollView>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(180).duration(380)}>
              <Pressable
                onPress={() => {
                  tap();
                  navigation.navigate('JoinMatchCode');
                }}
                style={({ pressed }) => [styles.joinCard, pressed && { opacity: 0.94 }]}
              >
                <View style={styles.joinIcon}>
                  <Ionicons name="key" size={22} color="#fff" />
                </View>
                <View style={styles.joinCopy}>
                  <Text style={styles.joinTitle}>Team B — dhammee lacagta</Text>
                  <Text style={styles.joinHint}>Geli Match Code + telefoonka Team A</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(220).duration(380)} style={styles.steps}>
              {[
                { n: '01', t: 'Dooro', d: 'Garoon + field + saacad' },
                { n: '02', t: 'Bixi', d: 'Qaybta kooxdaada' },
                { n: '03', t: 'Ciyaar', d: 'Lineup marka la kiraysto' },
              ].map((s) => (
                <View key={s.n} style={styles.step}>
                  <Text style={styles.stepN}>{s.n}</Text>
                  <Text style={styles.stepT}>{s.t}</Text>
                  <Text style={styles.stepD}>{s.d}</Text>
                </View>
              ))}
            </Animated.View>
          </View>
        </ScrollView>
      </View>
    </FadeIn>
  );
}

function makeStyles(colors, shadows) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { paddingBottom: 48 },
    searchPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: radii.full,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 8,
      ...shadows.lifted,
    },
    searchIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    searchPlaceholder: {
      flex: 1,
      marginLeft: 10,
      fontSize: 15,
      fontWeight: '600',
      color: '#64748B',
    },
    searchGo: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.brandGreen,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheet: {
      marginTop: -18,
      paddingHorizontal: spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 8,
    },
    action: {
      width: '47%',
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 12,
      ...shadows.card,
    },
    actionPressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
    actionIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    actionLabel: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    actionHint: {
      marginTop: 2,
      fontSize: 12,
      fontWeight: '500',
      color: colors.muted,
    },
    sectionTitle: {
      ...typography.h4,
      fontWeight: '800',
      color: colors.text,
      marginTop: 18,
      marginBottom: 10,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    seeAll: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.brandGreen,
    },
    matchCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      paddingRight: 12,
      ...shadows.card,
    },
    matchAccent: {
      width: 5,
      alignSelf: 'stretch',
      backgroundColor: colors.brandGreen,
    },
    matchBody: {
      flex: 1,
      paddingVertical: 14,
      paddingHorizontal: 12,
    },
    matchKicker: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.brandGreen,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
    },
    matchTitle: {
      marginTop: 4,
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    matchWhen: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '500',
      color: colors.muted,
      lineHeight: 18,
    },
    tiles: {
      gap: 12,
      paddingBottom: 4,
      paddingRight: 8,
    },
    emptyTile: {
      width: 196,
      height: 168,
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.surface,
    },
    emptyTileText: {
      fontWeight: '700',
      color: colors.muted,
    },
    joinCard: {
      marginTop: 22,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.brandNavy,
      borderRadius: 18,
      padding: 14,
      gap: 12,
    },
    joinIcon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor: colors.brandGreen,
      alignItems: 'center',
      justifyContent: 'center',
    },
    joinCopy: { flex: 1 },
    joinTitle: {
      color: '#fff',
      fontSize: 15,
      fontWeight: '800',
    },
    joinHint: {
      marginTop: 3,
      color: 'rgba(255,255,255,0.72)',
      fontSize: 12,
      fontWeight: '500',
    },
    steps: {
      marginTop: 22,
      flexDirection: 'row',
      gap: 8,
    },
    step: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    stepN: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.brandGreen,
      letterSpacing: 0.6,
    },
    stepT: {
      marginTop: 6,
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    stepD: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '500',
      color: colors.muted,
      lineHeight: 15,
    },
  });
}
