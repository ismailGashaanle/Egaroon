import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import Toast from 'react-native-toast-message';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import TextField from '../../components/TextField';
import Chip from '../../components/Chip';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ownerApi } from '../../api/owner';
import { stadiumsApi } from '../../api/stadiums';
import { radii, spacing, typography } from '../../theme';

const DAYS = [
  { value: 0, label: 'Axad (Sunday)' },
  { value: 1, label: 'Isniin (Monday)' },
  { value: 2, label: 'Talaado (Tuesday)' },
  { value: 3, label: 'Arbaco (Wednesday)' },
  { value: 4, label: 'Khamiis (Thursday)' },
  { value: 5, label: 'Jimce (Friday)' },
  { value: 6, label: 'Sabti (Saturday)' },
];

export default function OwnerJoogtoScreen({ navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const [loading, setLoading] = useState(true);
  const [memberships, setMemberships] = useState([]);
  const [stadiums, setStadiums] = useState([]);
  const [fieldsList, setFieldsList] = useState([]);
  const [filterTab, setFilterTab] = useState('all'); // all, active, grace, expired
  const [search, setSearch] = useState('');
  const [expandedQr, setExpandedQr] = useState({});

  // Add Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    fieldId: '',
    teamName: '',
    captainName: '',
    captainPhone: '',
    dayOfWeek: 2, // Tuesday default (Talaado)
    startTimeLocal: '21:04',
    endTimeLocal: '22:00',
    monthlyFee: '83',
    currency: 'USD',
    gracePeriodDays: '4',
    isPaid: true,
    paymentMethod: 'cash',
  });

  // Renew / Mark Paid State
  const [payingId, setPayingId] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recData, stadData] = await Promise.all([
        ownerApi.listRecurring().catch(() => ({ items: [] })),
        stadiumsApi.mine().catch(() => ({ stadiums: [] })),
      ]);

      const items = Array.isArray(recData?.items)
        ? recData.items
        : Array.isArray(recData)
        ? recData
        : [];
      setMemberships(items);

      const stads = Array.isArray(stadData?.stadiums)
        ? stadData.stadiums
        : Array.isArray(stadData)
        ? stadData
        : [];
      setStadiums(stads);

      // Fetch all fields belonging to owner's stadiums
      const fieldPromises = stads.map(async (s) => {
        try {
          const res = await stadiumsApi.listFields(s._id || s.id);
          const fList = Array.isArray(res?.fields) ? res.fields : [];
          return fList.map((f) => ({
            ...f,
            stadiumId: s._id || s.id,
            stadiumName: s.name,
          }));
        } catch {
          return [];
        }
      });

      const nested = await Promise.all(fieldPromises);
      const allFields = nested.flat();
      setFieldsList(allFields);

      if (allFields.length > 0) {
        setForm((prev) => ({
          ...prev,
          fieldId: prev.fieldId || allFields[0]._id,
        }));
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Khalad', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Safe Scan Navigation helper to avoid payload errors
  const handleOpenScan = (code) => {
    try {
      navigation.navigate('ScanGate', code ? { bookingCode: code } : undefined);
    } catch {
      try {
        navigation.navigate('OwnerTabs', {
          screen: 'Scan',
          params: code ? { bookingCode: code } : undefined,
        });
      } catch {
        navigation.navigate('ManagerTabs', {
          screen: 'Scan',
          params: code ? { bookingCode: code } : undefined,
        });
      }
    }
  };

  // KPIs
  const stats = useMemo(() => {
    let active = 0;
    let grace = 0;
    let expired = 0;
    let totalGross = 0;
    let totalKulFee = 0;

    memberships.forEach((m) => {
      if (m.cardStatus === 'active') active++;
      else if (m.cardStatus === 'grace_period') grace++;
      else expired++;

      const fee = Number(m.monthlyFee || 0);
      const kFee = Number(m.kulansiiyeFee || 4.0);
      totalGross += fee;
      totalKulFee += kFee;
    });

    const netStadium = Math.max(0, totalGross - totalKulFee);
    return {
      total: memberships.length,
      active,
      grace,
      expired,
      totalGross,
      totalKulFee,
      netStadium,
    };
  }, [memberships]);

  // Filtered List
  const filteredMemberships = useMemo(() => {
    return memberships.filter((m) => {
      if (filterTab === 'active' && m.cardStatus !== 'active') return false;
      if (filterTab === 'grace' && m.cardStatus !== 'grace_period') return false;
      if (
        filterTab === 'expired' &&
        m.cardStatus !== 'expired' &&
        m.cardStatus !== 'blocked'
      )
        return false;

      if (search.trim()) {
        const q = search.toLowerCase();
        const tName = (m.teamName || '').toLowerCase();
        const cName = (m.captainName || '').toLowerCase();
        const cPhone = (m.captainPhone || '').toLowerCase();
        const cNum = (m.cardNumber || '').toLowerCase();
        return (
          tName.includes(q) ||
          cName.includes(q) ||
          cPhone.includes(q) ||
          cNum.includes(q)
        );
      }
      return true;
    });
  }, [memberships, filterTab, search]);

  const handleCreate = async () => {
    let targetFieldId = form.fieldId;
    if (!targetFieldId) {
      if (fieldsList.length > 0) {
        targetFieldId = fieldsList[0]._id;
      } else {
        Toast.show({
          type: 'error',
          text1: 'Dooro garoonka',
          text2: 'Ugu yaraan hal field ku dar garoonkaaga ka hor',
        });
        return;
      }
    }

    if (!form.teamName.trim()) {
      Toast.show({ type: 'error', text1: 'Geli magaca kooxda' });
      return;
    }

    setSubmitting(true);
    try {
      await ownerApi.createRecurring({
        fieldId: targetFieldId,
        teamName: form.teamName.trim(),
        captainName: form.captainName.trim(),
        captainPhone: form.captainPhone.trim(),
        dayOfWeek: Number(form.dayOfWeek),
        startTimeLocal: form.startTimeLocal.trim(),
        endTimeLocal: form.endTimeLocal.trim(),
        monthlyFee: Number(form.monthlyFee) || 83,
        currency: form.currency || 'USD',
        gracePeriodDays: Number(form.gracePeriodDays) || 4,
        isPaid: Boolean(form.isPaid),
        paymentMethod: form.paymentMethod || 'cash',
      });

      Toast.show({
        type: 'success',
        text1: 'Kooxda Joogtada ah waa la diiwaangeliyay! 🟢',
        text2: 'Kaarka VIP-da si toos ah ayaa loo abuuray.',
      });

      setModalOpen(false);
      setForm((prev) => ({
        ...prev,
        teamName: '',
        captainName: '',
        captainPhone: '',
      }));
      loadData();
    } catch (e) {
      Toast.show({
        type: 'error',
        text1: 'Diiwaangelinta waa fashilantay',
        text2: e?.response?.data?.message || e.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkPaid = (item) => {
    Alert.alert(
      'Xaqiiji Lacagta Bisha',
      `Ma hubtaa inaad xaqiijisay lacagta bisha kooxda "${item.teamName}" ($${item.monthlyFee} ${item.currency || 'USD'})?\n\nKaarka waxaa loogu kordhinayaa 1 bil oo cusub.`,
      [
        { text: 'Jooji', style: 'cancel' },
        {
          text: 'Haa, Xaqiiji',
          style: 'default',
          onPress: async () => {
            setPayingId(item._id);
            try {
              const res = await ownerApi.markJoogtoPaid(item._id, {
                amountPaid: item.monthlyFee,
                currency: item.currency || 'USD',
                paymentMethod: 'cash',
                notes: 'Mobile Owner / Manager Renewal',
              });
              Toast.show({
                type: 'success',
                text1: 'Lacagta waa la xaqiijiyay! 🟢',
                text2: `Kaarka waa firfircoonyahay ilaa 1 bil (${res.receipt?.receiptNumber || ''})`,
              });
              loadData();
            } catch (err) {
              Toast.show({
                type: 'error',
                text1: 'Fashil',
                text2: err?.response?.data?.message || err.message,
              });
            } finally {
              setPayingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (item) => {
    Alert.alert(
      'Tir Kooxda Joogtada ah',
      `Ma hubtaa inaad tirtirto kaarka iyo ballanta joogtada ah ee kooxda "${item.teamName}"?`,
      [
        { text: 'Jooji', style: 'cancel' },
        {
          text: 'Tir',
          style: 'destructive',
          onPress: async () => {
            try {
              await ownerApi.deleteRecurring(item._id);
              Toast.show({ type: 'success', text1: 'Waa la tirtiray' });
              loadData();
            } catch (e) {
              Toast.show({ type: 'error', text1: 'Khalad', text2: e.message });
            }
          },
        },
      ]
    );
  };

  const dayLabel = (d) => {
    const found = DAYS.find((x) => x.value === d);
    return found ? found.label.split(' ')[0] : `Maalinta ${d}`;
  };

  return (
    <View style={styles.screen}>
      <Header
        title="Ciyaaraha Joogto"
        subtitle="VIP Membership & Anti-Scam"
        variant="green"
      />

      {/* Action Strip: Quick Gate Scan & Add Team */}
      <View style={styles.topActions}>
        <Pressable
          style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.9 }]}
          onPress={() => handleOpenScan()}
        >
          <Ionicons name="scan-circle" size={22} color="#fff" />
          <Text style={styles.scanBtnText}>Scan Albaabka</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
          onPress={() => {
            if (fieldsList.length > 0 && !form.fieldId) {
              setForm((prev) => ({ ...prev, fieldId: fieldsList[0]._id }));
            }
            setModalOpen(true);
          }}
        >
          <Ionicons name="add-circle" size={22} color="#fff" />
          <Text style={styles.addBtnText}>Ku dar Koox</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={loadData} />}
      >
        {/* KPI Summary Cards */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.kpiScroll}>
          <Card style={[styles.kpiCard, { borderColor: '#10b981' }]}>
            <Text style={styles.kpiLabel}>Kooxaha Joogtada ah</Text>
            <Text style={[styles.kpiVal, { color: '#10b981' }]}>{stats.total}</Text>
            <Text style={styles.kpiSub}>
              🟢 {stats.active} Firfircoon · 🟡 {stats.grace} Grace
            </Text>
          </Card>

          <Card style={[styles.kpiCard, { borderColor: '#38bdf8' }]}>
            <Text style={styles.kpiLabel}>Dakhliga Bisha (Gross)</Text>
            <Text style={[styles.kpiVal, { color: '#0284c7' }]}>${stats.totalGross}</Text>
            <Text style={styles.kpiSub}>Dakhliga guud ee kooxaha</Text>
          </Card>

          <Card style={[styles.kpiCard, { borderColor: '#6366f1' }]}>
            <Text style={styles.kpiLabel}>Net Garoonka (Bisha)</Text>
            <Text style={[styles.kpiVal, { color: '#4f46e5' }]}>${stats.netStadium}</Text>
            <Text style={styles.kpiSub}>E-Garoon fee: -${stats.totalKulFee}</Text>
          </Card>
        </ScrollView>

        {/* Search Bar */}
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Raadi koox, kabtan, nambar, ama JG-..."
            placeholderTextColor={colors.muted}
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <Chip
            label={`Dhammaan (${memberships.length})`}
            selected={filterTab === 'all'}
            onPress={() => setFilterTab('all')}
          />
          <Chip
            label={`Firfircoon (${stats.active})`}
            selected={filterTab === 'active'}
            onPress={() => setFilterTab('active')}
          />
          <Chip
            label={`Muddo-dhaaf (${stats.grace})`}
            selected={filterTab === 'grace'}
            onPress={() => setFilterTab('grace')}
          />
          <Chip
            label={`Xidhan (${stats.expired})`}
            selected={filterTab === 'expired'}
            onPress={() => setFilterTab('expired')}
          />
        </View>

        {/* List of Permanent Matches */}
        {loading && !memberships.length ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : filteredMemberships.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons name="card-outline" size={48} color={colors.muted} />
            <Text style={styles.emptyTitle}>Kooxo joogto ah lama helin</Text>
            <Text style={styles.emptySub}>
              Riix "Ku dar Koox" si aad u diiwaangeliso koox joogto ah oo aad ugu abuurto Kaadhka VIP-da.
            </Text>
          </Card>
        ) : (
          filteredMemberships.map((item) => {
            const isOk = item.cardStatus === 'active';
            const isGrace = item.cardStatus === 'grace_period';

            const badgeBg = isOk ? '#059669' : isGrace ? '#d97706' : '#dc2626';
            const badgeText = isOk
              ? 'FIRFIRCOON (ANSAX)'
              : isGrace
              ? `MUDDO-DHAAF (${item.daysRemainingInGrace || 0}d)`
              : 'XIDHAN / DHACAY';

            const qrPayload = JSON.stringify({
              type: 'joogto_card',
              cardNumber: item.cardNumber,
              token: item.qrSignature,
              pin: item.securityPin,
              stadiumId: item.stadium?._id || item.stadium,
            });

            const isQrOpen = Boolean(expandedQr[item._id]);
            const validUntilStr = item.billingCycle?.endDate
              ? new Date(item.billingCycle.endDate).toLocaleDateString()
              : '—';

            return (
              <Card
                key={item._id}
                style={[
                  styles.teamCard,
                  { borderLeftWidth: 4, borderLeftColor: badgeBg },
                ]}
              >
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.teamName}>{item.teamName}</Text>
                    <Text style={styles.fieldInfo}>
                      {item.stadium?.name || 'Garoonka'} · {item.field?.name || 'Field'}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: badgeBg }]}>
                    <Text style={styles.badgeText}>{badgeText}</Text>
                  </View>
                </View>

                {/* Card Number & PIN pill */}
                <View style={styles.secStrip}>
                  <View>
                    <Text style={styles.secLabel}>KAARKA ID</Text>
                    <Text style={styles.secVal}>{item.cardNumber}</Text>
                  </View>
                  <View>
                    <Text style={styles.secLabel}>PIN SIR AH</Text>
                    <Text style={[styles.secVal, { color: '#0284c7' }]}>
                      {item.securityPin || '****'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.secLabel}>WAQTIGA</Text>
                    <Text style={styles.secVal}>
                      {dayLabel(item.dayOfWeek)} · {item.startTimeLocal}–{item.endTimeLocal}
                    </Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.metaBlock}>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Kabtanka:</Text>
                    <Text style={styles.metaVal}>
                      {item.captainName || '—'} ({item.captainPhone || '—'})
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Ansax ilaa:</Text>
                    <Text style={styles.metaVal}>{validUntilStr}</Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Lacagta Bisha:</Text>
                    <Text style={[styles.metaVal, { color: colors.brandGreen, fontWeight: '700' }]}>
                      ${item.monthlyFee} {item.currency || 'USD'}
                    </Text>
                  </View>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaLabel}>Net Garoonka:</Text>
                    <Text style={styles.metaVal}>
                      ${item.stadiumShare ?? Math.max(0, item.monthlyFee - (item.kulansiiyeFee || 4))} (Fee: -${item.kulansiiyeFee || 4})
                    </Text>
                  </View>
                </View>

                {/* QR Display */}
                {isQrOpen && (
                  <View style={styles.qrBox}>
                    <QRCode value={qrPayload} size={150} />
                    <Text style={styles.qrHint}>Ku qabo scanner-ka albaabka</Text>
                    <Text style={styles.qrSec}>Saxiix cryptographic ah oo sugan</Text>
                  </View>
                )}

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  <Button
                    title={isQrOpen ? 'Qari QR' : 'Tus QR Code'}
                    variant="outline"
                    onPress={() =>
                      setExpandedQr((prev) => ({ ...prev, [item._id]: !prev[item._id] }))
                    }
                    style={styles.cardActionBtn}
                  />

                  <Button
                    title="Hubi Albaabka"
                    variant="outline"
                    onPress={() => handleOpenScan(item.cardNumber)}
                    style={styles.cardActionBtn}
                  />

                  <Button
                    title={
                      payingId === item._id
                        ? 'Xaqiijinaya...'
                        : `Xaqiiji Lacagta ($${item.monthlyFee})`
                    }
                    variant="primary"
                    loading={payingId === item._id}
                    onPress={() => handleMarkPaid(item)}
                    style={styles.cardActionBtn}
                  />

                  <Pressable
                    style={styles.deleteBtn}
                    onPress={() => handleDelete(item)}
                    hitSlop={8}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>

      {/* Add Permanent Team Modal */}
      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ku dar Koox Joogto ah</Text>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.charcoal} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody}>
              {/* Field Select */}
              <Text style={styles.fieldLabel}>Dooro Garoonka (Field) *</Text>
              {fieldsList.length === 0 ? (
                <View style={styles.noFieldBox}>
                  <Ionicons name="alert-circle" size={18} color="#d97706" />
                  <Text style={styles.noFieldText}>
                    Garoomo (Fields) lama helin. Fadlan hubi in garoonkaagu leeyahay ugu yaraan 1 field oo firfircoon.
                  </Text>
                </View>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                  {fieldsList.map((f) => {
                    const isSelected = form.fieldId === f._id;
                    return (
                      <Pressable
                        key={f._id}
                        onPress={() => setForm({ ...form, fieldId: f._id })}
                        style={[
                          styles.fieldSelectPill,
                          isSelected && styles.fieldSelectPillActive,
                        ]}
                      >
                        <Ionicons
                          name={isSelected ? 'checkmark-circle' : 'football-outline'}
                          size={18}
                          color={isSelected ? '#fff' : colors.brandGreen}
                        />
                        <View>
                          <Text style={[styles.fieldPillTitle, isSelected && { color: '#fff' }]}>
                            {f.name} {f.type ? `(${f.type})` : ''}
                          </Text>
                          <Text style={[styles.fieldPillSub, isSelected && { color: 'rgba(255,255,255,0.85)' }]}>
                            {f.stadiumName}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              <TextField
                label="Magaca Kooxda (Team Name) *"
                placeholder="Tusaale: Teachers FC"
                value={form.teamName}
                onChangeText={(t) => setForm({ ...form, teamName: t })}
              />

              <TextField
                label="Magaca Kabtanka"
                placeholder="Tusaale: Abdi Ahmed"
                value={form.captainName}
                onChangeText={(t) => setForm({ ...form, captainName: t })}
              />

              <TextField
                label="Telefoonka Kabtanka"
                placeholder="063XXXXXXX ama 061XXXXXXX"
                keyboardType="phone-pad"
                value={form.captainPhone}
                onChangeText={(t) => setForm({ ...form, captainPhone: t })}
              />

              {/* Day of Week */}
              <Text style={styles.fieldLabel}>Maalinta Ciyaarta *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {DAYS.map((d) => (
                  <Chip
                    key={d.value}
                    label={d.label}
                    selected={form.dayOfWeek === d.value}
                    onPress={() => setForm({ ...form, dayOfWeek: d.value })}
                  />
                ))}
              </ScrollView>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Bilaabashada"
                    placeholder="21:04 ama 09:04 PM"
                    value={form.startTimeLocal}
                    onChangeText={(t) => setForm({ ...form, startTimeLocal: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Dhamaadka"
                    placeholder="22:00 ama 10:00 PM"
                    value={form.endTimeLocal}
                    onChangeText={(t) => setForm({ ...form, endTimeLocal: t })}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Lacagta Bisha ($)"
                    placeholder="83"
                    keyboardType="numeric"
                    value={form.monthlyFee}
                    onChangeText={(t) => setForm({ ...form, monthlyFee: t })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TextField
                    label="Grace Days (Muddo-dhaaf)"
                    placeholder="4"
                    keyboardType="numeric"
                    value={form.gracePeriodDays}
                    onChangeText={(t) => setForm({ ...form, gracePeriodDays: t })}
                  />
                </View>
              </View>

              {/* Toggle Paid */}
              <Pressable
                style={styles.paidToggle}
                onPress={() => setForm((prev) => ({ ...prev, isPaid: !prev.isPaid }))}
              >
                <Ionicons
                  name={form.isPaid ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={form.isPaid ? colors.brandGreen : colors.muted}
                />
                <Text style={styles.paidToggleText}>
                  Bishii hore waa la bixiyay (Mark 1st month as paid)
                </Text>
              </Pressable>

              <Button
                title={submitting ? 'Diiwaangelinaya...' : 'Diiwaangeli oo Abuur Kaarka'}
                variant="primary"
                loading={submitting}
                onPress={handleCreate}
                style={{ marginTop: 16, marginBottom: 24 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    topActions: {
      flexDirection: 'row',
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      gap: 10,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    scanBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brandGreen,
      paddingVertical: 10,
      borderRadius: radii.md,
      gap: 6,
    },
    scanBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    addBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#0284c7',
      paddingVertical: 10,
      borderRadius: radii.md,
      gap: 6,
    },
    addBtnText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 14,
    },
    body: {
      padding: spacing.md,
      paddingBottom: 40,
    },
    kpiScroll: {
      marginBottom: spacing.md,
    },
    kpiCard: {
      width: 175,
      padding: 12,
      marginRight: 10,
      borderWidth: 1.5,
      borderRadius: radii.md,
    },
    kpiLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 4,
    },
    kpiVal: {
      fontSize: 22,
      fontWeight: '800',
      marginBottom: 2,
    },
    kpiSub: {
      fontSize: 10,
      color: colors.muted,
      fontWeight: '500',
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      height: 42,
      marginBottom: 10,
      gap: 8,
    },
    searchInput: {
      flex: 1,
      fontSize: 13,
      color: colors.charcoal,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 14,
    },
    emptyCard: {
      alignItems: 'center',
      paddingVertical: 40,
      paddingHorizontal: 20,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.charcoal,
      marginTop: 12,
      marginBottom: 6,
    },
    emptySub: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 18,
    },
    teamCard: {
      marginBottom: spacing.md,
      padding: spacing.md,
      borderRadius: radii.md,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    teamName: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.charcoal,
    },
    fieldInfo: {
      fontSize: 12,
      color: colors.muted,
      marginTop: 2,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radii.full,
    },
    badgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '700',
    },
    secStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 8,
      borderRadius: radii.sm,
      marginBottom: 10,
    },
    secLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.muted,
      letterSpacing: 0.5,
    },
    secVal: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.charcoal,
      marginTop: 1,
    },
    metaBlock: {
      gap: 4,
      marginBottom: 10,
    },
    metaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    metaLabel: {
      fontSize: 12,
      color: colors.muted,
    },
    metaVal: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.charcoal,
    },
    qrBox: {
      alignItems: 'center',
      backgroundColor: '#fff',
      padding: 14,
      borderRadius: radii.sm,
      marginVertical: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    qrHint: {
      fontSize: 12,
      fontWeight: '700',
      color: '#0f172a',
      marginTop: 8,
    },
    qrSec: {
      fontSize: 10,
      color: '#64748b',
    },
    cardActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    cardActionBtn: {
      flex: 1,
      height: 38,
    },
    deleteBtn: {
      padding: 8,
      borderRadius: radii.sm,
      backgroundColor: '#fee2e2',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.charcoal,
    },
    modalBody: {
      padding: spacing.md,
    },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.charcoal,
      marginBottom: 6,
    },
    noFieldBox: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fffbeb',
      padding: 10,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: '#fde68a',
      marginBottom: 12,
      gap: 8,
    },
    noFieldText: {
      flex: 1,
      fontSize: 12,
      color: '#92400e',
      lineHeight: 16,
    },
    fieldSelectPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.md,
      marginRight: 8,
      gap: 8,
    },
    fieldSelectPillActive: {
      backgroundColor: '#059669',
      borderColor: '#059669',
    },
    fieldPillTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.charcoal,
    },
    fieldPillSub: {
      fontSize: 11,
      color: colors.muted,
    },
    formRow: {
      flexDirection: 'row',
      gap: 10,
    },
    paidToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginVertical: 8,
    },
    paidToggleText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.charcoal,
    },
  });
}
