import { Pressable, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { typography } from '../theme';
import { toIsoDate, addDaysIso } from '../lib/dateUtils';

function parts(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return { y, m, d, date: new Date(y, m - 1, d) };
}

export default function DateStrip({ dates, selected, onSelect }) {
  const { colors, shadows } = useTheme();
  const styles = makeStyles(colors, shadows);
  const today = toIsoDate();
  const tomorrow = addDaysIso(today, 1);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {dates.map((iso) => {
        const on = iso === selected;
        const isToday = iso === today;
        const isTomorrow = iso === tomorrow;
        const { d, date } = parts(iso);
        const weekday = isToday
          ? 'Maanta'
          : isTomorrow
            ? 'Berri'
            : date.toLocaleDateString('so-SO', { weekday: 'short' });
        const month = date.toLocaleDateString('so-SO', { month: 'short' });
        return (
          <Pressable
            key={iso}
            onPress={() => onSelect(iso)}
            style={[
              styles.card,
              on && styles.cardOn,
              isToday && !on && styles.cardToday,
            ]}
          >
            <Text style={[styles.weekday, on && styles.onText]} numberOfLines={1}>
              {weekday}
            </Text>
            <Text style={[styles.num, on && styles.onText]}>{d}</Text>
            <Text style={[styles.month, on && styles.onTextMuted]}>{month}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function makeStyles(colors, shadows) {
  return StyleSheet.create({
    row: {
      gap: 8,
      paddingVertical: 8,
      paddingRight: 8,
    },
    card: {
      width: 70,
      alignItems: 'center',
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: 12,
      paddingHorizontal: 4,
      ...shadows.soft,
    },
    cardOn: {
      backgroundColor: colors.brandGreen,
      borderColor: colors.brandGreen,
      transform: [{ scale: 1.04 }],
      ...shadows.lifted,
    },
    cardToday: {
      borderColor: colors.brandGreen,
      backgroundColor: colors.surface,
    },
    weekday: {
      ...typography.caption,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      color: colors.muted,
    },
    num: {
      marginTop: 2,
      fontSize: 20,
      fontWeight: '900',
      color: colors.text,
      lineHeight: 24,
    },
    month: {
      marginTop: 2,
      fontSize: 10,
      fontWeight: '700',
      color: colors.muted,
    },
    onText: { color: colors.white },
    onTextMuted: { color: 'rgba(255,255,255,0.85)' },
  });
}
