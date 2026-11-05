import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PitchDecor from './PitchDecor';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

const HERO_H = 268;

/**
 * Immersive Hoyga header — pitch glow, greeting, optional search/CTA slot.
 */
export default function HoygaHero({
  kicker = 'Hoyga',
  greeting,
  name,
  subtitle,
  onAvatarPress,
  initials,
  children,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const padTop = Math.max(insets.top, 12) + 6;

  return (
    <View style={[styles.wrap, { paddingTop: padTop, minHeight: HERO_H + padTop - 40 }]}>
      <PitchDecor height={HERO_H + padTop} />
      <View style={styles.topRow}>
        <View style={styles.copy}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.hello} numberOfLines={1}>
            {greeting}
            {name ? `, ${name}` : ''}
          </Text>
          {subtitle ? (
            <Text style={styles.sub} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {onAvatarPress ? (
          <Pressable onPress={onAvatarPress} hitSlop={8} style={styles.avatar}>
            <Text style={styles.avatarText}>{initials || 'K'}</Text>
            <View style={styles.avatarDot}>
              <Ionicons name="football" size={9} color="#fff" />
            </View>
          </Pressable>
        ) : null}
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
      paddingBottom: 28,
      overflow: 'hidden',
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      zIndex: 1,
    },
    copy: { flex: 1, paddingRight: 12 },
    kicker: {
      color: 'rgba(16,185,129,0.95)',
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1.6,
      textTransform: 'uppercase',
    },
    hello: {
      marginTop: 6,
      color: '#fff',
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: -0.6,
    },
    sub: {
      marginTop: 6,
      color: 'rgba(255,255,255,0.78)',
      fontSize: 14,
      fontWeight: '500',
      lineHeight: 20,
      maxWidth: 260,
    },
    avatar: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: 'rgba(16,185,129,0.22)',
      borderWidth: 1.5,
      borderColor: 'rgba(16,185,129,0.7)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '800',
    },
    avatarDot: {
      position: 'absolute',
      right: -2,
      bottom: -2,
      width: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.brandGreen,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.brandNavy,
    },
    slot: {
      zIndex: 1,
      marginTop: 22,
    },
  });
}
