import { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Chip from '../../components/Chip';
import { ownerApi } from '../../api/owner';
import { useTheme } from '../../context/ThemeContext';
import { formatSlotRange } from '../../lib/gateScan';
import { isSlotStartPast } from '../../lib/dateUtils';
import { spacing, typography } from '../../theme';

const PAY_MODES = [
  {
    id: 'full',
    label: 'Team A — dhammaan',
    hint: 'Captain A bixiya lacagta oo dhan',
  },
  {
    id: 'half_a',
    label: 'Team A — qayb',
    hint: 'Qaybta A kaliya; Team B weli',
  },
];

const PAY_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'zaad', label: 'Zaad' },
  { id: 'edahab', label: 'eDahab' },
  { id: 'hormuud', label: 'Hormuud' },
];

/** Staff walk-in booking for a free slot. */
export default function WalkInBookScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const { stadiumId, fieldId, startTime, endTime, date } = route.params || {};

  const [captainName, setCaptainName] = useState('');
  const [captainPhone, setCaptainPhone] = useState('');
  const [teamName, setTeamName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [payMode, setPayMode] = useState('full');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  const onSubmit = async () => {
    if (!captainPhone.trim()) {
      Toast.show({ type: 'error', text1: 'Telefoonka captain ayaa loo baahan yahay' });
      return;
    }
    if (!stadiumId || !fieldId || !startTime || !endTime) {
      Toast.show({ type: 'error', text1: 'Slot info waa dhamaystirnayn' });
      return;
    }
    if (route.params?.labelHint === 'RECURRING' || route.params?.isRecurring) {
      Toast.show({
        type: 'error',
        text1: 'Joogto — waa la qaatay',
        text2: 'Waqtigani waxaa haysta koox toddobaadle ah',
      });
      return;
    }
    if (isSlotStartPast(startTime)) {
      Toast.show({
        type: 'error',
        text1: 'Waqtigani wuu dhacay',
        text2: 'Dooro saacad mustaqbal ah',
      });
      return;
    }
    setSaving(true);
    try {
      const result = await ownerApi.walkIn({
        stadiumId,
        fieldId,
        startTime,
        endTime,
        captainName: captainName.trim() || undefined,
        captainPhone: captainPhone.trim(),
        teamName: teamName.trim() || undefined,
        payMode,
        paymentMethod,
        payerPhone: payerPhone.trim() || undefined,
        payNow: true,
      });
      const booking = result.booking;
      Toast.show({
        type: 'success',
        text1: `Walk-in · ${paymentMethod.toUpperCase()}`,
        text2: booking?.bookingCode || '',
      });
      navigation.replace('OwnerBookingDetail', {
        bookingId: String(booking._id),
      });
    } catch (e) {
      const code = e.data?.error?.details?.code || e.data?.error?.code;
      const so = e.data?.error?.details?.messageSo;
      if (code === 'RECURRING_SLOT' || /weekly team|joogto|toddobaadle/i.test(String(e.message))) {
        Toast.show({
          type: 'error',
          text1: 'Joogto — waa la qaatay',
          text2: so || e.message,
        });
      } else {
        Toast.show({ type: 'error', text1: 'Walk-in', text2: e.message });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Walk-in book" subtitle={date || ''} onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.body}>
          <Card>
            <Text style={styles.meta}>{formatSlotRange(startTime, endTime)}</Text>
            <Text style={styles.hint}>
              Captain soo galay — buuxi foomka, dooro lacag-bixinta (Cash / Zaad / eDahab / Hormuud).
            </Text>
          </Card>

          <TextField
            label="Magaca captain"
            value={captainName}
            onChangeText={setCaptainName}
            placeholder="Axmed Cali"
          />
          <TextField
            label="Telefoon captain *"
            value={captainPhone}
            onChangeText={setCaptainPhone}
            keyboardType="phone-pad"
            placeholder="61xxxxxxx"
          />
          <TextField
            label="Magaca kooxda"
            value={teamName}
            onChangeText={setTeamName}
            placeholder="Team Hilaac"
          />
          <TextField
            label="Telefoon lacag-bixiye (optional)"
            value={payerPhone}
            onChangeText={setPayerPhone}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Qaybta lacagta</Text>
          {PAY_MODES.map((m) => (
            <Chip
              key={m.id}
              label={m.label}
              selected={payMode === m.id}
              onPress={() => setPayMode(m.id)}
              style={styles.chip}
            />
          ))}
          <Text style={styles.hint}>{PAY_MODES.find((m) => m.id === payMode)?.hint}</Text>

          <Text style={styles.label}>Habka lacag-bixinta *</Text>
          <View style={styles.rowWrap}>
            {PAY_METHODS.map((m) => (
              <Chip
                key={m.id}
                label={m.label}
                selected={paymentMethod === m.id}
                onPress={() => setPaymentMethod(m.id)}
                style={styles.chip}
              />
            ))}
          </View>

          <Button
            title={`Book & pay (${paymentMethod})`}
            loading={saving}
            onPress={onSubmit}
            style={{ marginTop: 16 }}
          />
          <Button
            title="Jooji"
            variant="outline"
            onPress={() => navigation.goBack()}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.md, paddingBottom: 40 },
    meta: { ...typography.body, color: colors.text, fontWeight: '700' },
    hint: { ...typography.caption, color: colors.muted, marginTop: 6, marginBottom: 8 },
    label: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: '700',
      marginTop: 12,
      marginBottom: 8,
    },
    chip: { marginBottom: 8, marginRight: 8 },
    rowWrap: { flexDirection: 'row', flexWrap: 'wrap' },
  });
}
