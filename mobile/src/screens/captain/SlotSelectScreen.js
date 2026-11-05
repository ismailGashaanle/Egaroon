import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import NavyFooter from '../../components/NavyFooter';
import { stadiumsApi } from '../../api/stadiums';
import {
  buildDateStrip,
  formatSlotTime,
  formatMoney,
  venueNowMs,
  effectiveSlotState,
  toIsoDate,
} from '../../lib/dateUtils';
import DateStrip from '../../components/DateStrip';
import { useTheme } from '../../context/ThemeContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import { weatherApi } from '../../api/weather';
import WeatherBanner from '../../components/WeatherBanner';
import { radii, spacing, typography } from '../../theme';
import {
  sortStadiumFields,
  formatFieldType,
  estimateTeamShare,
  formatUsd,
  hoursLabel,
  capacityForType,
} from '../../lib/fieldFormats';

function isRecurringSlot(slot) {
  if (!slot) return false;
  if (slot.labelHint === 'RECURRING' || slot.isRecurring) return true;
  return String(slot.reason || '').startsWith('RECURRING');
}

function recurringLabel(slot) {
  if (slot?.labelSo) return slot.labelSo;
  if (slot?.teamName) return `Joogto · ${slot.teamName}`;
  const reason = String(slot?.reason || '');
  if (reason.startsWith('RECURRING:')) {
    const name = reason.slice('RECURRING:'.length).trim();
    if (name && name !== 'permanent') return `Joogto · ${name}`;
  }
  return 'Joogto';
}

function slotBg(slot, isPicked, colors, state) {
  if (isPicked) return colors.accent;
  if (state === 'available') return colors.slotAvailable;
  if (isRecurringSlot(slot)) return '#4F46E5';
  if (state === 'booked' || state === 'blocked') return colors.slotBooked;
  if (state === 'selected') return '#0284C7';
  return colors.surfaceInset;
}

function canPick(slot, state) {
  if (!slot || isRecurringSlot(slot)) return false;
  return state === 'available';
}

