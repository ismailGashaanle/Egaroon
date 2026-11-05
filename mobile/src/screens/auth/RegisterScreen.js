import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import TextField from '../../components/TextField';
import { authApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import { ROLES } from '../../lib/roles';
import { colors, typography, radii } from '../../theme';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { otpEnabled, publicOwnerSignup } = useAuthFeatures();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    emailOtp: '',
    phoneOtp: '',
    role: ROLES.TEAM_CAPTAIN,
  });
  const [loading, setLoading] = useState(false);
  const [otpBusy, setOtpBusy] = useState(false);
  const [demoOtps, setDemoOtps] = useState({ email: null, phone: null });

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!publicOwnerSignup && form.role === ROLES.STADIUM_OWNER) {
      set('role', ROLES.TEAM_CAPTAIN);
    }
  }, [publicOwnerSignup, form.role]);

  const sendOtps = async () => {
    if (!form.email.trim() || !form.phone.trim()) {
      Toast.show({ type: 'error', text1: 'Email iyo telefoon ayaa loo baahan yahay' });
      return;
    }
    setOtpBusy(true);
    try {
      const emailRes = await authApi.sendOtp('email', form.email.trim());
      const phoneRes = await authApi.sendOtp('phone', form.phone.trim());

      const next = {
        email: emailRes?.devCode
          ? { code: emailRes.devCode, provider: emailRes.provider || 'local' }
          : null,
        phone: phoneRes?.devCode
          ? { code: phoneRes.devCode, provider: phoneRes.provider || 'local' }
          : null,
      };
      setDemoOtps(next);

      if (next.email?.code) set('emailOtp', String(next.email.code));
      if (next.phone?.code) set('phoneOtp', String(next.phone.code));

      const isDemo = Boolean(next.email || next.phone);
      Toast.show({
        type: 'success',
        text1: isDemo ? 'Demo OTP waa diyaar' : 'OTP waa la diray',
        text2: isDemo
          ? 'Koodhka mock ayaa hoos ka muuqda'
          : 'Hubi email / SMS',
      });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'OTP fashilmay', text2: e.message });
    } finally {
      setOtpBusy(false);
    }
  };

  const onSubmit = async () => {
    setLoading(true);
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        role: form.role,
      };
      if (otpEnabled) {
        body.emailOtp = form.emailOtp.trim();
        body.phoneOtp = form.phoneOtp.trim();
      }
      await register(body);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Diiwaangelintu way fashilantay', text2: e.message });
    } finally {
      setLoading(false);
    }
  };

  const showDemoBanner = otpEnabled && (demoOtps.email || demoOtps.phone);

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Isdiiwaangeli" subtitle="Samee akoon cusub" />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <Card>
              <TextField
                label="Magaca"
                value={form.name}
                onChangeText={(v) => set('name', v)}
              />
              <TextField
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                value={form.email}
                onChangeText={(v) => set('email', v)}
              />
              <TextField
                label="Telefoon (061…)"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={(v) => set('phone', v)}
              />
              <TextField
                label="Furaha sirta (8+)"
                secureTextEntry
                value={form.password}
                onChangeText={(v) => set('password', v)}
              />

              {publicOwnerSignup ? (
                <>
                  <Text style={styles.fieldLabel}>Dooro door</Text>
                  <View style={styles.chips}>
                    <Chip
                      label="Kabtan"
                      selected={form.role === ROLES.TEAM_CAPTAIN}
                      onPress={() => set('role', ROLES.TEAM_CAPTAIN)}
                    />
                    <Chip
                      label="Mulkiile"
                      selected={form.role === ROLES.STADIUM_OWNER}
                      onPress={() => set('role', ROLES.STADIUM_OWNER)}
                    />
                  </View>
                </>
              ) : (
                <Text style={styles.captainHint}>
                  Akoonada cusub waa Kabtan. Super Admin wuxuu ka furikaraa diiwaangelinta
                  milkiilaha.
                </Text>
              )}

              {otpEnabled ? (
                <>
                  <Button
                    title="Dir OTP"
                    variant="outline"
                    onPress={sendOtps}
                    loading={otpBusy}
                    style={styles.mb3}
                  />

                  {showDemoBanner ? (
                    <View style={styles.demoBanner}>
                      <Text style={styles.demoTitle}>Demo OTP</Text>
                      <Text style={styles.demoBody}>
                        Mock mode — koodhkan waxaa soo celiyay API (`devCode`). Production-ka ma
                        muuqdo.
                      </Text>
                      {demoOtps.email?.code ? (
                        <Text style={styles.demoCode}>Email: {demoOtps.email.code}</Text>
                      ) : null}
                      {demoOtps.phone?.code ? (
                        <Text style={[styles.demoCode, { marginTop: 4 }]}>
                          Telefoon: {demoOtps.phone.code}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}

                  <TextField
                    label="OTP Email"
                    keyboardType="number-pad"
                    value={form.emailOtp}
                    onChangeText={(v) => set('emailOtp', v)}
                  />
                  <TextField
                    label="OTP Telefoon"
                    keyboardType="number-pad"
                    value={form.phoneOtp}
                    onChangeText={(v) => set('phoneOtp', v)}
                  />
                </>
              ) : null}

              <Button
                title="Diiwaangeli"
                variant="primary"
                onPress={onSubmit}
                loading={loading}
                style={styles.mt1}
              />
            </Card>

            <Pressable onPress={() => navigation.goBack()} style={styles.link}>
              <Text style={styles.linkText}>Hore u soco → Soo gal</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.warmwhite },
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48 },
  fieldLabel: {
    ...typography.caption,
    fontWeight: '500',
    color: colors.muted,
    marginBottom: 6,
    marginTop: 4,
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  captainHint: {
    ...typography.caption,
    color: colors.darkSurface2,
    lineHeight: 18,
    marginBottom: 12,
    marginTop: 4,
  },
  mb3: { marginBottom: 12 },
  mt1: { marginTop: 4 },
  demoBanner: {
    marginBottom: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.4)',
    backgroundColor: colors.statusConfirmedBg,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  demoTitle: {
    ...typography.overline,
    color: colors.brandGreen,
  },
  demoBody: {
    marginTop: 4,
    fontSize: 12,
    color: colors.darkSurface2,
    lineHeight: 16,
  },
  demoCode: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '700',
    color: colors.brandNavy,
  },
  link: { marginTop: 12, paddingVertical: 8 },
  linkText: {
    textAlign: 'center',
    color: colors.brandNavy,
    fontWeight: '600',
  },
});
