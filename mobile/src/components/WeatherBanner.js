import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { radii, spacing } from '../theme';

const PLAY_BG = {
  good: '#ECFDF5',
  caution: '#FFF7ED',
  poor: '#FEF2F2',
  unplayable: '#FEE2E2',
};
const PLAY_FG = {
  good: '#176B45',
  caution: '#C2410C',
  poor: '#B91C1C',
  unplayable: '#991B1B',
};

function n(v, suffix = '') {
  if (v == null || Number.isNaN(Number(v))) return '—';
  return `${Math.round(Number(v))}${suffix}`;
}

export default function WeatherBanner({ weather }) {
  const { colors } = useTheme();
  if (!weather?.summary) return null;
  const s = weather.summary;
  const play = weather.play || {};
  const level = play.level || 'good';
  const rainy = Number(s.rainMm) >= 1 || Number(s.rainChance) >= 40;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>CIMILADA · {weather.date}</Text>
          <Text style={[styles.place, { color: colors.text }]} numberOfLines={1}>
            {weather.place?.name || weather.place?.city || 'Goobta'}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: PLAY_BG[level] || PLAY_BG.good }]}>
          <Text style={[styles.badgeText, { color: PLAY_FG[level] || PLAY_FG.good }]}>
            {play.labelSo || play.label || '—'}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <Ionicons
          name={rainy ? 'rainy-outline' : 'sunny-outline'}
          size={28}
          color={colors.brandGreen}
        />
        <Text style={[styles.temp, { color: colors.text }]}>
          {n(s.tempMax, '°')}
          <Text style={[styles.tempMin, { color: colors.muted }]}> / {n(s.tempMin, '°')}</Text>
        </Text>
        <Text style={[styles.cond, { color: colors.muted }]}>{s.conditionSo || s.condition}</Text>
      </View>

      <View style={styles.stats}>
        <Text style={[styles.stat, { color: colors.text }]}>
          Roob {s.rainMm != null ? `${Number(s.rainMm).toFixed(1)} mm` : '—'}
          {s.rainChance != null ? ` · ${n(s.rainChance, '%')}` : ''}
        </Text>
        <Text style={[styles.stat, { color: colors.text }]}>Dabayl {n(s.windKmh, ' km/h')}</Text>
      </View>

      {weather.risks?.length ? (
        <View style={{ marginTop: 8, gap: 4 }}>
          {weather.risks.slice(0, 3).map((r) => (
            <Text key={r.code} style={[styles.risk, { color: colors.text }]}>
              • {r.titleSo || r.title}
            </Text>
          ))}
        </View>
      ) : null}

      {weather.hours?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hours}>
          {weather.hours
            .filter((h) => h.hour % 3 === 0)
            .map((h) => (
              <View key={h.time} style={[styles.hour, { backgroundColor: colors.surfaceInset }]}>
                <Text style={[styles.hourT, { color: colors.muted }]}>
                  {String(h.hour).padStart(2, '0')}:00
                </Text>
                <Text style={[styles.hourN, { color: colors.text }]}>{n(h.temp, '°')}</Text>
              </View>
            ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 14,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: '#176B45',
  },
  place: { marginTop: 2, fontSize: 14, fontWeight: '800' },
  badge: { borderRadius: radii.full, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 10 },
  temp: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  tempMin: { fontSize: 15, fontWeight: '700' },
  cond: { flex: 1, fontSize: 13, fontWeight: '600', marginBottom: 4 },
  stats: { marginTop: 8, gap: 2 },
  stat: { fontSize: 12, fontWeight: '700' },
  risk: { fontSize: 12, fontWeight: '600' },
  hours: { gap: 8, marginTop: 10 },
  hour: { minWidth: 56, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 8, alignItems: 'center' },
  hourT: { fontSize: 10, fontWeight: '700' },
  hourN: { marginTop: 2, fontSize: 14, fontWeight: '800' },
});
