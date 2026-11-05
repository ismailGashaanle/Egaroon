import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Chip from '../../components/Chip';
import MatchPassCard from '../../components/MatchPassCard';
import PaymentConfirmModal from '../../components/PaymentConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import { bookingsApi } from '../../api/bookings';
import { paymentsApi } from '../../api/payments';
import { stadiumsApi } from '../../api/stadiums';
import { statusColor } from '../../lib/roles';
import {
  bookingStatusLabel,
  captainIdOf,
  isConfirmedBooking,
  isPartyPaid,
  sameUserId,
} from '../../lib/bookingStatus';
import { syncMatchReminders, cancelMatchReminders } from '../../lib/matchReminders';
import { MatchCodeCard } from './JoinMatchCodeScreen';
import { matchPaymentProgress } from '../../lib/matchJoinErrors';
import {
  SO_CARRIERS,
  composedPhone,
  digitsOnly,
} from '../../lib/somaliPhone';
import { formatSlotTime, formatMoney } from '../../lib/dateUtils';
import { colors, typography, spacing, radii } from '../../theme';

export default function BookingDetailScreen({ route, navigation }) {
  const {
    bookingId,
    openPay: openPayParam,
    paySide: paySideParam,
    payFull: payFullParam,
    phone: phoneParam,
    name: nameParam,
  } = route.params || {};
  const { user } = useAuth();
  const { lineupEnabled } = useAuthFeatures();
  const [booking, setBooking] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCarrier, setInviteCarrier] = useState('telesom');
  const [inviteLocal, setInviteLocal] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [payOpen, setPayOpen] = useState(false);
  const [paySide, setPaySide] = useState('teamA');
  const [payFull, setPayFull] = useState(false);
  const [paySeedPhone, setPaySeedPhone] = useState(undefined);
  const [paySeedName, setPaySeedName] = useState(undefined);
  const [changeRequests, setChangeRequests] = useState([]);
  const [rescheduleConfirmOpen, setRescheduleConfirmOpen] = useState(false);
  const [reschedulePickerOpen, setReschedulePickerOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const [respondingId, setRespondingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [bData, pData, crData] = await Promise.all([
        bookingsApi.get(bookingId),
        paymentsApi.listMine().catch(() => ({ payments: [] })),
        bookingsApi.getChangeRequests(bookingId).catch(() => ({ requests: [] })),
      ]);
      setBooking(bData.booking || bData);
      setChangeRequests(crData.requests || []);
      const all = pData.payments || [];
      setPayments(
        all.filter((p) => {
          const bid = p.booking?._id || p.booking;
          return String(bid) === String(bookingId);
        })
      );
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Faahfaahin lama helin', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  // ConfirmBooking / JoinMatch → open PaymentConfirmModal (never initiate from one-tap).
  useEffect(() => {
    if (!openPayParam || !booking) return;
    const side = paySideParam === 'teamB' ? 'teamB' : 'teamA';
    setPaySide(side);
    setPayFull(Boolean(payFullParam));
    setPaySeedPhone(phoneParam || user?.phone);
    setPaySeedName(nameParam || user?.name);
    setPayOpen(true);
    navigation.setParams({
      openPay: undefined,
      paySide: undefined,
      payFull: undefined,
      phone: undefined,
      name: undefined,
    });
  }, [
    openPayParam,
    paySideParam,
    payFullParam,
    phoneParam,
    nameParam,
    booking,
    user?.phone,
    user?.name,
    navigation,
  ]);

  useEffect(() => {
    if (!booking) return undefined;
    let cancelled = false;
    (async () => {
      if (
        ['CANCELLED', 'EXPIRED'].includes(booking.status)
      ) {
        await cancelMatchReminders(booking._id);
        return;
      }
      if (!cancelled) await syncMatchReminders(booking);
    })();
    return () => {
      cancelled = true;
    };
  }, [booking?._id, booking?.status, booking?.startTime]);

  if (loading && !booking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandGreen} />
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Lama helin</Text>
      </View>
    );
  }

  const userId = user?.id || user?._id;
  const isTeamACaptain = sameUserId(captainIdOf(booking.teamA), userId);
  const isTeamBCaptain = sameUserId(captainIdOf(booking.teamB), userId);
  const teamAPaid = isPartyPaid(booking.teamA);
  const teamBPaid = booking.teamB ? isPartyPaid(booking.teamB) : false;
  const coveredFull = Boolean(booking.coveredFullMatch);
  const confirmed = isConfirmedBooking(booking.status);
  const statusLabel = bookingStatusLabel(booking);
  const paymentProgress = matchPaymentProgress(booking);

  const code = booking.bookingCode || '';
  const stadiumName =
    typeof booking.stadium === 'object' ? booking.stadium?.name : 'Garoon';
  const fieldName =
    typeof booking.field === 'object' ? booking.field?.name : null;

  const canInvite =
    isTeamACaptain &&
    (teamAPaid || coveredFull) &&
    !booking.teamB &&
    !['CANCELLED', 'EXPIRED'].includes(booking.status);

  const mySide = isTeamACaptain ? 'teamA' : isTeamBCaptain ? 'teamB' : null;
  const myParty = mySide ? booking[mySide] : null;
  const canPayMyShare =
    mySide &&
    myParty &&
    !isPartyPaid(myParty) &&
    !coveredFull &&
    Number(myParty.amountDue || 0) > 0 &&
    ['HELD', 'PAYMENT_PENDING'].includes(booking.status);

  const holdActive =
    ['HELD', 'PAYMENT_PENDING'].includes(booking.status) &&
    (booking.holdExpiresAt || booking.teamBPaymentDueAt);

  const sllRate = Number(
    booking?.financialSnapshot?.sllPerUsd ||
      booking?.pricing?.sllPerUsd ||
      8500
  );

  const paymentForSide = (side) => {
    const forSide = payments.filter((p) => p.side === side);
    const paid = forSide.find((p) =>
      ['SUCCESS', 'HELD', 'SETTLED'].includes(p.status)
    );
    return paid || forSide[0] || null;
  };

  const onInvite = async () => {
    const phone = composedPhone(inviteCarrier, inviteLocal);
    if (!phone) {
      Toast.show({ type: 'error', text1: 'Telefoonka ma saxna' });
      return;
    }
    setInviting(true);
    try {
      const data = await bookingsApi.inviteTeamB(booking._id, { phone });
      const who = data.invitedCaptain;
      Toast.show({
        type: 'success',
        text1: 'Team B waa la casuumay',
        text2: who?.name || inviteName.trim() || undefined,
      });
      setShowInvite(false);
      setInviteLocal('');
      await load();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Casuumaaddu way fashilantay', text2: e.message });
    } finally {
      setInviting(false);
    }
  };

  const inviteCarrierObj =
    SO_CARRIERS.find((c) => c.id === inviteCarrier) || SO_CARRIERS[0];

  const pendingChangeRequest = changeRequests.find((r) => r.status === 'PENDING');
  const canReschedule =
    (confirmed || holdActive) && (isTeamACaptain || isTeamBCaptain) && !pendingChangeRequest;
  const canCancel =
    !['CANCELLED', 'EXPIRED', 'SETTLED', 'COMPLETED'].includes(booking.status) &&
    (isTeamACaptain || isTeamBCaptain);

  const onRespondChangeRequest = async (requestId, action, reason) => {
    setRespondingId(requestId);
    try {
      await bookingsApi.respondChangeRequest(requestId, { action, reason });
      Toast.show({
        type: 'success',
        text1:
          action === 'ACCEPT'
            ? 'Waqtiga cusub waa la aqbalay — ballanka waa la wareejiyay!'
            : 'Codsiga waqtiga waa la diiday',
      });
      await load();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Hawlgalku wuu fashilmay', text2: e.message });
    } finally {
      setRespondingId(null);
    }
  };

  const getTodayYMD = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };
  const getTomorrowYMD = () => {
    const d = new Date(Date.now() + 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const getDayAfterTomorrowYMD = () => {
    const d = new Date(Date.now() + 86400000 * 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const loadSlotsForDate = async (fieldId, dateStr) => {
    if (!fieldId || !dateStr) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const res = await stadiumsApi.listSlots(fieldId, dateStr);
      setAvailableSlots(res?.slots || res || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Boosaska lama helin', text2: e.message });
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const onDateChange = (newDate) => {
    setRescheduleDate(newDate);
    const fId = booking?.field?._id || booking?.field;
    loadSlotsForDate(fId, newDate);
  };

  const openSlotPicker = () => {
    const initialDate = rescheduleDate || getTodayYMD();
    setRescheduleDate(initialDate);
    const fId = booking?.field?._id || booking?.field;
    loadSlotsForDate(fId, initialDate);
    setReschedulePickerOpen(true);
  };

  const onRescheduleSubmit = async () => {
    if (!selectedSlot) {
      Toast.show({ type: 'error', text1: 'Fadlan dooro waqti banaan' });
      return;
    }
    setRescheduling(true);
    try {
      const fId = booking?.field?._id || booking?.field;
      const res = await bookingsApi.requestReschedule(booking._id, {
        proposedDate: rescheduleDate,
        proposedStartTime: selectedSlot.startTime,
        proposedEndTime: selectedSlot.endTime,
        proposedFieldId: fId,
        reason: rescheduleReason.trim() || 'Codsi beddelka waqtiga',
      });
      Toast.show({
        type: 'success',
        text1: 'Codsiga beddelka waa la diray',
        text2: res.message || 'Wuxuu sugayaa oggolaanshaha garoonka',
      });
      setReschedulePickerOpen(false);
      setSelectedSlot(null);
      setRescheduleReason('');
      await load();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Codsigii wuu fashilmay', text2: e.message });
    } finally {
      setRescheduling(false);
    }
  };

  const onCancelBooking = (fullRefund = false) => {
    Alert.alert(
      'Kansal Ballanka',
      fullRefund
        ? 'Mulkiilaha ayaa beddelay waqtiga — waxaad xaq u leedahay 100% lacag-celin buuxda. Ma rabtaa inaad kansasho?'
        : 'Ma hubtaa inaad rabto inaad kansasho? Lacag-celinta waxaa loo xisaabinayaa sida waafaqsan xeerka garoonka (Policy).',
      [
        { text: 'Maya', style: 'cancel' },
        {
          text: 'Haa, Kansal',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await bookingsApi.cancelWithPolicy(booking._id, {
                reason: fullRefund
                  ? 'Stadium requested reschedule not accepted'
                  : 'Cancelled by captain',
                requestFullRefund: fullRefund,
              });
              Toast.show({
                type: 'success',
                text1: 'Ballanka waa la kansalay',
                text2: res?.message,
              });
              await load();
            } catch (e) {
              Toast.show({ type: 'error', text1: 'Kansalaashadu way fashilantay', text2: e.message });
            }
          },
        },
      ]
    );
  };

  return (
    <FadeIn>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {pendingChangeRequest && (
          <Card style={[styles.fullWidth, styles.changeBanner]}>
            <View style={styles.badgeRow}>
              <Text style={styles.changeBadge}>CODSI BEDDELKII WAQTIGA</Text>
            </View>
            <Text style={styles.changeTitle}>
              {pendingChangeRequest.requestedBy === 'STADIUM_OWNER'
                ? 'Mulkiilaha garoonka ayaa codsaday waqti cusub'
                : 'Waxaa jira codsi sugaya beddelka waqtiga'}
            </Text>
            <Text style={styles.changeReason}>
              Sababta: {pendingChangeRequest.reason || '—'}
            </Text>
            <View style={styles.changeGrid}>
              <View style={styles.changeBox}>
                <Text style={styles.changeLabel}>Waqtigii Hore</Text>
                <Text style={styles.changeVal}>
                  {formatSlotTime(pendingChangeRequest.currentSlot?.startTime)}
                </Text>
              </View>
              <View style={[styles.changeBox, styles.changeBoxNew]}>
                <Text style={[styles.changeLabel, { color: colors.brandGreen }]}>Waqtiga Cusub (GMT+3)</Text>
                <Text style={[styles.changeVal, { color: colors.brandGreen }]}>
                  {formatSlotTime(pendingChangeRequest.proposedSlot?.startTime)} (EAT)
                </Text>
              </View>
            </View>
            <View style={styles.changeActions}>
              <Button
                title="Aqbal Waqtiga Cusub"
                onPress={() => onRespondChangeRequest(pendingChangeRequest._id, 'ACCEPT')}
                loading={respondingId === pendingChangeRequest._id}
                style={{ flex: 1, marginRight: 6 }}
              />
              <Button
                title="Diid"
                variant="outline"
                onPress={() => onRespondChangeRequest(pendingChangeRequest._id, 'REJECT')}
                style={{ flex: 1 }}
              />
            </View>
            {pendingChangeRequest.requestedBy === 'STADIUM_OWNER' && (
              <Button
                title="Kansal & 100% Soo Celi Lacagta"
                variant="danger"
                onPress={() => onCancelBooking(true)}
                style={{ marginTop: 8 }}
              />
            )}
          </Card>
        )}
        <Card style={styles.fullWidth}>
          <Text style={styles.stadium}>{stadiumName}</Text>
          {fieldName ? <Text style={styles.field}>{fieldName}</Text> : null}
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: statusColor(booking.status) }]} />
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
          <Text style={styles.rawStatus}>{booking.status}</Text>

          {confirmed && code ? (
            <>
              <Text style={styles.codeLabel}>Tixraac</Text>
              <Text style={styles.code}>{code}</Text>
            </>
          ) : (
            <Text style={styles.pendingCode}>
              {coveredFull
                ? 'Sug xaqiijinta lacagta — QR / receipt ayaa soo bixi doona'
                : 'Tixraac / QR waxay soo baxaan marka labada kooxood bixiyaan (ama adigu dhammaan)'}
            </Text>
          )}

          {booking.startTime ? (
            <Text style={styles.when}>
              Waqtiga: {formatSlotTime(booking.startTime)}
              {booking.endTime ? ` – ${formatSlotTime(booking.endTime)}` : ''}
            </Text>
          ) : null}

          {booking.pricing?.teamShare != null ? (
            <Text style={styles.price}>
              Qaybta kooxda: {formatMoney(booking.pricing.teamShare)}
            </Text>
          ) : null}
          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressPct}>{paymentProgress.percent}%</Text>
              <Text style={styles.progressMeta}>
                ${Number(paymentProgress.paidAmount || 0).toFixed(2)} / $
                {Number(paymentProgress.totalPrice || 0).toFixed(2)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, paymentProgress.percent)}%` },
                ]}
              />
            </View>
            <Text style={styles.progressHint}>
              Team A {paymentProgress.teamAPaid ? '✓' : '…'} · Team B{' '}
              {paymentProgress.teamBPaid ? '✓' : '…'}
            </Text>
          </View>
          {coveredFull ? (
            <Text style={styles.covered}>Team A wuxuu bixiyay dhammaan ciyaarta</Text>
          ) : null}
        </Card>

        {teamAPaid && !coveredFull && booking.matchCode && !teamBPaid ? (
          <MatchCodeCard booking={booking} colors={colors} onUpdated={load} />
        ) : null}

        {holdActive ? (
          <Card style={[styles.fullWidth, styles.bannerCard]}>
            <Text style={styles.bannerTitle}>
              {teamAPaid && !booking.teamB
                ? 'Casuum Team B'
                : teamAPaid && booking.teamB && !teamBPaid
                  ? 'Sug Team B — weli ma bixin'
                  : 'Bixi lacagtaada ka hor waqtiga'}
            </Text>
            <Text style={styles.bannerBody}>
              Labada kooxood waa inay bixiyaan. Boosku waa “Waa la doortay” ilaa labaduba
              bixiyaan — kadib “Waa la kiraystay”.
            </Text>
            {(booking.teamBPaymentDueAt || booking.holdExpiresAt) && (
              <Text style={styles.deadline}>
                Deadline:{' '}
                {new Date(
                  booking.teamBPaymentDueAt || booking.holdExpiresAt
                ).toLocaleString()}
              </Text>
            )}
          </Card>
        ) : null}

        <PartySection
          label="Team A"
          party={booking.teamA}
          paid={teamAPaid}
          payment={paymentForSide('teamA')}
          isMe={isTeamACaptain}
          sllRate={sllRate}
        />

        {booking.teamB ? (
          <PartySection
            label="Team B"
            party={booking.teamB}
            paid={teamBPaid}
            payment={paymentForSide('teamB')}
            isMe={isTeamBCaptain}
            sllRate={sllRate}
          />
        ) : (
          <Card style={styles.fullWidth}>
            <Text style={styles.partyLabel}>Team B</Text>
            <Text style={styles.muted}>
              {coveredFull
                ? 'Ikhtiyaari — casuum cadowga lineup / pass (lacag uma baahna)'
                : teamAPaid
                  ? 'Weli lama casuumin — geli telefoonka kabtanka B'
                  : 'Marka aad bixiso, casuum Team B'}
            </Text>
          </Card>
        )}

        {canInvite ? (
          <Card style={styles.fullWidth}>
            <Text style={styles.partyLabel}>
              {coveredFull ? 'Casuum Team B (ikhtiyaari)' : 'Casuum Team B'}
            </Text>
            {coveredFull ? (
              <Text style={[styles.muted, { marginTop: 6 }]}>
                Ballanka waa la kiraystay. Casuumaaddu waa lineup / QR Team B oo keliya.
              </Text>
            ) : null}
            {!showInvite ? (
              <Button
                title={coveredFull ? 'Casuum cadowga (ikhtiyaari)' : 'Casuum Team B'}
                onPress={() => setShowInvite(true)}
                style={{ marginTop: 10 }}
              />
            ) : (
              <View style={{ marginTop: 8 }}>
                <Text style={styles.fieldLabel}>Telefoonka kabtanka B</Text>
                <View style={styles.ops}>
                  {SO_CARRIERS.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.prefix}
                      selected={inviteCarrier === c.id}
                      onPress={() => {
                        setInviteCarrier(c.id);
                        setInviteLocal('');
                      }}
                      style={styles.opChip}
                    />
                  ))}
                </View>
                <View style={styles.phoneRow}>
                  <View style={styles.prefixBox}>
                    <Text style={styles.prefixText}>
                      +252 · {inviteCarrierObj.prefix}
                    </Text>
                  </View>
                  <TextField
                    style={styles.localField}
                    value={inviteLocal}
                    onChangeText={(t) => setInviteLocal(digitsOnly(t).slice(0, 7))}
                    placeholder="XXXXXXX"
                    keyboardType="phone-pad"
                  />
                </View>
                <TextField
                  label="Magaca (ikhtiyaari)"
                  value={inviteName}
                  onChangeText={setInviteName}
                  placeholder="Magaca kabtanka"
                  autoCapitalize="words"
                />
                <Button
                  title="Dir casuumaad"
                  onPress={onInvite}
                  loading={inviting}
                  style={{ marginTop: 4 }}
                />
              </View>
            )}
          </Card>
        ) : null}

        {canPayMyShare ? (
          <Button
            title={`Bixi qaybtaada · ${formatMoney(myParty.amountDue)} (${Math.round(Number(myParty.amountDue) * sllRate).toLocaleString()} SlSh)`}
            onPress={() => {
              setPaySide(mySide);
              setPayFull(false);
              setPaySeedPhone(user?.phone);
              setPaySeedName(user?.name);
              setPayOpen(true);
            }}
            style={styles.payCta}
          />
        ) : null}

        {isTeamACaptain &&
          !teamAPaid &&
          !coveredFull &&
          ['HELD', 'PAYMENT_PENDING'].includes(booking.status) && (
            <Button
              title={`Bixi dhammaan · ${formatMoney(booking.pricing?.totalPrice)} (${Math.round(Number(booking.pricing?.totalPrice) * sllRate).toLocaleString()} SlSh)`}
              variant="outline"
              onPress={() => {
                setPaySide('teamA');
                setPayFull(true);
                setPaySeedPhone(user?.phone);
                setPaySeedName(user?.name);
                setPayOpen(true);
              }}
              style={styles.payCta}
            />
          )}

        {confirmed ? (
          <MatchPassCard booking={booking} matchPass={booking.matchPass} />
        ) : null}

        {lineupEnabled &&
          confirmed &&
          (isTeamACaptain || isTeamBCaptain) && (
            <Button
              title="Formation & lineup"
              variant="outline"
              onPress={() =>
                navigation.navigate('Lineup', {
                  bookingId: booking._id,
                  teamSide: mySide,
                })
              }
              style={styles.payCta}
            />
          )}

        {canReschedule && (
          <Button
            title="Ii beddel waqtiga"
            variant="outline"
            onPress={() => setRescheduleConfirmOpen(true)}
            style={styles.payCta}
          />
        )}
 
        {canCancel && (
          <Button
            title="Kansal Ballanka"
            variant="danger"
            onPress={() => onCancelBooking(false)}
            style={styles.payCta}
          />
        )}
      </ScrollView>

      {/* Step 1: Confirmation Prompt Modal */}
      <Modal
        visible={rescheduleConfirmOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setRescheduleConfirmOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Xaqiijinta Beddelka Waqtiga</Text>
            <View style={[styles.infoBox, { backgroundColor: '#FEF3C7', borderColor: '#F59E0B' }]}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#92400E' }}>
                Ma xaqiijinaysaa inaad rabto inaad beddesho waqtiga ballankaaga?
              </Text>
              <Text style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>
                Do you want to change your time slot? Waxaad dooran kartaa maalin iyo waqti kale oo banaan.
              </Text>
            </View>

            <View style={{ marginVertical: 12, padding: 10, backgroundColor: colors.surface, borderRadius: radii.md }}>
              <Text style={{ fontSize: 12, color: colors.muted }}>
                Garoonka: <Text style={{ fontWeight: '600', color: colors.charcoal }}>{booking?.stadium?.name} · {booking?.field?.name}</Text>
              </Text>
              <Text style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>
                Waqtiga hadda: <Text style={{ fontWeight: '600', color: colors.charcoal }}>{formatSlotTime(booking?.startTime)} (GMT+3)</Text>
              </Text>
              <Text style={{ fontSize: 11, color: colors.brandGreen, marginTop: 4 }}>
                💡 Xeerka: Beddelka &gt; 24 saac ka hor waa bilaash ($0).
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Button
                title="Maya, ka noqo"
                variant="outline"
                onPress={() => setRescheduleConfirmOpen(false)}
                style={{ flex: 1 }}
              />
              <Button
                title="Haa, ii beddel"
                onPress={() => {
                  setRescheduleConfirmOpen(false);
                  openSlotPicker();
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Step 2 & 3: Dooro Maalin & Waqti Cusub Modal */}
      <Modal
        visible={reschedulePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReschedulePickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '85%' }]}>
            <Text style={styles.modalTitle}>Dooro Maalin & Waqti Cusub</Text>
            <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 8 }}>
              Aagga: Africa/Mogadishu (GMT+3 / EAT)
            </Text>

            {/* Quick Date Chips */}
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.muted, marginBottom: 6 }}>
              1. Dooro Maalinta
            </Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
              <Chip
                label="Maanta"
                selected={rescheduleDate === getTodayYMD()}
                onPress={() => onDateChange(getTodayYMD())}
              />
              <Chip
                label="Berri"
                selected={rescheduleDate === getTomorrowYMD()}
                onPress={() => onDateChange(getTomorrowYMD())}
              />
              <Chip
                label="Saadambe"
                selected={rescheduleDate === getDayAfterTomorrowYMD()}
                onPress={() => onDateChange(getDayAfterTomorrowYMD())}
              />
            </View>

            <TextField
              label="Taariikhda (YYYY-MM-DD)"
              value={rescheduleDate}
              onChangeText={onDateChange}
              placeholder="YYYY-MM-DD"
            />

            {/* Slot List */}
            <Text style={{ fontSize: 11, fontWeight: '700', textTransform: 'uppercase', color: colors.muted, marginTop: 8, marginBottom: 6 }}>
              2. Dooro Saacadda Banaan (GMT+3)
            </Text>
            {loadingSlots ? (
              <ActivityIndicator size="small" color={colors.brandGreen} style={{ marginVertical: 16 }} />
            ) : availableSlots.length === 0 ? (
              <Text style={{ fontSize: 12, color: colors.muted, textAlign: 'center', marginVertical: 12 }}>
                Ma jiraan boosas banaan maalintan.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {availableSlots.map((s) => {
                    const isAvail = s.state === 'available';
                    const isSel = selectedSlot?.startTime === s.startTime;
                    return (
                      <Chip
                        key={s.startTime}
                        label={`${s.startLabel} – ${s.endLabel} (${isSel ? '✓' : isAvail ? 'Banaan' : 'Xiran'})`}
                        selected={isSel}
                        disabled={!isAvail}
                        onPress={() => setSelectedSlot(s)}
                      />
                    );
                  })}
                </View>
              </ScrollView>
            )}

            {selectedSlot ? (
              <View style={{ marginVertical: 8, padding: 8, backgroundColor: colors.brandGreen + '10', borderRadius: radii.md }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandGreen }}>
                  La Doortay: {rescheduleDate} · {selectedSlot.startLabel} – {selectedSlot.endLabel} (GMT+3)
                </Text>
                <Text style={{ fontSize: 11, color: colors.charcoal, marginTop: 2 }}>
                  Kharashka: $0.00 (Bilaash)
                </Text>
              </View>
            ) : null}

            <TextField
              label="Sababta beddelka (ikhtiyaari)"
              value={rescheduleReason}
              onChangeText={setRescheduleReason}
              placeholder="Sababta..."
            />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Button
                title="Dib u noqo"
                variant="outline"
                onPress={() => {
                  setReschedulePickerOpen(false);
                  setRescheduleConfirmOpen(true);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Xaqiiji & Gudbi"
                disabled={!selectedSlot}
                loading={rescheduling}
                onPress={onRescheduleSubmit}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <PaymentConfirmModal
        visible={payOpen}
        onClose={() => setPayOpen(false)}
        booking={booking}
        side={paySide}
        coverFullMatch={payFull}
        defaultPhone={paySeedPhone || user?.phone}
        defaultName={paySeedName || user?.name}
        onPaid={() => {
          load();
        }}
      />
    </FadeIn>
  );
}

function PartySection({ label, party, paid, payment, isMe, sllRate }) {
  if (!party) return null;
  const teamName = party.team?.name || label;
  const due = Number(party.amountDue || 0);
  const ref =
    payment?.providerReference ||
    (payment?._id ? String(payment._id).slice(-8).toUpperCase() : null);

  const isSll = payment?.currency === 'SLL' || payment?.payCurrency === 'SLL';

  return (
    <Card style={styles.fullWidth}>
      <View style={styles.partyHeader}>
        <Text style={styles.partyLabel}>
          {label}
          {isMe ? ' (adiga)' : ''}
        </Text>
        <Text style={[styles.payBadge, paid ? styles.payOk : styles.payWait]}>
          {paid ? (due === 0 ? 'Covered' : 'Bixiyay') : party.paymentStatus || 'PENDING'}
        </Text>
      </View>
      <Text style={styles.teamName}>{teamName}</Text>
      <Text style={styles.partyMeta}>
        Qaybta: {formatMoney(due)}
        {!paid ? ` (${Math.round(due * (sllRate || 8500)).toLocaleString()} SlSh)` : ''}
        {party.playersCount != null ? ` · ${party.playersCount} ciyaartoy` : ''}
      </Text>
      {paid && payment ? (
        <View style={styles.receiptBox}>
          <Text style={styles.receiptTitle}>🧾 Rasiidka Lacag-Bixinta ({label})</Text>
          <Text style={styles.receiptLine}>
            Lacagta la bixiyay:{' '}
            <Text style={styles.receiptBold}>
              {isSll
                ? `${Number(payment.amountSll || payment.amount).toLocaleString()} SlSh`
                : `$${Number(payment.amountUsd || payment.amount).toFixed(2)} USD`}
            </Text>
          </Text>
          {isSll && payment.amountUsd ? (
            <Text style={styles.receiptSub}>
              U dhiganta: ${Number(payment.amountUsd).toFixed(2)} USD · Sarifka: $1 = {Number(payment.exchangeRate || sllRate || 8500).toLocaleString()} SlSh
            </Text>
          ) : null}
          {payment.paidAt ? (
            <Text style={styles.receiptSub}>
              Waqtiga: {new Date(payment.paidAt).toLocaleString()}
            </Text>
          ) : null}
        </View>
      ) : null}
      {payment?.payerPhone ? (
        <Text style={styles.partyMeta}>
          Lacag-bixiye: {payment.payerPhone}
          {payment.operator ? ` · ${payment.operator}` : ''}
        </Text>
      ) : null}
      {payment?.teamBContactPhone ? (
        <Text style={styles.partyMeta}>Xiriir B: {payment.teamBContactPhone}</Text>
      ) : null}
      {ref ? <Text style={styles.payRef}>Ref: {ref}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmwhite },
  scroll: { padding: spacing.md, paddingBottom: 48, alignItems: 'center' },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.warmwhite,
  },
  muted: { color: colors.muted },
  fullWidth: { width: '100%' },
  stadium: { fontSize: 22, fontWeight: '800', color: colors.brandNavy },
  field: { marginTop: 4, color: colors.muted, fontWeight: '600' },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { color: colors.brandNavy, fontWeight: '800', fontSize: 15, flex: 1 },
  rawStatus: { marginTop: 4, ...typography.caption, color: colors.muted },
  codeLabel: { marginTop: 20, ...typography.caption, color: colors.muted },
  code: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.brandGreen,
    letterSpacing: 1,
  },
  pendingCode: {
    marginTop: 14,
    fontSize: 13,
    color: colors.statusPending,
    fontWeight: '600',
    lineHeight: 20,
  },
  when: { marginTop: 12, color: colors.charcoal },
  price: { marginTop: 8, fontWeight: '700', color: colors.brandNavy },
  progressBlock: { marginTop: 12 },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 6,
  },
  progressPct: { fontSize: 24, fontWeight: '800', color: colors.brandNavy },
  progressMeta: { fontSize: 12, color: colors.muted, fontWeight: '600' },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.brandGreen,
  },
  progressHint: { marginTop: 6, fontSize: 11, color: colors.muted, fontWeight: '600' },
  covered: {
    marginTop: 6,
    color: colors.statusConfirmed,
    fontWeight: '700',
    fontSize: 13,
  },
  bannerCard: { backgroundColor: colors.statusPendingBg },
  bannerTitle: {
    fontWeight: '800',
    color: colors.statusPending,
    fontSize: 15,
  },
  bannerBody: {
    marginTop: 6,
    fontSize: 13,
    color: colors.charcoal,
    lineHeight: 20,
  },
  deadline: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    color: colors.statusPending,
  },
  partyLabel: {
    ...typography.overline,
    color: colors.muted,
  },
  partyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  payBadge: {
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  payOk: {
    backgroundColor: colors.statusConfirmedBg,
    color: colors.statusConfirmed,
  },
  payWait: {
    backgroundColor: colors.statusPendingBg,
    color: colors.statusPending,
  },
  teamName: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '800',
    color: colors.brandNavy,
  },
  partyMeta: { marginTop: 4, color: colors.muted, fontSize: 13 },
  payRef: {
    marginTop: 8,
    fontWeight: '800',
    color: colors.brandGreen,
    fontSize: 13,
  },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '600',
    color: colors.muted,
    marginBottom: 6,
  },
  ops: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  opChip: { flexGrow: 0 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  prefixBox: {
    height: 48,
    paddingHorizontal: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceInset,
    justifyContent: 'center',
  },
  prefixText: { fontWeight: '700', color: colors.muted, fontSize: 12 },
  localField: { flex: 1, marginBottom: 0 },
  payCta: { width: '100%', marginTop: 4, marginBottom: 8 },
  receiptBox: {
    marginTop: 8,
    padding: 10,
    borderRadius: radii.md,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  receiptTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.brandGreen,
    marginBottom: 4,
  },
  receiptLine: {
    fontSize: 13,
    color: colors.text || '#1E2433',
  },
  receiptBold: {
    fontWeight: '800',
    color: colors.brandGreen,
  },
  receiptSub: {
    fontSize: 11,
    color: colors.muted,
    marginTop: 3,
  },
  qrCard: { alignItems: 'center', marginTop: 8, width: '100%' },
  qrHint: {
    marginTop: 12,
    ...typography.caption,
    color: colors.muted,
    textAlign: 'center',
  },
  codeUnderQr: {
    marginTop: 8,
    fontWeight: '800',
    color: colors.brandGreen,
    fontSize: 18,
    letterSpacing: 1,
  },
  changeBanner: {
    borderWidth: 2,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
    marginBottom: 12,
  },
  badgeRow: { flexDirection: 'row', marginBottom: 4 },
  changeBadge: {
    backgroundColor: '#F59E0B',
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  changeTitle: {
    ...typography.subheading,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 4,
  },
  changeReason: {
    ...typography.caption,
    color: '#B45309',
    marginTop: 4,
  },
  changeGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 10,
  },
  changeBox: {
    flex: 1,
    padding: 8,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  changeBoxNew: {
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderColor: 'rgba(16,185,129,0.3)',
  },
  changeLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.muted,
  },
  changeVal: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
  },
  changeActions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: radii.lg,
    padding: 18,
  },
  modalTitle: {
    ...typography.subheading,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  modalHint: {
    ...typography.caption,
    color: colors.muted,
    marginBottom: 12,
  },
});
