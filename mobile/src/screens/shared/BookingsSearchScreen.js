import { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import OwnerBookingFaahfaahinCard from '../../components/OwnerBookingFaahfaahinCard';
import { ownerApi } from '../../api/owner';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

function todayYmd() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/**
 * Owner/manager booking search — name/phone + date/time → card results.
 */
export default function BookingsSearchScreen() {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [q, setQ] = useState('');
  const [date, setDate] = useState(todayYmd());
  const [time, setTime] = useState('');
  const [cards, setCards] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setSearched(true);
    try {
      const params = {};
      const free = q.trim();
      if (free) {
        if (/^\d[\d\s+]*$/.test(free) || free.replace(/\D/g, '').length >= 7) {
          params.phone = free;
        } else if (/^KUL-/i.test(free)) {
          params.bookingCode = free.toUpperCase();
        } else {
          params.q = free;
        }
      }
      if (date.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        params.date = date.trim();
      }
      if (time.trim() && /^\d{1,2}:\d{2}$/.test(time.trim())) {
        params.time = time.trim();
      }
      const data = await ownerApi.listBookings(params);
      setCards(data.cards || []);
      setBookings(data.bookings || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Raadi booking', text2: e.message });
      setCards([]);
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [q, date, time]);

  useFocusEffect(
    useCallback(() => {
      runSearch();
    }, [runSearch])
  );

  const openDetail = (card, index) => {
    const id =
      card?.bookingId ||
      bookings[index]?._id ||
      bookings[index]?.id;
    if (!id) return;
    navigation.navigate('OwnerBookingDetail', { bookingId: String(id) });
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title="Raadi bookings"
          subtitle="Magac · tel · taariikh · wakhti"
          onBack={() => navigation.goBack()}
        />
        <View style={styles.filters}>
          <TextField
            label="Magac ama telefoon"
            value={q}
            onChangeText={setQ}
            placeholder="Axmed / 61xxxxxxx / KUL-…"
            autoCapitalize="none"
          />
          <View style={styles.row2}>
            <TextField
              label="Taariikh (YYYY-MM-DD)"
              value={date}
              onChangeText={setDate}
              autoCapitalize="none"
              style={{ flex: 1 }}
            />
            <TextField
              label="Wakhti (HH:mm)"
              value={time}
              onChangeText={setTime}
              placeholder="20:00"
              autoCapitalize="none"
              style={{ flex: 1 }}
            />
          </View>
          <Button title="Raadi" loading={loading} onPress={runSearch} />
        </View>

        {loading && !cards.length ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 24 }} />
        ) : (
          <FlatList
            data={cards}
            keyExtractor={(item, i) => String(item.bookingId || i)}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl refreshing={loading} onRefresh={runSearch} />
            }
            ListEmptyComponent={
              searched ? (
                <Text style={styles.empty}>
                  Natiijo ma jirto — isku day magac, tel, ama taariikh kale.
                </Text>
              ) : null
            }
            renderItem={({ item, index }) => (
              <OwnerBookingFaahfaahinCard
                card={item}
                booking={bookings[index]}
                compact
                showQr={false}
                onPress={() => openDetail(item, index)}
              />
            )}
          />
        )}
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    filters: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
    row2: { flexDirection: 'row', gap: 10 },
    list: { padding: spacing.md, paddingBottom: 40 },
    empty: {
      textAlign: 'center',
      color: colors.muted,
      ...typography.body,
      marginTop: 24,
    },
  });
}
