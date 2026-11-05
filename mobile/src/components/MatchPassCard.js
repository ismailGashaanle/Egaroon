import { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import Toast from 'react-native-toast-message';
import { formatWhen, formatMoney } from '../lib/gateScan';
import { formatSlotTime } from '../lib/dateUtils';
import { isExpoGo } from '../lib/expoRuntime';
import { buildMatchPassShareText, whatsAppShareUrl } from '../lib/matchShare';
import { colors, typography, spacing, radii, shadows } from '../theme';

function phoneOf(side) {
  if (!side) return null;
  return (
    side.payerPhoneDisplay ||
    side.payerPhone ||
    side.captainPhoneDisplay ||
    side.captainPhone ||
    null
  );
}

function isPaid(side) {
  if (!side) return false;
  if (side.coveredByTeamA) return true;
  if (side.paidAt) return true;
  const st = String(side.paymentStatus || '').toUpperCase();
  return st === 'PAID' || st === 'COVERED';
}

function TeamRow({ label, side }) {
  const name = side?.teamName || label;
  const phone = phoneOf(side);
  const paid = isPaid(side);

  return (
    <View style={styles.teamRow}>
      <View style={styles.teamLetter}>
        <Text style={styles.teamLetterText}>{label === 'Team A' ? 'A' : 'B'}</Text>
      </View>
      <View style={styles.teamMeta}>
        <Text style={styles.teamName} numberOfLines={1}>
          {side ? name : 'Weli ma jiro'}
        </Text>
        {phone ? (
          <Text style={styles.teamPhone} numberOfLines={1}>
            {phone}
          </Text>
        ) : null}
      </View>
      {side ? (
        <View style={[styles.paidBadge, paid ? styles.paidOn : styles.paidOff]}>
          <Text style={[styles.paidText, paid ? styles.paidTextOn : styles.paidTextOff]}>
            {paid ? (side.coveredByTeamA ? 'Covered' : 'Paid') : '—'}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Compact Match Pass — stadium/time, prominent QR, short team rows.
 * Save PNG (MediaLibrary / share fallback) · WhatsApp image or short Somali text.
 */
export default function MatchPassCard({ booking, matchPass: matchPassProp }) {
  const cardRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [sharingWa, setSharingWa] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const pass = matchPassProp || booking?.matchPass || null;
  const code = pass?.bookingCode || booking?.bookingCode || '';
  const qrValue =
    pass?.qrPayload ||
    booking?.qrPayload ||
    (code ? JSON.stringify({ bookingCode: code, code }) : String(booking?._id || ''));

  const stadiumName =
    pass?.stadiumName ||
    (typeof booking?.stadium === 'object' ? booking.stadium?.name : null) ||
    'Garoon';
  const fieldName =
    pass?.fieldName ||
    (typeof booking?.field === 'object' ? booking.field?.name : null);
  const start = pass?.startTime || booking?.startTime;
  const end = pass?.endTime || booking?.endTime;
  const bookedAt = pass?.bookedAt || booking?.createdAt;

  const teamA = pass?.teamA || {
    teamName: booking?.teamA?.team?.name || 'Team A',
    captainName: booking?.teamA?.captain?.name,
    captainPhone: booking?.teamA?.captain?.phone,
    paidAt: booking?.teamAPaidAt,
  };
  const teamB = pass?.teamB ||
    (booking?.teamB
      ? {
          teamName: booking.teamB?.team?.name || 'Team B',
          captainName: booking.teamB?.captain?.name,
          captainPhone: booking.teamB?.captain?.phone,
        }
      : null);

  const slotLabel = start
    ? `${new Date(start).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })} · ${formatSlotTime(start)}${end ? ` – ${formatSlotTime(end)}` : ''}`
    : '—';

  const shareText = buildMatchPassShareText({
    stadiumName,
    fieldName,
    slotLabel,
    bookingCode: code,
    teamAName: teamA?.teamName,
    teamBName: teamB?.teamName,
  });

  const capturePass = async () => {
    if (!cardRef.current) return null;
    return captureRef(cardRef, {
      format: 'png',
      quality: 1,
      result: 'tmpfile',
    });
  };

  const onSaveImage = async () => {
    setSaving(true);
    try {
      const uri = await capturePass();
      if (!uri) return;

      let saved = false;
      if (!isExpoGo()) {
        try {
          // eslint-disable-next-line global-require
          const MediaLibrary = require('expo-media-library');
          const perm = await MediaLibrary.requestPermissionsAsync();
          if (perm.granted || perm.accessPrivileges === 'limited') {
            await MediaLibrary.saveToLibraryAsync(uri);
            saved = true;
            Toast.show({
              type: 'success',
              text1: 'Sawirka waa la keydiyay',
              text2: 'Gallery / Photos — tus albaabka offline',
            });
          }
        } catch {
          /* fall through to share */
        }
      }

      if (!saved) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'Keydi Match Pass',
            UTI: 'public.png',
          });
          Toast.show({
            type: 'info',
            text1: isExpoGo() ? 'Expo Go · wadaag / keydi' : 'La wadaag / keydi',
            text2: isExpoGo()
              ? 'Gallery full save needs development build — door share'
              : 'Door soo-saare si aad u keydiso sawirka',
          });
        } else {
          Toast.show({
            type: 'info',
            text1: 'Sawir lama keydin karin',
            text2: isExpoGo()
              ? 'Media library limited in Expo Go — isticmaal dev build'
              : 'Oggolow Photos access Settings-ka',
          });
        }
      }
    } catch (err) {
      Toast.show({
        type: 'info',
        text1: 'Save image way fashilantay',
        text2: err?.message || Platform.OS,
      });
    } finally {
      setSaving(false);
    }
  };

  const onWhatsApp = async () => {
    setSharingWa(true);
    try {
      const uri = await capturePass();
      if (uri) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: 'WhatsApp · Match Pass',
            UTI: 'public.png',
          });
          Toast.show({
            type: 'success',
            text1: 'Door WhatsApp',
            text2: 'Share sheet — door WhatsApp si aad u dirto sawirka',
          });
          return;
        }
      }
      await Linking.openURL(whatsAppShareUrl(shareText));
    } catch {
      try {
        await Linking.openURL(whatsAppShareUrl(shareText));
      } catch {
        Toast.show({
          type: 'info',
          text1: 'WhatsApp lama furin',
          text2: 'Isku day Keydi gallery ka dibna wadaag',
        });
      }
    } finally {
      setSharingWa(false);
    }
  };

  const busy = saving || sharingWa;

  return (
    <View style={styles.wrap}>
      <View ref={cardRef} collapsable={false} style={styles.card}>
        <View style={styles.head}>
          <Text style={styles.brand}>E-GAROON</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>MATCH PASS</Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={styles.place} numberOfLines={1}>
            {stadiumName}
            {fieldName ? ` · ${fieldName}` : ''}
          </Text>
          <Text style={styles.when} numberOfLines={1}>
            {slotLabel}
          </Text>

          {qrValue ? (
            <View style={styles.qrBlock}>
              <View style={styles.qrPad}>
                <QRCode value={String(qrValue)} size={132} color="#1E2433" backgroundColor="#fff" />
              </View>
              {code ? <Text style={styles.code}>{code}</Text> : null}
              <Text style={styles.qrHint}>Tus albaabka · scan QR</Text>
            </View>
          ) : null}

          <View style={styles.teams}>
            <TeamRow label="Team A" side={teamA} />
            <View style={styles.teamDivider} />
            <TeamRow label="Team B" side={teamB} />
          </View>
        </View>
      </View>

      <Pressable
        onPress={() => setDetailsOpen((v) => !v)}
        style={styles.detailsToggle}
        accessibilityRole="button"
      >
        <Text style={styles.detailsToggleText}>Faafaahin</Text>
        <Ionicons
          name={detailsOpen ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.muted}
        />
      </Pressable>

      {detailsOpen ? (
        <View style={styles.detailsPanel}>
          <DetailLine label="Booking" value={formatWhen(bookedAt)} />
          {booking?.matchCode ? (
            <DetailLine label="Match code" value={booking.matchCode} />
          ) : null}
          <DetailLine
            label="Team A lacag"
            value={
              teamA
                ? [
                    teamA.paymentMethodLabel || teamA.paymentMethod,
                    teamA.amountPaid != null
                      ? teamA.currency === 'SLL'
                        ? `${Number(teamA.amountSll || teamA.amountPaid).toLocaleString()} SlSh${teamA.amountUsd ? ` ($${Number(teamA.amountUsd).toFixed(2)})` : ''}`
                        : `$${Number(teamA.amountPaid).toFixed(2)} USD`
                      : null,
                    teamA.exchangeRate && teamA.currency === 'SLL'
                      ? `Sarif: $1=${Number(teamA.exchangeRate).toLocaleString()} SlSh`
                      : null,
                    formatWhen(teamA.paidAt),
                  ]
                    .filter(Boolean)
                    .join(' · ') || '—'
                : '—'
            }
          />
          <DetailLine
            label="Team B lacag"
            value={
              teamB?.coveredByTeamA
                ? 'Team A ayaa dhammaan bixiyay'
                : teamB
                  ? [
                      teamB.paymentMethodLabel || teamB.paymentMethod,
                      teamB.amountPaid != null
                        ? teamB.currency === 'SLL'
                          ? `${Number(teamB.amountSll || teamB.amountPaid).toLocaleString()} SlSh${teamB.amountUsd ? ` ($${Number(teamB.amountUsd).toFixed(2)})` : ''}`
                          : `$${Number(teamB.amountPaid).toFixed(2)} USD`
                        : null,
                      teamB.exchangeRate && teamB.currency === 'SLL'
                        ? `Sarif: $1=${Number(teamB.exchangeRate).toLocaleString()} SlSh`
                        : null,
                      formatWhen(teamB.paidAt),
                    ]
                      .filter(Boolean)
                      .join(' · ') || '—'
                  : 'Weli ma jiro'
            }
          />
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onSaveImage}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            styles.ctaGallery,
            (busy || pressed) && { opacity: 0.85 },
            busy && { opacity: 0.55 },
          ]}
        >
          <Ionicons name="images-outline" size={18} color={colors.brandGreen} />
          <Text style={styles.ctaGalleryText}>
            {saving ? 'Keydinaya…' : 'Keydi gallery'}
          </Text>
        </Pressable>
        <Pressable
          onPress={onWhatsApp}
          disabled={busy}
          style={({ pressed }) => [
            styles.cta,
            styles.ctaWa,
            (busy || pressed) && { opacity: 0.9 },
            busy && { opacity: 0.55 },
          ]}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#fff" />
          <Text style={styles.ctaWaText}>
            {sharingWa ? 'Furaya…' : 'WhatsApp'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DetailLine({ label, value }) {
  if (value == null || value === '') return null;
  return (
    <View style={styles.detailLine}>
      <Text style={styles.detailK}>{label}</Text>
      <Text style={styles.detailV}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: spacing.sm,
  },
  card: {
    width: '100%',
    borderRadius: radii.xl,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.28)',
    ...shadows.card,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    backgroundColor: colors.brandNavy,
  },
  brand: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  badge: {
    backgroundColor: colors.brandGreen,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.full,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  body: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  place: {
    ...typography.h4,
    color: colors.brandNavy,
    fontWeight: '700',
  },
  when: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  qrBlock: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  qrPad: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: radii.md,
    borderWidth: 2,
    borderColor: colors.brandBlue,
  },
  code: {
    marginTop: 8,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 15,
    fontWeight: '700',
    color: colors.brandNavy,
    letterSpacing: 0.8,
  },
  qrHint: {
    ...typography.caption,
    color: colors.muted,
    marginTop: 2,
    fontSize: 11,
  },
  teams: {
    borderRadius: radii.md,
    backgroundColor: 'rgba(30, 36, 51, 0.04)',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  teamDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(30, 36, 51, 0.12)',
    marginLeft: 38,
  },
  teamLetter: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.brandGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamLetterText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  teamMeta: {
    flex: 1,
    minWidth: 0,
  },
  teamName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.brandNavy,
    fontSize: 14,
    lineHeight: 18,
  },
  teamPhone: {
    ...typography.caption,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 16,
  },
  paidBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
  },
  paidOn: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  paidOff: {
    backgroundColor: 'rgba(30, 36, 51, 0.06)',
  },
  paidText: {
    fontSize: 11,
    fontWeight: '700',
  },
  paidTextOn: {
    color: colors.brandGreen,
  },
  paidTextOff: {
    color: colors.muted,
  },
  detailsToggle: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  detailsToggleText: {
    ...typography.caption,
    color: colors.muted,
    fontWeight: '600',
  },
  detailsPanel: {
    marginTop: 2,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceInset || '#eef0ed',
    gap: 8,
  },
  detailLine: {
    gap: 2,
  },
  detailK: {
    ...typography.caption,
    color: colors.muted,
    fontSize: 11,
  },
  detailV: {
    ...typography.body,
    color: colors.brandNavy,
    fontSize: 13,
    fontWeight: '600',
  },
  actions: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: 10,
  },
  cta: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: radii.button,
  },
  ctaGallery: {
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: colors.brandGreen,
  },
  ctaGalleryText: {
    color: colors.brandGreen,
    fontWeight: '700',
    fontSize: 14,
  },
  ctaWa: {
    backgroundColor: '#25D366',
  },
  ctaWaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
});
