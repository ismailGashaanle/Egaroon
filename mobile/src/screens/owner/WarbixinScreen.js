import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import StaffHero from '../../components/StaffHero';
import Chip from '../../components/Chip';
import TextField from '../../components/TextField';
import ReportKpiCard from '../../components/owner/ReportKpiCard';
import {
  ReportBarChart,
  ReportAreaChart,
  ReportHorizontalBars,
  ReportPanel,
  ReportPeakHours,
  ReportStatusPills,
  ReportPanelIcon,
} from '../../components/owner/ReportCharts';
import { ownerApi } from '../../api/owner';
import { stadiumsApi } from '../../api/stadiums';
import { useAuth } from '../../context/AuthContext';
import { useAuthFeatures } from '../../hooks/useAuthFeatures';
import { useTheme } from '../../context/ThemeContext';
import { money, formatWhen } from '../../lib/ownerDisplay';
import { shareReportExport } from '../../lib/shareReport';
import { REPORT_BRAND, formatChartDay, labelForStatus } from '../../lib/reportBrand';
import { ROLES, statusColor } from '../../lib/roles';
import { radii, spacing, typography } from '../../theme';

const DAY_OPTIONS = [7, 14, 30, 90];

export default function WarbixinScreen() {
  const navigation = useNavigation();
  const { colors, shadows } = useTheme();
  const { user } = useAuth();
  const { ownerCommissionVisible } = useAuthFeatures();
  const styles = makeStyles(colors, shadows);

  const isOwner = user?.role === ROLES.STADIUM_OWNER;
  const showCommission = isOwner && ownerCommissionVisible;

  const [reports, setReports] = useState(null);
  const [slotReport, setSlotReport] = useState(null);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(null);
  const [stadiumId, setStadiumId] = useState('');
  const [days, setDays] = useState(14);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [datesOpen, setDatesOpen] = useState(false);

  const queryParams = useMemo(() => {
    const params = {};
    if (stadiumId) params.stadiumId = stadiumId;
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      params.from = from;
      params.to = to;
    } else {
      params.days = Number(days) || 14;
    }
    return params;
  }, [stadiumId, days, from, to]);

  const loadStadiums = useCallback(async () => {
    try {
      const data = await stadiumsApi.mine();
      setStadiums(data.stadiums || []);
    } catch {
      setStadiums([]);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rep, slots] = await Promise.all([
        ownerApi.reports(queryParams),
        ownerApi.slotReports(queryParams).catch(() => null),
      ]);
      setReports(rep?.reports || rep || null);
      setSlotReport(slots?.report || slots || null);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Warbixin', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useFocusEffect(
    useCallback(() => {
      loadStadiums();
      load();
    }, [loadStadiums, load])
  );

  const onExport = async (format) => {
    setExporting(format);
    try {
      const res = await ownerApi.exportReports({ ...queryParams, format });
      await shareReportExport(res.data, format);
      Toast.show({ type: 'success', text1: `Export ${format.toUpperCase()} diyaar` });
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Export', text2: e.message });
    } finally {
      setExporting(null);
    }
  };

  const pickDays = (n) => {
    setDays(n);
    setFrom('');
    setTo('');
  };

  const hourData = useMemo(
    () => (reports?.bookingsByHour || []).filter((h) => h.count > 0),
    [reports]
  );
  const revenueBars = useMemo(
    () =>
      (reports?.bookingsByDay || []).map((d) => ({
        date: d.date,
        revenue: Number(d.revenue) || 0,
      })),
    [reports]
  );
  const periodDays = reports?.days || Number(days) || 14;
  const dakhli = isOwner ? money(reports?.revenueSettled) : '—';
  const history = (slotReport?.bookingHistory || []).slice(0, 25);
  const weeks = reports?.bookingsByWeek || [];

  return (
    <FadeIn>
      <View style={styles.screen}>
        <StaffHero
          kicker={isOwner ? 'Aragtida milkiilaha' : 'Aragtida maamulaha'}
          title="Warbixin"
          subtitle="Ballamo, lacagta, fields, iyo feedback — sidii web."
        >
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{reports?.todayBookings ?? '—'}</Text>
              <Text style={styles.heroStatL}>Maanta</Text>
            </View>
            <View style={styles.heroStatDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{reports?.totalBookings ?? '—'}</Text>
              <Text style={styles.heroStatL}>Ballamo</Text>
            </View>
            <View style={styles.heroStatDiv} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatN}>{dakhli}</Text>
              <Text style={styles.heroStatL}>Dakhli</Text>
            </View>
          </View>
        </StaffHero>

        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        >
          <Animated.View entering={FadeInDown.duration(360)} style={styles.sheet}>
            {stadiums.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                <Chip
                  label="Dhammaan"
                  selected={!stadiumId}
                  onPress={() => setStadiumId('')}
                  style={styles.chip}
                />
                {stadiums.map((s) => (
                  <Chip
                    key={String(s._id)}
                    label={s.name}
                    selected={stadiumId === String(s._id)}
                    onPress={() => setStadiumId(String(s._id))}
                    style={styles.chip}
                  />
                ))}
              </ScrollView>
            ) : null}

            <View style={styles.chipRowWrap}>
              {DAY_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  label={`${n} maalmood`}
                  selected={!from && !to && days === n}
                  onPress={() => pickDays(n)}
                  style={styles.chip}
                />
              ))}
              <Chip
                label="Taariikh"
                selected={datesOpen || Boolean(from || to)}
                onPress={() => setDatesOpen((v) => !v)}
                style={styles.chip}
              />
            </View>

            {datesOpen ? (
              <View style={styles.dateRow}>
                <TextField
                  label="Laga bilaabo"
                  value={from}
                  onChangeText={setFrom}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  style={styles.dateField}
                />
                <TextField
                  label="Ilaa"
                  value={to}
                  onChangeText={setTo}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  style={styles.dateField}
                />
              </View>
            ) : null}

            <View style={styles.exportRow}>
              <Pressable
                onPress={() =>
                  navigation.navigate('BookingsSearch')
                }
                style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.9 }]}
              >
                <Ionicons name="qr-code-outline" size={18} color={colors.brandNavy} />
                <Text style={styles.exportText}>Albaabka</Text>
              </Pressable>
              <Pressable
                onPress={() => onExport('xlsx')}
                style={({ pressed }) => [styles.exportBtn, pressed && { opacity: 0.9 }]}
              >
                {exporting === 'xlsx' ? (
                  <ActivityIndicator color={colors.brandNavy} />
                ) : (
                  <>
                    <Ionicons name="download-outline" size={18} color={colors.brandNavy} />
                    <Text style={styles.exportText}>Excel</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                onPress={() => onExport('pdf')}
                style={({ pressed }) => [styles.exportBtnGreen, pressed && { opacity: 0.9 }]}
              >
                {exporting === 'pdf' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="document-text-outline" size={18} color="#fff" />
                    <Text style={styles.exportTextGreen}>PDF</Text>
                  </>
                )}
              </Pressable>
            </View>

            {loading && !reports ? (
              <ActivityIndicator color={colors.brandGreen} style={{ marginVertical: 28 }} />
            ) : reports ? (
              <>
                <View style={styles.exchangeRateBanner}>
                  <Text style={styles.exchangeRateText}>
                    Sarifka Maanta: $1 = {Number(reports.sllPerUsd || 8500).toLocaleString()} SlSh
                  </Text>
                  <Text style={styles.currencyBreakdownText}>
                    💵 {reports.currencyBreakdown?.countPaidUsd || 0} USD · SlSh: {reports.currencyBreakdown?.countPaidSll || 0}
                  </Text>
                </View>

                <View style={styles.kpiGrid}>
                  <ReportKpiCard
                    style={styles.kpi}
                    icon={(fg) => <Ionicons name="calendar-outline" size={18} color={fg} />}
                    label="Ciyaaraha maanta"
                    value={reports.todayBookings ?? 0}
                    hint="Ciyaaro maanta la qorsheeyay"
                  />
                  <ReportKpiCard
                    style={styles.kpi}
                    tone="olive"
                    icon={(fg) => <Ionicons name="layers-outline" size={18} color={fg} />}
                    label="Ballamo (muddo)"
                    value={reports.totalBookings ?? 0}
                    hint={`${periodDays} maalmood`}
                  />
                  <ReportKpiCard
                    style={styles.kpi}
                    tone="orange"
                    icon={(fg) => <Ionicons name="cash-outline" size={18} color={fg} />}
                    label="Dakhliga"
                    value={
                      isOwner && reports.revenueSettled != null
                        ? `${money(reports.revenueSettled)}\n(${Number(reports.revenueSettledSll || Math.round(reports.revenueSettled * (reports.sllPerUsd || 8500))).toLocaleString()} SlSh)`
                        : '—'
                    }
                    hint="Lacag la xaqiijiyay muddadan"
                  />
                  {showCommission ? (
                    <ReportKpiCard
                      style={styles.kpi}
                      tone="charcoal"
                      icon={(fg) => <Ionicons name="pie-chart-outline" size={18} color={fg} />}
                      label="Commission"
                      value={
                        reports.commissionTotal != null ? money(reports.commissionTotal) : '—'
                      }
                    />
                  ) : null}
                  <ReportKpiCard
                    style={styles.kpi}
                    tone="olive"
                    icon={(fg) => <Ionicons name="star-outline" size={18} color={fg} />}
                    label="Qiimaynta"
                    value={reports.avgRating || '—'}
                    hint={`${reports.reviewCount || 0} faallo`}
                  />
                </View>

                {slotReport?.totals ? (
                  <View style={styles.kpiGrid}>
                    <ReportKpiCard
                      style={styles.kpi}
                      icon={(fg) => <Ionicons name="checkmark-circle-outline" size={18} color={fg} />}
                      label="La kiraystay"
                      value={slotReport.totals.bookedSlots}
                    />
                    <ReportKpiCard
                      style={styles.kpi}
                      tone="olive"
                      icon={(fg) => <Ionicons name="time-outline" size={18} color={fg} />}
                      label="Banaan"
                      value={slotReport.totals.availableRemaining}
                    />
                    <ReportKpiCard
                      style={styles.kpi}
                      tone="orange"
                      icon={(fg) => <Ionicons name="alert-circle-outline" size={18} color={fg} />}
                      label="Waqti lumay"
                      value={slotReport.totals.lostSlots}
                    />
                    <ReportKpiCard
                      style={styles.kpi}
                      icon={(fg) => <Ionicons name="bar-chart-outline" size={18} color={fg} />}
                      label="Isticmaalka"
                      value={`${slotReport.totals.utilizationPercent ?? 0}%`}
                      hint={`${slotReport.totals.unbookedDayCount || 0} maalmood aan la kiraysan`}
                    />
                  </View>
                ) : null}

                <ReportPanel
                  title="Ballamo maalinle"
                  icon={<ReportPanelIcon name="bar-chart-outline" />}
                >
                  <ReportBarChart
                    data={reports.bookingsByDay || []}
                    color={REPORT_BRAND.forest}
                    emptyLabel="Xog ma jirto weli."
                  />
                </ReportPanel>

                <ReportPanel
                  title="Dakhliga waqtiga"
                  icon={<ReportPanelIcon name="cash-outline" />}
                >
                  {isOwner ? (
                    <ReportAreaChart
                      data={revenueBars}
                      valueKey="revenue"
                      color={REPORT_BRAND.olive}
                      emptyLabel="Xog ma jirto weli."
                    />
                  ) : (
                    <Text style={styles.mutedCenter}>Dakhliga waa milkiile kaliya.</Text>
                  )}
                </ReportPanel>

                <ReportPanel
                  title="Isku-dhafka xaaladda"
                  icon={<ReportPanelIcon name="layers-outline" />}
                >
                  <ReportStatusPills
                    items={reports.bookingsByStatus || []}
                    emptyLabel="Xog ma jirto weli."
                  />
                </ReportPanel>

                <ReportPanel
                  title="Garoomada ugu sareeya"
                  icon={<ReportPanelIcon name="football-outline" />}
                >
                  <ReportHorizontalBars
                    data={(reports.byField || []).slice(0, 6)}
                    emptyLabel="Xog ma jirto weli."
                  />
                </ReportPanel>

                <ReportPanel
                  title="Saacadaha ugu badan"
                  icon={<ReportPanelIcon name="time-outline" />}
                >
                  <ReportPeakHours data={hourData} emptyLabel="Xog ma jirto weli." />
                </ReportPanel>

                {slotReport?.byDay?.length ? (
                  <>
                    <ReportPanel
                      title="Waqti lumay maalintiiba"
                      icon={<ReportPanelIcon name="bar-chart-outline" />}
                    >
                      <ReportBarChart
                        data={slotReport.byDay}
                        valueKey="lost"
                        color={REPORT_BRAND.orange}
                        emptyLabel="Xog ma jirto weli."
                      />
                    </ReportPanel>
                    <ReportPanel
                      title="Fields — lumay / isticmaal"
                      icon={<ReportPanelIcon name="grid-outline" />}
                    >
                      <ReportHorizontalBars
                        data={(slotReport.byField || []).slice(0, 8).map((f) => ({
                          name: `${f.fieldName} (${f.utilizationPercent}%)`,
                          bookings: f.lostSlots,
                        }))}
                        barColor={REPORT_BRAND.orange}
                        emptyLabel="Xog ma jirto weli."
                      />
                    </ReportPanel>
                  </>
                ) : null}

                <ReportPanel
                  title="Taariikhda ballamaha"
                  icon={<ReportPanelIcon name="list-outline" />}
                  action={
                    history.length ? (
                      <Text style={styles.historyCount}>{history.length} ciyaarood</Text>
                    ) : null
                  }
                >
                  {!history.length ? (
                    <Text style={styles.mutedCenter}>Xog ma jirto weli.</Text>
                  ) : (
                    history.map((row) => (
                      <Pressable
                        key={String(row.id)}
                        onPress={() =>
                          row.id &&
                          navigation.navigate('OwnerBookingDetail', {
                            bookingId: String(row.id),
                          })
                        }
                        style={styles.histRow}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.histWhen}>{formatWhen(row.startTime)}</Text>
                          <Text style={styles.histVenue} numberOfLines={1}>
                            {row.stadium || 'Garoon'}
                            {row.field ? ` · ${row.field}` : ''}
                          </Text>
                          <Text style={styles.histTeams} numberOfLines={1}>
                            {row.teamA || '—'}
                            {row.teamB ? ` vs ${row.teamB}` : ''}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.histBadge,
                            { backgroundColor: `${statusColor(row.status)}22` },
                          ]}
                        >
                          <Text style={[styles.histBadgeText, { color: statusColor(row.status) }]}>
                            {labelForStatus(row.status)}
                          </Text>
                        </View>
                      </Pressable>
                    ))
                  )}
                </ReportPanel>

                <ReportPanel
                  title="Captains ballansaday"
                  icon={<ReportPanelIcon name="people-outline" />}
                >
                  <ReportHorizontalBars
                    data={(reports.captains || []).slice(0, 8).map((c) => ({
                      name: c.name,
                      bookings: c.bookings,
                    }))}
                    emptyLabel="Xog ma jirto weli."
                  />
                </ReportPanel>

                {weeks.length ? (
                  <ReportPanel
                    title="Toddobaadkii"
                    icon={<ReportPanelIcon name="calendar-outline" />}
                  >
                    <View style={styles.weekHead}>
                      <Text style={[styles.weekCell, styles.weekH]}>Toddobaad</Text>
                      <Text style={[styles.weekCell, styles.weekH, styles.weekNum]}>Ballamo</Text>
                      {isOwner ? (
                        <Text style={[styles.weekCell, styles.weekH, styles.weekNum]}>Dakhli</Text>
                      ) : null}
                    </View>
                    {weeks.map((w) => (
                      <View key={w.weekStart} style={styles.weekRow}>
                        <Text style={styles.weekCell}>{formatChartDay(w.weekStart)}</Text>
                        <Text style={[styles.weekCell, styles.weekNum]}>{w.count}</Text>
                        {isOwner ? (
                          <Text style={[styles.weekCell, styles.weekNum]}>
                            {w.revenue != null ? money(w.revenue) : '—'}
                          </Text>
                        ) : null}
                      </View>
                    ))}
                  </ReportPanel>
                ) : null}
              </>
            ) : null}
          </Animated.View>
        </ScrollView>
      </View>
    </FadeIn>
  );
}

