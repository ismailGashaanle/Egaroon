import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import NotificationRow from '../../components/NotificationRow';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { notificationsApi } from '../../api/notifications';
import { ownerApi } from '../../api/owner';
import { formatWhen } from '../../lib/ownerDisplay';
import { radii, spacing, typography } from '../../theme';

export default function OwnerDheeraadScreen({ navigation }) {
  const { user, logout, updateProfile } = useAuth();
  const { colors, mode, setMode, isDark } = useTheme();
  const styles = makeStyles(colors);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [city, setCity] = useState(user?.city || '');
  const [saving, setSaving] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loadingN, setLoadingN] = useState(false);
  const [pendingAgreementsCount, setPendingAgreementsCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    setLoadingN(true);
    try {
      const data = await notificationsApi.list();
      setNotifications((data.notifications || []).slice(0, 12));
    } catch {
      setNotifications([]);
    } finally {
      setLoadingN(false);
    }
  }, []);

  const checkAgreements = useCallback(async () => {
    try {
      const list = await ownerApi.listAgreements();
      const pending = (Array.isArray(list) ? list : []).filter(
        (a) => a.status === 'PENDING_ACCEPTANCE'
      );
      setPendingAgreementsCount(pending.length);
    } catch {
      setPendingAgreementsCount(0);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setName(user?.name || '');
      setCity(user?.city || '');
      loadNotifications();
      checkAgreements();
    }, [user, loadNotifications, checkAgreements])
  );

  const onSave = async () => {
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        city: city.trim() || undefined,
      });
      setEditing(false);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Profile', text2: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Dheeraad" subtitle="Profile · ogeysiis · logout" />
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={loadingN} onRefresh={loadNotifications} />
          }
        >
          <Card>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email || user?.phone || ''}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>Stadium Owner</Text>
            </View>
            <Text style={[styles.muted, { marginTop: 10 }]}>
              Adiga ayaa leh setup-ka (stadium, fields, managers, cups). Manager-ku wuxuu
              qabtaa check-in iyo maalin-maalinta.
            </Text>
          </Card>

          <Card>
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>Profile</Text>
              <Pressable onPress={() => setEditing((v) => !v)}>
                <Text style={styles.link}>{editing ? 'Jooji' : 'Beddel'}</Text>
              </Pressable>
            </View>
            {editing ? (
              <>
                <TextField label="Magaca" value={name} onChangeText={setName} />
                <TextField label="Magaalada" value={city} onChangeText={setCity} />
                <Button title="Kaydi" loading={saving} onPress={onSave} />
              </>
            ) : (
              <Text style={styles.muted}>
                {user?.city ? `Magaalo: ${user.city}` : 'Magaalo lama diiwaangelin'}
              </Text>
            )}
          </Card>

          <Card>
            <Text style={styles.sectionTitle}>Habka muuqaalka</Text>
            <View style={styles.themeRow}>
              <Chip
                label="Light"
                selected={mode === 'light'}
                onPress={() => setMode('light')}
                style={styles.themeChip}
              />
              <Chip
                label="Dark"
                selected={mode === 'dark'}
                onPress={() => setMode('dark')}
                style={styles.themeChip}
              />
            </View>
            <Text style={styles.themeHint}>
              Hadda: {isDark ? 'Dark (navy)' : 'Light'} — waa la kaydiyaa
            </Text>
          </Card>

          <Pressable
            onPress={() => navigation.navigate('OwnerWallet')}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Ionicons name="wallet-outline" size={20} color="#10b981" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.menuLabel}>E-Garoon Wallet</Text>
                <View style={{ backgroundColor: '#059669', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>ESCROW</Text>
                </View>
              </View>
              <Text style={styles.muted}>Xisaabta garoonka · Escrow, KYC & codso xawaalad OTP</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('OwnerJoogto')}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
              <Ionicons name="card" size={20} color="#0284c7" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.menuLabel}>Ciyaaraha Joogto (VIP Passes)</Text>
                <View style={{ backgroundColor: '#0284c7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 10 }}>
                  <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>VIP</Text>
                </View>
              </View>
              <Text style={styles.muted}>Maamul kooxaha bisha · Xaqiiji lacagta & scan albaabka</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('OwnerSubscriptions')}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.menuIcon, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
              <Ionicons name="card-outline" size={20} color={colors.brandGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Subscription ($7 / Field)</Text>
              <Text style={styles.muted}>Bixi biilasha bisha · USSD push ama dakhliga garoonka</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('OwnerAgreements')}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
          >
            <View style={[styles.menuIcon, pendingAgreementsCount > 0 && { backgroundColor: '#FEF3C7' }]}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={pendingAgreementsCount > 0 ? '#D97706' : colors.brandGreen}
              />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.menuLabel}>Heshiisyada Garoonka</Text>
                {pendingAgreementsCount > 0 && (
                  <View style={styles.alertBadge}>
                    <Text style={styles.alertBadgeText}>{pendingAgreementsCount} sugaya</Text>
                  </View>
                )}
              </View>
              <Text style={styles.muted}>
                {pendingAgreementsCount > 0
                  ? '⚠️ Heshiis cusub ayaa sugaya aqbaliddaada'
                  : 'Revenue policy · heshiisyada firfircoon'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('TeamLineupSearch')}
            style={({ pressed }) => [styles.menuRow, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.menuIcon}>
              <Ionicons name="football-outline" size={20} color={colors.brandGreen} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>Lineups</Text>
              <Text style={styles.muted}>Kooxdayda · raadi koox kale</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <Text style={styles.section}>Ogeysiisyada (Socket / API)</Text>
          {!notifications.length ? (
            <Card>
              <Text style={styles.muted}>Ogeysiis cusub ma jiro.</Text>
            </Card>
          ) : (
            notifications.map((n) => (
              <NotificationRow
                key={String(n._id || n.id)}
                title={n.title || n.type || 'Ogeysiis'}
                body={n.body || n.message || ''}
                time={formatWhen(n.createdAt || n.updatedAt)}
              />
            ))
          )}

          <Pressable
            onPress={logout}
            style={({ pressed }) => [styles.logoutRow, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={20} color={colors.statusCancelled} />
            </View>
            <Text style={styles.logoutText}>Logout</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        </ScrollView>
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.md, paddingBottom: 40 },
    name: { fontSize: 18, fontWeight: '800', color: colors.text },
    email: { marginTop: 4, color: colors.muted },
    rolePill: {
      marginTop: 12,
      alignSelf: 'flex-start',
      borderRadius: radii.sm,
      backgroundColor: colors.statusConfirmedBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    roleText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brandGreen,
    },
    muted: { ...typography.caption, color: colors.muted, lineHeight: 18 },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    section: {
      marginTop: 4,
      marginBottom: 8,
      fontSize: 15,
      fontWeight: '800',
      color: colors.brandNavy,
    },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    link: { color: colors.brandGreen, fontWeight: '700' },
    themeRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    themeChip: { flexGrow: 0, minWidth: 88 },
    themeHint: { marginTop: 12, fontSize: 12, color: colors.muted },
    menuRow: {
      marginTop: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    menuIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.statusConfirmedBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    menuLabel: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    alertBadge: {
      backgroundColor: '#FEF3C7',
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: radii.sm,
    },
    alertBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: '#B45309',
    },
    logoutRow: {
      marginTop: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.surface,
      borderRadius: radii.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
    },
    logoutIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: colors.statusCancelledBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutText: {
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
      color: colors.statusCancelled,
    },
  });
}
