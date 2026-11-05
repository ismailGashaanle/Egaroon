import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Chip from '../../components/Chip';
import StadiumCard from '../../components/StadiumCard';
import { stadiumsApi } from '../../api/stadiums';
import { buildDateStrip, dateChipLabel } from '../../lib/dateUtils';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typography } from '../../theme';

export default function SearchResultsScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const initial = route.params || {};
  const [date, setDate] = useState(initial.date);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);
  const dates = buildDateStrip(initial.date || undefined, 7);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (initial.city) params.city = initial.city;
      if (initial.region) params.region = initial.region;
      if (initial.area) params.area = initial.area;
      if (date) params.date = date;
      if (initial.lat != null && initial.lng != null) {
        params.lat = initial.lat;
        params.lng = initial.lng;
      }
      if (initial.sort) params.sort = initial.sort;

      const data = await stadiumsApi.list(params);
      setStadiums(data.stadiums || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Garoonnada lama soo qaadin', text2: e.message });
    } finally {
      setLoading(false);
    }
  }, [date, initial.city, initial.region, initial.area, initial.lat, initial.lng, initial.sort]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Natiijooyinka" subtitle="Dooro garoonka" onBack={() => navigation.goBack()} />

        <View style={styles.dateStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateRow}>
            {dates.map((d) => (
              <Chip
                key={d}
                label={dateChipLabel(d)}
                selected={d === date}
                onPress={() => setDate(d)}
                style={styles.dateChip}
              />
            ))}
          </ScrollView>
        </View>

        {loading && !stadiums.length ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={stadiums}
            keyExtractor={(item) => String(item._id || item.id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={styles.empty}>Garoon lama helin. Isku day magaalad kale.</Text>
            }
            renderItem={({ item }) => (
              <StadiumCard
                stadium={item}
                onPress={() =>
                  navigation.navigate('FieldSelect', {
                    stadiumId: String(item._id || item.id),
                    stadiumName: item.name,
                    images: item.images || [],
                    sizePrices: item.sizePrices || [],
                    date,
                    startingPrice:
                      item.startingPrice ?? item.priceFrom ?? item.minPrice ?? null,
                    ops: item.ops || null,
                  })
                }
              />
            )}
          />
        )}
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    dateStrip: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
    },
    dateRow: {
      paddingHorizontal: spacing.md,
      gap: 8,
    },
    dateChip: { flexGrow: 0 },
    list: { padding: spacing.md, paddingBottom: 32 },
    empty: {
      textAlign: 'center',
      color: colors.muted,
      marginTop: 48,
      ...typography.body,
    },
  });
}
