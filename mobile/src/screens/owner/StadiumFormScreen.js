import { useEffect, useState } from 'react';
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
import * as Location from 'expo-location';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { stadiumsApi } from '../../api/stadiums';
import { pickAndUploadImage } from '../../lib/pickUpload';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography, radii } from '../../theme';

const emptyForm = () => ({
  name: '',
  description: '',
  city: '',
  region: '',
  area: '',
  address: '',
  lat: '',
  lng: '',
  openingTime: '06:00',
  closingTime: '23:00',
  images: [],
});

export default function StadiumFormScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const stadiumId = route.params?.stadiumId;
  const isEdit = !!stadiumId;
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(!!isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    if (!stadiumId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await stadiumsApi.get(stadiumId);
        const st = data.stadium || data;
        const loc = st.location || {};
        const latLng = loc.latLng || {};
        setForm({
          name: st.name || '',
          description: st.description || '',
          city: loc.city || st.city || '',
          region: loc.region || '',
          area: loc.area || '',
          address: loc.address || '',
          lat: latLng.lat != null ? String(latLng.lat) : loc.lat != null ? String(loc.lat) : '',
          lng: latLng.lng != null ? String(latLng.lng) : loc.lng != null ? String(loc.lng) : '',
          openingTime: st.openingTime || '06:00',
          closingTime: st.closingTime || '23:00',
          images: Array.isArray(st.images) ? [...st.images] : [],
        });
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Garoonka', text2: e.message });
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    })();
  }, [stadiumId, navigation]);

  const set = (key) => (value) => setForm((p) => ({ ...p, [key]: value }));

  const onGps = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Toast.show({ type: 'error', text1: 'GPS', text2: 'Location permission lama helin' });
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setForm((p) => ({
        ...p,
        lat: String(pos.coords.latitude.toFixed(6)),
        lng: String(pos.coords.longitude.toFixed(6)),
      }));
      Toast.show({ type: 'success', text1: 'GPS waa la qaatay' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'GPS', text2: e.message });
    } finally {
      setLocating(false);
    }
  };

  const onPickCover = async () => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage({ folder: 'stadiums' });
      if (!url) return;
      setForm((p) => ({ ...p, images: [url, ...p.images.filter((u) => u !== url)] }));
      Toast.show({ type: 'success', text1: 'Cover waa la upload-gareeyay' });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Upload', text2: e.message });
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      Toast.show({ type: 'error', text1: 'Magaca ayaa loo baahan yahay' });
      return;
    }
    if (!form.city.trim()) {
      Toast.show({ type: 'error', text1: 'Magaalada ayaa loo baahan yahay' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        openingTime: form.openingTime.trim() || undefined,
        closingTime: form.closingTime.trim() || undefined,
        images: form.images.length ? form.images : undefined,
        location: {
          city: form.city.trim(),
          region: form.region.trim() || undefined,
          area: form.area.trim() || undefined,
          address: form.address.trim() || undefined,
          lat: form.lat ? Number(form.lat) : undefined,
          lng: form.lng ? Number(form.lng) : undefined,
        },
      };
      if (isEdit) {
        await stadiumsApi.update(stadiumId, payload);
        Toast.show({ type: 'success', text1: 'Garoonka waa la cusboonaysiiyay' });
        navigation.goBack();
      } else {
        const data = await stadiumsApi.create(payload);
        const created = data.stadium || data;
        const id = created._id || created.id;
        Toast.show({ type: 'success', text1: 'Garoon waa la abuuray (pending)' });
        if (id) {
          navigation.replace('StadiumDetail', { stadiumId: id });
        } else {
          navigation.goBack();
        }
      }
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
          title={isEdit ? 'Beddel garoonka' : 'Abuur garoon'}
          subtitle="Magaca · goobta · cover · saacadaha"
          onBack={() => navigation.goBack()}
          variant="green"
        />
        {loading ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <Card>
              <Text style={styles.hint}>
                Cover-ka iyo GPS-ka ayaa muhiim u ah raadinta. Status-ka cusub waa pending
                ilaa admin uu xaqiijiyo.
              </Text>

              {form.images[0] ? (
                <Image source={{ uri: form.images[0] }} style={styles.cover} resizeMode="cover" />
              ) : (
                <View style={[styles.cover, styles.coverEmpty]}>
                  <Text style={styles.coverEmptyText}>Cover ma jiro</Text>
                </View>
              )}
              <Button
                title={uploading ? 'Upload…' : 'Dooro / upload cover'}
                variant="outline"
                loading={uploading}
                onPress={onPickCover}
                style={{ marginBottom: 8 }}
              />

              <TextField label="Magaca *" value={form.name} onChangeText={set('name')} />
              <TextField
                label="Sharaxaad"
                value={form.description}
                onChangeText={set('description')}
                multiline
              />
              <TextField label="Magaalo *" value={form.city} onChangeText={set('city')} />
              <TextField label="Gobol" value={form.region} onChangeText={set('region')} />
              <TextField label="Xaafad / area" value={form.area} onChangeText={set('area')} />
              <TextField label="Cinwaan" value={form.address} onChangeText={set('address')} />

              <View style={styles.row2}>
                <TextField
                  label="Lat"
                  value={form.lat}
                  onChangeText={set('lat')}
                  keyboardType="decimal-pad"
                  style={{ flex: 1 }}
                />
                <TextField
                  label="Lng"
                  value={form.lng}
                  onChangeText={set('lng')}
                  keyboardType="decimal-pad"
                  style={{ flex: 1 }}
                />
              </View>
              <Button
                title={locating ? 'GPS…' : 'Qaado GPS hadda'}
                variant="outline"
                loading={locating}
                onPress={onGps}
                style={{ marginBottom: 8 }}
              />

              <View style={styles.row2}>
                <TextField
                  label="Furitaanka (HH:MM)"
                  value={form.openingTime}
                  onChangeText={set('openingTime')}
                  placeholder="06:00"
                  style={{ flex: 1 }}
                />
                <TextField
                  label="Xiritaanka (HH:MM)"
                  value={form.closingTime}
                  onChangeText={set('closingTime')}
                  placeholder="23:00"
                  style={{ flex: 1 }}
                />
              </View>
            </Card>

            <Button title={isEdit ? 'Kaydi isbeddelka' : 'Abuur garoon'} loading={saving} onPress={onSave} />
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
    cover: {
      width: '100%',
      height: 140,
      borderRadius: radii.md,
      marginBottom: 10,
      backgroundColor: colors.brandNavy,
    },
    coverEmpty: { alignItems: 'center', justifyContent: 'center' },
    coverEmptyText: { color: colors.white, fontWeight: '600' },
    row2: { flexDirection: 'row', gap: 10 },
    cancel: { color: colors.muted, fontWeight: '600' },
  });
}
