import { Pressable, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radii, typography } from '../theme';

/**
 * primary = brand green CTA
 * secondary / outline = green outline
 * navy = white text on brandNavy
 * white = navy text on white (footer bar CTA)
 * danger = cancelled red
 */
export default function Button({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
  textStyle,
}) {
  const { colors } = useTheme();
  const isOutline = variant === 'secondary' || variant === 'outline';
  const isDanger = variant === 'danger';
  const isNavy = variant === 'navy';
  const isWhite = variant === 'white';

  let bg = colors.brandGreen;
  let borderColor = colors.brandGreen;
  let labelColor = colors.white;
  let spinner = colors.white;

  if (isDanger) {
    bg = colors.statusCancelled;
    borderColor = colors.statusCancelled;
  } else if (isWhite) {
    bg = colors.white;
    borderColor = colors.white;
    labelColor = colors.brandNavy;
    spinner = colors.brandNavy;
  } else if (isNavy) {
    bg = colors.brandNavy;
    borderColor = colors.brandNavy;
  } else if (isOutline) {
    bg = colors.surface;
    borderColor = colors.brandGreen;
    labelColor = colors.brandGreen;
    spinner = colors.brandGreen;
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: isOutline ? 1.5 : 0,
          opacity: disabled || loading ? 0.6 : pressed ? 0.9 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={spinner} />
      ) : (
        <Text style={[styles.label, { color: labelColor }, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.h4,
    fontWeight: '700',
  },
});
