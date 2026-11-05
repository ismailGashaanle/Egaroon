import { View, Text, StyleSheet, Pressable } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import { useTheme } from '../context/ThemeContext';
import { formatMoney, formatWhen } from '../lib/gateScan';
import { formatSlotSo } from '../lib/ownerDisplay';
import { radii, spacing, typography } from '../theme';

function Row({ label, value, styles }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{String(value)}</Text>
    </View>
  );
}

/**
 * Owner/manager booking faafaahin card — captain, payment, QR, gate status.
 * Accepts API `detailCard` or a merged booking + card object.
 */
export default function OwnerBookingFaahfaahinCard({
  card,
  booking,
  onPress,
  showQr = true,
  compact = false,
}) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const c = card || {};
  const b = booking || {};
  const captainName =
    c.captainName || b.teamA?.captain?.name || b.teamA?.team?.name || '—';
  const captainPhone = c.captainPhone || b.teamA?.captain?.phone || '—';
  const code = c.bookingCode || b.bookingCode || c.qrCode || '—';
  const paymentLabel =
    c.paymentMethodLabel ||
    (c.walkIn && c.paymentMethod === 'cash'
      ? 'Walk-in / Cash'
      : c.paymentMethod) ||
    '—';
  const carrierLabel = c.carrier?.label || null;
  const isSll = (c.currency || b.pricing?.currency) === 'SLL';
  const amount =
    c.amountPaid != null
      ? isSll
        ? `${Number(c.amountSll || c.amountPaid).toLocaleString()} SlSh${c.amountUsd ? ` ($${Number(c.amountUsd).toFixed(2)})` : ''}`
        : formatMoney(c.amountPaid, c.currency || b.pricing?.currency)
      : b.pricing?.totalPrice != null
        ? formatMoney(b.pricing.totalPrice, b.pricing.currency)
        : '—';
  const qrValue = c.qrPayload || code;
  const lockSo = c.lockMessageSo || c.messageSo;

  const body = (
    <Card style={compact ? styles.compactCard : undefined}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.status}>{c.status || b.status || '—'}</Text>
        </View>
        {c.walkIn ? (
          <View style={styles.pill}>
            <Text style={styles.pillText}>Walk-in</Text>
          </View>
        ) : null}
        {onPress ? (
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        ) : null}
      </View>

      <Row label="Captain" value={captainName} styles={styles} />
      <Row label="Telefoon" value={captainPhone} styles={styles} />
      {carrierLabel ? (
        <Row label="Carrier" value={carrierLabel} styles={styles} />
      ) : null}
      <Row
        label="Markii la booking-gareeyay"
        value={formatWhen(c.bookedAt || b.createdAt)}
        styles={styles}
      />
      <Row
        label="Wakhtiga ciyaarta"
        value={formatSlotSo(c.startTime || b.startTime, c.endTime || b.endTime)}
        styles={styles}
      />
      <Row
        label="Nooca lacagta"
        value={
          carrierLabel && paymentLabel && paymentLabel !== '—'
            ? `${paymentLabel} · ${carrierLabel}`
            : paymentLabel
        }
        styles={styles}
      />
      <Row label="Markii la bixiyay" value={formatWhen(c.paidAt)} styles={styles} />
      <Row label="Lacagta" value={amount} styles={styles} />
      <Row
        label="Tixraac"
        value={c.tixraac || c.reference || code}
        styles={styles}
      />

      {!compact && (c.stadiumName || b.stadium?.name) ? (
        <Row
          label="Garoon / Field"
          value={`${c.stadiumName || b.stadium?.name || '—'} · ${
            c.fieldName || b.field?.name || '—'
          }`}
          styles={styles}
        />
      ) : null}

      {lockSo && !c.qrVerified ? (
        <Text style={styles.lockHint}>{lockSo}</Text>
      ) : null}

      {showQr && !compact && qrValue && qrValue !== '—' ? (
        <View style={styles.qrWrap}>
          <QRCode value={String(qrValue)} size={140} color={colors.brandNavy} backgroundColor="#fff" />
          <Text style={styles.qrHint}>QR — staff verification / scan</Text>
        </View>
      ) : null}
    </Card>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && { opacity: 0.92 }]}>
      {body}
    </Pressable>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    compactCard: { marginBottom: 10 },
    flex: { flex: 1 },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    code: { ...typography.title, color: colors.text, fontSize: 17 },
    status: {
      ...typography.caption,
      color: colors.brandGreen,
      fontWeight: '700',
      marginTop: 2,
    },
    pill: {
      backgroundColor: colors.brandGreen + '22',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.sm,
    },
    pillText: {
      ...typography.caption,
      color: colors.brandGreen,
      fontWeight: '700',
    },
    kv: { marginBottom: 8 },
    k: { ...typography.caption, color: colors.muted, marginBottom: 2 },
    v: { ...typography.body, color: colors.text },
    lockHint: {
      ...typography.caption,
      color: colors.statusCancelled || '#B45309',
      marginTop: 4,
      marginBottom: 4,
    },
    qrWrap: {
      alignItems: 'center',
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    qrHint: {
      ...typography.caption,
      color: colors.muted,
      marginTop: 8,
    },
  });
}
