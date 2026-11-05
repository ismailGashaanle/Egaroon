import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { typography, spacing } from '../theme';

/**
 * Screen header — navy (default) or green accent.
 * Pass `onBack` for stack screens (chevron).
 */
export default function Header({ title, subtitle, right, variant = 'navy', onBack }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const bg = variant === 'green' ? colors.brandGreen : colors.brandNavy;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: bg,
          paddingTop: Math.max(insets.top, 12) + 8,
        },
      ]}
    >
      <View style={styles.row}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.white} />
          </Pressable>
        ) : null}
        <View style={styles.copy}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {right ? <View>{right}</View> : null}
      </View>
      {variant === 'navy' ? (
        <View style={[styles.accentBar, { backgroundColor: colors.brandGreen }]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  backBtn: {
    marginRight: 4,
    marginBottom: 2,
    padding: 2,
  },
  copy: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 4,
    ...typography.caption,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  accentBar: {
    marginTop: 12,
    height: 3,
    width: 40,
    borderRadius: 2,
  },
});
