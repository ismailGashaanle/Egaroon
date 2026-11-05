import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import TextField from '../../components/TextField';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import { bookingsApi } from '../../api/bookings';
import {
  SO_CARRIERS,
  composedPhone,
  digitsOnly,
} from '../../lib/somaliPhone';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radii } from '../../theme';
import { MatchCodeCard } from './JoinMatchCodeScreen';

/**
 * After Team A pays their share — share Match Code and/or invite Team B by phone.
 * Optional when Team A already covered the full match.
 */
export default function InviteTeamBScreen({ route, navigation }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { bookingId } = route.params || {};
  const [carrierId, setCarrierId] = useState('telesom');
  const [localNumber, setLocalNumber] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [coveredFull, setCoveredFull] = useState(false);
  const [booking, setBooking] = useState(null);

  const carrier = SO_CARRIERS.find((c) => c.id === carrierId) || SO_CARRIERS[0];

  useEffect(() => {
    load();
  }, [bookingId, navigation]);

  async function load() {
    try {
      const data = await bookingsApi.get(bookingId);
      const b = data.booking || data;
      setBooking(b);
      setCoveredFull(Boolean(b?.coveredFullMatch));
      if (b?.coveredFullMatch && ['CONFIRMED', 'CHECKED_IN', 'SETTLED'].includes(b.status)) {
        navigation.replace('BookingDetail', { bookingId });
      }
    } catch {
      /* keep invite form */
    }
  }

  const onInvite = async () => {
    const phone = composedPhone(carrierId, localNumber);
    if (!phone) {
      Toast.show({
        type: 'error',
        text1: 'Telefoonka ma saxna',
        text2: 'Geli lambarka +252 (061 / 063 / 065 / 090)',
      });
      return;
    }
    setSubmitting(true);
    try {
      const data = await bookingsApi.inviteTeamB(bookingId, { phone });
      const who = data.invitedCaptain;
      Toast.show({
        type: 'success',
        text1: 'Team B waa la casuumay',
        text2: who?.name
          ? `${who.name}${who.phone ? ` · ${who.phone}` : ''}`
          : name.trim() || undefined,
      });
      navigation.replace('BookingDetail', { bookingId });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Casuumaaddu way fashilantay', text2: e.message });
    } finally {
      setSubmitting(false);
    }
  };

  const skip = () => {
    navigation.replace('BookingDetail', { bookingId });
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title="Casuum Team B"
          subtitle="Telefoonka kabtanka B"
          onBack={() => navigation.replace('BookingDetail', { bookingId })}
        />
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {booking?.matchCode ? (
            <MatchCodeCard booking={booking} colors={colors} onUpdated={load} />
          ) : null}
          <Card>
            <Text style={styles.hint}>
              {coveredFull
                ? 'Dhammaan lacagta waa la bixiyay. Casuumaaddu waa ikhtiyaari — Team B lacag uma baahna.'
                : 'Waad bixisay lacagta teamkaaga. Share Match Code ama casuum telefoon — Team B wuxuu bixinayaa qaybtiisa.'}
            </Text>
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Telefoonka kabtanka B (ikhtiyaari)</Text>
            <View style={styles.ops}>
              {SO_CARRIERS.map((c) => (
                <Chip
                  key={c.id}
                  label={`${c.label} ${c.prefix}`}
                  selected={carrierId === c.id}
                  onPress={() => {
                    setCarrierId(c.id);
                    setLocalNumber('');
                  }}
                  style={styles.opChip}
                />
              ))}
            </View>
            <View style={styles.phoneRow}>
              <View style={styles.prefixBox}>
                <Text style={styles.prefixText}>+252 · {carrier.prefix}</Text>
              </View>
              <TextField
                style={styles.localField}
                value={localNumber}
                onChangeText={(t) => setLocalNumber(digitsOnly(t).slice(0, 7))}
                placeholder="XXXXXXX"
                keyboardType="phone-pad"
              />
            </View>
            <TextField
              label="Magaca (ikhtiyaari)"
              value={name}
              onChangeText={setName}
              placeholder="Magaca kabtanka B"
              autoCapitalize="words"
            />
          </Card>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <Button
            title={coveredFull ? 'Casuum (ikhtiyaari)' : 'Dir casuumaad'}
            variant="white"
            onPress={onInvite}
            loading={submitting}
          />
          <Button
            title={coveredFull ? 'Sii wad — QR / receipt' : 'Hadda ma casuumayo'}
            variant="outline"
            onPress={skip}
            style={styles.skipBtn}
            textStyle={styles.skipText}
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
    hint: {
      ...typography.body,
      color: colors.text,
      fontSize: 14,
      lineHeight: 22,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 10,
    },
    ops: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 12,
    },
    opChip: { flexGrow: 0 },
    phoneRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    prefixBox: {
      height: 48,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceInset,
      justifyContent: 'center',
    },
    prefixText: {
      fontWeight: '700',
      color: colors.muted,
      fontSize: 13,
    },
    localField: { flex: 1, marginBottom: 0 },
    footer: {
      backgroundColor: colors.brandNavy,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      gap: 10,
    },
    skipBtn: {
      backgroundColor: 'transparent',
      borderColor: 'rgba(255,255,255,0.55)',
    },
    skipText: { color: colors.white },
  });
}
