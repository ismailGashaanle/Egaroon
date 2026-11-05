import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Linking,
  StyleSheet,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Chip from '../../components/Chip';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import api, { getApiErrorMessage } from '../../api/client';
import { giftsApi } from '../../api/gifts';
import { radii, spacing, typography } from '../../theme';

const SUSPENSE_MS = 2800;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MENU = [
  { id: 'lineups', label: 'Lineups (Kooxdayda / Raadi)', icon: 'football-outline', screen: 'TeamLineupSearch' },
  { id: 'about', label: 'About', icon: 'information-circle-outline', screen: 'About' },
  { id: 'help', label: 'Help', icon: 'help-circle-outline', screen: 'Help' },
  { id: 'contact', label: 'Contact', icon: 'call-outline', screen: 'Contact' },
  { id: 'language', label: 'Luuqada', icon: 'language-outline', action: 'language' },
  { id: 'logout', label: 'Logout', icon: 'log-out-outline', action: 'logout', danger: true },
];

export default function DheeraadScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { colors, mode, setMode, isDark } = useTheme();
  const { giftEnabled, loaded: featuresLoaded } = useAuthFeatures();
  const styles = makeStyles(colors);
  const [campaigns, setCampaigns] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [enteringId, setEnteringId] = useState(null);
  const [drawPhase, setDrawPhase] = useState(null); // null | 'waiting' | 'win' | 'lose'
  const [drawResult, setDrawResult] = useState(null);

  const reloadGifts = async () => {
    if (!giftEnabled) {
      setCampaigns([]);
      setVouchers([]);
      return;
    }
    try {
      const [activeRes, vouchersRes] = await Promise.all([
        giftsApi.listActive(),
        giftsApi.myVouchers(),
      ]);
      setCampaigns(activeRes.data.data.campaigns || []);
      setVouchers(vouchersRes.data.data.vouchers || []);
    } catch {
      setCampaigns([]);
      setVouchers([]);
    }
  };

  useEffect(() => {
    if (!featuresLoaded) return;
    let cancelled = false;
    (async () => {
      if (!giftEnabled) {
        if (!cancelled) {
          setCampaigns([]);
          setVouchers([]);
        }
        return;
      }
      try {
        const [activeRes, vouchersRes] = await Promise.all([
          giftsApi.listActive(),
          giftsApi.myVouchers(),
        ]);
        if (cancelled) return;
        setCampaigns(activeRes.data.data.campaigns || []);
        setVouchers(vouchersRes.data.data.vouchers || []);
      } catch {
        if (!cancelled) {
          setCampaigns([]);
          setVouchers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [featuresLoaded, giftEnabled]);

  const enterGift = async (campaignId) => {
    if (enteringId || drawPhase === 'waiting') return;
    setEnteringId(campaignId);
    setDrawResult(null);
    setDrawPhase('waiting');
    try {
      const [, apiRes] = await Promise.all([
        delay(SUSPENSE_MS),
        giftsApi.enter(campaignId, {}),
      ]);
      const result = apiRes.data.data;
      setDrawResult(result);
      setDrawPhase(result.won ? 'win' : 'lose');
      await reloadGifts();
    } catch (err) {
      setDrawPhase(null);
      Toast.show({ type: 'error', text1: getApiErrorMessage(err, 'Gifts failed') });
    } finally {
      setEnteringId(null);
    }
  };

  const closeReveal = () => {
    if (drawPhase === 'waiting') return;
    setDrawPhase(null);
    setDrawResult(null);
  };

  const onItem = (item) => {
    if (item.action === 'logout') {
      logout();
      return;
    }
    if (item.action === 'language') {
      Toast.show({
        type: 'info',
        text1: 'Af Soomaali',
        text2: 'Luqadda app-ka waa Soomaali (default)',
      });
      return;
    }
    if (item.screen) navigation.navigate(item.screen);
  };

  const issued = vouchers.filter((v) => v.voucherStatus === 'issued');
  const showGift = giftEnabled && (campaigns.length > 0 || issued.length > 0);
  const busy = Boolean(enteringId) || drawPhase === 'waiting';

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Dheeraad" subtitle="Itus in kale" />
        <ScrollView contentContainerStyle={styles.body}>
          <Card>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.email}>{user?.email || user?.phone || ''}</Text>
            <View style={styles.rolePill}>
              <Text style={styles.roleText}>Team Captain</Text>
            </View>
          </Card>

          {showGift && (
            <Card>
              <Text style={styles.sectionTitle}>Free match gift · Hadiyad</Text>
              <Text style={styles.sectionHint}>
                Geli draw — voucher = ciyaar bilaash (hal booking)
              </Text>
              {issued.map((v) => (
                <View key={v.id || v._id} style={styles.voucherBox}>
                  <Text style={styles.voucherCode}>{v.voucherCode}</Text>
                  <Text style={styles.sectionHint}>Redeem on web booking details</Text>
                </View>
              ))}
              {campaigns.map((c) => {
                const id = c.id || c._id;
                return (
                  <Pressable
                    key={id}
                    disabled={c.alreadyEntered || busy}
                    onPress={() => enterGift(id)}
                    style={({ pressed }) => [
                      styles.giftRow,
                      pressed && { opacity: 0.85 },
                      (c.alreadyEntered || busy) && { opacity: 0.6 },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.giftName}>{c.name}</Text>
                      <Text style={styles.sectionHint}>
                        {[c.city, c.region].filter(Boolean).join(' · ') || 'Platform'} ·{' '}
                        {c.remainingWinners} left
                      </Text>
                    </View>
                    <Text style={styles.giftAction}>
                      {c.alreadyEntered
                        ? c.myEntry?.won
                          ? 'Won'
                          : 'Done'
                        : enteringId === id
                          ? '…'
                          : 'Gift'}
                    </Text>
                  </Pressable>
                );
              })}
            </Card>
          )}

          <Card>
            <Text style={styles.sectionTitle}>Habka muuqaalka</Text>
            <Text style={styles.sectionHint}>
              Light = warmwhite · Dark = brand navy
            </Text>
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
              Hadda: {isDark ? 'Dark (navy)' : 'Light (warmwhite)'} — waa la kaydiyaa
            </Text>
          </Card>

          <Card style={styles.menuCard}>
            {MENU.map((item, idx) => (
              <Pressable
                key={item.id}
                onPress={() => onItem(item)}
                style={({ pressed }) => [
                  styles.menuRow,
                  idx < MENU.length - 1 && styles.menuBorder,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View
                  style={[
                    styles.menuIcon,
                    item.danger && { backgroundColor: colors.statusCancelledBg },
                  ]}
                >
                  <Ionicons
                    name={item.icon}
                    size={20}
                    color={item.danger ? colors.statusCancelled : colors.brandGreen}
                  />
                </View>
                <Text style={[styles.menuLabel, item.danger && styles.danger]}>
                  {item.label}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </Card>
        </ScrollView>

        <Modal visible={Boolean(drawPhase)} transparent animationType="fade">
          <View style={styles.revealBackdrop}>
            <View style={styles.revealCard}>
              {drawPhase === 'waiting' && (
                <>
                  <Ionicons name="gift" size={48} color={colors.brandGreen} />
                  <ActivityIndicator
                    color={colors.brandGreen}
                    style={{ marginTop: 16 }}
                  />
                  <Text style={[styles.revealTitle, { marginTop: 16 }]}>
                    Hadiyadda waa la furayaa…
                  </Text>
                  <Text style={styles.revealHint}>Opening your gift…</Text>
                </>
              )}
              {drawPhase === 'win' && (
                <>
                  <Ionicons name="checkmark-circle" size={48} color={colors.brandGreen} />
                  <Text style={styles.revealTitle}>Waad ku guulaysatay!</Text>
                  <Text style={styles.revealHint}>You won a free match!</Text>
                  <Text style={styles.revealCode}>{drawResult?.entry?.voucherCode}</Text>
                  <Text style={styles.revealHint}>
                    Isticmaal booking details (web) — 100% off.
                  </Text>
                  <Pressable onPress={closeReveal} style={styles.revealBtn}>
                    <Text style={styles.revealBtnText}>OK · Hagaag</Text>
                  </Pressable>
                </>
              )}
              {drawPhase === 'lose' && (
                <>
                  <Ionicons name="close-circle" size={48} color={colors.muted} />
                  <Text style={styles.revealTitle}>Nasiib xumo</Text>
                  <Text style={styles.revealHint}>
                    Better luck next time — try another campaign.
                  </Text>
                  <Pressable onPress={closeReveal} style={styles.revealBtn}>
                    <Text style={styles.revealBtnText}>OK · Hagaag</Text>
                  </Pressable>
                </>
              )}
            </View>
          </View>
        </Modal>
      </View>
    </FadeIn>
  );
}

/** Simple info pages shared via route name */
export function CaptainInfoScreen({ route, navigation }) {
  const name = route.name;
  const [contacts, setContacts] = useState(null);
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  useEffect(() => {
    if (name !== 'Contact') return;
    api
      .get('/auth/contacts')
      .then((r) => setContacts(r.data.data))
      .catch(() => setContacts(null));
  }, [name]);

  const title =
    name === 'About' ? 'About' : name === 'Help' ? 'Help' : 'Contact';

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title={title} subtitle="E-Garoon" onBack={() => navigation.goBack()} />
        <ScrollView contentContainerStyle={styles.body}>
          {name === 'About' ? (
            <Card>
              <Text style={styles.infoTitle}>E-Garoon</Text>
              <Text style={styles.infoBody}>
                Platform-ka ballansiga garoonnada ciyaaraha — raadi, dooro waqti, bixi
                lacag, hel tixraac QR.
              </Text>
            </Card>
          ) : null}

          {name === 'Help' ? (
            <Card>
              <Text style={styles.infoTitle}>Sidee loo isticmaalaa?</Text>
              <Text style={styles.infoBody}>
                1. Raadi → dooro garoonka{'\n'}
                2. Dooro field-ka{'\n'}
                3. Dooro waqtiga banaan{'\n'}
                4. Xaqiiji oo bixi lacagta{'\n'}
                5. Ballamo → tus QR albaabka
              </Text>
            </Card>
          ) : null}

          {name === 'Contact' ? (
            <Card>
              <Text style={styles.infoTitle}>Nala soo xiriir</Text>
              {(contacts?.contacts || []).slice(0, 4).map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => c.phone && Linking.openURL(`tel:${c.phone}`)}
                  style={styles.contactRow}
                >
                  <Text style={styles.contactCity}>{c.city}</Text>
                  <Text style={styles.contactMeta}>
                    {c.phone} · {c.hours}
                  </Text>
                </Pressable>
              ))}
              {!contacts?.contacts?.length ? (
                <Text style={styles.infoBody}>
                  support@egaroon.com · WhatsApp / call support
                </Text>
              ) : null}
            </Card>
          ) : null}
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
    sectionTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
    },
    sectionHint: {
      marginTop: 4,
      marginBottom: 12,
      ...typography.caption,
      color: colors.muted,
    },
    themeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    themeChip: { flexGrow: 0, minWidth: 88 },
    themeHint: {
      marginTop: 12,
      fontSize: 12,
      color: colors.muted,
    },
    menuCard: { paddingVertical: 4, paddingHorizontal: 8 },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 8,
      gap: 12,
    },
    menuBorder: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
      flex: 1,
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    danger: { color: colors.statusCancelled },
    giftRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 10,
    },
    giftName: { fontSize: 15, fontWeight: '700', color: colors.text },
    giftAction: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.brandGreen,
    },
    voucherBox: {
      marginBottom: 8,
      padding: 10,
      borderRadius: radii.sm,
      backgroundColor: colors.statusConfirmedBg,
    },
    voucherCode: {
      fontSize: 15,
      fontWeight: '800',
      fontFamily: 'monospace',
      color: colors.brandGreen,
    },
    revealBackdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    revealCard: {
      backgroundColor: colors.surface || colors.bg,
      borderRadius: radii.md,
      padding: spacing.lg,
      alignItems: 'center',
    },
    revealTitle: {
      marginTop: 12,
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    revealHint: {
      marginTop: 6,
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
    },
    revealCode: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 18,
      fontWeight: '800',
      fontFamily: 'monospace',
      color: colors.brandGreen,
      letterSpacing: 1,
    },
    revealBtn: {
      marginTop: 20,
      backgroundColor: colors.brandGreen,
      paddingHorizontal: 24,
      paddingVertical: 12,
      borderRadius: radii.sm,
    },
    revealBtnText: {
      color: '#fff',
      fontWeight: '800',
      fontSize: 15,
    },
    infoTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
    },
    infoBody: {
      ...typography.body,
      color: colors.charcoal,
    },
    contactRow: {
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    contactCity: { fontWeight: '700', color: colors.text },
    contactMeta: { marginTop: 2, color: colors.muted, fontSize: 13 },
  });
}
