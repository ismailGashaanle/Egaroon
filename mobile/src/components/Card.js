import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radii, spacing } from '../theme';

export default function Card({ children, style, ...rest }) {
  const { colors, shadows } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          ...shadows.card,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 12,
  },
});
