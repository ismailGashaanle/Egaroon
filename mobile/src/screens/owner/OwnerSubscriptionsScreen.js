import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ownerApi } from '../../api/owner';
import { radii, spacing, typography } from '../../theme';

const OPERATORS = [
  { id: 'telesom', label: 'Telesom (Zaad)', sub: '063' },
  { id: 'somtel', label: 'Somtel (eDahab)', sub: '065' },
  { id: 'hormuud', label: 'Hormuud (Waafi)', sub: '061' },
  { id: 'golis', label: 'Golis (Sahal)', sub: '090' },
];

export default function OwnerSubscriptionsScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);

  const [payCurrency, setPayCurrency] = useState('USD');
  const [operator, setOperator] = useState('telesom');
  const [phone, setPhone] = useState(user?.phone || '');
  const [paying, setPaying] = useState(false);

  const [proofRef, setProofRef] = useState('');
  const [proofNotes, setProofNotes] = useState('');
  const [submittingProof, setSubmittingProof] = useState(false);

  const rate = 8500; // SlSh per USD

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ownerApi.listSubscriptions();
      const list = data?.subscriptions || [];
      setSubscriptions(list);
      if (list.length > 0 && !selectedSub) {
        const unpaid = list.find((s) => s.status === 'owed' || s.approvalStatus === 'pending_approval');
        setSelectedSub(unpaid || list[0]);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Khalad',
        text2: err?.response?.data?.message || 'Lama soo kicin karo subscription-ka',
      });
    } finally {
      setLoading(false);
    }
  }, [selectedSub]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePayMobile = async () => {
    if (!selectedSub) return;
    if (!phone) {
      Toast.show({ type: 'error', text1: 'Geli lambarka moobilkaaga' });
      return;
    }
    setPaying(true);
    try {
      const res = await ownerApi.paySubscription(selectedSub.id, {
        operator,
        phone,
        payCurrency,
      });
      Toast.show({
        type: 'success',
        text1: 'Guul!',
        text2: res?.messageSo || 'Subscription-ka waa la bixiyey!',
      });
      await load();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Lacag-bixintu way fashilantay',
        text2: err?.response?.data?.message || 'Isku day mar kale',
      });
    } finally {
      setPaying(false);
    }
  };

  const handlePayAutoDeduct = async () => {
    if (!selectedSub) return;
    setPaying(true);
    try {
      const res = await ownerApi.paySubscription(selectedSub.id, {
        method: 'auto_deduct',
      });
      Toast.show({
        type: 'success',
        text1: 'Guul!',
        text2: res?.messageSo || 'Dakhliga garoonka ayaa laga jaray!',
      });
      await load();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Khalad',
        text2: err?.response?.data?.message || 'Dakhliga kuma filna',
      });
    } finally {
      setPaying(false);
    }
  };

  const handleSubmitProof = async () => {
    if (!selectedSub) return;
    if (!proofRef) {
      Toast.show({ type: 'error', text1: 'Geli Transaction ID' });
      return;
    }
    setSubmittingProof(true);
    try {
      const res = await ownerApi.submitSubscriptionProof(selectedSub.id, {
        paymentReference: proofRef,
        notes: proofNotes,
      });
      Toast.show({
        type: 'success',
        text1: 'Waa la gudbiyey',
        text2: res?.messageSo || 'Super Admin ayaa xaqiijinaya',
      });
      setProofRef('');
      setProofNotes('');
      await load();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Khalad',
        text2: err?.response?.data?.message || 'Gudbintu way fashilantay',
      });
    } finally {
      setSubmittingProof(false);
    }
  };

  const dueUsd = selectedSub ? Number(selectedSub.amountDue || 0) - Number(selectedSub.amountPaid || 0) : 0;
  const dueSll = Math.round(dueUsd * rate);

  return (
    <View style={styles.screen}>
      <Header title="Stadium Subscription ($7/Field)" showBack onBack={() => navigation.goBack()} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {selectedSub && (
          <Card style={styles.breakdownCard}>
            <View style={styles.cardHeader}>
              <Ionicons name="football-outline" size={20} color={colors.brandGreen} />
              <Text style={styles.stadiumTitle}>{selectedSub.stadiumName}</Text>
            </View>
            <Text style={styles.periodText}>
              Bisha: {selectedSub.year}-{String(selectedSub.month).padStart(2, '0')}
            </Text>

            <View style={styles.mathRow}>
              <View style={styles.mathCol}>
                <Text style={styles.mathLabel}>Fields</Text>
                <Text style={styles.mathVal}>{selectedSub.fieldsCount || 1}</Text>
              </View>
              <Text style={styles.mathOp}>×</Text>
              <View style={styles.mathCol}>
                <Text style={styles.mathLabel}>Qiimaha</Text>
                <Text style={styles.mathVal}>${selectedSub.ratePerField || 7}</Text>
              </View>
              <Text style={styles.mathOp}>=</Text>
              <View style={styles.mathCol}>
                <Text style={styles.mathLabel}>Wadarta</Text>
                <Text style={[styles.mathVal, { color: colors.brandGreen }]}>
                  ${selectedSub.amountDue} USD
                </Text>
              </View>
            </View>
            <Text style={styles.sllHint}>
              U dhiganta: {dueSll.toLocaleString()} SlSh ({rate.toLocaleString()} SlSh / $1)
            </Text>
          </Card>
        )}

        {selectedSub?.status !== 'paid' && (
          <>
            {/* Pay with Mobile Money */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Habka 1: Ku Bixi Mobile Money (USSD Push)</Text>
              <Text style={styles.sectionSub}>Dooro lacagta aad rabto inaad ku bixiso:</Text>

              <View style={styles.currencyToggle}>
                <Pressable
                  onPress={() => setPayCurrency('USD')}
                  style={[styles.currBtn, payCurrency === 'USD' && styles.currBtnActive]}
                >
                  <Text style={[styles.currText, payCurrency === 'USD' && styles.currTextActive]}>
                    💵 USD (${dueUsd})
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setPayCurrency('SLL')}
                  style={[styles.currBtn, payCurrency === 'SLL' && styles.currBtnActive]}
                >
                  <Text style={[styles.currText, payCurrency === 'SLL' && styles.currTextActive]}>
                    SlSh ({dueSll.toLocaleString()})
                  </Text>
                </Pressable>
              </View>

              <View style={styles.operatorRow}>
                {OPERATORS.map((op) => (
                  <Pressable
                    key={op.id}
                    onPress={() => setOperator(op.id)}
                    style={[styles.opBtn, operator === op.id && styles.opBtnActive]}
                  >
                    <Text style={[styles.opText, operator === op.id && styles.opTextActive]}>
                      {op.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <TextField
                label="Lambarka Moobilka"
                value={phone}
                onChangeText={setPhone}
                placeholder="063xxxxxxx"
                keyboardType="phone-pad"
              />

              <Button
                title={`Bixi Hadda (${payCurrency === 'USD' ? `$${dueUsd}` : `${dueSll.toLocaleString()} SlSh`})`}
                loading={paying}
                onPress={handlePayMobile}
              />
            </Card>

            {/* Pay from Earnings */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Habka 2: Ka Jar Dakhliga Garoonka</Text>
              <Text style={styles.sectionSub}>
                Haddii aad leedahay dakhli ciyaareed oo gaaraya ${dueUsd}, si toos ah ayaad uga jari kartaa.
              </Text>
              <Button
                title={`Ka Jar Dakhliga ($${dueUsd} USD)`}
                variant="secondary"
                loading={paying}
                onPress={handlePayAutoDeduct}
              />
            </Card>

            {/* Submit Reference Proof */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Habka 3: Gudbi Tixraaca Zaad / eDahab</Text>
              <Text style={styles.sectionSub}>
                Haddii aad lacagta gacanta ugu dirtay xisaabta shirkadda, geli tixraaca si Super Admin-ku u xaqiijiyo.
              </Text>
              <TextField
                label="Transaction ID / Reference"
                value={proofRef}
                onChangeText={setProofRef}
                placeholder="ZAAD-xxxx ama EDAHAB-xxxx"
              />
              <TextField
                label="Xusuusin (Ikhtiyaari)"
                value={proofNotes}
                onChangeText={setProofNotes}
                placeholder="Faahfaahin..."
              />
              <Button
                title="Gudbi Caddeynta"
                variant="secondary"
                loading={submittingProof}
                onPress={handleSubmitProof}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
    breakdownCard: { marginBottom: spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
    stadiumTitle: { fontSize: typography.sizes.md, fontWeight: '700', color: colors.textPrimary },
    periodText: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginBottom: spacing.md },
    mathRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      backgroundColor: colors.surfaceAccent || 'rgba(0,0,0,0.04)',
      padding: spacing.md,
      borderRadius: radii.md,
      marginBottom: spacing.sm,
    },
    mathCol: { alignItems: 'center' },
    mathLabel: { fontSize: 10, color: colors.textSecondary, marginBottom: 2 },
    mathVal: { fontSize: typography.sizes.md, fontWeight: '800', color: colors.textPrimary },
    mathOp: { fontSize: 18, fontWeight: '700', color: colors.textSecondary },
    sllHint: { fontSize: typography.sizes.xs, color: colors.textSecondary, textAlign: 'center', marginTop: 4 },
    sectionCard: { marginBottom: spacing.md },
    sectionTitle: { fontSize: typography.sizes.sm, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    sectionSub: { fontSize: typography.sizes.xs, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 18 },
    currencyToggle: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
    currBtn: {
      flex: 1,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      alignItems: 'center',
    },
    currBtnActive: { borderColor: colors.brandGreen, backgroundColor: 'rgba(16,185,129,0.1)' },
    currText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    currTextActive: { color: colors.brandGreen, fontWeight: '800' },
    operatorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginBottom: spacing.md },
    opBtn: {
      flex: 1,
      minWidth: '45%',
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      alignItems: 'center',
    },
    opBtnActive: { borderColor: colors.brandGreen, backgroundColor: 'rgba(16,185,129,0.1)' },
    opText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
    opTextActive: { color: colors.brandGreen, fontWeight: '800' },
  });
}
