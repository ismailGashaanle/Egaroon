import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Chip from '../../components/Chip';
import { stadiumsApi } from '../../api/stadiums';
import { ownerApi } from '../../api/owner';
import { tournamentsApi } from '../../api/tournaments';
import { useTheme } from '../../context/ThemeContext';
import {
  coverImage,
  stadiumPlace,
  hoursLabel,
  fieldPriceLabel,
  WEEKDAYS_SO,
  formatWhen,
} from '../../lib/ownerDisplay';
import { radii, spacing, typography } from '../../theme';

const BLOCK_TYPES = [
  { id: 'weather', label: 'Roob' },
  { id: 'maintenance', label: 'Dayactir' },
  { id: 'holiday', label: 'Fasax' },
  { id: 'private_event', label: 'Private' },
  { id: 'owner_block', label: 'Xir' },
];

function todayYmd() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function StadiumDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const stadiumId = route.params?.stadiumId;
  const { colors, shadows } = useTheme();
  const styles = makeStyles(colors, shadows);
  const insets = useSafeAreaInsets();

  const [stadium, setStadium] = useState(null);
  const [fields, setFields] = useState([]);
  const [managers, setManagers] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [discounts, setDiscounts] = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [cups, setCups] = useState([]);
  const [cupDetail, setCupDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState({ email: '', name: '', password: '' });
  const [inviting, setInviting] = useState(false);

  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState({
    name: '',
    percentOff: '20',
    fieldId: '',
    applyToAllSlots: true,
    startTimeLocal: '06:00',
    endTimeLocal: '12:00',
  });
  const [savingDiscount, setSavingDiscount] = useState(false);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blockForm, setBlockForm] = useState({
    fieldId: '',
    type: 'weather',
    date: '',
    startTime: '08:00',
    endTime: '12:00',
    reason: '',
  });
  const [savingBlock, setSavingBlock] = useState(false);

  const [lockOpen, setLockOpen] = useState(false);
  const [lockForm, setLockForm] = useState({
    date: todayYmd(),
    allDay: true,
    startTime: '06:00',
    endTime: '23:00',
    type: 'owner_block',
    reason: 'Maanta ma shaqeeyo',
  });
  const [savingLock, setSavingLock] = useState(false);

  const [recOpen, setRecOpen] = useState(false);
  const [recForm, setRecForm] = useState({
    fieldId: '',
    teamName: '',
    dayOfWeek: 5,
    startTimeLocal: '20:00',
    endTimeLocal: '21:00',
    note: '',
  });
  const [savingRec, setSavingRec] = useState(false);
  const [editingRecurring, setEditingRecurring] = useState(null);

  const [opsBusy, setOpsBusy] = useState(false);
  const [offlineHours, setOfflineHours] = useState('4');
  const [offlineReason, setOfflineReason] = useState('');
  const [fieldOpsBusyId, setFieldOpsBusyId] = useState(null);
  const [nowTick, setNowTick] = useState(Date.now());
  const [panel, setPanel] = useState('fields');

  const [policyForm, setPolicyForm] = useState({
    freeRescheduleWindowHours: '24',
    rescheduleFee: '0',
    minRescheduleNoticeHours: '6',
    cancelRefundPercent: '100',
    policyNoticeSo: '',
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    if (!stadiumId) return;
    setLoading(true);
    try {
      const stRes = await stadiumsApi.get(stadiumId);
      const st = stRes.stadium || stRes;
      setStadium(st);

      const p = st.bookingPolicy || {};
      setPolicyForm({
        freeRescheduleWindowHours: String(p.freeRescheduleWindowHours ?? 24),
        rescheduleFee: String(p.rescheduleFee ?? 0),
        minRescheduleNoticeHours: String(p.minRescheduleNoticeHours ?? 6),
        cancelRefundPercent: String(p.cancelRefundPercent ?? 100),
        policyNoticeSo: p.policyNoticeSo || '',
      });

      const [fRes, mRes, bRes, dRes, rRes, tRes] = await Promise.all([
        stadiumsApi.listFields(stadiumId).catch(() => ({ fields: [] })),
        stadiumsApi.listManagers(stadiumId).catch(() => ({ managers: [] })),
        stadiumsApi.listBlocks(stadiumId, { upcoming: 1 }).catch(() => ({ blocks: [] })),
        ownerApi.listDiscounts({ stadiumId }).catch(() => ({ discounts: [] })),
        ownerApi.listRecurring({ stadiumId }).catch(() => ({ recurring: [] })),
        tournamentsApi.list({ stadiumId }).catch(() => ({ tournaments: [] })),
      ]);

      const fieldList = fRes.fields || [];
      setFields(fieldList);
      setManagers(mRes.managers || []);
      setBlocks(bRes.blocks || bRes.availabilityBlocks || []);
      setDiscounts(dRes.discounts || []);
      setRecurring(rRes.recurring || []);
      setCups(tRes.tournaments || []);

      if (fieldList[0]) {
        const firstId = String(fieldList[0]._id);
        setBlockForm((p) => (p.fieldId ? p : { ...p, fieldId: firstId }));
        setRecForm((p) => (p.fieldId ? p : { ...p, fieldId: firstId }));
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Garoonka', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [stadiumId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onInvite = async () => {
    if (!invite.email.trim()) {
      Toast.show({ type: 'error', text1: 'Email ayaa loo baahan yahay' });
      return;
    }
    setInviting(true);
    try {
      await stadiumsApi.inviteManager(stadiumId, {
        email: invite.email.trim(),
        name: invite.name.trim() || undefined,
        password: invite.password || undefined,
      });
      Toast.show({ type: 'success', text1: 'Manager waa la casuumay' });
      setInvite({ email: '', name: '', password: '' });
      setInviteOpen(false);
      const mRes = await stadiumsApi.listManagers(stadiumId);
      setManagers(mRes.managers || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Casuumid', text2: e.message });
    } finally {
      setInviting(false);
    }
  };

  const onRevoke = (managerId, label) => {
    Alert.alert('Ka saar manager?', label || 'Manager', [
      { text: 'Maya', style: 'cancel' },
      {
        text: 'Ka saar',
        style: 'destructive',
        onPress: async () => {
          try {
            await stadiumsApi.revokeManager(stadiumId, managerId);
            Toast.show({ type: 'success', text1: 'Manager waa laga saaray' });
            setManagers((prev) => prev.filter((m) => String(m._id) !== String(managerId)));
          } catch (e) {
            Toast.show({ type: 'error', text1: 'Revoke', text2: e.message });
          }
        },
      },
    ]);
  };

  const onCreateDiscount = async () => {
    if (!discountForm.name.trim()) {
      Toast.show({ type: 'error', text1: 'Magaca discount ayaa loo baahan yahay' });
      return;
    }
    setSavingDiscount(true);
    try {
      const percent = Number(discountForm.percentOff);
      await ownerApi.createDiscount({
        stadiumId,
        name: discountForm.name.trim(),
        fieldId: discountForm.fieldId || null,
        applyToAllSlots: !!discountForm.applyToAllSlots,
        percentOff: percent > 0 ? percent : undefined,
        daysOfWeek: discountForm.applyToAllSlots ? [] : undefined,
        startTimeLocal: discountForm.applyToAllSlots
          ? null
          : discountForm.startTimeLocal || null,
        endTimeLocal: discountForm.applyToAllSlots ? null : discountForm.endTimeLocal || null,
      });
      Toast.show({ type: 'success', text1: 'Discount waa la abuuray' });
      setDiscountOpen(false);
      setDiscountForm((p) => ({ ...p, name: '', percentOff: '20' }));
      const dRes = await ownerApi.listDiscounts({ stadiumId });
      setDiscounts(dRes.discounts || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Discount', text2: e.message });
    } finally {
      setSavingDiscount(false);
    }
  };

  const onDeleteDiscount = (id) => {
    Alert.alert('Tirtir discount?', '', [
      { text: 'Maya', style: 'cancel' },
      {
        text: 'Tirtir',
        style: 'destructive',
        onPress: async () => {
          try {
            await ownerApi.deleteDiscount(id);
            setDiscounts((prev) => prev.filter((d) => String(d._id) !== String(id)));
            Toast.show({ type: 'success', text1: 'Discount waa la tirtiray' });
          } catch (e) {
            Toast.show({ type: 'error', text1: 'Delete', text2: e.message });
          }
        },
      },
    ]);
  };

  const onCreateBlock = async () => {
    if (!blockForm.fieldId) {
      Toast.show({ type: 'error', text1: 'Field dooro' });
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(blockForm.date)) {
      Toast.show({ type: 'error', text1: 'Taariikhda: YYYY-MM-DD' });
      return;
    }
    const startsAt = new Date(`${blockForm.date}T${blockForm.startTime || '08:00'}:00`);
    const endsAt = new Date(`${blockForm.date}T${blockForm.endTime || '12:00'}:00`);
    if (!(endsAt > startsAt)) {
      Toast.show({ type: 'error', text1: 'Dhammaadku waa inuu ka dambeeyo bilowga' });
      return;
    }
    setSavingBlock(true);
    try {
      await stadiumsApi.createBlock(blockForm.fieldId, {
        type: blockForm.type,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: blockForm.reason.trim() || undefined,
      });
      Toast.show({ type: 'success', text1: 'Block waa la abuuray' });
      setBlockOpen(false);
      const bRes = await stadiumsApi.listBlocks(stadiumId, { upcoming: 1 });
      setBlocks(bRes.blocks || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Block', text2: e.message });
    } finally {
      setSavingBlock(false);
    }
  };

  const onLockStadium = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lockForm.date)) {
      Toast.show({ type: 'error', text1: 'Taariikhda: YYYY-MM-DD' });
      return;
    }
    const startT = lockForm.allDay ? '00:00' : lockForm.startTime || '06:00';
    const endT = lockForm.allDay ? '23:59' : lockForm.endTime || '23:00';
    const startsAt = new Date(`${lockForm.date}T${startT}:00`);
    const endsAt = new Date(`${lockForm.date}T${endT}:00`);
    if (lockForm.allDay) {
      endsAt.setMinutes(59, 59, 999);
    }
    if (!(endsAt > startsAt)) {
      Toast.show({ type: 'error', text1: 'Dhammaadku waa inuu ka dambeeyo bilowga' });
      return;
    }
    setSavingLock(true);
    try {
      await stadiumsApi.lockStadium(stadiumId, {
        type: lockForm.type || 'owner_block',
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
        reason: lockForm.reason.trim() || 'Whole stadium locked',
      });
      Toast.show({
        type: 'success',
        text1: 'Garoonka waa la xiray',
        text2: 'Booking lama sameyn karo wakhtigaas',
      });
      setLockOpen(false);
      const bRes = await stadiumsApi.listBlocks(stadiumId, { upcoming: 1 });
      setBlocks(bRes.blocks || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Xiridda garoonka', text2: e.message });
    } finally {
      setSavingLock(false);
    }
  };

  const onDeleteBlock = (id) => {
    Alert.alert('Tirtir block?', '', [
      { text: 'Maya', style: 'cancel' },
      {
        text: 'Tirtir',
        style: 'destructive',
        onPress: async () => {
          try {
            await stadiumsApi.deleteBlock(id);
            setBlocks((prev) => prev.filter((b) => String(b._id) !== String(id)));
            Toast.show({ type: 'success', text1: 'Block waa la tirtiray' });
          } catch (e) {
            Toast.show({ type: 'error', text1: 'Delete', text2: e.message });
          }
        },
      },
    ]);
  };

  const resetRecForm = () => {
    setEditingRecurring(null);
    setRecForm((p) => ({ ...p, teamName: '', note: '' }));
  };

  const startEditRecurring = (r) => {
    setEditingRecurring(r);
    setRecForm({
      fieldId: String(r.field?._id || r.field || recForm.fieldId || ''),
      teamName: r.teamName || '',
      dayOfWeek: Number(r.dayOfWeek ?? 5),
      startTimeLocal: r.startTimeLocal || '20:00',
      endTimeLocal: r.endTimeLocal || '21:00',
      note: r.note || '',
    });
    setRecOpen(true);
  };

  const onSaveRecurring = async () => {
    if (!recForm.fieldId || !recForm.teamName.trim()) {
      Toast.show({ type: 'error', text1: 'Field iyo magaca kooxda ayaa loo baahan yahay' });
      return;
    }
    setSavingRec(true);
    try {
      const payload = {
        fieldId: recForm.fieldId,
        teamName: recForm.teamName.trim(),
        dayOfWeek: Number(recForm.dayOfWeek),
        startTimeLocal: recForm.startTimeLocal,
        endTimeLocal: recForm.endTimeLocal,
        frequency: 'weekly',
        note: recForm.note.trim() || undefined,
      };
      if (editingRecurring?._id) {
        await ownerApi.updateRecurring(editingRecurring._id, payload);
        Toast.show({ type: 'success', text1: 'Joogto waa la cusboonaysiiyay' });
      } else {
        await ownerApi.createRecurring(payload);
        Toast.show({ type: 'success', text1: 'Permanent slot waa la abuuray' });
      }
      setRecOpen(false);
      resetRecForm();
      const rRes = await ownerApi.listRecurring({ stadiumId });
      setRecurring(rRes.recurring || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Permanent', text2: e.message });
    } finally {
      setSavingRec(false);
    }
  };

  const onDeleteRecurring = (id) => {
    Alert.alert('Tirtir joogto?', 'Koox toddobaadle ah — saacaddaas waa la furi doonaa.', [
      { text: 'Maya', style: 'cancel' },
      {
        text: 'Tirtir',
        style: 'destructive',
        onPress: async () => {
          try {
            await ownerApi.deleteRecurring(id);
            setRecurring((prev) => prev.filter((r) => String(r._id) !== String(id)));
            if (editingRecurring && String(editingRecurring._id) === String(id)) {
              resetRecForm();
              setRecOpen(false);
            }
            Toast.show({ type: 'success', text1: 'Joogto waa la tirtiray' });
          } catch (e) {
            Toast.show({ type: 'error', text1: 'Delete', text2: e.message });
          }
        },
      },
    ]);
  };

  const openCup = async (t) => {
    try {
      const data = await tournamentsApi.get(t._id);
      setCupDetail(data);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Cup', text2: e.message });
    }
  };

  const ops = stadium?.ops;
  const isOffline = ops && ops.bookable === false;
  const reopenSecs =
    isOffline && ops?.reopenAt
      ? Math.max(0, Math.ceil((new Date(ops.reopenAt).getTime() - nowTick) / 1000))
      : null;

  const setOnline = async () => {
    setOpsBusy(true);
    try {
      const res = await stadiumsApi.setOps(stadiumId, { mode: 'online' });
      setStadium(res.stadium || res);
      Toast.show({ type: 'success', text1: 'Dhamaan garoonka waa furan (online)' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Online', text2: e.message });
    } finally {
      setOpsBusy(false);
    }
  };

  const setOffline = async () => {
    setOpsBusy(true);
    try {
      const hours = Math.max(1, Number(offlineHours) || 4);
      const until = new Date(Date.now() + hours * 60 * 60 * 1000);
      const res = await stadiumsApi.setOps(stadiumId, {
        mode: 'offline',
        offlineFrom: new Date().toISOString(),
        offlineUntil: until.toISOString(),
        reason: offlineReason.trim() || 'Xiran — ma shaqeeyo',
      });
      setStadium(res.stadium || res);
      Toast.show({
        type: 'success',
        text1: 'Dhamaan garoonka waa xiran',
        text2: `Dib u furmaya ~${hours} saacadood`,
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Offline', text2: e.message });
    } finally {
      setOpsBusy(false);
    }
  };

  const setFieldOnline = async (fieldId) => {
    setFieldOpsBusyId(String(fieldId));
    try {
      const res = await stadiumsApi.setFieldOps(fieldId, { mode: 'online' });
      const updated = res.field || res;
      setFields((prev) =>
        prev.map((f) => (String(f._id) === String(fieldId) ? { ...f, ...updated } : f))
      );
      Toast.show({ type: 'success', text1: 'Field keliya waa furan' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Field online', text2: e.message });
    } finally {
      setFieldOpsBusyId(null);
    }
  };

  const setFieldOffline = async (fieldId) => {
    setFieldOpsBusyId(String(fieldId));
    try {
      const hours = Math.max(1, Number(offlineHours) || 4);
      const until = new Date(Date.now() + hours * 60 * 60 * 1000);
      const res = await stadiumsApi.setFieldOps(fieldId, {
        mode: 'offline',
        offlineFrom: new Date().toISOString(),
        offlineUntil: until.toISOString(),
        reason: offlineReason.trim() || 'Field xiran',
      });
      const updated = res.field || res;
      setFields((prev) =>
        prev.map((f) => (String(f._id) === String(fieldId) ? { ...f, ...updated } : f))
      );
      Toast.show({
        type: 'success',
        text1: 'Field keliya waa xiran',
        text2: `Dib u furmaya ~${hours} saacadood`,
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Field offline', text2: e.message });
    } finally {
      setFieldOpsBusyId(null);
    }
  };

  const onSavePolicy = async () => {
    setSavingPolicy(true);
    try {
      const res = await ownerApi.updateStadiumPolicy(stadiumId, {
        rescheduleAllowed: true,
        freeRescheduleWindowHours: Number(policyForm.freeRescheduleWindowHours) || 24,
        rescheduleFee: Number(policyForm.rescheduleFee) || 0,
        minRescheduleNoticeHours: Number(policyForm.minRescheduleNoticeHours) || 6,
        cancelRefundPercent: Number(policyForm.cancelRefundPercent) || 100,
        policyNoticeSo: policyForm.policyNoticeSo.trim() || undefined,
      });
      setStadium((prev) => ({ ...prev, bookingPolicy: res.bookingPolicy }));
      Toast.show({ type: 'success', text1: 'Xeerka garoonka waa la keydiyay' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Keydintu way fashilantay', text2: e.message });
    } finally {
      setSavingPolicy(false);
    }
  };

  const uri = coverImage(stadium);
  const place = stadiumPlace(stadium);
  const hours = hoursLabel(stadium);

  return (
    <FadeIn>
      <View style={styles.screen}>
        {loading && !stadium ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 80 }} />
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.heroWrap}>
              {uri ? (
                <Image source={{ uri }} style={styles.hero} resizeMode="cover" />
              ) : (
                <View style={[styles.hero, styles.heroFallback]}>
                  <Ionicons name="football-outline" size={48} color="rgba(16,185,129,0.7)" />
                </View>
              )}
              <View style={styles.heroScrim} />
              <View style={[styles.heroNav, { paddingTop: Math.max(insets.top, 10) }]}>
                <Pressable onPress={() => navigation.goBack()} style={styles.heroNavBtn} hitSlop={8}>
                  <Ionicons name="chevron-back" size={22} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => navigation.navigate('StadiumForm', { stadiumId })}
                  style={styles.heroNavBtn}
                  hitSlop={8}
                >
                  <Ionicons name="create-outline" size={18} color="#fff" />
                </Pressable>
              </View>
              <View style={styles.heroCopy}>
                <View
                  style={[
                    styles.statusPill,
                    { backgroundColor: isOffline ? 'rgba(220,38,38,0.92)' : 'rgba(16,185,129,0.92)' },
                  ]}
                >
                  <Text style={styles.statusPillText}>{isOffline ? 'XIDHAN' : 'FURAN'}</Text>
                </View>
                <Text style={styles.heroName}>{stadium?.name || 'Garoon'}</Text>
                {!!place && (
                  <Text style={styles.heroPlace} numberOfLines={1}>
                    {place}
                  </Text>
                )}
                {hours ? <Text style={styles.heroHours}>{hours}</Text> : null}
              </View>
            </View>

            <View style={styles.pad}>
              {stadium?.subscriptionStatus?.isLocked ? (
                <View style={[styles.card, { backgroundColor: 'rgba(239, 68, 68, 0.12)', borderColor: '#ef4444', borderWidth: 1, marginBottom: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="lock-closed" size={18} color="#dc2626" style={{ marginRight: 6 }} />
                    <Text style={{ fontWeight: '800', color: '#dc2626', fontSize: 13 }}>SUBSCRIPTION XIDHAN</Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                    {stadium.subscriptionStatus.messageSo ||
                      `Garoonku wuu xidhan yahay maadaama subscription-ka bishan ($${stadium.subscriptionStatus.owedAmount}) aan la bixin kadib xilligii bilaashka ahaa.`}
                  </Text>
                </View>
              ) : stadium?.subscriptionStatus?.isGracePeriod ? (
                <View style={[styles.card, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: '#f59e0b', borderWidth: 1, marginBottom: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="time-outline" size={18} color="#d97706" style={{ marginRight: 6 }} />
                    <Text style={{ fontWeight: '800', color: '#d97706', fontSize: 13 }}>
                      XILLIGA BILAASHKA ({stadium.subscriptionStatus.graceDaysLeft} MAALMOOD AYAA HADHAY)
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
                    {stadium.subscriptionStatus.messageSo ||
                      `Waxaa kuu hadhay ${stadium.subscriptionStatus.graceDaysLeft} maalmood oo bilaash ah (Grace Period) inaad bixiso subscription-ka $${stadium.subscriptionStatus.owedAmount}.`}
                  </Text>
                </View>
              ) : null}

              <View style={styles.statCard}>
                <Stat label="Fields" value={String(fields.length)} colors={colors} />
                <View style={styles.statDiv} />
                <Stat label="Managers" value={String(managers.length)} colors={colors} />
                <View style={styles.statDiv} />
                <Stat label="Xidh" value={String(blocks.length)} colors={colors} />
              </View>

              <Text style={styles.section}>Maamul garoonka</Text>
              <View style={styles.manageGrid}>
                {[
                  { id: 'fields', icon: 'grid-outline', label: 'Fields', hint: 'Qiimo & furid' },
                  { id: 'ops', icon: 'cloud-outline', label: 'Furan', hint: 'Xidh / fur' },
                  { id: 'policy', icon: 'time-outline', label: 'Policy', hint: 'Beddelka & GMT' },
                  { id: 'managers', icon: 'people-outline', label: 'Managers', hint: 'Casuum' },
                  { id: 'xidh', icon: 'lock-closed-outline', label: 'Xidh', hint: 'Saacad' },
                  { id: 'joogto', icon: 'repeat-outline', label: 'Joogto', hint: 'Weekly' },
                  { id: 'qiimo', icon: 'pricetag-outline', label: 'Dhimis', hint: 'Discount' },
                  { id: 'cups', icon: 'trophy-outline', label: 'Cups', hint: 'Tournament' },
                ].map((p) => {
                  const on = panel === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setPanel(p.id)}
                      style={[styles.manageTile, on && styles.manageTileOn]}
                    >
                      <View style={[styles.manageIcon, on && styles.manageIconOn]}>
                        <Ionicons
                          name={p.icon}
                          size={18}
                          color={on ? colors.white : colors.brandGreen}
                        />
                      </View>
                      <Text style={[styles.manageLabel, on && styles.manageLabelOn]} numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Text style={[styles.manageHint, on && styles.manageHintOn]} numberOfLines={1}>
                        {p.hint}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.panelLift}>
              {panel === 'policy' ? (
                <Card>
                  <Text style={styles.fieldName}>Booking & Reschedule Policy</Text>
                  <Text style={styles.sectionHint}>
                    Xeerka beddelka waqtiga, ogeysiiska, iyo aagga waqtiga garoonka (Timezone).
                  </Text>

                  <TextField
                    label="Waqtiga Bilaashka ah (Saacado, e.g. 24)"
                    value={policyForm.freeRescheduleWindowHours}
                    onChangeText={(t) => setPolicyForm({ ...policyForm, freeRescheduleWindowHours: t })}
                    keyboardType="numeric"
                  />

                  <TextField
                    label="Kharashka Beddelka ($ USD, e.g. 0 ama 5)"
                    value={policyForm.rescheduleFee}
                    onChangeText={(t) => setPolicyForm({ ...policyForm, rescheduleFee: t })}
                    keyboardType="numeric"
                  />

                  <TextField
                    label="Ogeysiiska Ugu Yar (Saacado, e.g. 6)"
                    value={policyForm.minRescheduleNoticeHours}
                    onChangeText={(t) => setPolicyForm({ ...policyForm, minRescheduleNoticeHours: t })}
                    keyboardType="numeric"
                  />

                  <TextField
                    label="Lacag-celinta Kansalaashada (% Refund, e.g. 100)"
                    value={policyForm.cancelRefundPercent}
                    onChangeText={(t) => setPolicyForm({ ...policyForm, cancelRefundPercent: t })}
                    keyboardType="numeric"
                  />

                  <TextField
                    label="Fariinta Ogeysiiska Ee Ciyaartoyda (Af-Soomaali)"
                    value={policyForm.policyNoticeSo}
                    onChangeText={(t) => setPolicyForm({ ...policyForm, policyNoticeSo: t })}
                    placeholder="Qoraal gaar ah oo ku saabsan xeerka ballanka..."
                  />

                  <View style={{ marginTop: 8, padding: 10, borderRadius: radii.md, backgroundColor: 'rgba(16,185,129,0.08)' }}>
                    <Text style={{ ...typography.caption, fontWeight: '700', color: colors.brandGreen }}>
                      Aagga Waqtiga: Africa/Mogadishu (GMT+3 / EAT)
                    </Text>
                    <Text style={{ ...typography.caption, color: colors.muted, marginTop: 2 }}>
                      Dhammaan boosaska waxaa loo xisaabiyaa waqtiga maxalliga ah ee garoonka.
                    </Text>
                  </View>

                  <Button
                    title="Keydi Xeerka Garoonka"
                    onPress={onSavePolicy}
                    loading={savingPolicy}
                    style={{ marginTop: 14 }}
                  />
                </Card>
              ) : null}
              {panel === 'ops' ? (
                <Card>
                  <Text style={styles.fieldName}>
                    {isOffline ? 'Garoonka waa xidhan' : 'Garoonka waa furan'}
                  </Text>
                  <Text style={styles.sectionHint}>
                    Xidhitaankani wuxuu xidhayaa dhammaan fields-ka.
                  </Text>
                  {isOffline ? (
                    <Text style={styles.opsMsg}>
                      {ops?.messageSo || 'Garoonku wuu xidhan yahay'}
                      {reopenSecs != null
                        ? `\nDib u furmaya: ${Math.floor(reopenSecs / 3600)}s ${Math.floor(
                            (reopenSecs % 3600) / 60
                          )}d`
                        : ''}
                    </Text>
                  ) : null}
                  {!isOffline ? (
                    <View style={{ marginTop: 10 }}>
                      <TextField
                        label="Saacado (dib u furid)"
                        value={offlineHours}
                        onChangeText={setOfflineHours}
                        keyboardType="number-pad"
                        placeholder="4"
                      />
                      <TextField
                        label="Sabab"
                        value={offlineReason}
                        onChangeText={setOfflineReason}
                        placeholder="Dayactir / roob"
                      />
                      <Button
                        title="Xidh garoonka"
                        variant="outline"
                        loading={opsBusy}
                        onPress={setOffline}
                      />
                    </View>
                  ) : (
                    <Button
                      title="Fur garoonka"
                      loading={opsBusy}
                      onPress={setOnline}
                      style={{ marginTop: 10 }}
                    />
                  )}
                </Card>
              ) : null}

              {panel === 'fields' ? (
              <>
              {/* Fields */}
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Fields</Text>
                <Pressable
                  onPress={() => navigation.navigate('FieldForm', { stadiumId })}
                >
                  <Text style={styles.link}>+ Ku dar</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionHint}>Fur ama xidh field mid keliya.</Text>
              {!fields.length ? (
                <Card>
                  <Text style={styles.muted}>
                    Field ma jiro. Ku dar: type (5v5…11v11), images, pricePerPlayer × capacity.
                  </Text>
                </Card>
              ) : (
                fields.map((f) => {
                  const fOps = f.ops;
                  const fOffline = fOps && fOps.bookable === false;
                  const busy = fieldOpsBusyId === String(f._id);
                  return (
                    <Card key={String(f._id)}>
                      <View style={styles.rowBetween}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={styles.fieldName}>{f.name}</Text>
                          {fOffline ? (
                            <View style={styles.offlineBadge}>
                              <Text style={styles.offlineBadgeText}>OFFLINE</Text>
                            </View>
                          ) : null}
                        </View>
                        <Pressable
                          onPress={() =>
                            navigation.navigate('FieldForm', {
                              stadiumId,
                              fieldId: f._id,
                            })
                          }
                        >
                          <Text style={styles.link}>Beddel</Text>
                        </Pressable>
                      </View>
                      <Text style={styles.fieldMeta}>
                        {f.type} · {f.capacity}v{f.capacity}
                      </Text>
                      <Text style={styles.price}>{fieldPriceLabel(f)}</Text>
                      {hoursLabel(f) ? (
                        <Text style={styles.muted}>Saacadaha: {hoursLabel(f)}</Text>
                      ) : null}
                      {fOffline && fOps?.messageSo ? (
                        <Text style={styles.opsMsg}>{fOps.messageSo}</Text>
                      ) : null}
                      <View style={{ marginTop: 10 }}>
                        {fOffline ? (
                          <Button
                            title="Fur field"
                            loading={busy}
                            onPress={() => setFieldOnline(f._id)}
                          />
                        ) : (
                          <Button
                            title="Xidh field"
                            variant="outline"
                            loading={busy}
                            onPress={() => setFieldOffline(f._id)}
                          />
                        )}
                      </View>
                    </Card>
                  );
                })
              )}
              </>
              ) : null}

              {panel === 'managers' ? (
              <>
              {/* Managers */}
              <Text style={styles.section}>Managers</Text>
              <Text style={styles.sectionHint}>Casuum ama ka saar. Manager ma tirtiri karo garoonka.</Text>
              {managers.map((m) => {
                const u = m.user || {};
                const id = m._id || m.id;
                return (
                  <Card key={String(id)}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldName}>{u.name || 'Manager'}</Text>
                        <Text style={styles.muted}>{u.email || u.phone || ''}</Text>
                      </View>
                      <Pressable onPress={() => onRevoke(id, u.name)} hitSlop={8}>
                        <Text style={styles.danger}>Ka saar</Text>
                      </Pressable>
                    </View>
                  </Card>
                );
              })}
              {!managers.length ? (
                <Text style={[styles.muted, { marginBottom: 8 }]}>Weli manager ma jiro.</Text>
              ) : null}

              {inviteOpen ? (
                <Card>
                  <TextField
                    label="Email"
                    value={invite.email}
                    onChangeText={(email) => setInvite((p) => ({ ...p, email }))}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                  <TextField
                    label="Magaca (cusub)"
                    value={invite.name}
                    onChangeText={(name) => setInvite((p) => ({ ...p, name }))}
                  />
                  <TextField
                    label="Password (akoonta cusub)"
                    value={invite.password}
                    onChangeText={(password) => setInvite((p) => ({ ...p, password }))}
                    secureTextEntry
                  />
                  <Button title="Casuum" loading={inviting} onPress={onInvite} />
                  <Button
                    title="Jooji"
                    variant="outline"
                    onPress={() => setInviteOpen(false)}
                    style={{ marginTop: 8 }}
                  />
                </Card>
              ) : (
                <Button
                  title="Casuum manager"
                  variant="outline"
                  onPress={() => setInviteOpen(true)}
                  style={{ marginBottom: 12 }}
                />
              )}
              </>
              ) : null}

              {panel === 'qiimo' ? (
              <>
              {/* Discounts */}
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Discounts</Text>
                <Pressable onPress={() => setDiscountOpen((v) => !v)}>
                  <Text style={styles.link}>{discountOpen ? 'Jooji' : '+ Ku dar'}</Text>
                </Pressable>
              </View>
              {discountOpen ? (
                <Card>
                  <TextField
                    label="Magaca"
                    value={discountForm.name}
                    onChangeText={(name) => setDiscountForm((p) => ({ ...p, name }))}
                  />
                  <TextField
                    label="% dhimis"
                    value={discountForm.percentOff}
                    onChangeText={(percentOff) =>
                      setDiscountForm((p) => ({ ...p, percentOff }))
                    }
                    keyboardType="number-pad"
                  />
                  <Text style={styles.muted}>Field (ikhtiyaari — dhammaan haddii madhan)</Text>
                  <View style={styles.chips}>
                    <Chip
                      label="Dhammaan"
                      selected={!discountForm.fieldId}
                      onPress={() => setDiscountForm((p) => ({ ...p, fieldId: '' }))}
                      style={styles.chip}
                    />
                    {fields.map((f) => (
                      <Chip
                        key={String(f._id)}
                        label={f.name}
                        selected={discountForm.fieldId === String(f._id)}
                        onPress={() =>
                          setDiscountForm((p) => ({ ...p, fieldId: String(f._id) }))
                        }
                        style={styles.chip}
                      />
                    ))}
                  </View>
                  <Chip
                    label={
                      discountForm.applyToAllSlots
                        ? 'Dhammaan slots'
                        : 'Saacad gaar ah'
                    }
                    selected={discountForm.applyToAllSlots}
                    onPress={() =>
                      setDiscountForm((p) => ({
                        ...p,
                        applyToAllSlots: !p.applyToAllSlots,
                      }))
                    }
                    style={[styles.chip, { marginBottom: 10 }]}
                  />
                  {!discountForm.applyToAllSlots ? (
                    <View style={styles.row2}>
                      <TextField
                        label="Bilow"
                        value={discountForm.startTimeLocal}
                        onChangeText={(startTimeLocal) =>
                          setDiscountForm((p) => ({ ...p, startTimeLocal }))
                        }
                        style={{ flex: 1 }}
                      />
                      <TextField
                        label="Dhammaad"
                        value={discountForm.endTimeLocal}
                        onChangeText={(endTimeLocal) =>
                          setDiscountForm((p) => ({ ...p, endTimeLocal }))
                        }
                        style={{ flex: 1 }}
                      />
                    </View>
                  ) : null}
                  <Button
                    title="Abuur discount"
                    loading={savingDiscount}
                    onPress={onCreateDiscount}
                  />
                </Card>
              ) : null}
              {!discounts.length ? (
                <Text style={[styles.muted, { marginBottom: 8 }]}>Discount ma jiro.</Text>
              ) : (
                discounts.map((d) => (
                  <Card key={String(d._id)}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldName}>{d.name}</Text>
                        <Text style={styles.muted}>
                          {d.percentOff != null
                            ? `${d.percentOff}%`
                            : d.amountOff != null
                              ? `$${d.amountOff}`
                              : '—'}
                          {d.field?.name ? ` · ${d.field.name}` : ' · dhammaan fields'}
                        </Text>
                      </View>
                      <Pressable onPress={() => onDeleteDiscount(d._id)}>
                        <Text style={styles.danger}>Tirtir</Text>
                      </Pressable>
                    </View>
                  </Card>
                ))
              )}
              </>
              ) : null}

              {panel === 'xidh' ? (
              <>
              {/* Stadium-wide lock */}
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Xidh garoonka</Text>
                <Pressable onPress={() => setLockOpen((v) => !v)}>
                  <Text style={styles.link}>{lockOpen ? 'Jooji' : '+ Xir'}</Text>
                </Pressable>
              </View>
              <Text style={styles.sectionHint}>Maanta ma shaqeeyo — dhammaan fields waa xiran.</Text>
              {lockOpen ? (
                <Card>
                  <TextField
                    label="Taariikh (YYYY-MM-DD)"
                    value={lockForm.date}
                    onChangeText={(date) => setLockForm((p) => ({ ...p, date }))}
                    placeholder={todayYmd()}
                    autoCapitalize="none"
                  />
                  <View style={styles.chips}>
                    <Chip
                      label="Maalin dhan"
                      selected={lockForm.allDay}
                      onPress={() => setLockForm((p) => ({ ...p, allDay: true }))}
                      style={styles.chip}
                    />
                    <Chip
                      label="Saacado"
                      selected={!lockForm.allDay}
                      onPress={() => setLockForm((p) => ({ ...p, allDay: false }))}
                      style={styles.chip}
                    />
                  </View>
                  {!lockForm.allDay ? (
                    <View style={styles.row2}>
                      <TextField
                        label="Bilow"
                        value={lockForm.startTime}
                        onChangeText={(startTime) =>
                          setLockForm((p) => ({ ...p, startTime }))
                        }
                        style={{ flex: 1 }}
                      />
                      <TextField
                        label="Dhammaad"
                        value={lockForm.endTime}
                        onChangeText={(endTime) => setLockForm((p) => ({ ...p, endTime }))}
                        style={{ flex: 1 }}
                      />
                    </View>
                  ) : null}
                  <Text style={styles.muted}>Nooca</Text>
                  <View style={styles.chips}>
                    {BLOCK_TYPES.map((t) => (
                      <Chip
                        key={t.id}
                        label={t.label}
                        selected={lockForm.type === t.id}
                        onPress={() => setLockForm((p) => ({ ...p, type: t.id }))}
                        style={styles.chip}
                      />
                    ))}
                  </View>
                  <TextField
                    label="Sabab"
                    value={lockForm.reason}
                    onChangeText={(reason) => setLockForm((p) => ({ ...p, reason }))}
                  />
                  <Button
                    title="Xir garoonka oo dhan"
                    loading={savingLock}
                    onPress={onLockStadium}
                  />
                </Card>
              ) : null}

              {/* Blocks */}
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Blocks (field / roob / dhismo)</Text>
                <Pressable onPress={() => setBlockOpen((v) => !v)}>
                  <Text style={styles.link}>{blockOpen ? 'Jooji' : '+ Ku dar'}</Text>
                </Pressable>
              </View>
              {blockOpen ? (
                <Card>
                  <Text style={styles.muted}>Field</Text>
                  <View style={styles.chips}>
                    {fields.map((f) => (
                      <Chip
                        key={String(f._id)}
                        label={f.name}
                        selected={blockForm.fieldId === String(f._id)}
                        onPress={() =>
                          setBlockForm((p) => ({ ...p, fieldId: String(f._id) }))
                        }
                        style={styles.chip}
                      />
                    ))}
                  </View>
                  <Text style={styles.muted}>Nooca</Text>
                  <View style={styles.chips}>
                    {BLOCK_TYPES.map((t) => (
                      <Chip
                        key={t.id}
                        label={t.label}
                        selected={blockForm.type === t.id}
                        onPress={() => setBlockForm((p) => ({ ...p, type: t.id }))}
                        style={styles.chip}
                      />
                    ))}
                  </View>
                  <TextField
                    label="Taariikh (YYYY-MM-DD)"
                    value={blockForm.date}
                    onChangeText={(date) => setBlockForm((p) => ({ ...p, date }))}
                    placeholder="2026-08-25"
                    autoCapitalize="none"
                  />
                  <View style={styles.row2}>
                    <TextField
                      label="Bilow"
                      value={blockForm.startTime}
                      onChangeText={(startTime) =>
                        setBlockForm((p) => ({ ...p, startTime }))
                      }
                      style={{ flex: 1 }}
                    />
                    <TextField
                      label="Dhammaad"
                      value={blockForm.endTime}
                      onChangeText={(endTime) => setBlockForm((p) => ({ ...p, endTime }))}
                      style={{ flex: 1 }}
                    />
                  </View>
                  <TextField
                    label="Sabab"
                    value={blockForm.reason}
                    onChangeText={(reason) => setBlockForm((p) => ({ ...p, reason }))}
                  />
                  <Button title="Abuur block" loading={savingBlock} onPress={onCreateBlock} />
                </Card>
              ) : null}
              {!blocks.length ? (
                <Text style={[styles.muted, { marginBottom: 8 }]}>Block ma jiro.</Text>
              ) : (
                blocks.map((b) => (
                  <Card key={String(b._id)}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldName}>
                          {b.scope === 'stadium'
                            ? `🔒 Dhammaan garoonka · ${b.type}`
                            : `${b.type} · ${b.field?.name || 'Field'}`}
                        </Text>
                        <Text style={styles.muted}>
                          {formatWhen(b.startsAt)} → {formatWhen(b.endsAt)}
                        </Text>
                        {b.reason ? <Text style={styles.muted}>{b.reason}</Text> : null}
                      </View>
                      <Pressable onPress={() => onDeleteBlock(b._id)}>
                        <Text style={styles.danger}>Tirtir</Text>
                      </Pressable>
                    </View>
                  </Card>
                ))
              )}
              </>
              ) : null}

              {panel === 'joogto' ? (
              <>
              {/* Recurring */}
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Permanent weekly</Text>
                <Pressable
                  onPress={() => {
                    if (recOpen) {
                      resetRecForm();
                      setRecOpen(false);
                    } else {
                      setRecOpen(true);
                    }
                  }}
                >
                  <Text style={styles.link}>{recOpen ? 'Jooji' : '+ Ku dar'}</Text>
                </Pressable>
              </View>
              {recOpen ? (
                <Card>
                  <TextField
                    label="Magaca kooxda (tusaale Doctors)"
                    value={recForm.teamName}
                    onChangeText={(teamName) => setRecForm((p) => ({ ...p, teamName }))}
                  />
                  <Text style={styles.muted}>Field</Text>
                  <View style={styles.chips}>
                    {fields.map((f) => (
                      <Chip
                        key={String(f._id)}
                        label={f.name}
                        selected={recForm.fieldId === String(f._id)}
                        onPress={() =>
                          setRecForm((p) => ({ ...p, fieldId: String(f._id) }))
                        }
                        style={styles.chip}
                      />
                    ))}
                  </View>
                  <Text style={styles.muted}>Maalinta toddobaadka</Text>
                  <View style={styles.chips}>
                    {WEEKDAYS_SO.map((label, idx) => (
                      <Chip
                        key={label}
                        label={label}
                        selected={Number(recForm.dayOfWeek) === idx}
                        onPress={() => setRecForm((p) => ({ ...p, dayOfWeek: idx }))}
                        style={styles.chip}
                      />
                    ))}
                  </View>
                  <View style={styles.row2}>
                    <TextField
                      label="Bilow"
                      value={recForm.startTimeLocal}
                      onChangeText={(startTimeLocal) =>
                        setRecForm((p) => ({ ...p, startTimeLocal }))
                      }
                      style={{ flex: 1 }}
                    />
                    <TextField
                      label="Dhammaad"
                      value={recForm.endTimeLocal}
                      onChangeText={(endTimeLocal) =>
                        setRecForm((p) => ({ ...p, endTimeLocal }))
                      }
                      style={{ flex: 1 }}
                    />
                  </View>
                  <TextField
                    label="Xusuusin"
                    value={recForm.note}
                    onChangeText={(note) => setRecForm((p) => ({ ...p, note }))}
                  />
                  <Button
                    title={editingRecurring ? 'Kaydi isbeddel' : 'Kaydi joogto'}
                    loading={savingRec}
                    onPress={onSaveRecurring}
                  />
                </Card>
              ) : null}
              {recurring.map((r) => (
                <Card key={String(r._id)}>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fieldName}>
                        {r.teamName || 'Koox'} · {WEEKDAYS_SO[r.dayOfWeek] || `Maalin ${r.dayOfWeek}`}
                      </Text>
                      <Text style={styles.muted}>
                        {r.startTimeLocal}–{r.endTimeLocal}
                        {r.field?.name ? ` · ${r.field.name}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Pressable onPress={() => startEditRecurring(r)}>
                        <Text style={styles.link}>Wax ka beddel</Text>
                      </Pressable>
                      <Pressable onPress={() => onDeleteRecurring(r._id)}>
                        <Text style={styles.danger}>Tirtir</Text>
                      </Pressable>
                    </View>
                  </View>
                </Card>
              ))}
              {!recurring.length ? (
                <Text style={[styles.muted, { marginBottom: 8 }]}>
                  Permanent weekly ma jiro. Tusaale: health doctors Jimce 20:00–21:00.
                </Text>
              ) : null}
              </>
              ) : null}

              {panel === 'cups' ? (
              <>
              {/* Cups */}
              <View style={styles.sectionRow}>
                <Text style={styles.section}>Cups / tournaments</Text>
                <Pressable onPress={() => navigation.navigate('CupForm', { stadiumId })}>
                  <Text style={styles.link}>+ Abuur</Text>
                </Pressable>
              </View>
              {!cups.length ? (
                <Card>
                  <Text style={styles.muted}>
                    Cup ma jiro. Abuur: N teams, fee, winner gift — slots TOURNAMENT ayaa
                    xannibaya booking-ga.
                  </Text>
                </Card>
              ) : (
                cups.map((t) => (
                  <Card key={String(t._id)}>
                    <Pressable onPress={() => openCup(t)}>
                      <Text style={styles.fieldName}>{t.name}</Text>
                      <Text style={styles.muted}>
                        {t.status || 'draft'} · max {t.maxTeams || t.numberOfTeams || '—'} teams
                        {t.registrationFee != null ? ` · fee $${t.registrationFee}` : ''}
                      </Text>
                      <Text style={[styles.link, { marginTop: 6 }]}>Fixtures / groups</Text>
                    </Pressable>
                  </Card>
                ))
              )}

              {cupDetail ? (
                <Card>
                  <View style={styles.rowBetween}>
                    <Text style={styles.fieldName}>
                      {cupDetail.tournament?.name || 'Cup detail'}
                    </Text>
                    <Pressable onPress={() => setCupDetail(null)}>
                      <Text style={styles.link}>Xir</Text>
                    </Pressable>
                  </View>
                  <Text style={styles.muted}>
                    Teams: {(cupDetail.teams || []).length} · Fixtures:{' '}
                    {(cupDetail.fixtures || []).length}
                  </Text>
                  {(cupDetail.standings || []).slice(0, 8).map((s, i) => (
                    <Text key={`${s.teamId || i}`} style={styles.muted}>
                      {s.group ? `G${s.group} ` : ''}
                      {s.teamName || s.teamId} · PTS {s.PTS ?? s.pts ?? 0}
                    </Text>
                  ))}
                  {(cupDetail.fixtures || []).slice(0, 6).map((fx) => (
                    <Text key={String(fx._id)} style={styles.muted}>
                      {fx.round || 'FX'}: {fx.homeTeam?.name || fx.homeTeam || '?'} vs{' '}
                      {fx.awayTeam?.name || fx.awayTeam || '?'}
                    </Text>
                  ))}
                  <Text style={[styles.muted, { marginTop: 8 }]}>
                    Assign groups / natiijooyin — web Owner Tournaments.
                  </Text>
                </Card>
              ) : null}
              </>
              ) : null}
              </View>
            </View>
          </ScrollView>
        )}
      </View>
    </FadeIn>
  );
}

function Stat({ label, value, colors }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: colors.brandGreen }}>{value}</Text>
      <Text style={{ marginTop: 2, fontSize: 11, color: colors.muted, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

function makeStyles(colors, shadows) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { paddingBottom: 48 },
    pad: { paddingHorizontal: spacing.md, marginTop: -36 },
    heroWrap: {
      height: 292,
      backgroundColor: colors.brandNavy,
      overflow: 'hidden',
    },
    hero: { width: '100%', height: '100%' },
    heroFallback: { alignItems: 'center', justifyContent: 'center' },
    heroScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(30,36,51,0.42)',
    },
    heroNav: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      zIndex: 2,
    },
    heroNavBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'rgba(30,36,51,0.55)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroCopy: {
      position: 'absolute',
      left: 18,
      right: 18,
      bottom: 52,
    },
    statusPill: {
      alignSelf: 'flex-start',
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 8,
    },
    statusPillText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1.1,
    },
    heroName: {
      fontSize: 28,
      fontWeight: '800',
      color: '#fff',
      letterSpacing: -0.4,
    },
    heroPlace: {
      marginTop: 4,
      fontSize: 14,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.88)',
    },
    heroHours: {
      marginTop: 4,
      fontSize: 12,
      fontWeight: '700',
      color: 'rgba(16,185,129,0.95)',
    },
    statCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      paddingHorizontal: 8,
      marginBottom: 18,
      ...shadows.lifted,
    },
    statDiv: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    manageGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 14,
    },
    manageTile: {
      width: '47.5%',
      maxWidth: '48.5%',
      flexGrow: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 18,
      paddingVertical: 14,
      paddingHorizontal: 12,
      ...shadows.soft,
    },
    manageTileOn: {
      backgroundColor: colors.brandNavy,
      borderColor: colors.brandNavy,
      ...shadows.card,
    },
    manageIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: colors.surfaceInset,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    manageIconOn: {
      backgroundColor: 'rgba(16,185,129,0.22)',
    },
    manageLabel: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    manageLabelOn: { color: '#fff' },
    manageHint: {
      marginTop: 2,
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
    },
    manageHintOn: { color: 'rgba(255,255,255,0.72)' },
    panelLift: {
      paddingBottom: 4,
    },
    muted: { ...typography.caption, color: colors.muted, lineHeight: 18 },
    opsScope: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.muted,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    opsHint: {
      marginTop: 6,
      ...typography.caption,
      color: colors.muted,
      lineHeight: 17,
    },
    opsMsg: {
      marginTop: 8,
      ...typography.caption,
      color: '#DC2626',
      lineHeight: 18,
    },
    offlineBadge: {
      backgroundColor: '#FEE2E2',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
    },
    offlineBadgeText: {
      color: '#DC2626',
      fontSize: 10,
      fontWeight: '800',
    },
    section: {
      marginTop: 8,
      marginBottom: 8,
      fontSize: 15,
      fontWeight: '800',
      color: colors.brandNavy,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 4,
    },
    sectionHint: {
      marginBottom: 8,
      ...typography.caption,
      color: colors.muted,
    },
    fieldName: { fontSize: 16, fontWeight: '700', color: colors.text },
    fieldMeta: { marginTop: 4, fontSize: 13, color: colors.muted },
    price: { marginTop: 8, fontWeight: '700', color: colors.brandGreen, fontSize: 13 },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    row2: { flexDirection: 'row', gap: 10 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10, marginTop: 4 },
    chip: { minWidth: 0, flexGrow: 0 },
    link: { color: colors.brandGreen, fontWeight: '700', fontSize: 13 },
    danger: { color: colors.statusCancelled, fontWeight: '700', fontSize: 13 },
  });
}
