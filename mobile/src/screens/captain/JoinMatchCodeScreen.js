import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  Linking,
  Share,
  Animated,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import OrangeHeader from '../../components/OrangeHeader';
import Card from '../../components/Card';
import Button from '../../components/Button';
import FadeIn from '../../components/FadeIn';
import { bookingsApi } from '../../api/bookings';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radii } from '../../theme';
import {
  SO_CARRIERS,
  composedPhone,
  formatPhoneDisplay,
  formatSharePhone,
  digitsOnly,
  normalizeSomaliPhone,
  splitSomaliPhone,
} from '../../lib/somaliPhone';
import {
  joinMatchErrorMessage,
  matchPaymentProgress,
} from '../../lib/matchJoinErrors';
import {
  buildMatchSharePackage,
  resolveTeamAShareName,
  whatsAppShareUrl,
} from '../../lib/matchShare';

/**
 * Team B: Match Code + Team A payer phone → preview → join → pay (anti-scam).
 */
function normalizeMatchCodeInput(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

const JOIN_STEPS = [
  { key: 'code', label: 'Code', icon: 'key-outline' },
  { key: 'confirm', label: 'Xaqiiji', icon: 'checkmark-circle-outline' },
  { key: 'pay', label: 'Bixi', icon: 'card-outline' },
  { key: 'done', label: 'Dhammee', icon: 'flag-outline' },
];

function JoinSteps({ active, colors, styles }) {
  const idx = Math.max(0, JOIN_STEPS.findIndex((s) => s.key === active));
  return (
    <View style={styles.stepsRow}>
      {JOIN_STEPS.map((step, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <View key={step.key} style={styles.stepItem}>
            <View
              style={[
                styles.stepDot,
                done && { backgroundColor: colors.brandGreen },
                current && {
                  backgroundColor: `${colors.brandGreen}22`,
                  borderColor: colors.brandGreen,
                  borderWidth: 2,
                },
              ]}
            >
              <Ionicons
                name={step.icon}
                size={14}
                color={done ? '#fff' : current ? colors.brandGreen : colors.textMuted}
              />
            </View>
            <Text
              style={[
                styles.stepLabel,
                current && { color: colors.brandGreen, fontWeight: '800' },
              ]}
            >
              {step.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function PaymentProgressBar({ progress, colors, styles }) {
  const percent = Math.min(100, Math.max(0, Number(progress?.percent || 0)));
  const paid = Number(progress?.paidAmount || 0);
  const total = Number(progress?.totalPrice || 0);
  const remaining = Number(progress?.remainingAmount ?? Math.max(0, total - paid));
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: percent,
      useNativeDriver: false,
      friction: 8,
    }).start();
  }, [percent, widthAnim]);

  const barWidth = widthAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHeader}>
        <View>
          <Text style={styles.progressCaption}>Lacagta la bixiyay</Text>
          <Text style={styles.progressPct}>{percent}%</Text>
        </View>
        <Text style={styles.progressMoney}>
          ${paid.toFixed(2)} / ${total.toFixed(2)}
          {remaining > 0 ? `\nHadhay: $${remaining.toFixed(2)}` : ''}
        </Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.progressFill,
            { width: barWidth, backgroundColor: colors.brandGreen },
          ]}
        />
      </View>
      <View style={styles.progressSides}>
        <Text style={styles.progressSide}>Team A {progress?.teamAPaid ? '✓' : '…'}</Text>
        <Text style={styles.progressSide}>Team B {progress?.teamBPaid ? '✓' : '…'}</Text>
      </View>
    </View>
  );
}

