import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from './Button';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography } from '../theme';

/**
 * Sticky navy bar — selected summary + primary CTA (bus-ticket style).
 */
export default function NavyFooter({
  leftLabel,
  leftValue,
  amountLabel = 'Amount',
  amount,
  ctaTitle,
  onPress,
  loading,
  disabled,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.brandNavy,
          paddingBottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View style={styles.meta}>
        <View style={styles.metaCol}>
          {leftLabel ? <Text style={styles.metaLabel}>{leftLabel}</Text> : null}
          <Text style={styles.metaValue} numberOfLines={1}>
            {leftValue || '—'}
          </Text>
        </View>
        <View style={[styles.metaCol, styles.metaRight]}>
          <Text style={styles.metaLabel}>{amountLabel}</Text>
          <Text style={[styles.amount, { color: colors.brandGreen }]}>
            {amount != null ? amount : '—'}
          </Text>
        </View>
      </View>
      <Button
        title={ctaTitle}
        variant="white"
        onPress={onPress}
        loading={loading}
        disabled={disabled}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    borderTopWidth: 0,
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  metaCol: { flex: 1 },
  metaRight: { alignItems: 'flex-end' },
  metaLabel: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.65)',
    fontWeight: '500',
  },
  metaValue: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  amount: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: '800',
  },
});
