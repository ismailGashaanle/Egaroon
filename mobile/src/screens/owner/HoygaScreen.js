import { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import HoygaHero from '../../components/HoygaHero';
import Card from '../../components/Card';
import WeatherAlertBanner from '../../components/WeatherAlertBanner';
import { stadiumsApi } from '../../api/stadiums';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { coverImage, stadiumPlace, hoursLabel } from '../../lib/ownerDisplay';
import { radii, spacing, typography } from '../../theme';

export default function OwnerHoygaScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { colors, shadows } = useTheme();
  const styles = makeStyles(colors, shadows);
  const [stadiums, setStadiums] = useState([]);
  const [loading, setLoading] = useState(true);

  const first = String(user?.name || '').trim().split(/\s+/)[0] || 'Owner';
  const initials = (() => {
    const parts = String(user?.name || 'O').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return 'O';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  })();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Subax wanaagsan' : hour < 17 ? 'Galab wanaagsan' : 'Fiid wanaagsan';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await stadiumsApi.mine();
      setStadiums(data.stadiums || []);
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Garoonnada', text2: e.message });
      setStadiums([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openStadium = (stadium) => {
    navigation.navigate('StadiumDetail', { stadiumId: stadium._id || stadium.id });
  };

  return (
    <FadeIn>
      <View style={styles.screen}>
        <HoygaHero
          kicker="Hoyga · Owner"
          greeting={greeting}
          name={first}
          subtitle="Garoonnadaada — cover, fields, iyo maamul."
          initials={initials}
          onAvatarPress={() => navigation.navigate('Dheeraad')}
        >
          <Pressable
            onPress={() => navigation.navigate('StadiumForm')}
            style={({ pressed }) => [styles.createPill, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.createIcon}>
              <Ionicons name="add" size={20} color={colors.brandNavy} />
            </View>
            <Text style={styles.createText}>Abuur garoon cusub</Text>
          </Pressable>
        </HoygaHero>

        <View style={{ paddingHorizontal: spacing.md }}>
          <WeatherAlertBanner
            cityFilter={stadiums.map((s) => s.city || s.location?.city).filter(Boolean)}
          />
        </View>

        {loading && !stadiums.length ? (
          <ActivityIndicator color={colors.brandGreen} style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={stadiums}
            keyExtractor={(item) => String(item._id || item.id)}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              <Text style={styles.hint}>
                {stadiums.length
                  ? `${stadiums.length} garoon · taabo si aad u maamusho`
                  : 'Weli garoon ma jiro. Abuur mid cusub kor.'}
              </Text>
            }
            ListEmptyComponent={
              <Card>
                <Text style={styles.emptyTitle}>Weli garoon ma jiro</Text>
                <Text style={styles.emptyBody}>
                  Abuur garoon: location, GPS, cover images, iyo working hours. Kadib
                  fields ku dar.
                </Text>
              </Card>
            }
            renderItem={({ item }) => {
              const uri = coverImage(item);
              const place = stadiumPlace(item);
              const hours = hoursLabel(item);
              const fieldHint =
                item.fieldsCount != null
                  ? `${item.fieldsCount} field`
                  : item.fields?.length != null
                    ? `${item.fields.length} field`
                    : 'Fields';
              const offline = item.ops && item.ops.bookable === false;

              return (
                <Pressable
                  onPress={() => openStadium(item)}
                  style={({ pressed }) => [pressed && { opacity: 0.94 }]}
                >
                  <Card style={styles.coverCard}>
                    <View style={styles.heroWrap}>
                      {uri ? (
                        <Image source={{ uri }} style={styles.hero} resizeMode="cover" />
                      ) : (
                        <View style={[styles.hero, styles.heroFallback]}>
                          <Ionicons name="football-outline" size={40} color={colors.white} />
                        </View>
                      )}
                      <View style={styles.heroScrim} />
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: offline ? 'rgba(220,38,38,0.92)' : 'rgba(16,185,129,0.92)' },
                        ]}
                      >
                        <Text style={styles.statusBadgeText}>{offline ? 'XIDHAN' : 'FURAN'}</Text>
                      </View>
                      <View style={styles.heroCopy}>
                        <Text style={styles.heroName} numberOfLines={2}>
                          {item.name || 'Garoon'}
                        </Text>
                        {!!place && (
                          <Text style={styles.heroPlace} numberOfLines={1}>
                            {place}
                          </Text>
                        )}
                        <View style={styles.maamulCta}>
                          <Text style={styles.maamulCtaText}>Maamul garoonka</Text>
                          <Ionicons name="arrow-forward" size={16} color={colors.brandNavy} />
                        </View>
                      </View>
                    </View>

                    <View style={styles.metaRow}>
                      <View style={styles.metaChip}>
                        <Ionicons name="grid-outline" size={14} color={colors.brandGreen} />
                        <Text style={styles.metaText}>{fieldHint}</Text>
                      </View>
                      {hours ? (
                        <View style={styles.metaChip}>
                          <Ionicons name="time-outline" size={14} color={colors.brandGreen} />
                          <Text style={styles.metaText}>{hours}</Text>
                        </View>
                      ) : null}
                      {item.status ? (
                        <View style={styles.metaChip}>
                          <Text style={styles.metaText}>{String(item.status)}</Text>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              );
            }}
          />
        )}
      </View>
    </FadeIn>
  );
}

function makeStyles(colors, shadows) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    createPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderRadius: radii.full,
      paddingVertical: 8,
      paddingLeft: 8,
      paddingRight: 16,
      gap: 10,
      ...shadows.lifted,
    },
    createIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#ECFDF5',
      alignItems: 'center',
      justifyContent: 'center',
    },
    createText: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.brandNavy,
    },
    list: { padding: spacing.md, paddingBottom: 40, marginTop: -12 },
    hint: {
      ...typography.caption,
      color: colors.muted,
      marginBottom: 12,
      lineHeight: 18,
    },
    coverCard: { padding: 0, overflow: 'hidden', marginBottom: 4 },
    heroWrap: {
      height: 188,
      backgroundColor: colors.brandNavy,
    },
    hero: { width: '100%', height: '100%' },
    heroFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.brandNavy,
    },
    heroScrim: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(30,36,51,0.48)',
    },
    statusBadge: {
      position: 'absolute',
      top: 12,
      right: 12,
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusBadgeText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
      letterSpacing: 1,
    },
    heroCopy: {
      position: 'absolute',
      left: 14,
      right: 14,
      bottom: 14,
    },
    heroName: {
      fontSize: 22,
      fontWeight: '800',
      color: colors.white,
    },
    heroPlace: {
      marginTop: 4,
      fontSize: 13,
      fontWeight: '500',
      color: 'rgba(255,255,255,0.9)',
    },
    maamulCta: {
      marginTop: 12,
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#fff',
      borderRadius: radii.full,
      paddingVertical: 8,
      paddingLeft: 14,
      paddingRight: 12,
      ...shadows.lifted,
    },
    maamulCtaText: {
      fontSize: 13,
      fontWeight: '800',
      color: colors.brandNavy,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.surfaceInset,
      borderRadius: radii.sm,
      paddingHorizontal: 8,
      paddingVertical: 5,
    },
    metaText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    emptyTitle: {
      fontSize: 16,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 6,
    },
    emptyBody: {
      ...typography.body,
      color: colors.muted,
    },
  });
}
