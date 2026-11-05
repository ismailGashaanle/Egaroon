import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import { bookingsApi } from '../../api/bookings';
import { statusColor } from '../../lib/roles';
import { bookingStatusLabel } from '../../lib/bookingStatus';
import { colors, typography, radii, spacing } from '../../theme';

export default function BallamoScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [joogtoCards, setJoogtoCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lookup, setLookup] = useState('');
  const [showQrMap, setShowQrMap] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, joogtoRes] = await Promise.all([
        bookingsApi.mine(),
        bookingsApi.getJoogtoCards().catch(() => ({ memberships: [] })),
      ]);
      setBookings(data.bookings || []);
      setJoogtoCards(joogtoRes?.memberships || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Ballamaha lama soo qaadin', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onLookup = async () => {
    const code = lookup.trim().toUpperCase().replace(/\s+/g, '');
    if (!code) {
      Toast.show({ type: 'info', text1: 'Geli tixraac / Match Code' });
      return;
    }
    if (/^SG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
      navigation.navigate('JoinMatchCode', { prefill: code });
      return;
    }
    const found = bookings.find(
      (b) =>
        String(b.bookingCode || '').toUpperCase() === code ||
        String(b.matchCode || '').toUpperCase() === code
    );
    if (found) {
      navigation.navigate('BookingDetail', { bookingId: found._id });
      return;
    }
    Toast.show({
      type: 'error',
      text1: 'Tixraac lama helin',
      text2: 'Ama isticmaal Join with code (SG-XXXX-XXXX)',
    });
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Ballamo" subtitle="Tixraacyadaada" variant="green" />
        {loading && !bookings.length ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => String(item._id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <>
                {joogtoCards.map((card) => {
                  const isOk = card.cardStatus === 'active';
                  const isGrace = card.cardStatus === 'grace_period';
                  const badgeColor = isOk ? '#059669' : isGrace ? '#d97706' : '#dc2626';
                  const badgeText = isOk
                    ? 'FIRFIRCOON'
                    : isGrace
                    ? `MUDDO-DHAAF (${card.daysRemainingInGrace || 0}d)`
                    : 'XIDHAN / DHACAY';
                  const isQrOpen = Boolean(showQrMap[card._id]);
                  const qrPayload = JSON.stringify({
                    type: 'joogto_card',
                    cardNumber: card.cardNumber,
                    token: card.qrSignature,
                    pin: card.securityPin,
                    stadiumId: card.stadium?._id || card.stadium,
                  });

                  return (
                    <Card
                      key={card._id}
                      style={{
                        marginBottom: spacing.md,
                        borderWidth: 1.5,
                        borderColor: badgeColor,
                        backgroundColor: '#0f172a',
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 8,
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Ionicons name="card" size={16} color="#38bdf8" />
                          <Text
                            style={{
                              color: '#38bdf8',
                              fontSize: 11,
                              fontWeight: '800',
                              letterSpacing: 0.5,
                            }}
                          >
                            VIP MEMBERSHIP PASS
                          </Text>
                        </View>
                        <View
                          style={{
                            backgroundColor: badgeColor,
                            paddingHorizontal: 8,
                            paddingVertical: 2,
                            borderRadius: radii.full,
                          }}
                        >
                          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                            {badgeText}
                          </Text>
                        </View>
                      </View>

                      <Text
                        style={{
                          color: '#fff',
                          fontSize: 16,
                          fontWeight: '800',
                          marginBottom: 2,
                        }}
                      >
                        {card.teamName || 'Kooxda Joogtada ah'}
                      </Text>
                      <Text style={{ color: '#94a3b8', fontSize: 12, marginBottom: 8 }}>
                        {card.stadium?.name || 'Garoonka'} · {card.field?.name || 'Garoon'}
                      </Text>

                      <View
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          backgroundColor: '#1e293b',
                          padding: 10,
                          borderRadius: radii.sm,
                          marginBottom: 10,
                        }}
                      >
                        <View>
                          <Text style={{ color: '#64748b', fontSize: 10 }}>KAARKA ID</Text>
                          <Text
                            style={{
                              color: '#f8fafc',
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {card.cardNumber}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: '#64748b', fontSize: 10 }}>PIN-KA ALBAABKA</Text>
                          <Text
                            style={{
                              color: '#38bdf8',
                              fontSize: 12,
                              fontWeight: '700',
                            }}
                          >
                            {card.securityPin || '****'}
                          </Text>
                        </View>
                        <View>
                          <Text style={{ color: '#64748b', fontSize: 10 }}>WAQTIGA</Text>
                          <Text
                            style={{
                              color: '#f8fafc',
                              fontSize: 12,
                              fontWeight: '600',
                            }}
                          >
                            {card.startTimeLocal || card.startTime} –{' '}
                            {card.endTimeLocal || card.endTime}
                          </Text>
                        </View>
                      </View>

                      {isQrOpen && (
                        <View
                          style={{
                            alignItems: 'center',
                            padding: 14,
                            backgroundColor: '#ffffff',
                            borderRadius: radii.sm,
                            marginBottom: 10,
                          }}
                        >
                          <QRCode value={qrPayload} size={150} />
                          <Text
                            style={{
                              color: '#0f172a',
                              fontSize: 11,
                              fontWeight: '700',
                              marginTop: 8,
                            }}
                          >
                            Ku dhufo scan-ka albaabka
                          </Text>
                        </View>
                      )}

                      <Button
                        title={isQrOpen ? 'Qari QR Code-ka' : 'Tus QR Code-ka Albaabka'}
                        variant={isQrOpen ? 'outline' : 'primary'}
                        onPress={() =>
                          setShowQrMap((prev) => ({
                            ...prev,
                            [card._id]: !prev[card._id],
                          }))
                        }
                        style={{ height: 38 }}
                      />
                    </Card>
                  );
                })}

                <Card style={styles.lookupCard}>
                  <Text style={styles.lookupTitle}>Raadi tixraac / Match Code</Text>
                  <View style={styles.lookupRow}>
                    <TextInput
                      style={styles.lookupInput}
                      value={lookup}
                      onChangeText={setLookup}
                      placeholder="KUL-… ama SG-XXXX-XXXX"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="characters"
                    />
                    <Button title="Raadi" onPress={onLookup} style={styles.lookupBtn} />
                  </View>
                  <Button
                    title="Dhammee lacagta"
                    onPress={() => navigation.navigate('JoinMatchCode')}
                    style={{ marginTop: 10 }}
                  />
                  <Text style={styles.joinHint}>
                    Team B: geli Match Code + telefoonka Team A
                  </Text>
                </Card>
              </>
            }
            ListEmptyComponent={
              <Text style={styles.empty}>Weli ma lihid ballan. Fur Raadi tab oo dooro garoon.</Text>
            }
            renderItem={({ item }) => {
              const stadiumName =
                typeof item.stadium === 'object' ? item.stadium?.name : 'Garoon';
              const when = item.startTime
                ? new Date(item.startTime).toLocaleString()
                : '—';
              return (
                <Pressable
                  onPress={() =>
                    navigation.navigate('BookingDetail', { bookingId: item._id })
                  }
                  style={({ pressed }) => pressed && { opacity: 0.9 }}
                >
                  <Card>
                    <View style={styles.row}>
                      <View style={styles.iconWrap}>
                        <Ionicons name="ticket-outline" size={20} color={colors.brandGreen} />
                      </View>
                      <View style={styles.copy}>
                        <Text style={styles.name}>{stadiumName}</Text>
                        <Text style={styles.when}>{when}</Text>
                        <Text
                          style={[
                            styles.statusLabel,
                            {
                              color: statusColor(item.status),
                            },
                          ]}
                        >
                          {bookingStatusLabel(item)}
                        </Text>
                        <Text style={styles.code}>
                          Tixraac: {item.bookingCode || 'Sug labada lacag'}
                        </Text>
                      </View>
                      <View
                        style={[styles.dot, { backgroundColor: statusColor(item.status) }]}
                      />
                    </View>
                  </Card>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmwhite },
  list: { padding: spacing.md, paddingBottom: 28 },
  lookupCard: { marginBottom: 8 },
  lookupTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brandNavy,
    marginBottom: 10,
  },
  lookupRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  lookupInput: {
    flex: 1,
    backgroundColor: colors.warmwhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: colors.charcoal,
    fontSize: 15,
  },
  lookupBtn: { paddingHorizontal: 16, paddingVertical: 12 },
  joinHint: {
    marginTop: 8,
    fontSize: 12,
    color: colors.muted,
    lineHeight: 18,
  },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.statusConfirmedBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.brandNavy,
  },
  when: { marginTop: 4, ...typography.caption, color: colors.muted },
  statusLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: colors.statusPending,
  },
  code: { marginTop: 6, fontWeight: '700', color: colors.brandGreen },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
