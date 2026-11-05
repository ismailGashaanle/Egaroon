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
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import NotificationRow from '../../components/NotificationRow';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { notificationsApi } from '../../api/notifications';
import { formatWhen } from '../../lib/ownerDisplay';
import { radii, spacing, typography } from '../../theme';

/**
 * Stadium Manager profile — day-to-day ops only (no payout / delete stadium).
 */
export default function ManagerDheeraadScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { colors, mode, setMode, isDark } = useTheme();
  const styles = makeStyles(colors);
  const [notifications, setNotifications] = useState([]);
  const [loadingN, setLoadingN] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoadingN(true);
    try {
      const data = await notificationsApi.list();
      setNotifications((data.notifications || []).slice(0, 10));
    } catch {
      setNotifications([]);
    } finally {
      setLoadingN(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Dheeraad" subtitle="Manager · check-in & maalin" />
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
              <Text style={styles.roleText}>Stadium Manager</Text>
            </View>
            <Text style={[styles.muted, { marginTop: 10 }]}>
              Adiga: Scan QR, ballamaha maanta, availability blocks. Owner ayaa leh stadium
              create/delete, managers invite, discounts, cups, iyo payout.
            </Text>
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
              <Text style={styles.muted}>Maamul kooxaha bisha · Xaqiiji lacagta albaabka</Text>
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
              <Text style={styles.muted}>Raadi koox kale · formation</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>

          <Text style={styles.section}>Ogeysiisyada</Text>
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
      backgroundColor: colors.statusInfoBg,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    roleText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.statusInfo,
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
