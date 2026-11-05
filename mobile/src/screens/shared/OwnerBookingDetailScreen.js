import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import OwnerBookingFaahfaahinCard from '../../components/OwnerBookingFaahfaahinCard';
import { ownerApi } from '../../api/owner';
import { bookingsApi } from '../../api/bookings';
import { useTheme } from '../../context/ThemeContext';
import { formatWhen } from '../../lib/gateScan';
import { navigateToScan } from '../../lib/ownerDisplay';
import { formatSlotTime } from '../../lib/dateUtils';
import { spacing, typography, radii } from '../../theme';

function Row({ label, value, styles }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.k}>{label}</Text>
      <Text style={styles.v}>{value || '—'}</Text>
    </View>
  );
}

export default function OwnerBookingDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const bookingId = route.params?.bookingId;
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [data, setData] = useState(null);
  const [changeRequests, setChangeRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleStart, setRescheduleStart] = useState('20:00');
  const [rescheduleEnd, setRescheduleEnd] = useState('21:00');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const load = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    try {
      const [res, crRes] = await Promise.all([
        ownerApi.getBooking(bookingId),
        bookingsApi.getChangeRequests(bookingId).catch(() => ({ requests: [] })),
      ]);
      setData(res);
      setChangeRequests(crRes.requests || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Booking', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  const onProposeReschedule = async () => {
    if (!rescheduleDate || !rescheduleStart || !rescheduleEnd) {
      Toast.show({ type: 'error', text1: 'Fadlan dooro taariikhda iyo saacadaha' });
      return;
    }
    setSubmittingReschedule(true);
    try {
      const res = await ownerApi.proposeReschedule(bookingId, {
        proposedDate: rescheduleDate,
        proposedStartTime: rescheduleStart,
        proposedEndTime: rescheduleEnd,
        reason: rescheduleReason.trim() || 'Soo jeedin ka timid mulkiilaha garoonka',
      });
      Toast.show({
        type: 'success',
        text1: 'Codsiga waa loo diray kabtanka',
        text2: res.message,
      });
      setRescheduleOpen(false);
      setRescheduleReason('');
      await load();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Soo jeedintu way fashilantay', text2: e.message });
    } finally {
      setSubmittingReschedule(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const booking = data?.booking;
  const gate = data?.gateSummary;
  const card = data?.detailCard || gate?.detailCard;
  const policy = gate?.paymentPolicy;
  const teamB = gate?.teamB;
  const capB = booking?.teamB?.captain;

  const alreadyStarted =
    Boolean(card?.qrVerified || booking?.gateCheckedInAt) &&
    ['IN_PROGRESS', 'CHECKED_IN', 'COMPLETED', 'SETTLED'].includes(
      String(booking?.status || card?.status || '')
    );

  const bilowLocked = !alreadyStarted;
  const lockReason =
    card?.lockMessageSo ||
    gate?.lockMessageSo ||
    (card?.timeState === 'too_early' || gate?.timeState === 'too_early'
      ? gate?.messageSo || 'Ma bilaabi kartid — maaha wakhtigan.'
      : card?.timeState === 'expired' || gate?.timeState === 'expired'
        ? 'Wakhtigagii aad ciyaari lahaydeen wuu dhacay — ma bilaabi kartid.'
        : 'Weli QR lama hubin — scan ka hor intaadan bilowin ciyaarta.');

  const openScan = () => {
    const stadiumId = String(
      card?.stadiumId || booking?.stadium?._id || booking?.stadium || ''
    );
    navigateToScan(navigation, {
      stadiumId: stadiumId || undefined,
      bookingCode: card?.bookingCode || booking?.bookingCode || undefined,
      bookingId: String(booking?._id || bookingId),
    });
  };

  const pendingChangeRequest = changeRequests.find((r) => r.status === 'PENDING');
  const canProposeReschedule =
    ['CONFIRMED', 'HELD', 'PAYMENT_PENDING'].includes(booking?.status) && !pendingChangeRequest;

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title="Faahfaahinta booking"
          subtitle={booking?.bookingCode || card?.bookingCode || ''}
          onBack={() => navigation.goBack()}
        />
        {loading && !booking && !card ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.body}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          >
            {pendingChangeRequest && (
              <Card style={{ borderWidth: 1.5, borderColor: '#F59E0B', backgroundColor: '#FFFBEB', marginBottom: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#D97706', marginBottom: 2 }}>
                  CODSI BEDDELKII WAQTIGA ({pendingChangeRequest.status})
                </Text>
                <Text style={{ ...typography.body, fontWeight: '700', color: '#92400E' }}>
                  {pendingChangeRequest.requestedBy === 'STADIUM_OWNER'
                    ? 'Waxaad soo jeedisay waqti cusub (sugaya kabtanka)'
                    : 'Kabtanka ayaa codsaday waqti cusub'}
                </Text>
                <Text style={{ ...typography.caption, color: '#B45309', marginTop: 4 }}>
                  Sababta: {pendingChangeRequest.reason || '—'}
                </Text>
                <Text style={{ ...typography.caption, color: colors.muted, marginTop: 4 }}>
                  Waqtiga cusub: {formatSlotTime(pendingChangeRequest.proposedSlot?.startTime)} (GMT+3 / EAT)
                </Text>
              </Card>
            )}

            <Text style={styles.section}>Faafaahinta</Text>
            <OwnerBookingFaahfaahinCard card={card} booking={booking} showQr />

            {teamB || booking?.teamB?.team || capB ? (
              <>
                <Text style={styles.section}>Team B</Text>
                <Card>
                  <Row
                    label="Koox"
                    value={teamB?.teamName || booking?.teamB?.team?.name}
                    styles={styles}
                  />
                  <Row
                    label="Captain"
                    value={teamB?.captainName || capB?.name}
                    styles={styles}
                  />
                  <Row
                    label="Telefoon"
                    value={teamB?.captainPhone || capB?.phone}
                    styles={styles}
                  />
                </Card>
              </>
            ) : null}

            {policy?.labelSo || policy?.waitingUntil ? (
              <>
                <Text style={styles.section}>Policy / sugid</Text>
                <Card>
                  {policy.labelSo ? <Text style={styles.row}>{policy.labelSo}</Text> : null}
                  <Row
                    label="Sugaya ilaa"
                    value={policy.waitingUntil ? formatWhen(policy.waitingUntil) : '—'}
                    styles={styles}
                  />
                </Card>
              </>
            ) : null}

            <Text style={styles.section}>Bilow ciyaarta</Text>
            <Card>
              {alreadyStarted ? (
                <Text style={styles.ok}>Ciyaarta waa bilowday · albaabka waa la hubiyay</Text>
              ) : (
                <>
                  <Text style={styles.lock}>{lockReason}</Text>
                  <Text style={styles.muted}>
                    1) Scan QR · 2) Wakhtiga slot-ka (±10 daqiiqo horay) · 3) Bilow
                  </Text>
                </>
              )}
              <Button
                title={alreadyStarted ? 'Ciyaarta waa bilowday' : 'Scan QR / Bilow ciyaarta'}
                variant={bilowLocked ? 'outline' : 'primary'}
                onPress={openScan}
                disabled={alreadyStarted}
                style={{ marginTop: 12 }}
              />

              {canProposeReschedule && (
                <Button
                  title="Soo jeedi Waqti Cusub"
                  variant="outline"
                  onPress={() => {
                    if (booking?.startTime) {
                      setRescheduleDate(booking.startTime.slice(0, 10));
                    }
                    setRescheduleOpen(true);
                  }}
                  style={{ marginTop: 10 }}
                />
              )}
            </Card>
          </ScrollView>
        )}
      </View>

      {/* Propose Reschedule Modal */}
      <Modal
        visible={rescheduleOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRescheduleOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <View style={{ backgroundColor: '#fff', borderRadius: radii.lg, padding: 18 }}>
            <Text style={{ ...typography.subheading, fontWeight: '800', color: colors.text, marginBottom: 4 }}>
              Soo jeedi Waqti Cusub
            </Text>
            <Text style={{ ...typography.caption, color: colors.muted, marginBottom: 12 }}>
              Ballanka lama beddeli doono ilaa kabtanku aqbalo. Haddii uu diido, waqtigii hore ayaa ahaanaya.
            </Text>

            <TextField
              label="Taariikhda (YYYY-MM-DD)"
              value={rescheduleDate}
              onChangeText={setRescheduleDate}
              placeholder="YYYY-MM-DD"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Bilowga (GMT+3)"
                  value={rescheduleStart}
                  onChangeText={setRescheduleStart}
                  placeholder="20:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="Dhammaadka (GMT+3)"
                  value={rescheduleEnd}
                  onChangeText={setRescheduleEnd}
                  placeholder="21:00"
                />
              </View>
            </View>
            <TextField
              label="Sababta aad u soo jeedinayso"
              value={rescheduleReason}
              onChangeText={setRescheduleReason}
              placeholder="Cilad koronto, dayactir..."
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button
                title="Ka noqo"
                variant="outline"
                onPress={() => setRescheduleOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Dir Soo Jeedinta"
                onPress={onProposeReschedule}
                loading={submittingReschedule}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.md, paddingBottom: 40 },
    section: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: '700',
      marginTop: 14,
      marginBottom: 6,
    },
    kv: { marginBottom: 8 },
    k: { ...typography.caption, color: colors.muted, marginBottom: 2 },
    v: { ...typography.body, color: colors.text },
    row: { ...typography.body, color: colors.text, marginBottom: 4 },
    muted: { ...typography.caption, color: colors.muted, marginTop: 6 },
    lock: {
      ...typography.body,
      color: colors.statusCancelled || '#B45309',
      fontWeight: '600',
    },
    ok: {
      ...typography.body,
      color: colors.brandGreen,
      fontWeight: '700',
    },
  });
}
