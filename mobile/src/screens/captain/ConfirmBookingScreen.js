import { useEffect, useRef, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import { useAuth } from '../../context/AuthContext';
import { bookingsApi } from '../../api/bookings';
import { teamsApi } from '../../api/teams';
import { formatSlotTime, formatMoney, isSlotStartPast } from '../../lib/dateUtils';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

/** Normalize to UTC ISO — keep slots API times exact (no local wall-clock rewrite). */
function toIso(value) {
  if (!value) return null;
  try {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
        const d = new Date(trimmed);
        if (Number.isNaN(d.getTime())) return null;
        return d.toISOString();
      }
    }
    const d = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

function holdErrorCopy(apiMsg, errData) {
  const msg = String(apiMsg || '');
  const code = errData?.error?.details?.code || errData?.error?.code;
  if (
    code === 'STADIUM_OFFLINE' ||
    /xidhan|stadium is (closed|offline)|STADIUM_OFFLINE/i.test(msg)
  ) {
    return {
      text1: 'Garoonku wuu xidhan yahay',
      text2:
        msg ||
        errData?.error?.details?.messageSo ||
        'Garoonku wuu xidhan yahay ee dooro stadium kale',
    };
  }
  if (
    code === 'FIELD_OFFLINE' ||
    /field.*(closed|offline)|FIELD_OFFLINE|field-kan/i.test(msg)
  ) {
    return {
      text1: 'Field-kan wuu xidhan yahay',
      text2:
        msg ||
        errData?.error?.details?.messageSo ||
        'Field-kan wuu xidhan yahay ee dooro field kale',
    };
  }
  if (code === 'SLOT_PAST' || /slot in the past|waqtigani wuu dhacay/i.test(msg)) {
    return {
      text1: 'Waqtigani wuu dhacay',
      text2: 'Dooro saacad mustaqbal ah',
    };
  }
  if (code === 'RECURRING_SLOT' || /weekly team|joogto|toddobaadle/i.test(msg)) {
    const so = errData?.error?.details?.messageSo;
    return {
      text1: 'Joogto — waa la qaatay',
      text2: so || msg || 'Waqtigani waxaa haysta koox toddobaadle ah',
    };
  }
  if (/already booked/i.test(msg)) {
    return {
      text1: 'Waqtigani waa la qaatay',
      text2: 'Dooro waqti kale — ballan la xaqiijiyay ayaa jira',
    };
  }
  if (/on hold|being booked|someone else|try again/i.test(msg)) {
    return {
      text1: 'Waqtigani waa la haystaa',
      text2: 'Kabtan kale ayaa haysta — isku day markale ama dooro waqti kale',
    };
  }
  if (/hold.?expir|payment window|released/i.test(msg)) {
    return {
      text1: 'Hold-kii wuu dhacay',
      text2: 'Dib u dooro slot-ka oo isku day',
    };
  }
  if (/session|dib u gal|expired token|invalid.*token|401/i.test(msg)) {
    return {
      text1: 'Fadlan dib u gal',
      text2: 'Session-kaagu wuu dhacay',
    };
  }
  // Keep toast short — never echo raw server dumps
  const short =
    msg && msg.length <= 120 && !/eyJ[A-Za-z0-9_-]+\./.test(msg)
      ? msg
      : 'Ballanka wuu fashilmay';
  return {
    text1: short,
    text2: 'Isku day markale ama dooro waqti kale',
  };
}

function idOf(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') return String(value._id || value.id || '');
  return String(value);
}

/**
 * Confirm slot → POST /bookings (hold) → BookingDetail + PaymentConfirmModal.
 * Never initiate payment from this screen — popup must confirm first.
 */
export default function ConfirmBookingScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { user } = useAuth();
  const params = route.params || {};
  const {
    stadiumId: stadiumIdParam,
    stadiumName,
    fieldId: fieldIdParam,
    fieldName,
    fieldType,
    date,
    startTime: startParam,
    endTime: endParam,
    pricing,
  } = params;

  const fieldId = idOf(fieldIdParam);
  const stadiumId = idOf(stadiumIdParam);
  const { sllPerUsd } = useAuthFeatures();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [teamId, setTeamId] = useState(null);
  const [teamLabel, setTeamLabel] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const teamShare = pricing?.payableTeamShare ?? pricing?.teamShare ?? pricing?.totalPrice ?? null;
  const total = pricing?.payableFullMatch ?? pricing?.totalPrice ?? null;
  const discount = pricing?.discountAmount || 0;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await teamsApi.listMine();
        const teams = data.teams || [];
        if (cancelled || !teams.length) return;
        const first = teams[0];
        setTeamId(idOf(first._id));
        setTeamLabel(first.name || null);
      } catch (e) {
        if (__DEV__) console.warn('[ConfirmBooking] teams list', e.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onPay = async () => {
    if (submittingRef.current) return;
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Geli magacaaga' });
      return;
    }
    if (!fieldId) {
      Toast.show({
        type: 'error',
        text1: 'Garoonka lama dooran',
        text2: 'Dib u dooro waqtiga',
      });
      return;
    }

    let startTime = toIso(startParam);
    let endTime = toIso(endParam);
    // Slots API always sends endTime; if missing, assume 1-hour slot from start.
    if (startTime && !endTime) {
      endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();
    }
    if (!startTime || !endTime) {
      Toast.show({
        type: 'error',
        text1: 'Waqtiga ma saxna',
        text2: 'Dib u dooro slot-ka',
      });
      return;
    }
    if (new Date(startTime).getTime() >= new Date(endTime).getTime()) {
      Toast.show({
        type: 'error',
        text1: 'Waqtiga ma saxna',
        text2: 'Bilowga iyo dhamaadka isku mid ma noqon karaan',
      });
      return;
    }
    if (isSlotStartPast(startTime)) {
      Toast.show({
        type: 'error',
        text1: 'Waqtigani wuu dhacay',
        text2: 'Dooro slot mustaqbal ah',
      });
      return;
    }

    const payload = {
      fieldId,
      ...(stadiumId ? { stadiumId } : {}),
      startTime,
      endTime,
      ...(teamId ? { teamId } : {}),
      teamName: (teamLabel || name).trim(),
    };

    if (__DEV__) {
      console.log('[ConfirmBooking] POST /bookings', payload);
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const data = await bookingsApi.create(payload);
      const booking = data.booking || data;
      if (!booking?._id) {
        throw new Error('Server-ka ma soo celin booking id');
      }
      Toast.show({
        type: 'success',
        text1: 'Ballanka waa la haystay',
        text2: 'Xaqiiji oo bixi lacagta',
      });
      navigation.replace('BookingDetail', {
        bookingId: booking._id,
        openPay: true,
        paySide: 'teamA',
        payFull: false,
        phone: phone.trim() || undefined,
        name: name.trim(),
      });
    } catch (e) {
      // 401: interceptor clears token, toasts once, AuthContext → Login
      if (e.status === 401 || e.isUnauthorized) {
        if (__DEV__) console.warn('[ConfirmBooking] hold failed: session expired');
        return;
      }
      const apiMsg = e.message || 'Codad ayaa dhacay';
      if (__DEV__) console.warn('[ConfirmBooking] hold failed', apiMsg);
      const needsTeam =
        /team/i.test(apiMsg) &&
        (/required|must|missing|create|join/i.test(apiMsg) || /koox/i.test(apiMsg));
      if (needsTeam) {
        Toast.show({
          type: 'error',
          text1: 'Koox ayaa lagaa rabaa',
          text2: 'Samee ama ku biir koox, ka dibna isku day',
        });
      } else {
        Toast.show({ type: 'error', ...holdErrorCopy(apiMsg, e.data) });
      }
    } finally {
      // Always re-enable — no silent retry loops after failure
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const styles = makeStyles(colors);

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title="Xaqiiji"
          subtitle="Faahfaahinta ballanka"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={styles.summaryLabel}>Garoon</Text>
            <Text style={styles.summaryValue}>{stadiumName}</Text>
            <Text style={styles.summaryLabel}>Cidan / Nooc</Text>
            <Text style={styles.summaryValue}>
              {[fieldName, fieldType].filter(Boolean).join(' · ') || '—'}
            </Text>
            <Text style={styles.summaryLabel}>Waqtiga</Text>
            <Text style={styles.summaryValue}>
              {date} · {formatSlotTime(startParam)} – {formatSlotTime(endParam)}
            </Text>
            {teamLabel ? (
              <>
                <Text style={styles.summaryLabel}>Kooxda</Text>
                <Text style={styles.summaryValue}>{teamLabel}</Text>
              </>
            ) : null}
            {teamShare != null ? (
              <>
                <Text style={styles.summaryLabel}>Qiimaha (kooxdaada)</Text>
                <Text style={styles.price}>
                  {formatMoney(teamShare)}{' '}
                  <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted }}>
                    ({Math.round(Number(teamShare) * (sllPerUsd || 8500)).toLocaleString()} SlSh)
                  </Text>
                </Text>
              </>
            ) : null}
            {discount > 0 ? (
              <Text style={styles.discount}>Dhimis: −{formatMoney(discount)}</Text>
            ) : null}
            {total != null && total !== teamShare ? (
              <Text style={styles.muted}>
                Wadarta ciyaarta: {formatMoney(total)} ({Math.round(Number(total) * (sllPerUsd || 8500)).toLocaleString()} SlSh)
              </Text>
            ) : null}
          </Card>

          <Card>
            <Text style={styles.formTitle}>Macluumaadka macaamiisha</Text>
            <TextField
              label="Magaca"
              value={name}
              onChangeText={setName}
              placeholder="Magacaaga"
              autoCapitalize="words"
            />
            <TextField
              label="Taleefanka (+252)"
              value={phone}
              onChangeText={setPhone}
              placeholder="061XXXXXXX"
              keyboardType="phone-pad"
            />
          </Card>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Button
            title={`BIXI LACAGTA · ${formatMoney(teamShare)} (${Math.round(Number(teamShare) * (sllPerUsd || 8500)).toLocaleString()} SlSh)`}
            variant="white"
            onPress={onPay}
            loading={submitting}
          />
        </View>
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.md, paddingBottom: 24 },
    summaryLabel: {
      marginTop: 10,
      ...typography.caption,
      color: colors.muted,
      fontWeight: '600',
    },
    summaryValue: {
      marginTop: 2,
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    price: {
      marginTop: 4,
      fontSize: 22,
      fontWeight: '800',
      color: colors.primary,
    },
    discount: {
      marginTop: 6,
      color: colors.brandBlue,
      fontWeight: '600',
    },
    muted: { marginTop: 6, color: colors.muted },
    formTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    footer: {
      backgroundColor: colors.brandNavy,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
  });
}
