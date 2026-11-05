import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radii, typography } from '../theme';
import { formatUsd, fieldCountLabel } from '../lib/fieldFormats';

/**
 * One row per field size — 5v5 / 7v7 with that size's price (from fields).
 */
export default function SizePriceList({ sizes, compact = false }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const list = Array.isArray(sizes) ? sizes.filter((s) => s?.type) : [];
  if (!list.length) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {list.map((s) => (
        <View key={s.type} style={styles.row}>
          <View style={styles.left}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{s.type}</Text>
            </View>
            {s.count ? (
              <Text style={styles.count}>{fieldCountLabel(s.count)}</Text>
            ) : null}
          </View>
          {s.price != null ? (
            <Text style={styles.price}>
              {formatUsd(s.price)}
              <Text style={styles.unit}> /koox</Text>
            </Text>
          ) : (
            <Text style={styles.unit}>qiimo: soo eeg</Text>
          )}
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: {
      marginTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 8,
      gap: 6,
    },
    wrapCompact: {
      marginTop: 8,
      borderTopWidth: 0,
      paddingTop: 0,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    badge: {
      backgroundColor: colors.surfaceInset,
      borderRadius: radii.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
      minWidth: 48,
      alignItems: 'center',
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '800',
      color: colors.text,
    },
    count: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: '600',
    },
    price: {
      fontSize: 15,
      fontWeight: '800',
      color: colors.brandGreen,
    },
    unit: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.muted,
    },
  });
}
