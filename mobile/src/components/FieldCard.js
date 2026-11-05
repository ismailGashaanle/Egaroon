import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from './Card';
import CoverImage from './CoverImage';
import { useTheme } from '../context/ThemeContext';
import { typography, radii } from '../theme';
import { coverUri } from '../lib/media';
import {
  formatFieldType,
  capacityForType,
  estimateTeamShare,
  formatUsd,
  hoursLabel,
} from '../lib/fieldFormats';

export default function FieldCard({ field, fallbackCover, onPress, availableCount }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  const type = formatFieldType(field?.type);
  const capacity = field?.capacity || capacityForType(type);
  const price = estimateTeamShare(field);
  const hours = hoursLabel(field?.openingTime, field?.closingTime);
  const cover = coverUri(field?.images?.length ? field.images : fallbackCover, {
    width: 720,
    height: 400,
  });
  const offline = field?.ops && field.ops.bookable === false;
  const offlineMsg = field?.ops?.messageSo || (offline ? 'Xidhan · dooro field kale' : null);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.94 }]}
    >
      <Card style={styles.card}>
        <CoverImage uri={cover} height={132} style={styles.cover} iconSize={32}>
          <View style={styles.coverBadges}>
            {type ? (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{type}</Text>
              </View>
            ) : null}
            {offline ? (
              <View style={styles.offlineBadge}>
                <Text style={styles.offlineBadgeText}>XIDHAN</Text>
              </View>
            ) : availableCount != null ? (
              <View style={[styles.openBadge, availableCount > 0 ? styles.openBadgeOn : styles.openBadgeOff]}>
                <Text style={availableCount > 0 ? styles.openBadgeTextOn : styles.openBadgeTextOff}>
                  {availableCount > 0 ? `${availableCount} banaan` : 'Buuxa'}
                </Text>
              </View>
            ) : null}
          </View>
        </CoverImage>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.name} numberOfLines={1}>
              {field?.name || type || 'Field'}
            </Text>
            {price != null && !offline ? (
              <Text style={styles.price}>
                {formatUsd(price)}
                <Text style={styles.priceUnit}> /koox</Text>
              </Text>
            ) : null}
          </View>

          <View style={styles.metaRow}>
            {capacity ? (
              <View style={styles.meta}>
                <Ionicons name="people-outline" size={14} color={colors.brandGreen} />
                <Text style={styles.metaText}>{capacity} vs {capacity}</Text>
              </View>
            ) : null}
            {hours ? (
              <View style={styles.meta}>
                <Ionicons name="time-outline" size={14} color={colors.brandGreen} />
                <Text style={styles.metaText}>{hours}</Text>
              </View>
            ) : null}
            {field?.pricingMode === 'per_player' && field.pricePerPlayer != null ? (
              <View style={styles.meta}>
                <Ionicons name="cash-outline" size={14} color={colors.brandGreen} />
                <Text style={styles.metaText}>
                  {formatUsd(field.pricePerPlayer)} /ciyaartoy
                </Text>
              </View>
            ) : null}
          </View>

          {offlineMsg ? <Text style={styles.offlineHint}>{offlineMsg}</Text> : null}
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
    coverBadges: {
      ...StyleSheet.absoluteFillObject,
      padding: 10,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    typeBadge: {
      backgroundColor: 'rgba(16,185,129,0.95)',
      borderRadius: radii.full,
      paddingHorizontal: 12,
      paddingVertical: 5,
    },
    typeBadgeText: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '800',
    },
    offlineBadge: {
      backgroundColor: 'rgba(185,28,28,0.92)',
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    offlineBadgeText: {
      color: '#FEE2E2',
      fontSize: 11,
      fontWeight: '800',
    },
    openBadge: {
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    openBadgeOn: {
      backgroundColor: 'rgba(16,185,129,0.95)',
    },
    openBadgeOff: {
      backgroundColor: 'rgba(255,255,255,0.92)',
    },
    openBadgeTextOn: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '800',
    },
    openBadgeTextOff: {
      color: '#64748B',
      fontSize: 11,
      fontWeight: '800',
    },
    body: {
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 14,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
    },
    name: {
      flex: 1,
      fontSize: 17,
      fontWeight: '800',
      color: colors.text,
    },
    price: {
      fontSize: 17,
      fontWeight: '800',
      color: colors.brandGreen,
    },
    priceUnit: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      marginTop: 8,
    },
    meta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: '600',
    },
    offlineHint: {
      marginTop: 8,
      ...typography.caption,
      color: '#B91C1C',
      fontWeight: '600',
    },
  });
}
