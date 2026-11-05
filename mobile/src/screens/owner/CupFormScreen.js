import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Chip from '../../components/Chip';
import { stadiumsApi } from '../../api/stadiums';
import { tournamentsApi } from '../../api/tournaments';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

const FORMATS = [
  { id: 'GROUP_AND_KNOCKOUT', label: 'Group + KO' },
  { id: 'GROUP_STAGE', label: 'Groups' },
  { id: 'KNOCKOUT', label: 'Knockout' },
];

function toIsoLocal(dateStr, timeStr = '18:00') {
  if (!dateStr) return undefined;
  const t = timeStr.includes(':') ? timeStr : '18:00';
  const d = new Date(`${dateStr}T${t}:00`);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export default function CupFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const stadiumId = route.params?.stadiumId;
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [fields, setFields] = useState([]);
  const [selectedFieldIds, setSelectedFieldIds] = useState([]);
  const [name, setName] = useState('');
  const [maxTeams, setMaxTeams] = useState('8');
  const [registrationFee, setRegistrationFee] = useState('50');
  const [format, setFormat] = useState('GROUP_AND_KNOCKOUT');
  const [winnerGift, setWinnerGift] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [publish, setPublish] = useState(true);
  const [blockSlots, setBlockSlots] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await stadiumsApi.listFields(stadiumId);
        const list = data.fields || [];
        setFields(list);
        setSelectedFieldIds(list.map((f) => String(f._id)));
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Fields', text2: e.message });
      } finally {
        setLoading(false);
      }
    })();
  }, [stadiumId]);

  const toggleField = (id) => {
    setSelectedFieldIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Magaca cup-ka ayaa loo baahan yahay' });
      return;
    }
    const teams = Number(maxTeams);
    if (!(teams >= 2 && teams <= 64)) {
      Toast.show({ type: 'error', text1: 'Tirada kooxaha: 2–64' });
      return;
    }
    if (!selectedFieldIds.length) {
      Toast.show({ type: 'error', text1: 'Ugu yaraan field keliya dooro' });
      return;
    }
    const startIso = toIsoLocal(startDate, '18:00');
    const endIso = toIsoLocal(endDate, '22:00');
    const deadlineIso = toIsoLocal(deadline, '23:59');
    if (!startIso || !endIso || !deadlineIso) {
      Toast.show({
        type: 'error',
        text1: 'Taariikhda',
        text2: 'Isticmaal YYYY-MM-DD (tusaale 2026-09-01)',
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        stadiumId,
        fieldIds: selectedFieldIds,
        maxTeams: teams,
        registrationFee: Number(registrationFee) || 0,
        startDate: startIso,
        endDate: endIso,
        registrationDeadline: deadlineIso,
        format,
        publish,
        blockSlots,
        prize: winnerGift.trim()
          ? { winner: winnerGift.trim(), notes: winnerGift.trim() }
          : undefined,
      };
      await tournamentsApi.create(payload);
      Toast.show({
        type: 'success',
        text1: 'Cup waa la abuuray',
        text2: blockSlots ? 'Slots TOURNAMENT ayaa xanniban' : undefined,
      });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Cup', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title="Abuur cup"
          subtitle="Kooxo · fee · gift · block slots"
          onBack={() => navigation.goBack()}
          variant="green"
        />
        {loading ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Card>
              <Text style={styles.hint}>
                Haddii blockSlots la furayo, backend-ku wuxuu abuuraa availability block
                nooca tournament — booking-ga caadiga ah waa la xannibaa.
              </Text>

              <TextField label="Magaca cup *" value={name} onChangeText={setName} />
              <TextField
                label="Max teams (2–64)"
                value={maxTeams}
                onChangeText={setMaxTeams}
                keyboardType="number-pad"
              />
              <TextField
                label="Registration fee ($)"
                value={registrationFee}
                onChangeText={setRegistrationFee}
                keyboardType="decimal-pad"
              />
              <TextField
                label="Winner gift / prize note"
                value={winnerGift}
                onChangeText={setWinnerGift}
                placeholder="tusaale: $500 + koob"
              />

              <Text style={styles.label}>Format</Text>
              <View style={styles.chips}>
                {FORMATS.map((f) => (
                  <Chip
                    key={f.id}
                    label={f.label}
                    selected={format === f.id}
                    onPress={() => setFormat(f.id)}
                    style={styles.chip}
                  />
                ))}
              </View>

              <TextField
                label="Start date (YYYY-MM-DD)"
                value={startDate}
                onChangeText={setStartDate}
                placeholder="2026-09-01"
                autoCapitalize="none"
              />
              <TextField
                label="End date"
                value={endDate}
                onChangeText={setEndDate}
                placeholder="2026-09-15"
                autoCapitalize="none"
              />
              <TextField
                label="Registration deadline"
                value={deadline}
                onChangeText={setDeadline}
                placeholder="2026-08-31"
                autoCapitalize="none"
              />

              <Text style={styles.label}>Fields (cup slots)</Text>
              <View style={styles.chips}>
                {fields.map((f) => {
                  const id = String(f._id);
                  return (
                    <Chip
                      key={id}
                      label={f.name || id.slice(-4)}
                      selected={selectedFieldIds.includes(id)}
                      onPress={() => toggleField(id)}
                      style={styles.chip}
                    />
                  );
                })}
              </View>
              {!fields.length ? (
                <Text style={styles.warn}>Marka hore abuuri field. Kadib cup.</Text>
              ) : null}

              <View style={styles.chips}>
                <Chip
                  label={publish ? 'Publish OPEN' : 'Draft'}
                  selected={publish}
                  onPress={() => setPublish((v) => !v)}
                  style={styles.chip}
                />
                <Chip
                  label={blockSlots ? 'Block slots ON' : 'Block slots OFF'}
                  selected={blockSlots}
                  onPress={() => setBlockSlots((v) => !v)}
                  style={styles.chip}
                />
              </View>
            </Card>

            <Button title="Abuur cup" loading={saving} onPress={onSave} disabled={!fields.length} />
            <Text style={styles.webNote}>
              Fixtures / groups assign — mobile wuxuu tusaa liiska. Assign groups & natiijooyinka
              faahfaahsan: web Owner Tournaments.
            </Text>
            <Pressable onPress={() => navigation.goBack()} style={{ marginTop: 12, alignItems: 'center' }}>
              <Text style={styles.cancel}>Jooji</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    scroll: { padding: spacing.md, paddingBottom: 48 },
    hint: { ...typography.caption, color: colors.muted, marginBottom: 12, lineHeight: 18 },
    label: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 8,
      marginTop: 4,
    },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    chip: { minWidth: 0, flexGrow: 0 },
    warn: { color: colors.statusCancelled, marginBottom: 10, fontWeight: '600' },
    webNote: {
      marginTop: 12,
      ...typography.caption,
      color: colors.muted,
      lineHeight: 18,
    },
    cancel: { color: colors.muted, fontWeight: '600' },
  });
}