export default function SlotSelectScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { weatherEnabled } = useAuthFeatures();
  const {
    stadiumId,
    stadiumName,
    date: initialDate,
    startingPrice,
    fieldId: initialFieldId,
    fieldName: initialFieldName,
  } = route.params || {};
  const [date, setDate] = useState(initialDate || toIsoDate());
  const legend = [
    { key: 'available', label: 'Banaan', color: colors.slotAvailable },
    { key: 'booked', label: 'Booked', color: colors.slotBooked },
    { key: 'selected', label: 'Dooran', color: '#0284C7' },
    { key: 'weekly', label: 'Joogto', color: '#4F46E5' },
  ];
  const styles = makeStyles(colors);
  const [fields, setFields] = useState([]);
  const [fieldId, setFieldId] = useState(initialFieldId || null);
  const [slots, setSlots] = useState([]);
  const [picked, setPicked] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ops, setOps] = useState(null);
  const [weather, setWeather] = useState(null);
  const [clockMs, setClockMs] = useState(() => venueNowMs());
  const dates = useMemo(() => buildDateStrip(toIsoDate(), 13), []);

  const activeField = fields.find((f) => String(f._id) === String(fieldId));
  const stadiumOffline = ops && ops.bookable === false;
  const fieldOffline = activeField?.ops && activeField.ops.bookable === false;
  const bookingBlocked = stadiumOffline || fieldOffline;
  const offlineMsg = stadiumOffline
    ? ops?.messageSo || 'Garoonku wuu xidhan yahay ee dooro stadium kale'
    : fieldOffline
      ? activeField?.ops?.messageSo || 'Field-kan wuu xidhan yahay ee dooro field kale'
      : null;

  const loadFields = useCallback(async () => {
    try {
      const [fieldsData, stadiumData] = await Promise.all([
        stadiumsApi.listFields(stadiumId),
        stadiumsApi.get(stadiumId).catch(() => null),
      ]);
      const list = sortStadiumFields(fieldsData.fields || []);
      setFields(list);
      setFieldId((prev) => {
        if (prev && list.some((f) => String(f._id) === String(prev))) return prev;
        if (initialFieldId && list.some((f) => String(f._id) === String(initialFieldId))) {
          return initialFieldId;
        }
        return initialFieldId || null;
      });
      const st = stadiumData?.stadium || stadiumData;
      if (st?.ops) setOps(st.ops);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Garoonka lama furin', text2: e.message });
    }
  }, [stadiumId, initialFieldId]);

  const loadSlots = useCallback(async () => {
    if (!fieldId || !date) return;
    setLoading(true);
    setPicked(null);
    try {
      const data = await stadiumsApi.listSlots(fieldId, date);
      setSlots(data.slots || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Waqtiyada lama soo qaadin', text2: e.message });
      setSlots([]);
    } finally {
      setLoading(false);
    }
  }, [fieldId, date]);

  useEffect(() => {
    loadFields();
  }, [loadFields]);

  useEffect(() => {
    loadSlots();
  }, [loadSlots]);

  useEffect(() => {
    if (!weatherEnabled || !stadiumId || !date) {
      setWeather(null);
      return undefined;
    }
    let cancelled = false;
    weatherApi
      .lookup({ stadiumId, date })
      .then((data) => {
        if (!cancelled) setWeather(data.weather || data);
      })
      .catch(() => {
        if (!cancelled) setWeather(null);
      });
    return () => {
      cancelled = true;
    };
  }, [weatherEnabled, stadiumId, date]);

  useEffect(() => {
    const id = setInterval(() => setClockMs(venueNowMs()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (picked && !canPick(picked, effectiveSlotState(picked, clockMs))) {
      setPicked(null);
    }
  }, [clockMs, picked]);

  const visibleSlots = useMemo(
    () => slots.filter((s) => effectiveSlotState(s, clockMs) !== 'past'),
    [slots, clockMs]
  );

  const amount =
    picked?.pricing?.teamShare ??
    picked?.pricing?.totalPrice ??
    startingPrice ??
    null;

  const continueNext = () => {
    if (!picked || !activeField) return;
    if (!canPick(picked, effectiveSlotState(picked, venueNowMs()))) {
      Toast.show({
        type: 'error',
        text1: 'Waqtigani wuu dhacay',
        text2: 'Dooro saacad mustaqbal ah',
      });
      setPicked(null);
      return;
    }
    if (stadiumOffline) {
      Toast.show({
        type: 'error',
        text1: 'Garoonku wuu xidhan yahay',
        text2: offlineMsg,
      });
      return;
    }
    if (fieldOffline) {
      Toast.show({
        type: 'error',
        text1: 'Field-kan wuu xidhan yahay',
        text2: offlineMsg,
      });
      return;
    }
    const resolvedStadiumId = String(
      activeField.stadium?._id || activeField.stadium || stadiumId || ''
    );
    navigation.navigate('ConfirmBooking', {
      stadiumId: resolvedStadiumId,
      stadiumName,
      fieldId: String(activeField._id),
      fieldName: activeField.name,
      fieldType: activeField.type,
      date,
      // Pass exact ISO from slots API (normalized) — server hold overlap uses these.
      startTime: picked.startTime
        ? new Date(picked.startTime).toISOString()
        : picked.startTime,
      endTime: picked.endTime
        ? new Date(picked.endTime).toISOString()
        : picked.startTime
          ? new Date(new Date(picked.startTime).getTime() + 60 * 60 * 1000).toISOString()
          : picked.endTime,
      pricing: picked.pricing || null,
    });
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title={activeField?.name || initialFieldName || stadiumName || 'Garoon'}
          subtitle={stadiumName ? `${stadiumName} · dooro waqtiga` : 'Dooro waqtiga'}
          onBack={() => navigation.goBack()}
        />

        <ScrollView contentContainerStyle={styles.body}>
          {bookingBlocked ? (
            <View style={styles.offlineBanner}>
              <Text style={styles.offlineTitle}>
                {stadiumOffline ? 'STADIUM OFFLINE · xidhan' : 'FIELD OFFLINE · xidhan'}
              </Text>
              <Text style={styles.offlineBody}>{offlineMsg}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionLabel}>Dooro maalinta</Text>
          <DateStrip dates={dates} selected={date} onSelect={setDate} />
          {weather ? <WeatherBanner weather={weather} /> : null}

          {activeField ? (
            <View style={styles.fieldInfo}>
              <Text style={styles.fieldInfoTitle}>
                {[activeField.name, formatFieldType(activeField.type)].filter(Boolean).join(' · ')}
              </Text>
              <Text style={styles.fieldInfoMeta}>
                {[
                  capacityForType(activeField.type)
                    ? `${capacityForType(activeField.type)} vs ${capacityForType(activeField.type)}`
                    : null,
                  estimateTeamShare(activeField) != null
                    ? `${formatUsd(estimateTeamShare(activeField))} /koox`
                    : null,
                  hoursLabel(activeField.openingTime, activeField.closingTime),
                ]
                  .filter(Boolean)
                  .join('  ·  ')}
              </Text>
            </View>
          ) : null}

          <View style={styles.legend}>
            {legend.map((l) => (
              <View key={l.key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: l.color }]} />
                <Text style={styles.legendText}>{l.label}</Text>
              </View>
            ))}
          </View>

          {loading ? (
            <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 32 }} />
          ) : (
            <View style={styles.grid}>
              {visibleSlots.map((slot) => {
                const state = effectiveSlotState(slot, clockMs);
                const isPicked = picked?.startTime === slot.startTime;
                const pickable = canPick(slot, state);
                const weekly = isRecurringSlot(slot);
                return (
                  <Pressable
                    key={slot.startTime}
                    disabled={!pickable}
                    onPress={() => setPicked(slot)}
                    style={[
                      styles.slot,
                      {
                        backgroundColor: slotBg(slot, isPicked, colors, state),
                        opacity: pickable || isPicked || weekly ? 1 : 0.55,
                      },
                    ]}
                  >
                    <Text style={styles.slotTime}>
                      {formatSlotTime(slot.startTime, slot.startLabel)}
                    </Text>
                    {weekly ? (
                      <Text style={styles.slotPrice} numberOfLines={1}>
                        {recurringLabel(slot)}
                      </Text>
                    ) : slot.pricing?.teamShare != null ? (
                      <Text style={styles.slotPrice}>
                        {formatMoney(slot.pricing.teamShare)}
                      </Text>
                    ) : slot.state === 'blocked' ? (
                      <Text style={styles.slotPrice}>Xiran</Text>
                    ) : null}
                  </Pressable>
                );
              })}
              {!visibleSlots.length ? (
                <Text style={styles.empty}>Waqti banaan ma jiro maalintaan.</Text>
              ) : null}
            </View>
          )}
        </ScrollView>

        <NavyFooter
          leftLabel="Waqtiga"
          leftValue={picked ? formatSlotTime(picked.startTime, picked.startLabel) : 'Dooro'}
          amountLabel="Amount USD"
          amount={amount != null ? formatMoney(amount) : '—'}
          ctaTitle={bookingBlocked ? 'XIDHAN' : 'HORE U SOCO'}
          disabled={!picked || bookingBlocked}
          onPress={continueNext}
        />
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.md, paddingBottom: 24 },
    offlineBanner: {
      backgroundColor: '#FEE2E2',
      borderRadius: radii.md,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#FECACA',
    },
    offlineTitle: {
      fontWeight: '800',
      fontSize: 13,
      color: '#B91C1C',
      marginBottom: 4,
    },
    offlineBody: {
      ...typography.caption,
      color: '#991B1B',
      lineHeight: 18,
      fontWeight: '600',
    },
    dateRow: { gap: 8, marginBottom: 12 },
    sectionLabel: {
      marginTop: 4,
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    fieldInfo: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
    },
    fieldInfoTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
    },
    fieldInfoMeta: {
      marginTop: 4,
      ...typography.caption,
      color: colors.muted,
      fontWeight: '600',
    },
    legend: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
      marginBottom: 16,
      paddingVertical: 8,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 12, height: 12, borderRadius: 3 },
    legendText: { ...typography.caption, fontWeight: '600', color: colors.text },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    slot: {
      width: '30%',
      flexGrow: 1,
      minWidth: 96,
      maxWidth: '32%',
      borderRadius: radii.md,
      paddingVertical: 14,
      paddingHorizontal: 8,
      alignItems: 'center',
    },
    slotTime: {
      color: colors.white,
      fontWeight: '800',
      fontSize: 14,
    },
    slotPrice: {
      marginTop: 4,
      color: 'rgba(255,255,255,0.9)',
      fontSize: 11,
      fontWeight: '600',
    },
    empty: {
      width: '100%',
      textAlign: 'center',
      color: colors.muted,
      marginTop: 24,
    },
  });
}