function makeStyles(colors, shadows) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderRadius: 16,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
      paddingVertical: 10,
      paddingHorizontal: 8,
    },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatN: { color: '#fff', fontSize: 18, fontWeight: '800' },
    heroStatL: { marginTop: 2, color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '700' },
    heroStatDiv: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.18)' },
    scroll: { paddingBottom: 48 },
    sheet: {
      marginTop: -18,
      paddingHorizontal: spacing.md,
    },
    chipRow: { gap: 8, paddingBottom: 10 },
    chipRowWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    chip: { minWidth: 0, flexGrow: 0 },
    dateRow: { flexDirection: 'row', gap: 10 },
    dateField: { flex: 1, marginBottom: 8 },
    exportRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    exportBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 12,
      ...shadows.soft,
    },
    exportBtnGreen: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.brandGreen,
      borderRadius: 14,
      paddingVertical: 12,
      ...shadows.soft,
    },
    exportText: { fontWeight: '800', color: colors.brandNavy, fontSize: 13 },
    exportTextGreen: { fontWeight: '800', color: '#fff', fontSize: 13 },
    exchangeRateBanner: {
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.22)',
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: 6,
    },
    exchangeRateText: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brandGreen,
    },
    currencyBreakdownText: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
    },
    kpiGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 12,
    },
    kpi: { width: '47.5%', flexGrow: 1, maxWidth: '48.5%' },
    mutedCenter: {
      ...typography.caption,
      color: colors.muted,
      textAlign: 'center',
      paddingVertical: 28,
      fontWeight: '600',
    },
    historyCount: { fontSize: 12, fontWeight: '700', color: colors.muted },
    histRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    histWhen: { fontSize: 13, fontWeight: '800', color: colors.text },
    histVenue: { marginTop: 2, fontSize: 12, fontWeight: '600', color: colors.text },
    histTeams: { marginTop: 2, fontSize: 12, color: colors.muted },
    histBadge: {
      borderRadius: radii.full,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    histBadgeText: { fontSize: 10, fontWeight: '800' },
    weekHead: {
      flexDirection: 'row',
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    weekRow: {
      flexDirection: 'row',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    weekCell: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
    weekH: { fontWeight: '800', color: colors.muted, fontSize: 11, textTransform: 'uppercase' },
    weekNum: { textAlign: 'right', flex: 0.7 },
  });
}
