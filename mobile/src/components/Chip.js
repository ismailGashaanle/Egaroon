import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { radii } from '../theme';

/** Selectable chip — green when selected */
export default function Chip({ label, selected, onPress, style }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.brandGreen, borderColor: colors.brandGreen }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? colors.white : colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.chip,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    minWidth: 72,
  },
  label: {
    fontWeight: '600',
    fontSize: 14,
  },
});
