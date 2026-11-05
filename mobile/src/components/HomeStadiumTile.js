import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CoverImage from './CoverImage';
import { useTheme } from '../context/ThemeContext';
import { coverUri, stadiumPlace } from '../lib/media';
import { formatUsd } from '../lib/fieldFormats';
import { radii } from '../theme';

export default function HomeStadiumTile({ stadium, onPress }) {
  const { colors, shadows } = useTheme();
  const styles = makeStyles(colors, shadows);
  const name = stadium?.name || 'Garoon';
  const place = stadiumPlace(stadium);
  const cover = coverUri(stadium?.images, { width: 640, height: 400 });
  const price = stadium?.startingPrice ?? stadium?.priceFrom ?? stadium?.minPrice;
  const offline = stadium?.ops && stadium.ops.bookable === false;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.tile, pressed && { opacity: 0.94, transform: [{ scale: 0.98 }] }]}
    >
      <CoverImage uri={cover} height={118} style={styles.cover} iconSize={28}>
        {offline ? (
          <View style={styles.offline}>
            <Text style={styles.offlineText}>Xidhan</Text>
          </View>
        ) : price != null ? (
          <View style={styles.price}>
            <Text style={styles.priceText}>{formatUsd(price)}</Text>
          </View>
        ) : null}
      </CoverImage>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.loc}>
          <Ionicons name="location-outline" size={12} color={colors.brandGreen} />
          <Text style={styles.place} numberOfLines={1}>
            {place || 'Goobta'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function makeStyles(colors, shadows) {
  return StyleSheet.create({
    tile: {
      width: 196,
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.card,
    },
    cover: {
      borderTopLeftRadius: radii.lg,
      borderTopRightRadius: radii.lg,
    },
    price: {
      position: 'absolute',
      left: 8,
      bottom: 8,
      backgroundColor: 'rgba(16,185,129,0.95)',
      borderRadius: radii.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    priceText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
    },
    offline: {
      position: 'absolute',
      left: 8,
      top: 8,
      backgroundColor: 'rgba(185,28,28,0.92)',
      borderRadius: radii.full,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    offlineText: {
      color: '#fff',
      fontSize: 10,
      fontWeight: '800',
    },
    body: {
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    name: {
      fontSize: 14,
      fontWeight: '800',
      color: colors.text,
    },
    loc: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      marginTop: 4,
    },
    place: {
      flex: 1,
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
    },
  });
}
