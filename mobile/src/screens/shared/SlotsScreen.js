import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import StaffHero from '../../components/StaffHero';
import DateStrip from '../../components/DateStrip';
import { stadiumsApi } from '../../api/stadiums';
import { useTheme } from '../../context/ThemeContext';
import { formatCountdown } from '../../lib/gateScan';
import {
  formatSlotTime,
  venueNowMs,
  effectiveSlotState,
  toIsoDate,
  buildDateStrip,
} from '../../lib/dateUtils';
import { formatFieldType } from '../../lib/fieldFormats';
import { radii, spacing, typography } from '../../theme';

function slotLabel(slot) {
  return formatSlotTime(slot.startTime || slot.start, slot.startLabel);
}

function isRecurringSlot(slot) {
  if (!slot) return false;
  if (slot.labelHint === 'RECURRING' || slot.isRecurring) return true;
  return String(slot.reason || '').startsWith('RECURRING');
}

function slotBg(slot, colors, state) {
  if (isRecurringSlot(slot)) return '#4F46E5';
  if (state === 'available') return colors.slotAvailable;
  if (state === 'booked') return colors.slotBooked;
  if (state === 'selected') return '#D97706';
  if (state === 'blocked') return '#64748B';
  return colors.surfaceInset;
}

function stateSo(slot) {
  if (slot.labelSo) return slot.labelSo;
  const map = {
    available: 'Banaan',
    booked: 'Kiraystay',
    selected: 'Dooran',
    blocked: 'Xiran',
    past: 'Dhacay',
  };
  return map[slot.state] || slot.state;
}

