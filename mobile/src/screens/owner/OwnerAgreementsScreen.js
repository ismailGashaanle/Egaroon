import { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  StyleSheet,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import { ownerApi } from '../../api/owner';
import { useTheme } from '../../context/ThemeContext';
import { radii, spacing } from '../../theme';

const STATUS_CONFIG = {
  PENDING_ACCEPTANCE: {
    label: 'Sugaya aqbaliddaada',
    bg: '#FEF3C7',
    color: '#92400E',
    icon: 'time-outline',
  },
  ACTIVE: {
    label: 'Firfircoon (Active)',
    bg: '#D1FAE5',
    color: '#065F46',
    icon: 'checkmark-circle-outline',
  },
  REJECTED: {
    label: 'Waa la diiday',
    bg: '#FEE2E2',
    color: '#991B1B',
    icon: 'close-circle-outline',
  },
  DRAFT: {
    label: 'Qabyo (Draft)',
    bg: '#E5E7EB',
    color: '#374151',
    icon: 'document-text-outline',
  },
  SUSPENDED: {
    label: 'Hakad ku jira',
    bg: '#FFEDD5',
    color: '#9A3412',
    icon: 'pause-circle-outline',
  },
  SUPERSEDED: {
    label: 'Kii hore',
    bg: '#F3F4F6',
    color: '#6B7280',
    icon: 'archive-outline',
  },
};

export default function OwnerAgreementsScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [agreements, setAgreements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actingId, setActingId] = useState(null);

  // Reject modal state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectAgreementId, setRejectAgreementId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejecting, setRejecting] = useState(false);

  const loadAgreements = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await ownerApi.listAgreements();
      setAgreements(Array.isArray(data) ? data : []);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Heshiisyada',
        text2: err.message || 'Lama soo kicin karin heshiisyada',
      });
      setAgreements([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAgreements();
    }, [loadAgreements])
  );

  const handleAccept = (agreement) => {
    Alert.alert(
      'Aqbal Heshiiska?',
      `Ma hubtaa inaad aqbalayso heshiiskan v${agreement.version} ee garoonka ${agreement.stadiumName || 'garoonkaaga'}?`,
      [
        { text: 'Jooji', style: 'cancel' },
        {
          text: 'Haa, Aqbal',
          onPress: async () => {
            setActingId(agreement.id || agreement._id);
            try {
              await ownerApi.acceptAgreement(agreement.id || agreement._id);
              Toast.show({
                type: 'success',
                text1: 'Heshiiska waa la aqbalay',
                text2: 'Heshiiskani hadda wuu firfircoon yahay',
              });
              loadAgreements();
            } catch (err) {
              Toast.show({
                type: 'error',
                text1: 'Khalad',
                text2: err.message || 'Heshiiska lama aqbali karin',
              });
            } finally {
              setActingId(null);
            }
          },
        },
      ]
    );
  };

  const openRejectModal = (agreement) => {
    setRejectAgreementId(agreement.id || agreement._id);
    setRejectReason('');
    setRejectModalOpen(true);
  };

  const handleRejectConfirm = async () => {
    if (!rejectAgreementId) return;
    setRejecting(true);
    try {
      await ownerApi.rejectAgreement(rejectAgreementId, { reason: rejectReason.trim() });
      Toast.show({
        type: 'success',
        text1: 'Heshiiska waa la diiday',
        text2: 'Super Admin ayaa arki doona sababta aad u diidday',
      });
      setRejectModalOpen(false);
      loadAgreements();
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Khalad',
        text2: err.message || 'Lama diidi karin heshiiska',
      });
    } finally {
      setRejecting(false);
    }
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title="Heshiisyada Garoonka"
          subtitle="Revenue & Policy Agreements"
          onBack={() => navigation.goBack()}
        />

        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadAgreements(true)} />
          }
        >
          {loading && !refreshing ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.brandGreen} />
            </View>
          ) : agreements.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={44} color={colors.muted} />
              <Text style={styles.emptyTitle}>Heshiis ma jiro</Text>
              <Text style={styles.emptyText}>
                Weli heshiis revenue ah laguma samayn garoomadaada. Super Admin ayaa ku soo diri doona.
              </Text>
            </Card>
          ) : (
            agreements.map((agreement) => {
              const id = agreement.id || agreement._id;
              const isPending = agreement.status === 'PENDING_ACCEPTANCE';
              const isActing = actingId === id;
              const statusCfg = STATUS_CONFIG[agreement.status] || STATUS_CONFIG.DRAFT;
              const rules = agreement.rules || {};

              const feeDisplay =
                rules.bookingFeeCurrency === 'USD'
                  ? `$${Number(rules.bookingFeeAmount || 0).toFixed(2)}`
                  : `${rules.bookingFeeAmount} ${rules.bookingFeeCurrency || 'SLL'}`;

              const subDisplay =
                rules.subscriptionCurrency === 'USD'
                  ? `$${Number(rules.subscriptionAmount || 0).toFixed(2)}`
                  : `${rules.subscriptionAmount} ${rules.subscriptionCurrency || 'USD'}`;

              return (
                <Card
                  key={String(id)}
                  style={[
                    styles.agreementCard,
                    isPending && styles.pendingBorder,
                  ]}
                >
                  <View style={styles.topRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.stadiumName}>
                        {agreement.stadiumName || 'Garoon'}
                        {agreement.stadiumCity ? ` · ${agreement.stadiumCity}` : ''}
                      </Text>
                      <Text style={styles.versionText}>
                        Version {agreement.version} ·{' '}
                        {agreement.createdAt
                          ? new Date(agreement.createdAt).toLocaleDateString()
                          : ''}
                      </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: statusCfg.bg }]}>
                      <Ionicons name={statusCfg.icon} size={13} color={statusCfg.color} />
                      <Text style={[styles.badgeText, { color: statusCfg.color }]}>
                        {statusCfg.label}
                      </Text>
                    </View>
                  </View>

                  {/* Rules details box */}
                  <View style={styles.rulesBox}>
                    <Text style={styles.rulesHeader}>Shuruudaha Heshiiska</Text>

                    <View style={styles.ruleItem}>
                      <Text style={styles.ruleKey}>Habka (Model):</Text>
                      <Text style={styles.ruleVal}>
                        {rules.model ? rules.model.replace(/_/g, ' ') : '—'}
                      </Text>
                    </View>

                    {rules.bookingFeeEnabled ? (
                      <View style={styles.ruleItem}>
                        <Text style={styles.ruleKey}>Kharashka booking-ka:</Text>
                        <Text style={styles.ruleVal}>
                          {feeDisplay} / koox kasta ({rules.bookingFeePayer?.replace(/_/g, ' ') || 'each_team'})
                        </Text>
                      </View>
                    ) : null}

                    {rules.subscriptionEnabled ? (
                      <View style={styles.ruleItem}>
                        <Text style={styles.ruleKey}>Subscription:</Text>
                        <Text style={styles.ruleVal}>
                          {subDisplay} / {rules.subscriptionScope || 'stadium'} / bishii
                        </Text>
                      </View>
                    ) : null}

                    {rules.commissionEnabled ? (
                      <View style={styles.ruleItem}>
                        <Text style={styles.ruleKey}>Komishanka:</Text>
                        <Text style={styles.ruleVal}>
                          {Number(rules.commissionPercent || 0)}% oo kirada ah
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {agreement.notes ? (
                    <Text style={styles.notesText}>Fiiro: {agreement.notes}</Text>
                  ) : null}

                  {agreement.rejectReason ? (
                    <Text style={styles.rejectText}>Sababta diidmada: {agreement.rejectReason}</Text>
                  ) : null}

                  {/* Action buttons if pending */}
                  {isPending ? (
                    <View style={styles.actionBlock}>
                      <Text style={styles.actionHint}>
                        Fadlan dib u eeg oo xaqiiji heshiiskan si loogu dabaqo ballamaha cusub.
                      </Text>
                      <View style={styles.actionButtonsRow}>
                        <Button
                          title="Aqbal Heshiiska"
                          loading={isActing}
                          onPress={() => handleAccept(agreement)}
                          style={styles.acceptBtn}
                        />
                        <Button
                          title="Diid"
                          variant="ghost"
                          onPress={() => openRejectModal(agreement)}
                          style={styles.rejectBtn}
                        />
                      </View>
                    </View>
                  ) : null}
                </Card>
              );
            })
          )}
        </ScrollView>

        {/* Modal for rejecting agreement */}
        <Modal
          visible={rejectModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setRejectModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Diid Heshiiska</Text>
              <Text style={styles.modalSubtitle}>
                Geli sababta aad u diiday heshiiskan si Super Admin-ku wax uga beddelo.
              </Text>
              <TextField
                label="Sababta (ikhtiyaari)"
                value={rejectReason}
                onChangeText={setRejectReason}
                placeholder="Tusaale: Subscription-ka $7 aad buu u sarreeyaa…"
                multiline
                numberOfLines={3}
              />
              <View style={styles.modalActions}>
                <Button
                  title="Ka noqo"
                  variant="ghost"
                  onPress={() => setRejectModalOpen(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Xaqiiji Diidmada"
                  loading={rejecting}
                  onPress={handleRejectConfirm}
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.md, paddingBottom: 40 },
    center: { padding: 40, alignItems: 'center' },
    emptyCard: { padding: 32, alignItems: 'center', marginTop: 20 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptyText: {
      fontSize: 13,
      color: colors.muted,
      textAlign: 'center',
      marginTop: 6,
      lineHeight: 18,
    },
    agreementCard: { marginBottom: spacing.md, padding: spacing.md },
    pendingBorder: {
      borderWidth: 1.5,
      borderColor: '#F59E0B',
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 10,
    },
    stadiumName: { fontSize: 16, fontWeight: '700', color: colors.text },
    versionText: { fontSize: 12, color: colors.muted, marginTop: 2 },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: radii.sm,
      gap: 4,
    },
    badgeText: { fontSize: 11, fontWeight: '700' },
    rulesBox: {
      backgroundColor: colors.cardHover || 'rgba(0,0,0,0.03)',
      borderRadius: radii.sm,
      padding: spacing.sm,
      marginVertical: 8,
    },
    rulesHeader: {
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: colors.muted,
      marginBottom: 6,
    },
    ruleItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 3,
    },
    ruleKey: { fontSize: 13, color: colors.muted },
    ruleVal: { fontSize: 13, fontWeight: '600', color: colors.text },
    notesText: { fontSize: 12, color: colors.muted, fontStyle: 'italic', marginTop: 4 },
    rejectText: { fontSize: 12, color: '#DC2626', marginTop: 4 },
    actionBlock: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border || '#E5E7EB',
    },
    actionHint: { fontSize: 12, color: '#D97706', marginBottom: 8 },
    actionButtonsRow: {
      flexDirection: 'row',
      gap: 10,
    },
    acceptBtn: { flex: 2 },
    rejectBtn: { flex: 1 },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    modalContent: {
      backgroundColor: colors.card || '#FFFFFF',
      borderRadius: radii.md,
      padding: spacing.lg,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 4 },
    modalSubtitle: { fontSize: 13, color: colors.muted, marginBottom: 12 },
    modalActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  });
}
