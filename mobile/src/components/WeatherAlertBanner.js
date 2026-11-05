import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { weatherApi } from '../api/weather';
import { radii, spacing } from '../theme';

const TONE = {
  caution: { bg: '#FFF7ED', fg: '#C2410C', border: '#FDBA74' },
  poor: { bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA' },
  unplayable: { bg: '#FEE2E2', fg: '#991B1B', border: '#FCA5A5' },
};

function matchesCity(alert, filter) {
  if (!filter) return true;
  const values = Array.isArray(filter) ? filter : [filter];
  const needles = values.map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  if (!needles.length) return true;
  const hay = [alert.city, alert.citySo, alert.slug, alert.region].map((v) => String(v || '').toLowerCase());
  return needles.some((f) => hay.some((s) => s && (s === f || s.includes(f) || f.includes(s))));
}

/** Play-risk alerts (rain / storm / wind) for tracked cities. Hidden when flag is off. */
export default function WeatherAlertBanner({ cityFilter, refreshKey }) {
  const { colors } = useTheme();
  const { weatherEnabled, loaded } = useAuthFeatures();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    if (!loaded || !weatherEnabled) {
      setAlerts([]);
      return undefined;
    }
    let cancelled = false;
    weatherApi
      .alerts()
      .then((data) => {
        if (!cancelled) setAlerts(data?.alerts || []);
      })
      .catch(() => {
        if (!cancelled) setAlerts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loaded, weatherEnabled, refreshKey]);

  const visible = useMemo(
    () => (alerts || []).filter((a) => matchesCity(a, cityFilter)),
    [alerts, cityFilter]
  );

  if (!weatherEnabled || !visible.length) return null;

  return (
    <View style={styles.wrap}>
      {visible.map((a) => {
        const tone = TONE[a.level] || TONE.caution;
        return (
          <View
            key={a.id}
            style={[styles.card, { backgroundColor: tone.bg, borderColor: tone.border }]}
          >
            <Ionicons
              name={a.level === 'unplayable' ? 'warning' : 'rainy-outline'}
              size={20}
              color={tone.fg}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.kicker, { color: tone.fg }]}>
                DIGNIIN CIMILO · {a.citySo || a.city}
              </Text>
              <Text style={[styles.body, { color: colors.text }]}>{a.headlineSo || a.headline}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginTop: spacing.sm, marginBottom: spacing.sm },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderWidth: 1,
    borderRadius: radii.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  body: { marginTop: 2, fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