export default function SlotsScreen() {
  const navigation = useNavigation();
  const { colors, shadows } = useTheme();
  const styles = makeStyles(colors, shadows);
  const dates = useMemo(() => buildDateStrip(toIsoDate(), 13), []);

  const [stadiums, setStadiums] = useState([]);
  const [stadiumId, setStadiumId] = useState('');
  const [fields, setFields] = useState([]);
  const [fieldId, setFieldId] = useState('');
  const [date, setDate] = useState(() => toIsoDate());
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [clockMs, setClockMs] = useState(() => venueNowMs());

  useEffect(() => {
    const id = setInterval(() => {
      setNowTick(Date.now());
      setClockMs(venueNowMs());
    }, 30000);
    return () => clearInterval(id);
  }, []);

  const loadSlots = useCallback(async () => {
    if (!fieldId || !date) return;
    setSlotsLoading(true);
    try {
      const data = await stadiumsApi.listSlots(fieldId, date);
      const raw = [...(data.slots || [])].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
      setSlots(raw);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Slots', text2: e.message });
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [fieldId, date]);

  const loadStadiums = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stadiumsApi.mine();
      const list = data.stadiums || data || [];
      const arr = Array.isArray(list) ? list : [];
      setStadiums(arr);
      setStadiumId((prev) => {
        if (prev && arr.some((s) => String(s._id) === String(prev))) return prev;
        return arr[0] ? String(arr[0]._id) : '';
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Garoonyada', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStadiums();
    }, [loadStadiums])
  );

  useEffect(() => {
    if (!stadiumId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const fRes = await stadiumsApi.listFields(stadiumId);
        const list = fRes.fields || [];
        if (cancelled) return;
        setFields(list);
        setFieldId((prev) => {
          if (prev && list.some((f) => String(f._id) === String(prev))) return prev;
          return list[0] ? String(list[0]._id) : '';
        });
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Fields', text2: e.message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stadiumId]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    const waiting = slots.filter((s) => s.state === 'selected' && s.selectedUntil);
    if (!waiting.length) return undefined;
    const next = Math.min(...waiting.map((s) => new Date(s.selectedUntil).getTime()));
    const delay = Math.max(500, next - Date.now() + 400);
    const t = setTimeout(() => loadSlots(), delay);
    return () => clearTimeout(t);
  }, [slots, loadSlots, nowTick]);

  const onSlotPress = (slot) => {
    if (isRecurringSlot(slot)) {
      Toast.show({
        type: 'info',
        text1: slot.labelSo || 'Joogto',
        text2: slot.teamName || 'Koox toddobaadle ah',
      });
      return;
    }
    const state = effectiveSlotState(slot, venueNowMs());
    const bookingId = slot.bookingId || slot.booking?._id;
    if ((state === 'booked' || state === 'selected') && bookingId) {
      navigation.navigate('OwnerBookingDetail', { bookingId: String(bookingId) });
      return;
    }
    if (state === 'available') {
      navigation.navigate('WalkInBook', {
        stadiumId,
        fieldId,
        startTime: slot.startTime || slot.start,
        endTime: slot.endTime || slot.end,
        date,
      });
      return;
    }
    Toast.show({
      type: 'info',
      text1: state === 'past' ? 'Dhacay' : stateSo({ ...slot, state }),
      text2: state === 'past' ? 'Waqtigani wuu dhacay' : slot.reason || 'Lama dooran karo',
    });
  };

  const counts = useMemo(() => {
    const c = { available: 0, selected: 0, booked: 0, past: 0, weekly: 0 };
    slots.forEach((s) => {
      if (isRecurringSlot(s)) c.weekly += 1;
      else {
        const state = effectiveSlotState(s, clockMs);
        if (c[state] != null) c[state] += 1;
      }
    });
    return c;
  }, [slots, clockMs]);

  const stadiumName = stadiums.find((s) => String(s._id) === String(stadiumId))?.name;
  const fieldName = fields.find((f) => String(f._id) === String(fieldId))?.name;

  const legend = [
    { color: colors.slotAvailable, label: 'Banaan', n: counts.available },
    { color: '#D97706', label: 'Dooran', n: counts.selected },
    { color: colors.slotBooked, label: 'Kiraystay', n: counts.booked },
    { color: '#4F46E5', label: 'Joogto', n: counts.weekly },
    { color: colors.muted, label: 'Dhacay', n: counts.past },
  ];

  return (
    <FadeIn>
      <View style={styles.screen}>
        <StaffHero
          kicker="Slots"
          title={stadiumName || 'Garoon'}
          subtitle={fieldName ? `${fieldName} · taabo saacad` : 'Dooro field, kadib saacad'}
        >
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{counts.available}</Text>
              <Text style={styles.heroStatL}>Banaan</Text>
            </View>
            <View style={styles.heroStatDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{counts.booked}</Text>
              <Text style={styles.heroStatL}>Kiraystay</Text>
            </View>
            <View style={styles.heroStatDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{counts.past}</Text>
              <Text style={styles.heroStatL}>Dhacay</Text>
            </View>
          </View>
        </StaffHero>

        {loading ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={<RefreshControl refreshing={slotsLoading} onRefresh={loadSlots} />}
          >
            <Animated.View entering={FadeInDown.duration(360)} style={styles.sheet}>
              {stadiums.length > 1 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {stadiums.map((s) => {
                    const on = stadiumId === String(s._id);
                    return (
                      <Pressable
                        key={String(s._id)}
                        onPress={() => setStadiumId(String(s._id))}
                        style={[styles.pill, on && styles.pillOn]}
                      >
                        <Ionicons
                          name="business-outline"
                          size={14}
                          color={on ? '#fff' : colors.brandGreen}
                        />
                        <Text style={[styles.pillText, on && styles.pillTextOn]}>{s.name}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              <DateStrip dates={dates} selected={date} onSelect={setDate} />

              {fields.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.pillRow}
                >
                  {fields.map((f) => {
                    const on = fieldId === String(f._id);
                    const type = formatFieldType(f.type);
                    return (
                      <Pressable
                        key={String(f._id)}
                        onPress={() => setFieldId(String(f._id))}
                        style={[styles.pill, on && styles.pillOn]}
                      >
                        <Text style={[styles.pillText, on && styles.pillTextOn]}>
                          {f.name}
                          {type ? ` · ${type}` : ''}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <Text style={styles.muted}>Field ma jiro.</Text>
              )}

              <View style={styles.legend}>
                {legend.map((l) => (
                  <View key={l.label} style={styles.legendChip}>
                    <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                    <Text style={styles.legendText}>
                      {l.label} {l.n}
                    </Text>
                  </View>
                ))}
              </View>

              {slotsLoading && !slots.length ? (
                <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 24 }} />
              ) : !slots.length ? (
                <View style={styles.emptyBox}>
                  <Ionicons name="time-outline" size={28} color={colors.brandGreen} />
                  <Text style={styles.empty}>Slot ma jiro maalintaan.</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {slots.map((slot, idx) => {
                    const state = effectiveSlotState(slot, clockMs);
                    const weekly = isRecurringSlot(slot);
                    const wait =
                      state === 'selected' && slot.selectedUntil
                        ? Math.max(
                            0,
                            Math.ceil((new Date(slot.selectedUntil).getTime() - nowTick) / 1000)
                          )
                        : 0;
                    const muted = (state === 'past' || state === 'blocked') && !weekly;
                    return (
                      <Pressable
                        key={`${slot.startTime}-${idx}`}
                        onPress={() => onSlotPress(slot)}
                        style={({ pressed }) => [
                          styles.cell,
                          {
                            backgroundColor: slotBg(slot, colors, state),
                            opacity: muted ? 0.72 : pressed ? 0.9 : 1,
                          },
                        ]}
                      >
                        <Text style={[styles.cellTime, muted && { color: colors.text }]}>
                          {slotLabel(slot)}
                        </Text>
                        <Text
                          style={[styles.cellState, muted && { color: colors.muted }]}
                          numberOfLines={1}
                        >
                          {weekly
                            ? slot.teamName || 'Joogto'
                            : wait > 0
                              ? formatCountdown(wait)
                              : stateSo({ ...slot, state })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Animated.View>
          </ScrollView>
        )}
      </View>
    </FadeIn>
  );
}

function makeStyles(colors, shadows) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatN: { color: '#fff', fontSize: 20, fontWeight: '800' },
    heroStatL: { marginTop: 2, color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' },
    heroStatDiv: {
      width: 1,
      height: 28,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    body: { paddingBottom: 40 },
    sheet: {
      marginTop: -18,
      paddingHorizontal: spacing.md,
      paddingTop: 4,
    },
    pillRow: { gap: 8, paddingVertical: 12 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 9,
      ...shadows.soft,
    },
    pillOn: {
      backgroundColor: colors.brandGreen,
      borderColor: colors.brandGreen,
    },
    pillText: { fontSize: 13, fontWeight: '800', color: colors.text },
    pillTextOn: { color: '#fff' },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 14,
    },
    legendChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderWidth: 1,
      borderColor: colors.border,
    },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontWeight: '700', color: colors.text },
    muted: { ...typography.caption, color: colors.muted, marginTop: 8 },
    emptyBox: {
      alignItems: 'center',
      paddingVertical: 36,
      gap: 8,
    },
    empty: { color: colors.muted, fontWeight: '600' },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    cell: {
      width: '30%',
      flexGrow: 1,
      minWidth: 96,
      maxWidth: '32%',
      borderRadius: 16,
      paddingVertical: 16,
      paddingHorizontal: 8,
      alignItems: 'center',
      ...shadows.soft,
    },
    cellTime: {
      color: colors.white,
      fontWeight: '800',
      fontSize: 15,
    },
    cellState: {
      marginTop: 4,
      color: 'rgba(255,255,255,0.92)',
      fontSize: 11,
      fontWeight: '700',
    },
  });
}
