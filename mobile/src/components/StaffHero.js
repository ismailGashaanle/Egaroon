import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PitchDecor from './PitchDecor';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

/**
 * Compact pitch header for owner/manager tabs (Slots, Warbixin).
 */
export default function StaffHero({
  kicker,
  title,
  subtitle,
  onBack,
  right,
  children,
  compact = true,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const padTop = Math.max(insets.top, 12) + 4;
  const heroH = compact ? 188 : 248;

  return (
    <View style={[styles.wrap, { paddingTop: padTop, minHeight: heroH + padTop - 36 }]}>
      <PitchDecor height={heroH + padTop} />
      <View style={styles.topRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
        ) : null}
        <View style={styles.copy}>
          {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right ? <View style={styles.right}>{right}</View> : null}
      </View>
      {children ? <View style={styles.slot}>{children}</View> : null}
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    wrap: {
      backgroundColor: colors.brandNavy,
      paddingHorizontal: spacing.md,
      paddingBottom: 26,
      overflow: 'hidden',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      zIndex: 1,
    },
    back: {
      marginRight: 4,
      marginTop: 4,
      padding: 2,
    },
    copy: { flex: 1, paddingRight: 8 },
    kicker: {
      color: 'rgba(16,185,129,0.95)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    title: {
      marginTop: 4,
      color: '#fff',
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    sub: {
      marginTop: 4,
      color: 'rgba(255,255,255,0.78)',
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 18,
    },
    right: { marginTop: 4 },
    slot: {
      zIndex: 1,
      marginTop: 16,
    },
  });
}
