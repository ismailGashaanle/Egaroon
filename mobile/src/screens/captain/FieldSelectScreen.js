import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import CoverImage from '../../components/CoverImage';
import FieldCard from '../../components/FieldCard';
import SizePriceList from '../../components/SizePriceList';
import FieldFiltersSheet from '../../components/FieldFiltersSheet';
import { stadiumsApi } from '../../api/stadiums';
import { toIsoDate, countOpenSlots } from '../../lib/dateUtils';
import { coverUri, stadiumPlace } from '../../lib/media';
import {
  summarizeFieldSizes,
  stadiumSizePrices,
  fieldCountLabel,
  estimateTeamShare,
  sortStadiumFields,
  fieldSizeCounts,
  EMPTY_FIELD_FILTERS,
  countActiveFieldFilters,
  fieldMatchesFilters,
} from '../../lib/fieldFormats';
import { useTheme } from '../../context/ThemeContext';
import { radii, spacing, typography } from '../../theme';

/**
 * Stadium → fields list. Captain picks a field, then slot booking continues.
 */
export default function FieldSelectScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const {
    stadiumId,
    stadiumName,
    startingPrice,
    ops: initialOps,
    images: initialImages,
    sizePrices: initialSizePrices,
  } = route.params || {};

  const [fields, setFields] = useState([]);
  const [stadium, setStadium] = useState(null);
  const [ops, setOps] = useState(initialOps || null);
  const [loading, setLoading] = useState(true);
  const [openByField, setOpenByField] = useState({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [fieldFilters, setFieldFilters] = useState(EMPTY_FIELD_FILTERS);
  const today = toIsoDate();

  const stadiumOffline = ops && ops.bookable === false;
  const offlineMsg =
    ops?.messageSo || 'Garoonku wuu xidhan yahay ee dooro stadium kale';

  const orderedFields = useMemo(() => sortStadiumFields(fields), [fields]);
  const sizeCounts = useMemo(() => fieldSizeCounts(orderedFields), [orderedFields]);
  const activeFilterCount = countActiveFieldFilters(fieldFilters);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [fieldsData, stadiumData] = await Promise.all([
        stadiumsApi.listFields(stadiumId),
        stadiumsApi.get(stadiumId).catch(() => null),
      ]);
      setFields(sortStadiumFields(fieldsData.fields || []));
      const st = stadiumData?.stadium || stadiumData;
      if (st) {
        setStadium(st);
        if (st.ops) setOps(st.ops);
      }
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Field-yada lama soo qaadin', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [stadiumId]);

  useEffect(() => {
    load();
  }, [load]);

  const fieldIds = orderedFields.map((f) => String(f._id)).join(',');

  useEffect(() => {
    if (!orderedFields.length) return undefined;
    let cancelled = false;
    (async () => {
      const pairs = await Promise.all(
        orderedFields.map((f) =>
          stadiumsApi
            .listSlots(f._id, today)
            .then((data) => [String(f._id), countOpenSlots(data.slots || [])])
            .catch(() => [String(f._id), 0])
        )
      );
      if (!cancelled) setOpenByField(Object.fromEntries(pairs));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, fieldIds]);

  const visibleFields = useMemo(() => {
    return orderedFields.filter((f) =>
      fieldMatchesFilters(f, fieldFilters, {
        openCount: openByField[String(f._id)] || 0,
        share: estimateTeamShare(f),
      })
    );
  }, [orderedFields, fieldFilters, openByField]);

  const pickField = (field) => {
    const fieldOffline = field?.ops && field.ops.bookable === false;
    if (stadiumOffline) {
      Toast.show({ type: 'error', text1: 'Garoonku wuu xidhan yahay', text2: offlineMsg });
      return;
    }
    if (fieldOffline) {
      Toast.show({
        type: 'error',
        text1: 'Field-kan wuu xidhan yahay',
        text2: field.ops?.messageSo || 'Dooro field kale',
      });
      return;
    }
    navigation.navigate('SlotSelect', {
      stadiumId: String(stadiumId),
      stadiumName: stadium?.name || stadiumName,
      fieldId: String(field._id),
      fieldName: field.name,
      fieldType: field.type,
      date: today,
      startingPrice: estimateTeamShare(field) ?? startingPrice ?? null,
    });
  };

  const displayName = stadium?.name || stadiumName || 'Garoon';
  const place = stadiumPlace(stadium);
  const cover = coverUri(stadium?.images?.length ? stadium.images : initialImages, {
    width: 1000,
    height: 560,
  });
  const sizes = useMemo(
    () =>
      fields.length
        ? summarizeFieldSizes(fields)
        : stadiumSizePrices({ sizePrices: initialSizePrices, startingPrice }),
    [fields, initialSizePrices, startingPrice]
  );

  const hero = (
    <View style={styles.heroWrap}>
      <CoverImage uri={cover} height={188} style={styles.heroCover}>
        <View style={styles.heroOverlay}>
          {sizes.length ? (
            <View style={styles.heroTypes}>
              {sizes.map((s) => (
                <View key={s.type} style={styles.heroType}>
                  <Text style={styles.heroTypeText}>
                    {s.type}
                    {s.count ? ` × ${s.count}` : ''}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          <Text style={styles.heroName} numberOfLines={2}>
            {displayName}
          </Text>
          <View style={styles.heroLoc}>
            <Ionicons name="location-outline" size={14} color="#fff" />
            <Text style={styles.heroPlace} numberOfLines={1}>
              {place || 'Goobta lama sheegin'}
            </Text>
          </View>
        </View>
      </CoverImage>
      <View style={styles.heroMeta}>
        <Text style={styles.heroHint}>
          {fields.length
            ? `${fieldCountLabel(fields.length)} · dooro field-ka, ka dib maalin iyo saacad`
            : 'Field-yada…'}
        </Text>
        <SizePriceList sizes={sizes} compact />
      </View>
      <Text style={styles.sectionLabel}>Dooro field</Text>
    </View>
  );

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title={displayName}
          subtitle="Dooro field-ka"
          onBack={() => navigation.goBack()}
          right={
            <Pressable onPress={() => setFiltersOpen(true)} hitSlop={12} style={styles.filterBtn}>
              <Ionicons name="options-outline" size={22} color="#fff" />
              {activeFilterCount > 0 ? (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
          }
        />

        {stadiumOffline ? (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineTitle}>STADIUM OFFLINE · xidhan</Text>
            <Text style={styles.offlineBody}>{offlineMsg}</Text>
          </View>
        ) : null}

        <FlatList
          data={visibleFields}
          keyExtractor={(item) => String(item._id)}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <>
              {hero}
              {loading && !fields.length ? (
                <ActivityIndicator color={colors.brandGreen} style={{ marginVertical: 20 }} />
              ) : null}
            </>
          }
          ListEmptyComponent={
            loading ? null : (
              <Text style={styles.empty}>Garoonkan ma laha field banaan maalintaan.</Text>
            )
          }
          renderItem={({ item }) => (
            <View style={styles.sectionItem}>
              <FieldCard
                field={item}
                fallbackCover={stadium?.images || initialImages}
                availableCount={openByField[String(item._id)]}
                onPress={() => pickField(item)}
              />
            </View>
          )}
        />

        <FieldFiltersSheet
          visible={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          value={fieldFilters}
          onApply={setFieldFilters}
          sizes={sizeCounts}
        />
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    filterBtn: {
      padding: 6,
    },
    filterBadge: {
      position: 'absolute',
      top: 0,
      right: 0,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.accent || '#F59E0B',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    filterBadgeText: {
      color: '#fff',
      fontSize: 9,
      fontWeight: '800',
    },
    heroWrap: {
      marginBottom: 8,
    },
    heroCover: {
      borderRadius: radii.lg,
      overflow: 'hidden',
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'flex-end',
      padding: 14,
    },
    heroTypes: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 8,
    },
    heroType: {
      backgroundColor: 'rgba(16,185,129,0.95)',
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    heroTypeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    heroName: {
      color: '#fff',
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
    },
    heroLoc: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 4,
    },
    heroPlace: {
      color: 'rgba(255,255,255,0.92)',
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
    },
    heroMeta: {
      paddingTop: 12,
      paddingBottom: 4,
    },
    heroHint: {
      marginTop: 4,
      ...typography.caption,
      color: colors.muted,
      fontWeight: '500',
    },
    sectionLabel: {
      marginTop: 14,
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '800',
      color: colors.text,
    },
    sectionItem: {
      marginBottom: 12,
    },
    offlineBanner: {
      marginHorizontal: spacing.md,
      marginTop: 12,
      backgroundColor: '#FEE2E2',
      borderRadius: radii.md,
      padding: 12,
      borderWidth: 1,
      borderColor: '#FECACA',
    },
    offlineTitle: {
      fontWeight: '800',
      fontSize: 13,
      color: '#B91C1C',
      marginBottom: 4,
    },
    offlineBody: {
      ...typography.caption,
      color: '#991B1B',
      lineHeight: 18,
      fontWeight: '600',
    },
    list: { padding: spacing.md, paddingBottom: 32, gap: 12 },
    empty: {
      textAlign: 'center',
      color: colors.muted,
      marginTop: 32,
      ...typography.body,
    },
  });
}