export default function JoinMatchCodeScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const insets = useSafeAreaInsets();
  const shakeX = useRef(new Animated.Value(0)).current;
  const [code, setCode] = useState(normalizeMatchCodeInput(route?.params?.prefill || route?.params?.code));
  const [carrierId, setCarrierId] = useState('hormuud');
  const [localNumber, setLocalNumber] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [fieldError, setFieldError] = useState('');

  useEffect(() => {
    const qPhone = route?.params?.teamAPhone;
    if (qPhone) {
      const split = splitSomaliPhone(qPhone);
      if (split.carrierId) setCarrierId(split.carrierId);
      if (split.localNumber) setLocalNumber(split.localNumber);
    }
    const qCode = route?.params?.code || route?.params?.prefill;
    if (qCode) setCode(normalizeMatchCodeInput(qCode));
  }, [route?.params?.code, route?.params?.prefill, route?.params?.teamAPhone]);

  const normalize = normalizeMatchCodeInput;
  const carrier = SO_CARRIERS.find((c) => c.id === carrierId) || SO_CARRIERS[0];

  const shake = () => {
    shakeX.setValue(0);
    Animated.sequence([
      Animated.timing(shakeX, { toValue: 8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -8, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: -6, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeX, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  const showError = (msg) => {
    setFieldError(msg);
    shake();
    Toast.show({ type: 'error', text1: msg });
  };

  const lookup = async () => {
    const c = normalize(code);
    const teamAPhone = composedPhone(carrierId, localNumber);
    setFieldError('');
    if (!/^SG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) {
      showError('Format: SG-XXXX-XXXX');
      return;
    }
    if (!teamAPhone) {
      showError('Geli telefoonka Team A');
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const data = await bookingsApi.lookupMatchCode(c, teamAPhone, carrierId);
      setPreview(data);
      setFieldError('');
    } catch (err) {
      showError(joinMatchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const join = async () => {
    if (!preview?.booking) return;
    const teamAPhone = composedPhone(carrierId, localNumber);
    setJoining(true);
    try {
      const data = await bookingsApi.joinByCode({
        matchCode: preview.booking.matchCode,
        teamAPhone,
        carrierId,
        teamACarrier: carrierId,
      });
      Toast.show({ type: 'success', text1: 'Waad ku biirtay — bixi qaybtaada' });
      const id = data.booking?._id || preview.booking.id;
      navigation.replace('BookingDetail', {
        bookingId: id,
        openPay: true,
        paySide: 'teamB',
        payFull: false,
      });
    } catch (err) {
      showError(joinMatchErrorMessage(err, 'Ku biirid ma suurtogelin'));
    } finally {
      setJoining(false);
    }
  };

  const b = preview?.booking;
  const progress = b ? matchPaymentProgress(preview) : null;

  return (
    <FadeIn style={styles.screen}>
      <OrangeHeader title="Dhammee lacagta" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <JoinSteps active={b ? 'confirm' : 'code'} colors={colors} styles={styles} />

        <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
          <Card>
            <Text style={styles.hint}>
              Geli Match Code + telefoonka Team A (lacagta lagu bixiyay). Tusaale Telesom 063… ama +25263…. Code kaliya kuma filna.
            </Text>

            <View style={styles.fieldLabelRow}>
              <Ionicons name="key-outline" size={16} color={colors.brandOrange || '#E85D04'} />
              <Text style={styles.fieldLabel}>Match Code</Text>
            </View>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={(t) => {
                setCode(normalize(t));
                setFieldError('');
              }}
              placeholder="SG-XXXX-XXXX"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <View style={[styles.fieldLabelRow, { marginTop: 12 }]}>
              <Ionicons name="call-outline" size={16} color={colors.brandOrange || '#E85D04'} />
              <Text style={styles.fieldLabel}>
                Telefoonka Team A · {carrier.label} ({carrier.prefix})
              </Text>
            </View>
            <View style={styles.carrierRow}>
              {SO_CARRIERS.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setCarrierId(c.id)}
                  style={[
                    styles.carrierChip,
                    carrierId === c.id && {
                      backgroundColor: colors.brandOrange || '#E85D04',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.carrierChipText,
                      carrierId === c.id && { color: '#fff' },
                    ]}
                  >
                    {c.prefix}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={styles.input}
              value={localNumber}
              onChangeText={(t) => {
                const raw = digitsOnly(t);
                if (raw.length >= 9) {
                  const full = normalizeSomaliPhone(raw);
                  if (full) {
                    const split = splitSomaliPhone(full);
                    setCarrierId(split.carrierId);
                    setLocalNumber(split.localNumber);
                    setFieldError('');
                    return;
                  }
                }
                setLocalNumber(raw.slice(0, 12));
                setFieldError('');
              }}
              placeholder="XXX XXX · ama 063… / +252…"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
            {composedPhone(carrierId, localNumber) ? (
              <Text style={[styles.meta, { marginTop: 6, color: colors.brandGreen || '#15803d' }]}>
                La xaqiijinayaa: {formatPhoneDisplay(composedPhone(carrierId, localNumber))}
              </Text>
            ) : null}
            <Text style={[styles.meta, { marginTop: 4 }]}>
              Tusaale {carrier.label}: {carrier.prefix}… ama +252{carrier.prefix.slice(1)}…
            </Text>

            {fieldError ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={16} color="#B91C1C" />
                <Text style={styles.errorText}>{fieldError}</Text>
              </View>
            ) : null}

            <Button
              title="Raadi Match Code"
              onPress={lookup}
              loading={loading}
              style={{ marginTop: 12 }}
            />
          </Card>
        </Animated.View>

        {b ? (
          <Card style={{ marginTop: 12 }}>
            {progress ? (
              <PaymentProgressBar progress={progress} colors={colors} styles={styles} />
            ) : null}
            <Text style={styles.title}>
              {b.stadium?.name} · {b.field?.name}
            </Text>
            <Text style={styles.meta}>{new Date(b.startTime).toLocaleString()}</Text>
            <Text style={styles.meta}>
              Team A: {b.teamA?.team?.name || '—'} ·{' '}
              {progress?.teamAPaid ? 'waa bixiyay ✓' : b.teamA?.paymentStatus}
            </Text>
            <Text style={styles.due}>
              Team B due: ${Number(b.teamBAmountDue || 0).toFixed(2)}
            </Text>
            {preview.window?.phase ? (
              <Text style={styles.meta}>
                {preview.window.phase} · {preview.window.secondsRemaining}s
              </Text>
            ) : null}
            <Button
              title={b.teamBJoined ? 'Fur — bixi' : 'Ku biir oo bixi'}
              onPress={
                b.teamBJoined
                  ? () =>
                      navigation.replace('BookingDetail', {
                        bookingId: b.id,
                        openPay: true,
                        paySide: 'teamB',
                        payFull: false,
                      })
                  : join
              }
              loading={joining}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : null}
      </ScrollView>
      <View style={{ height: Math.max(insets.bottom, 8) }} />
    </FadeIn>
  );
}

/** Compact Match Code display for Team A after split pay. */
export function MatchCodeCard({ booking, colors, onUpdated }) {
  const [inviteLocal, setInviteLocal] = useState('');
  const [inviteCarrier, setInviteCarrier] = useState('hormuud');
  const [locking, setLocking] = useState(false);
  const code = booking?.matchCode;
  if (!code || booking?.coveredFullMatch) return null;
  if (!['PAYMENT_PENDING', 'HELD'].includes(booking?.status)) return null;

  const sharePhone =
    formatSharePhone(booking?.teamAPayerPhone) ||
    (booking?.teamAPayerPhoneE164 || booking?.teamAPayerPhoneLocal
      ? {
          e164: booking.teamAPayerPhoneE164,
          local0: booking.teamAPayerPhoneLocal,
          display: booking.teamAPayerPhoneDisplay,
        }
      : null);

  const teamAPhoneDisplay =
    sharePhone?.display ||
    booking?.teamAPayerPhoneDisplay ||
    (booking?.teamAPayerPhone ? formatPhoneDisplay(booking.teamAPayerPhone) : null);

  const sharePkg = buildMatchSharePackage({
    code,
    teamAPhone:
      sharePhone?.e164 ||
      booking?.teamAPayerPhoneE164 ||
      booking?.teamAPayerPhone,
    teamAName: resolveTeamAShareName(booking),
  });
  const shareText = sharePkg?.text || code;

  const copyCode = async () => {
    try {
      await Share.share({ message: sharePkg?.code || code });
    } catch {
      Toast.show({ type: 'info', text1: code });
    }
  };

  const copyShare = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      Toast.show({ type: 'info', text1: code });
    }
  };

  const shareWhatsApp = async () => {
    const url = whatsAppShareUrl(shareText);
    try {
      await Linking.openURL(url);
    } catch {
      await copyShare();
    }
  };

  const lockInvite = async () => {
    const phone = composedPhone(inviteCarrier, inviteLocal);
    if (!phone) {
      Toast.show({ type: 'error', text1: 'Geli telefoon sax ah' });
      return;
    }
    setLocking(true);
    try {
      await bookingsApi.lockInvitePhone(booking._id, { invitePhone: phone });
      Toast.show({ type: 'success', text1: 'Telefoonka Team B waa la xidhay' });
      onUpdated?.();
    } catch {
      Toast.show({
        type: 'error',
        text1: 'Xidhitaanka wuu fashilmay',
      });
    } finally {
      setLocking(false);
    }
  };

  return (
    <Card
      style={{
        padding: 0,
        overflow: 'hidden',
        borderColor: 'rgba(16, 185, 129, 0.35)',
      }}
    >
      <View
        style={{
          backgroundColor: colors.brandGreen,
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.8)',
          }}
        >
          E-Garoon · Match Code
        </Text>
        <Text style={{ color: '#fff', fontSize: 14, lineHeight: 20, marginTop: 4 }}>
          Waad bixisay lacagta teamkaaga. Waxaan sugaynaa Team B…
        </Text>
      </View>

      <View style={{ padding: 16 }}>
        {sharePkg?.teamAName ? (
          <Text style={{ color: colors.muted, fontSize: 13, marginBottom: 8 }}>
            Kooxda:{' '}
            <Text style={{ color: colors.text, fontWeight: '700' }}>{sharePkg.teamAName}</Text>
          </Text>
        ) : null}

        <Pressable
          onPress={copyCode}
          style={{
            backgroundColor: colors.brandNavy,
            borderRadius: radii.xl,
            borderWidth: 2,
            borderColor: 'rgba(16, 185, 129, 0.45)',
            paddingVertical: 16,
            paddingHorizontal: 14,
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: colors.brandBlue,
              marginBottom: 4,
            }}
          >
            Match Code · riix copy
          </Text>
          <Text
            style={{
              fontFamily: 'monospace',
              fontSize: 24,
              fontWeight: '800',
              letterSpacing: 3,
              color: colors.brandGreen,
            }}
          >
            {code}
          </Text>
        </Pressable>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
          <Pressable onPress={copyShare}>
            <Text style={{ color: colors.brandGreen, fontWeight: '700' }}>Copy tilmaamaha</Text>
          </Pressable>
          <Pressable onPress={shareWhatsApp}>
            <Text style={{ color: '#25D366', fontWeight: '700' }}>WhatsApp</Text>
          </Pressable>
        </View>

        <View
          style={{
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: 'rgba(16, 185, 129, 0.2)',
            backgroundColor: colors.surfaceInset || colors.surface,
            padding: 12,
            marginBottom: 10,
          }}
        >
          <Text
            style={{
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.8,
              textTransform: 'uppercase',
              color: colors.brandGreen,
              marginBottom: 8,
            }}
          >
            Tallaabooyinka Team B
          </Text>
          {(sharePkg?.steps || []).map((step, i) => (
            <View
              key={step}
              style={{ flexDirection: 'row', gap: 8, marginBottom: 6, alignItems: 'flex-start' }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '800', color: colors.brandGreen }}>
                  {i + 1}
                </Text>
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 }}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        {teamAPhoneDisplay || sharePhone?.e164 ? (
          <Text style={{ marginTop: 4, fontSize: 12, color: colors.muted || colors.textMuted }}>
            Telefoonka lacag-bixiyaha:{' '}
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {sharePhone?.e164 || teamAPhoneDisplay}
              {sharePhone?.local0 ? ` · ${sharePhone.local0}` : ''}
            </Text>
          </Text>
        ) : null}
        <Text style={{ marginTop: 6, fontSize: 12, color: colors.muted || colors.textMuted }}>
          Code kaliya kuma filna — Match Code + telefoonka Team A. Ha dirin OTP/password.
        </Text>

        {!booking.teamB && (
          <View style={{ marginTop: 12 }}>
            {booking.invitePhoneLocked || booking.invitePhone ? (
              <Text style={{ fontSize: 12, color: colors.brandGreen }}>
                Invite locked:{' '}
                {booking.invitePhoneDisplay || formatPhoneDisplay(booking.invitePhone) || 'yes'}
              </Text>
            ) : (
              <>
                <Text
                  style={{
                    fontSize: 12,
                    color: colors.muted || colors.textMuted,
                    marginBottom: 6,
                  }}
                >
                  Ikhtiyaari: xidhi telefoonka Team B
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {SO_CARRIERS.map((c) => (
                    <Pressable key={c.id} onPress={() => setInviteCarrier(c.id)}>
                      <Text
                        style={{
                          fontWeight: '700',
                          color:
                            inviteCarrier === c.id
                              ? colors.brandGreen
                              : colors.muted || colors.textMuted,
                        }}
                      >
                        {c.prefix}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  value={inviteLocal}
                  onChangeText={(t) => setInviteLocal(digitsOnly(t).slice(0, 7))}
                  placeholder="XXX XXX"
                  placeholderTextColor={colors.muted || colors.textMuted}
                  keyboardType="phone-pad"
                  style={{
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 8,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    color: colors.text,
                    marginBottom: 8,
                  }}
                />
                <Button title="Xidh telefoon" onPress={lockInvite} loading={locking} />
              </>
            )}
          </View>
        )}

        {(booking.teamBPaymentDueAt || booking.holdExpiresAt) && (
          <Text style={{ marginTop: 8, fontSize: 12, color: colors.muted || colors.textMuted }}>
            Window: {new Date(booking.teamBPaymentDueAt || booking.holdExpiresAt).toLocaleString()}
            {booking.opponentWindow?.phase ? ` · ${booking.opponentWindow.phase}` : ''}
          </Text>
        )}
      </View>
    </Card>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.md, paddingBottom: 24 },
    hint: { ...typography.body, color: colors.text, fontSize: 14, lineHeight: 22, marginBottom: 12 },
    fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
    fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: 2,
      color: colors.text,
      backgroundColor: colors.card,
      marginTop: 4,
    },
    carrierRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    carrierChip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    carrierChipText: { fontWeight: '700', color: colors.text, fontSize: 13 },
    errorBox: {
      marginTop: 10,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: '#FEE2E2',
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    errorText: { flex: 1, color: '#B91C1C', fontSize: 13, fontWeight: '600' },
    title: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 8 },
    meta: { marginTop: 6, fontSize: 13, color: colors.textMuted },
    due: { marginTop: 10, fontSize: 18, fontWeight: '800', color: colors.text },
    stepsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 14,
      paddingHorizontal: 4,
    },
    stepItem: { alignItems: 'center', flex: 1 },
    stepDot: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 4,
    },
    stepLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
    progressWrap: { marginBottom: 12 },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 8,
    },
    progressCaption: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
    progressPct: { fontSize: 28, fontWeight: '800', color: colors.text },
    progressMoney: {
      fontSize: 12,
      color: colors.textMuted,
      textAlign: 'right',
      lineHeight: 18,
    },
    progressTrack: { height: 10, borderRadius: 999, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 999 },
    progressSides: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 6,
    },
    progressSide: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  });
}
