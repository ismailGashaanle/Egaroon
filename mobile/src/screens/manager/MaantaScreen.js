import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import StaffHero from '../../components/StaffHero';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Chip from '../../components/Chip';
import NotificationRow from '../../components/NotificationRow';
import OwnerBookingFaahfaahinCard from '../../components/OwnerBookingFaahfaahinCard';
import { ownerApi } from '../../api/owner';
import { stadiumsApi } from '../../api/stadiums';
import { notificationsApi } from '../../api/notifications';
import { useTheme } from '../../context/ThemeContext';
import { formatWhen } from '../../lib/ownerDisplay';
import { spacing, typography, radii } from '../../theme';

const BLOCK_TYPES = [
  { id: 'weather', label: 'Roob' },
  { id: 'maintenance', label: 'Dayactir' },
  { id: 'holiday', label: 'Fasax' },
  { id: 'private_event', label: 'Private' },
];

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function MaantaScreen() {
  const navigation = useNavigation();
  const { colors, shadows } = useTheme();
  const styles = makeStyles(colors, shadows);

  const [bookings, setBookings] = useState([]);
  const [cards, setCards] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stadiums, setStadiums] = useState([]);
  const [fields, setFields] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [blockOpen, setBlockOpen] = useState(false);
  const [savingBlock, setSavingBlock] = useState(false);
  const [blockForm, setBlockForm] = useState({
    stadiumId: '',
    fieldId: '',
    type: 'weather',
    date: '',
    startTime: '08:00',
    endTime: '12:00',
    reason: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ymd = (() => {
        const d = new Date();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${d.getFullYear()}-${m}-${day}`;
      })();
      const data = await ownerApi.listBookings({ date: ymd });
      setBookings(data.bookings || []);
      setCards(data.cards || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Ballamaha maanta', text2: e.message });
    }
    try {
      const n = await notificationsApi.list();
      setNotifications((n.notifications || []).slice(0, 8));
    } catch {
      setNotifications([]);
    }
    try {
      const s = await stadiumsApi.mine();
      const list = s.stadiums || [];
      setStadiums(list);
      if (list[0]) {
        const sid = String(list[0]._id);
        setBlockForm((p) => (p.stadiumId ? p : { ...p, stadiumId: sid }));
        const fRes = await stadiumsApi.listFields(sid).catch(() => ({ fields: [] }));
        const fl = fRes.fields || [];
        setFields(fl);
        if (fl[0]) {
          setBlockForm((p) => (p.fieldId ? p : { ...p, fieldId: String(fl[0]._id) }));
        }
        const bRes = await stadiumsApi
          .listBlocks(sid, { upcoming: 1 })
          .catch(() => ({ blocks: [] }));
        setBlocks(bRes.blocks || []);
      }
    } catch {
      setStadiums([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onSelectStadium = async (stadiumId) => {
    setBlockForm((p) => ({ ...p, stadiumId, fieldId: '' }));
    try {
      const fRes = await stadiumsApi.listFields(stadiumId);
      const fl = fRes.fields || [];
      setFields(fl);
      if (fl[0]) setBlockForm((p) => ({ ...p, fieldId: String(fl[0]._id) }));
      const bRes = await stadiumsApi.listBlocks(stadiumId, { upcoming: 1 });
      setBlocks(bRes.blocks || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Fields', text2: e.message });
    }
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
      if (blockForm.stadiumId) {
        const bRes = await stadiumsApi.listBlocks(blockForm.stadiumId, { upcoming: 1 });
        setBlocks(bRes.blocks || []);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Block', text2: e.message });
    } finally {
      setSavingBlock(false);
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

  const today = useMemo(() => {
    if (cards.length) {
      return cards.map((c, i) => ({ card: c, booking: bookings[i] }));
    }
    return bookings
      .filter((b) => isToday(b.startTime))
      .map((b) => ({ card: null, booking: b }));
  }, [bookings, cards]);

  const listData = useMemo(() => {
    const rows = [];
    rows.push({ _kind: 'ops', id: 'ops' });
    rows.push({ _kind: 'search', id: 'search' });
    if (notifications.length) {
      rows.push({ _kind: 'section', id: 'sec-n', title: 'Ogeysiisyada' });
      notifications.forEach((n) =>
        rows.push({ _kind: 'notification', id: `n-${n._id || n.id}`, item: n })
      );
    }
    rows.push({ _kind: 'section', id: 'sec-b', title: 'Ballamaha maanta' });
    if (!today.length) {
      rows.push({ _kind: 'empty', id: 'empty-b' });
    } else {
      today.forEach((row, i) =>
        rows.push({
          _kind: 'booking',
          id: `b-${row.card?.bookingId || row.booking?._id || i}`,
          item: row,
        })
      );
    }
    return rows;
  }, [notifications, today]);

  return (
    <FadeIn>
      <View style={styles.screen}>
        <StaffHero
          kicker="Maanta"
          title="Maalintaada"
          subtitle="Ballamo · blocks · ogeysiis"
        >
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{today.length}</Text>
              <Text style={styles.heroStatL}>Ballamo</Text>
            </View>
            <View style={styles.heroStatDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{blocks.length}</Text>
              <Text style={styles.heroStatL}>Xidh</Text>
            </View>
            <View style={styles.heroStatDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{notifications.length}</Text>
              <Text style={styles.heroStatL}>Ogeysiis</Text>
            </View>
          </View>
        </StaffHero>
        {loading && !today.length && !notifications.length ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(row) => row.id}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={styles.list}
            renderItem={({ item: row }) => {
              if (row._kind === 'ops') {
                return (
                  <Card style={{ marginBottom: 12 }}>
                    <Text style={styles.opsTitle}>Xidh saacad (block)</Text>
                    <Text style={styles.hint}>Roob ama dayactir — xidh field wakhti gaar ah.</Text>
                    <Button
                      title={blockOpen ? 'Jooji form' : '+ Ku dar block'}
                      variant="outline"
                      onPress={() => setBlockOpen((v) => !v)}
                    />
                    {blockOpen ? (
                      <View style={{ marginTop: 12 }}>
                        {stadiums.length > 1 ? (
                          <>
                            <Text style={styles.muted}>Garoon</Text>
                            <View style={styles.chips}>
                              {stadiums.map((s) => (
                                <Chip
                                  key={String(s._id)}
                                  label={s.name}
                                  selected={blockForm.stadiumId === String(s._id)}
                                  onPress={() => onSelectStadium(String(s._id))}
                                  style={styles.chip}
                                />
                              ))}
                            </View>
                          </>
                        ) : null}
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
                            onChangeText={(endTime) =>
                              setBlockForm((p) => ({ ...p, endTime }))
                            }
                            style={{ flex: 1 }}
                          />
                        </View>
                        <TextField
                          label="Sabab"
                          value={blockForm.reason}
                          onChangeText={(reason) =>
                            setBlockForm((p) => ({ ...p, reason }))
                          }
                        />
                        <Button
                          title="Abuur block"
                          loading={savingBlock}
                          onPress={onCreateBlock}
                        />
                      </View>
                    ) : null}
                    {blocks.slice(0, 4).map((b) => (
                      <View key={String(b._id)} style={styles.blockRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.blockName}>
                            {b.type} · {b.field?.name || 'Field'}
                          </Text>
                          <Text style={styles.muted}>{formatWhen(b.startsAt)}</Text>
                        </View>
                        <Button
                          title="Tirtir"
                          variant="danger"
                          onPress={() => onDeleteBlock(b._id)}
                          style={styles.deleteBtn}
                          textStyle={{ fontSize: 12 }}
                        />
                      </View>
                    ))}
                  </Card>
                );
              }
              if (row._kind === 'search') {
                return (
                    <Button
                      title="Raadi ballan"
                      variant="outline"
                      onPress={() => navigation.navigate('BookingsSearch')}
                      style={{ marginBottom: 12 }}
                    />
                );
              }
              if (row._kind === 'section') {
                return <Text style={styles.section}>{row.title}</Text>;
              }
              if (row._kind === 'empty') {
                return <Text style={styles.empty}>Maanta ballan ma jiro.</Text>;
              }
              if (row._kind === 'notification') {
                const n = row.item;
                return (
                  <NotificationRow
                    title={n.title || n.type || 'Ogeysiis'}
                    body={n.body || n.message || ''}
                    time={formatWhen(n.createdAt || n.updatedAt)}
                  />
                );
              }
              const { card, booking } = row.item;
              const id = card?.bookingId || booking?._id;
              return (
                <OwnerBookingFaahfaahinCard
                  card={card}
                  booking={booking}
                  compact
                  showQr={false}
                  onPress={() =>
                    id &&
                    navigation.navigate('OwnerBookingDetail', {
                      bookingId: String(id),
                    })
                  }
                />
              );
            }}
          />
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
    heroStatDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.18)' },
    list: { paddingHorizontal: spacing.md, paddingBottom: 28, marginTop: -18 },
    opsTitle: { fontSize: 15, fontWeight: '800', color: colors.text, marginBottom: 4 },
    hint: { ...typography.caption, color: colors.muted, marginBottom: 10, lineHeight: 18 },
    muted: { ...typography.caption, color: colors.muted, marginBottom: 4 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    chip: { minWidth: 0, flexGrow: 0 },
    row2: { flexDirection: 'row', gap: 10 },
    blockRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    blockName: { fontWeight: '700', color: colors.text, fontSize: 13 },
    deleteBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: radii.sm },
    section: {
      ...typography.caption,
      fontWeight: '700',
      color: colors.brandNavy,
      marginBottom: 8,
      marginTop: 4,
    },
    empty: {
      textAlign: 'center',
      color: colors.muted,
      marginBottom: 16,
      marginTop: 8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    name: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      flex: 1,
      paddingRight: 8,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    when: { marginTop: 6, ...typography.caption, color: colors.muted },
    code: { marginTop: 8, fontWeight: '700', color: colors.brandGreen },
  });
}
