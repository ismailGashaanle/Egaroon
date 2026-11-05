import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import CoverImage from './CoverImage';
import SizePriceList from './SizePriceList';
import { useTheme } from '../context/ThemeContext';
import { typography, radii } from '../theme';
import { coverUri, stadiumPlace } from '../lib/media';
import { stadiumSizePrices, fieldCountLabel } from '../lib/fieldFormats';

export default function StadiumCard({ stadium, onPress }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const name = stadium?.name || 'Garoon';
  const place = stadiumPlace(stadium);
  const dist =
    stadium?.distanceKm != null ? `${Number(stadium.distanceKm).toFixed(1)} km` : null;
  const sizes = stadiumSizePrices(stadium);
  const fieldCount =
    stadium?.fieldCount ||
    sizes.reduce((n, s) => n + (Number(s.count) || 0), 0) ||
    sizes.length;
  const cover = coverUri(stadium?.images, { width: 900, height: 520 });
  const ops = stadium?.ops;
  const offline = ops && ops.bookable === false;
  const offlineMsg =
    ops?.messageSo || (offline ? 'Garoonku wuu xidhan yahay ee dooro stadium kale' : null);
  const rating =
    stadium?.ratingAverage != null
      ? Number(stadium.ratingAverage)
      : stadium?.rating != null
        ? Number(stadium.rating)
        : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [pressed && onPress && { opacity: 0.94 }]}
    >
      <Card style={styles.card}>
        <CoverImage uri={cover} height={168} style={styles.cover}>
          <View style={styles.coverTop}>
            {offline ? (
              <View style={[styles.badge, styles.offlineBadge]}>
                <Ionicons name="cloud-offline" size={12} color="#FEE2E2" />
                <Text style={styles.offlineBadgeText}>XIDHAN</Text>
              </View>
            ) : null}
            {fieldCount ? (
              <View style={styles.fieldCountBadge}>
                <Text style={styles.fieldCountText}>{fieldCountLabel(fieldCount)}</Text>
              </View>
            ) : null}
          </View>
        </CoverImage>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>

          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={14} color={colors.brandGreen} />
            <Text style={styles.place} numberOfLines={1}>
              {place || 'Goobta lama sheegin'}
              {dist ? `  ·  ${dist}` : ''}
            </Text>
          </View>

          {rating > 0 ? (
            <View style={styles.locRow}>
              <Ionicons name="star" size={13} color={colors.accent} />
              <Text style={styles.rating}>{rating.toFixed(1)}</Text>
              {stadium?.ratingCount ? (
                <Text style={styles.place}>({stadium.ratingCount})</Text>
              ) : null}
            </View>
          ) : null}

          {offlineMsg ? <Text style={styles.offlineMsg}>{offlineMsg}</Text> : null}

          <SizePriceList sizes={sizes} />

          {onPress ? (
            <View style={styles.footer}>
              <Text style={styles.footerHint}>Gudaha: dooro field-ka</Text>
              <View
                style={[
                  styles.cta,
                  { backgroundColor: offline ? colors.surfaceInset : colors.brandGreen },
                ]}
              >
                <Text
                  style={[
                    styles.ctaText,
                    { color: offline ? colors.text : colors.white },
                  ]}
                >
                  {offline ? 'Eeg' : 'Dooro'}
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={offline ? colors.text : colors.white}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Card>
    </Pressable>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    card: {
      padding: 0,
      overflow: 'hidden',
      marginBottom: 0,
    },
    cover: {
      borderTopLeftRadius: radii.card,
      borderTopRightRadius: radii.card,
    },
    coverTop: {
      ...StyleSheet.absoluteFillObject,
      padding: 10,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    fieldCountBadge: {
      marginLeft: 'auto',
      backgroundColor: 'rgba(16,185,129,0.92)',
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    fieldCountText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: '800',
    },
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: radii.full,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    offlineBadge: {
      backgroundColor: 'rgba(185,28,28,0.92)',
    },
    offlineBadgeText: {
      color: '#FEE2E2',
      fontSize: 11,
      fontWeight: '800',
    },
    body: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 14,
    },
    name: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.3,
    },
    locRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 6,
    },
    place: {
      ...typography.caption,
      color: colors.muted,
      flex: 1,
      fontWeight: '500',
    },
    rating: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    offlineMsg: {
      marginTop: 8,
      ...typography.caption,
      color: '#B91C1C',
      fontWeight: '600',
      lineHeight: 18,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    footerHint: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: '600',
      flex: 1,
      paddingRight: 8,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      borderRadius: radii.full,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    ctaText: {
      fontSize: 14,
      fontWeight: '800',
    },
  });
}
