import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { REPORT_BRAND } from '../../lib/reportBrand';

const TONE_BG = {
  forest: 'rgba(23,107,69,0.12)',
  olive: 'rgba(107,142,58,0.16)',
  orange: 'rgba(217,138,58,0.16)',
  charcoal: 'rgba(24,32,28,0.08)',
};

const TONE_FG = {
  forest: REPORT_BRAND.forest,
  olive: REPORT_BRAND.olive,
  orange: REPORT_BRAND.orange,
  charcoal: REPORT_BRAND.charcoal,
};

export default function ReportKpiCard({ icon, label, value, hint, tone = 'forest', style }) {
  const { colors, shadows, isDark } = useTheme();
  const fg =
    isDark && tone === 'charcoal'
      ? colors.text
      : TONE_FG[tone] || TONE_FG.forest;
  const bg = isDark && tone === 'charcoal' ? 'rgba(255,255,255,0.1)' : TONE_BG[tone] || TONE_BG.forest;

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
    >
      <View style={styles.top}>
        <Text style={[styles.label, { color: colors.muted }]} numberOfLines={2}>
          {label}
        </Text>
        {icon ? (
          <View style={[styles.icon, { backgroundColor: bg }]}>{icon(fg)}</View>
        ) : null}
      </View>
      <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      {hint ? (
        <Text style={[styles.hint, { color: colors.muted }]} numberOfLines={2}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 118,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    marginTop: 12,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  hint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
