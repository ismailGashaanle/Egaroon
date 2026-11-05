import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  TextInput,
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

export default function OwnerWalletScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [loading, setLoading] = useState(true);
  const [walletData, setWalletData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);

  // Withdrawal Flow Modal
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawStep, setWithdrawStep] = useState(1); // 1: form, 2: otp
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState('telesom_zaad');
  const [payoutPhone, setPayoutPhone] = useState(user?.phone || '');
  const [payoutAccountName, setPayoutAccountName] = useState(user?.name || '');
  const [currentWithdrawalId, setCurrentWithdrawalId] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  // KYC Modal
  const [kycModal, setKycModal] = useState(false);
  const [idType, setIdType] = useState('business_license');
  const [idNumber, setIdNumber] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [documentUrl, setDocumentUrl] = useState('');
  const [submittingKyc, setSubmittingKyc] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, tRes, wdRes] = await Promise.all([
        ownerApi.getWallet().catch(() => ({ success: false })),
        ownerApi.getWalletTransactions({ limit: 20 }).catch(() => ({ success: false, data: [] })),
        ownerApi.listWithdrawals().catch(() => ({ success: false, data: [] })),
      ]);

      if (wRes?.success && wRes?.data) setWalletData(wRes.data);
      if (tRes?.success && tRes?.data) setTransactions(tRes.data);
      if (wdRes?.success && wdRes?.data) setWithdrawals(wdRes.data);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Khalad ayaa dhacay',
        text2: 'Ma suurtogelin in xogta wallet-ka la soo saaro.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStartWithdrawal = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      Toast.show({ type: 'error', text1: 'Fadlan geli lacag sax ah' });
      return;
    }
    const avail = walletData?.wallet?.balanceAvailable || 0;
    if (amt > avail) {
      Toast.show({ type: 'error', text1: 'Lacagta la heli karo kuma filna' });
      return;
    }
    if (!payoutPhone.trim()) {
      Toast.show({ type: 'error', text1: 'Fadlan geli lambarka qaadashada' });
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      const res = await ownerApi.initiateWithdrawal({
        amount: amt,
        payoutMethod,
        payoutPhone: payoutPhone.trim(),
        payoutAccountName: payoutAccountName.trim() || undefined,
      });

      if (res?.success) {
        setCurrentWithdrawalId(res.data.withdrawal._id);
        setWithdrawStep(2);
        Toast.show({
          type: 'success',
          text1: 'OTP ayaa laguu soo diray',
          text2: `Koodhka 6-da god ah geli: ${res.data.otpCode || ''}`,
        });
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Khalad ayaa dhacay' });
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Khalad',
        text2: err.response?.data?.message || err.message,
      });
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length !== 6) {
      Toast.show({ type: 'error', text1: 'Fadlan geli 6-da god ee OTP-ga' });
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      const res = await ownerApi.verifyWithdrawalOtp({
        withdrawalId: currentWithdrawalId,
        otp: otpCode.trim(),
      });

      if (res?.success) {
        Toast.show({
          type: 'success',
          text1: 'Codsiga xawaaladda waa la gudbiyay!',
          text2: 'Waaxda Maaliyadda ee E-Garoon ayaa si dhakhso ah kuugu soo diri doonta.',
        });
        setWithdrawModal(false);
        setWithdrawStep(1);
        setWithdrawAmount('');
        setOtpCode('');
        loadData();
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'OTP-gu ma saxna' });
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Khalad',
        text2: err.response?.data?.message || err.message,
      });
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const handleSubmitKyc = async () => {
    if (!idNumber.trim()) {
      Toast.show({ type: 'error', text1: 'Fadlan geli lambarka aqoonsiga / sharciga' });
      return;
    }

    setSubmittingKyc(true);
    try {
      const res = await ownerApi.submitKyc({
        idType,
        idNumber: idNumber.trim(),
        businessName: businessName.trim() || undefined,
        documentUrl: documentUrl.trim() || undefined,
      });

      if (res?.success) {
        Toast.show({
          type: 'success',
          text1: 'Sharciga waa la gudbiyay',
          text2: 'Waaxda Maaliyadda ayaa hubin doonta.',
        });
        setKycModal(false);
        loadData();
      } else {
        Toast.show({ type: 'error', text1: res?.message || 'Khalad ayaa dhacay' });
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Khalad',
        text2: err.response?.data?.message || err.message,
      });
    } finally {
      setSubmittingKyc(false);
    }
  };

  const wallet = walletData?.wallet || {};
  const kyc = walletData?.kyc || {};
  const master = walletData?.masterAccounts || {};

  return (
    <View style={styles.container}>
      <Header
        title="E-Garoon Wallet"
        subtitle="Lacag-qabashada, Escrow & Xawaaladaha"
        showBack
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {/* Central Escrow Info Banner */}
        <View style={styles.escrowBanner}>
          <View style={styles.escrowHeader}>
            <Ionicons name="shield-checkmark" size={20} color="#059669" />
            <Text style={styles.escrowTitle}>E-Garoon Central Escrow System</Text>
          </View>
          <Text style={styles.escrowText}>
            Sida Uber oo kale, lacagaha ballansashada garoonka waxay ku dhacayaan labada akoon ee guud ee E-Garoon (Telesom ZAAD & Somtel eDahab). Lacagtaadu waxay diyaar noqoneysaa isla marka ciyaartu qabsoonto.
          </Text>
          <View style={styles.masterAccRow}>
            <View style={styles.masterPill}>
              <Text style={styles.masterPillLabel}>ZAAD Master:</Text>
              <Text style={styles.masterPillVal}>{master.telesom?.merchantCode || '202020'}</Text>
            </View>
            <View style={styles.masterPill}>
              <Text style={styles.masterPillLabel}>eDahab Master:</Text>
              <Text style={styles.masterPillVal}>{master.somtel?.merchantCode || 'ED-7070'}</Text>
            </View>
          </View>
        </View>

        {/* KYC Status Strip */}
        <Pressable
          onPress={() => setKycModal(true)}
          style={[
            styles.kycStrip,
            kyc.status === 'verified' ? styles.kycVerified : styles.kycWarning,
          ]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Ionicons
              name={kyc.status === 'verified' ? 'checkmark-circle' : 'alert-circle'}
              size={22}
              color={kyc.status === 'verified' ? '#10b981' : '#f59e0b'}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.kycStripTitle}>
                {kyc.status === 'verified'
                  ? 'Aqoonsiga Ganacsi: Waa La Xaqiijiyay'
                  : kyc.status === 'pending'
                  ? 'Aqoonsiga Ganacsi: Waa La Hubinayaa'
                  : 'Fadlan Gudbi Sharciga Ganacsi / Kaarka Qaran'}
              </Text>
              <Text style={styles.kycStripSub}>
                {kyc.status === 'verified'
                  ? `ID: ${kyc.idNumber || 'Verified'} · Xawaaladaha waa kuu furan yihiin`
                  : 'Si aad lacagahaaga ula baxdo, geli liisankaaga ama ID-gaaga'}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
        </Pressable>

        {/* Balance Cards Grid */}
        <View style={styles.balanceGrid}>
          {/* Held in Escrow */}
          <Card style={[styles.balanceCard, { borderLeftColor: '#f59e0b', borderLeftWidth: 4 }]}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Sugaya Ciyaarta (Escrow)</Text>
              <Ionicons name="hourglass-outline" size={18} color="#f59e0b" />
            </View>
            <Text style={styles.balanceAmount}>${(wallet.balanceHeld || 0).toFixed(2)}</Text>
            <Text style={styles.balanceMuted}>Lacagaha ballamaha soo socda</Text>
          </Card>

          {/* Available to Withdraw */}
          <Card style={[styles.balanceCard, { borderLeftColor: '#10b981', borderLeftWidth: 4 }]}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Diyaar u ah Qaadashada</Text>
              <Ionicons name="wallet-outline" size={18} color="#10b981" />
            </View>
            <Text style={[styles.balanceAmount, { color: '#10b981' }]}>
              ${(wallet.balanceAvailable || 0).toFixed(2)}
            </Text>
            <Text style={styles.balanceMuted}>Waad la bixi kartaa hadda</Text>
          </Card>

          {/* Processing Payouts */}
          <Card style={[styles.balanceCard, { borderLeftColor: '#3b82f6', borderLeftWidth: 4 }]}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Xawaaladaha Socda</Text>
              <Ionicons name="paper-plane-outline" size={18} color="#3b82f6" />
            </View>
            <Text style={styles.balanceAmount}>${(wallet.balanceProcessing || 0).toFixed(2)}</Text>
            <Text style={styles.balanceMuted}>Waaxda Maaliyadda ayaa gacanta ku haysa</Text>
          </Card>

          {/* Total Withdrawn */}
          <Card style={[styles.balanceCard, { borderLeftColor: '#8b5cf6', borderLeftWidth: 4 }]}>
            <View style={styles.balanceHeader}>
              <Text style={styles.balanceLabel}>Dhammaan Wixii La Qaatay</Text>
              <Ionicons name="checkmark-done-circle-outline" size={18} color="#8b5cf6" />
            </View>
            <Text style={styles.balanceAmount}>${(wallet.totalWithdrawn || 0).toFixed(2)}</Text>
            <Text style={styles.balanceMuted}>Lagu shubay Zaad / eDahab</Text>
          </Card>
        </View>

        {/* Withdrawal Action Button */}
        <View style={styles.actionSection}>
          <Button
            title="Codso Xawaalad (Withdrawal via OTP)"
            onPress={() => {
              setWithdrawStep(1);
              setWithdrawModal(true);
            }}
            disabled={(wallet.balanceAvailable || 0) <= 0}
            style={styles.withdrawBtn}
          />
        </View>

        {/* Recent Payout Requests */}
        <Text style={styles.sectionTitle}>Codsiyada Xawaaladaha (Withdrawal Requests)</Text>
        {withdrawals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Weli ma jiro codsi xawaaladeed.</Text>
          </Card>
        ) : (
          withdrawals.map((w) => (
            <Card key={w._id} style={styles.requestCard}>
              <View style={styles.requestRow}>
                <View>
                  <Text style={styles.requestRef}>{w.reference}</Text>
                  <Text style={styles.requestPhone}>
                    {w.payoutMethod === 'telesom_zaad' ? 'ZAAD' : 'eDahab'}: {w.payoutPhone}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.requestAmount}>${w.amount?.toFixed(2)}</Text>
                  <View
                    style={[
                      styles.statusPill,
                      w.status === 'completed'
                        ? styles.statusSuccess
                        : w.status === 'rejected'
                        ? styles.statusDanger
                        : styles.statusPending,
                    ]}
                  >
                    <Text style={styles.statusPillText}>
                      {w.status === 'completed'
                        ? 'La Bixiyay'
                        : w.status === 'rejected'
                        ? 'La Diiday'
                        : 'Socda'}
                    </Text>
                  </View>
                </View>
              </View>
              {w.disbursementReference && (
                <Text style={styles.refCode}>Tixraac: {w.disbursementReference}</Text>
              )}
            </Card>
          ))
        )}

        {/* Transactions Ledger */}
        <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
          Xisaabxirka Dhaqdhaqaaqa (Transactions Ledger)
        </Text>
        {transactions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Dhaqdhaqaaq xisaabeed weli ma jiro.</Text>
          </Card>
        ) : (
          transactions.map((t) => (
            <Card key={t._id} style={styles.txCard}>
              <View style={styles.txRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>{t.description || t.type}</Text>
                  <Text style={styles.txDate}>
                    {new Date(t.createdAt).toLocaleDateString('so-SO', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.txAmount,
                    t.amount >= 0 ? styles.txCredit : styles.txDebit,
                  ]}
                >
                  {t.amount >= 0 ? `+$${t.amount.toFixed(2)}` : `-$${Math.abs(t.amount).toFixed(2)}`}
                </Text>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* WITHDRAWAL MODAL */}
      <Modal visible={withdrawModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {withdrawStep === 1 ? 'Codso Xawaalad (Withdrawal)' : 'Xaqiiji Koodhka OTP-ga'}
              </Text>
              <Pressable onPress={() => setWithdrawModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </Pressable>
            </View>

            {withdrawStep === 1 ? (
              <View>
                <Text style={styles.modalSub}>
                  Lacagta la heli karo: ${(wallet.balanceAvailable || 0).toFixed(2)}
                </Text>

                <TextField
                  label="Lacagta aad rabto ($ USD) *"
                  value={withdrawAmount}
                  onChangeText={setWithdrawAmount}
                  placeholder="Tusaale: 50"
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>Habka Lacag-qaadashada *</Text>
                <View style={styles.methodRow}>
                  <Pressable
                    onPress={() => setPayoutMethod('telesom_zaad')}
                    style={[
                      styles.methodCard,
                      payoutMethod === 'telesom_zaad' && styles.methodSelected,
                    ]}
                  >
                    <Ionicons
                      name="phone-portrait-outline"
                      size={20}
                      color={payoutMethod === 'telesom_zaad' ? '#10b981' : '#94a3b8'}
                    />
                    <Text
                      style={[
                        styles.methodText,
                        payoutMethod === 'telesom_zaad' && styles.methodTextSelected,
                      ]}
                    >
                      Telesom ZAAD
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setPayoutMethod('somtel_edahab')}
                    style={[
                      styles.methodCard,
                      payoutMethod === 'somtel_edahab' && styles.methodSelected,
                    ]}
                  >
                    <Ionicons
                      name="phone-portrait-outline"
                      size={20}
                      color={payoutMethod === 'somtel_edahab' ? '#10b981' : '#94a3b8'}
                    />
                    <Text
                      style={[
                        styles.methodText,
                        payoutMethod === 'somtel_edahab' && styles.methodTextSelected,
                      ]}
                    >
                      Somtel eDahab
                    </Text>
                  </Pressable>
                </View>

                <TextField
                  label="Lambarka Akoonka / Taleefanka *"
                  value={payoutPhone}
                  onChangeText={setPayoutPhone}
                  placeholder="063xxxxxxx ama 065xxxxxxx"
                  keyboardType="phone-pad"
                />

                <TextField
                  label="Magaca Akoonka *"
                  value={payoutAccountName}
                  onChangeText={setPayoutAccountName}
                  placeholder="Magaca ku qoran akoonka"
                />

                <Button
                  title={submittingWithdrawal ? 'Dirayaa OTP...' : 'U Dir OTP Taleefankayga'}
                  onPress={handleStartWithdrawal}
                  disabled={submittingWithdrawal}
                  style={{ marginTop: 16 }}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.modalSub}>
                  Waxaan koodhka 6-da god ah u dirnay taleefankaaga ({payoutPhone}).
                </Text>

                <TextField
                  label="Geli Koodhka OTP (6 God) *"
                  value={otpCode}
                  onChangeText={setOtpCode}
                  placeholder="123456"
                  keyboardType="number-pad"
                  maxLength={6}
                />

                <Button
                  title={submittingWithdrawal ? 'Xaqiijinayaa...' : 'Xaqiiji oo Gudbi Codsiga'}
                  onPress={handleVerifyOtp}
                  disabled={submittingWithdrawal}
                  style={{ marginTop: 16 }}
                />

                <Pressable
                  onPress={() => setWithdrawStep(1)}
                  style={{ marginTop: 12, alignItems: 'center' }}
                >
                  <Text style={{ color: '#0ea5e9', fontSize: 13 }}>Dib ugu noqo foomka</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* KYC MODAL */}
      <Modal visible={kycModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Aqoonsiga Ganacsi (KYC)</Text>
              <Pressable onPress={() => setKycModal(false)}>
                <Ionicons name="close" size={24} color="#94a3b8" />
              </Pressable>
            </View>

            <ScrollView>
              <Text style={styles.modalSub}>
                Geli liisanka ganacsi ama kaarka aqoonsiga qaran si laguu siiyo oggolaanshaha lacag-qaadashada.
              </Text>

              <Text style={styles.fieldLabel}>Nooca Aqoonsiga *</Text>
              <View style={styles.methodRow}>
                <Pressable
                  onPress={() => setIdType('business_license')}
                  style={[
                    styles.methodCard,
                    idType === 'business_license' && styles.methodSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodText,
                      idType === 'business_license' && styles.methodTextSelected,
                    ]}
                  >
                    Liisanka Ganacsiga
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setIdType('national_id')}
                  style={[
                    styles.methodCard,
                    idType === 'national_id' && styles.methodSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.methodText,
                      idType === 'national_id' && styles.methodTextSelected,
                    ]}
                  >
                    Kaarka Qaran (ID)
                  </Text>
                </Pressable>
              </View>

              <TextField
                label="Lambarka Sharciga / ID-ga *"
                value={idNumber}
                onChangeText={setIdNumber}
                placeholder="Tusaale: BL-2026-88192"
              />

              <TextField
                label="Magaca Ganacsiga *"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Tusaale: Garoonka Hargeisa Arena"
              />

              <TextField
                label="Link-ga Dukumintiga (Sawir ama PDF)"
                value={documentUrl}
                onChangeText={setDocumentUrl}
                placeholder="https://..."
              />

              <Button
                title={submittingKyc ? 'Gudbinayaa...' : 'Gudbi Aqoonsiga'}
                onPress={handleSubmitKyc}
                disabled={submittingKyc}
                style={{ marginTop: 16 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background || '#0f172a',
    },
    scrollContent: {
      padding: spacing.md || 16,
      paddingBottom: 40,
    },
    escrowBanner: {
      backgroundColor: '#064e3b',
      borderRadius: radii.md || 12,
      padding: 14,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: '#059669',
    },
    escrowHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 6,
    },
    escrowTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#a7f3d0',
    },
    escrowText: {
      fontSize: 12,
      color: '#d1fae5',
      lineHeight: 17,
      marginBottom: 10,
    },
    masterAccRow: {
      flexDirection: 'row',
      gap: 8,
    },
    masterPill: {
      backgroundColor: 'rgba(0,0,0,0.25)',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 6,
      flexDirection: 'row',
      gap: 4,
    },
    masterPillLabel: {
      color: '#94a3b8',
      fontSize: 10,
    },
    masterPillVal: {
      color: '#34d399',
      fontSize: 10,
      fontWeight: '700',
    },
    kycStrip: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      borderRadius: radii.md || 12,
      marginBottom: 16,
      borderWidth: 1,
    },
    kycVerified: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderColor: 'rgba(16, 185, 129, 0.3)',
    },
    kycWarning: {
      backgroundColor: 'rgba(245, 158, 11, 0.1)',
      borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    kycStripTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: '#f8fafc',
    },
    kycStripSub: {
      fontSize: 11,
      color: '#94a3b8',
      marginTop: 2,
    },
    balanceGrid: {
      gap: 10,
      marginBottom: 16,
    },
    balanceCard: {
      padding: 14,
    },
    balanceHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    balanceLabel: {
      fontSize: 12,
      color: '#94a3b8',
      fontWeight: '600',
    },
    balanceAmount: {
      fontSize: 24,
      fontWeight: '800',
      color: '#f8fafc',
    },
    balanceMuted: {
      fontSize: 11,
      color: '#64748b',
      marginTop: 2,
    },
    actionSection: {
      marginBottom: 20,
    },
    withdrawBtn: {
      backgroundColor: '#059669',
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#f8fafc',
      marginBottom: 8,
    },
    emptyCard: {
      padding: 16,
      alignItems: 'center',
    },
    emptyText: {
      fontSize: 12,
      color: '#64748b',
    },
    requestCard: {
      padding: 12,
      marginBottom: 8,
    },
    requestRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    requestRef: {
      fontSize: 12,
      fontFamily: 'monospace',
      fontWeight: '700',
      color: '#34d399',
    },
    requestPhone: {
      fontSize: 11,
      color: '#94a3b8',
      marginTop: 2,
    },
    requestAmount: {
      fontSize: 15,
      fontWeight: '700',
      color: '#f8fafc',
    },
    statusPill: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 10,
      marginTop: 4,
    },
    statusSuccess: {
      backgroundColor: 'rgba(16, 185, 129, 0.2)',
    },
    statusDanger: {
      backgroundColor: 'rgba(239, 68, 68, 0.2)',
    },
    statusPending: {
      backgroundColor: 'rgba(59, 130, 246, 0.2)',
    },
    statusPillText: {
      fontSize: 10,
      fontWeight: '700',
      color: '#f8fafc',
    },
    refCode: {
      fontSize: 10,
      color: '#64748b',
      marginTop: 6,
      fontFamily: 'monospace',
    },
    txCard: {
      padding: 12,
      marginBottom: 6,
    },
    txRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    txTitle: {
      fontSize: 12,
      fontWeight: '600',
      color: '#e2e8f0',
    },
    txDate: {
      fontSize: 10,
      color: '#64748b',
      marginTop: 2,
    },
    txAmount: {
      fontSize: 13,
      fontWeight: '700',
    },
    txCredit: {
      color: '#10b981',
    },
    txDebit: {
      color: '#f87171',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.75)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: '#1e293b',
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
    },
    modalTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#f8fafc',
    },
    modalSub: {
      fontSize: 12,
      color: '#94a3b8',
      marginBottom: 14,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '600',
      color: '#cbd5e1',
      marginBottom: 6,
    },
    methodRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 12,
    },
    methodCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#0f172a',
      padding: 12,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#334155',
    },
    methodSelected: {
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    methodText: {
      fontSize: 12,
      color: '#94a3b8',
      fontWeight: '600',
    },
    methodTextSelected: {
      color: '#10b981',
    },
  });
