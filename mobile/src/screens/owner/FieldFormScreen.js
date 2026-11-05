import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
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
import { pickAndUploadImage } from '../../lib/pickUpload';
import { fieldPriceLabel } from '../../lib/ownerDisplay';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radii } from '../../theme';

const FIELD_TYPES = ['5v5', '6v6', '7v7', '8v8', '9v9', '11v11'];

function capacityFromType(type) {
  const n = Number(String(type).split('v')[0]);
  return Number.isFinite(n) ? n : 7;
}

export default function FieldFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const stadiumId = route.params?.stadiumId;
  const fieldId = route.params?.fieldId;
  const isEdit = !!fieldId;
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [name, setName] = useState('');
  const [type, setType] = useState('7v7');
  const [pricingMode, setPricingMode] = useState('per_player');
  const [pricePerPlayer, setPricePerPlayer] = useState('2');
  const [fixedPrice, setFixedPrice] = useState('');
  const [openingTime, setOpeningTime] = useState('06:00');
  const [closingTime, setClosingTime] = useState('23:00');
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(!!isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fieldOps, setFieldOps] = useState(null);
  const [opsBusy, setOpsBusy] = useState(false);
  const [offlineHours, setOfflineHours] = useState('4');
  const [offlineReason, setOfflineReason] = useState('');

  const capacity = useMemo(() => capacityFromType(type), [type]);
  const isFieldOffline = fieldOps && fieldOps.bookable === false;

  const preview = useMemo(() => {
    const fake = {
      capacity,
      pricingMode,
      pricePerPlayer: Number(pricePerPlayer) || 0,
      fixedPrice: Number(fixedPrice) || 0,
    };
    return fieldPriceLabel(fake);
  }, [capacity, pricingMode, pricePerPlayer, fixedPrice]);

  useEffect(() => {
    if (!fieldId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await stadiumsApi.getField(fieldId);
        const f = data.field || data;
        if (!f?._id && !f?.name) throw new Error('Field lama helin');
        setName(f.name || '');
        setType(f.type || '7v7');
        setPricingMode(f.pricingMode || 'per_player');
        setPricePerPlayer(f.pricePerPlayer != null ? String(f.pricePerPlayer) : '2');
        setFixedPrice(f.fixedPrice != null ? String(f.fixedPrice) : '');
        setOpeningTime(f.openingTime || '06:00');
        setClosingTime(f.closingTime || '23:00');
        setImages(Array.isArray(f.images) ? [...f.images] : []);
        setFieldOps(f.ops || null);
        if (f.offlineReason) setOfflineReason(String(f.offlineReason));
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Field', text2: e.message });
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [fieldId, navigation]);

  const onPickImage = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage({ folder: 'fields' });
      if (!url) return;
      setImages((prev) => [url, ...prev.filter((u) => u !== url)]);
      Toast.show({ type: 'success', text1: 'Sawir waa la upload-gareeyay' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Upload', text2: e.message });
    } finally {
      setUploading(false);
    }
  };

  const setFieldOnline = async () => {
    if (!fieldId) return;
    setOpsBusy(true);
    try {
      const res = await stadiumsApi.setFieldOps(fieldId, { mode: 'online' });
      const f = res.field || res;
      setFieldOps(f.ops || null);
      Toast.show({ type: 'success', text1: 'Field keliya waa furan (online)' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Online', text2: e.message });
    } finally {
      setOpsBusy(false);
    }
  };

  const setFieldOffline = async () => {
    if (!fieldId) return;
    setOpsBusy(true);
    try {
      const hours = Math.max(1, Number(offlineHours) || 4);
      const until = new Date(Date.now() + hours * 60 * 60 * 1000);
      const res = await stadiumsApi.setFieldOps(fieldId, {
        mode: 'offline',
        offlineFrom: new Date().toISOString(),
        offlineUntil: until.toISOString(),
        reason: offlineReason.trim() || 'Field xiran',
      });
      const f = res.field || res;
      setFieldOps(f.ops || null);
      Toast.show({
        type: 'success',
        text1: 'Field keliya waa xiran (offline)',
        text2: `Dib u furmaya ~${hours} saacadood`,
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Offline', text2: e.message });
    } finally {
      setOpsBusy(false);
    }
  };

  const onSave = async () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: 'Magaca field-ka ayaa loo baahan yahay' });
      return;
    }
    if (pricingMode === 'per_player' && !(Number(pricePerPlayer) > 0)) {
      Toast.show({ type: 'error', text1: 'Qiimaha / ciyaaryahan ayaa loo baahan yahay' });
      return;
    }
    if (pricingMode === 'fixed' && !(Number(fixedPrice) > 0)) {
      Toast.show({ type: 'error', text1: "Qiimaha go'an ayaa loo baahan yahay" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        type,
        pricingMode,
        pricePerPlayer: pricingMode === 'per_player' ? Number(pricePerPlayer) : undefined,
        fixedPrice: pricingMode === 'fixed' ? Number(fixedPrice) : undefined,
        openingTime: openingTime.trim() || undefined,
        closingTime: closingTime.trim() || undefined,
        images: images.length ? images : undefined,
        slotDurationMinutes: 60,
      };
      if (isEdit) {
        await stadiumsApi.updateField(fieldId, payload);
        Toast.show({ type: 'success', text1: 'Field waa la cusboonaysiiyay' });
      } else {
        await stadiumsApi.createField(stadiumId, payload);
        Toast.show({ type: 'success', text1: 'Field waa la abuuray' });
      }
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Kaydi', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title={isEdit ? 'Beddel field' : 'Ku dar field'}
          subtitle={`${capacity}v${capacity} · qiimaha backend ayaa xisaabiya`}
          onBack={() => navigation.goBack()}
          variant="green"
        />
        {loading ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Card>
              <Text style={styles.hint}>
                Capacity waa {capacity} (laga soo saaray type). per_player: teamShare =
                capacity × price · wadarta = × 2 kooxood.
              </Text>

              {images[0] ? (
                <Image source={{ uri: images[0] }} style={styles.cover} resizeMode="cover" />
              ) : null}
              <Button
                title={uploading ? 'Upload…' : 'Upload sawir field'}
                variant="outline"
                loading={uploading}
                onPress={onPickImage}
                style={{ marginBottom: 8 }}
              />

              <TextField label="Magaca *" value={name} onChangeText={setName} />

              <Text style={styles.label}>Nooca (type)</Text>
              <View style={styles.chips}>
                {FIELD_TYPES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={type === t}
                    onPress={() => setType(t)}
                    style={styles.chip}
                  />
                ))}
              </View>

              <Text style={styles.label}>Qiimaha</Text>
              <View style={styles.chips}>
                <Chip
                  label="Per player"
                  selected={pricingMode === 'per_player'}
                  onPress={() => setPricingMode('per_player')}
                  style={styles.chip}
                />
                <Chip
                  label="Fixed"
                  selected={pricingMode === 'fixed'}
                  onPress={() => setPricingMode('fixed')}
                  style={styles.chip}
                />
              </View>

              {pricingMode === 'per_player' ? (
                <TextField
                  label="Qiimaha / ciyaaryahan ($)"
                  value={pricePerPlayer}
                  onChangeText={setPricePerPlayer}
                  keyboardType="decimal-pad"
                />
              ) : (
                <TextField
                  label="Qiimaha go'an ($)"
                  value={fixedPrice}
                  onChangeText={setFixedPrice}
                  keyboardType="decimal-pad"
                />
              )}

              <Text style={styles.preview}>{preview}</Text>

              <View style={styles.row2}>
                <TextField
                  label="Furitaan"
                  value={openingTime}
                  onChangeText={setOpeningTime}
                  placeholder="06:00"
                  style={{ flex: 1 }}
                />
                <TextField
                  label="Xiritaan"
                  value={closingTime}
                  onChangeText={setClosingTime}
                  placeholder="23:00"
                  style={{ flex: 1 }}
                />
              </View>
            </Card>

            {isEdit ? (
              <Card>
                <Text style={styles.opsTitle}>Field keliya · online / offline</Text>
                <Text style={styles.hint}>
                  Kaliya field-kan ayaa xidhmi — fields-ka kale iyo stadium-yada kale ma saameynayaan.
                  Dhamaan garoonka: ka fur Stadium detail.
                </Text>
                <Text
                  style={[
                    styles.opsStatus,
                    { color: isFieldOffline ? '#DC2626' : colors.brandGreen },
                  ]}
                >
                  {isFieldOffline ? 'OFFLINE · xidhan' : 'ONLINE · furan'}
                </Text>
                {isFieldOffline && fieldOps?.messageSo ? (
                  <Text style={styles.opsMsg}>{fieldOps.messageSo}</Text>
                ) : null}
                {!isFieldOffline ? (
                  <View style={{ marginTop: 8 }}>
                    <TextField
                      label="Offline saacado (dib u furid)"
                      value={offlineHours}
                      onChangeText={setOfflineHours}
                      keyboardType="number-pad"
                      placeholder="4"
                    />
                    <TextField
                      label="Sabab"
                      value={offlineReason}
                      onChangeText={setOfflineReason}
                      placeholder="Dayactir / ..."
                    />
                    <Button
                      title="Xidh field keliya (offline)"
                      variant="outline"
                      loading={opsBusy}
                      onPress={setFieldOffline}
                    />
                  </View>
                ) : (
                  <Button
                    title="Fur field keliya (online)"
                    loading={opsBusy}
                    onPress={setFieldOnline}
                    style={{ marginTop: 10 }}
                  />
                )}
              </Card>
            ) : null}

            <Button title={isEdit ? 'Kaydi' : 'Abuur field'} loading={saving} onPress={onSave} />
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
    cover: {
      width: '100%',
      height: 120,
      borderRadius: radii.md,
      marginBottom: 10,
      backgroundColor: colors.brandNavy,
    },
    preview: {
      marginBottom: 12,
      fontWeight: '700',
      color: colors.brandGreen,
      fontSize: 13,
    },
    row2: { flexDirection: 'row', gap: 10 },
    cancel: { color: colors.muted, fontWeight: '600' },
    opsTitle: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.brandNavy,
      marginBottom: 6,
    },
    opsStatus: { fontWeight: '800', fontSize: 14, marginBottom: 4 },
    opsMsg: {
      ...typography.caption,
      color: '#DC2626',
      lineHeight: 18,
      marginBottom: 8,
    },
  });
}
