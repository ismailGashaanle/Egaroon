import { useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, {
  Rect,
  Line,
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
  G,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import {
  REPORT_BRAND,
  formatChartDay,
  formatHourLabel,
  labelForStatus,
  statusTone,
} from '../../lib/reportBrand';

function toRows(data, valueKey, labelKey, formatLabel) {
  const labelFn = formatLabel || formatChartDay;
  return (Array.isArray(data) ? data : []).filter(Boolean).map((d, idx) => ({
    ...d,
    _label: labelFn(d[labelKey] ?? '', d, idx),
    _value: Number(d[valueKey]) || 0,
  }));
}

function EmptyChart({ label }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyText, { color: colors.muted }]}>{label}</Text>
    </View>
  );
}

export function ReportPanel({ title, icon, action, children }) {
  const { colors, shadows } = useTheme();
  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          ...shadows.card,
        },
      ]}
    >
      {title || action ? (
        <View style={styles.panelHead}>
          <View style={styles.panelTitleRow}>
            {icon ? <View style={styles.panelIcon}>{icon}</View> : null}
            <Text style={[styles.panelTitle, { color: colors.text }]} numberOfLines={2}>
              {title}
            </Text>
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function ChartBox({ height = 176, children, onLayout }) {
  return (
    <View style={[styles.chartBox, { height }]} onLayout={onLayout}>
      {children}
    </View>
  );
}

function yTicks(max) {
  if (max <= 0) return [0];
  const nice = max <= 4 ? max : Math.ceil(max / 4) * 4;
  return [0, nice / 2, nice];
}

function labelStep(n) {
  if (n <= 6) return 1;
  if (n <= 14) return 2;
  if (n <= 31) return 4;
  return Math.ceil(n / 6);
}

export function ReportBarChart({
  data = [],
  valueKey = 'count',
  labelKey = 'date',
  color = REPORT_BRAND.forest,
  emptyLabel = 'Xog ma jirto weli.',
  formatLabel,
  height = 176,
}) {
  const { colors, isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(null);
  const rows = useMemo(
    () => toRows(data, valueKey, labelKey, formatLabel),
    [data, valueKey, labelKey, formatLabel]
  );

  if (!rows.length) return <EmptyChart label={emptyLabel} />;

  const padL = 28;
  const padR = 6;
  const padT = 12;
  const padB = 26;
  const innerW = Math.max(width - padL - padR, 1);
  const innerH = height - padT - padB;
  const maxVal = Math.max(...rows.map((r) => r._value), 1);
  const ticks = yTicks(maxVal);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const n = rows.length;
  const gap = n > 24 ? 1.5 : n > 12 ? 3 : 5;
  const barW = Math.max(3, (innerW - gap * Math.max(n - 1, 0)) / n);
  const step = labelStep(n);
  const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(24,32,28,0.08)';
  const tickFill = isDark ? '#94a3b8' : '#59635d';

  return (
    <View>
      {active != null && rows[active] ? (
        <Text style={[styles.tip, { color: colors.text }]}>
          {rows[active]._label}: {rows[active]._value}
        </Text>
      ) : (
        <Text style={[styles.tip, { color: 'transparent' }]}>.</Text>
      )}
      <ChartBox
        height={height}
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      >
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((t) => {
              const y = padT + innerH - (t / scaleMax) * innerH;
              return (
                <G key={`g-${t}`}>
                  <Line
                    x1={padL}
                    x2={width - padR}
                    y1={y}
                    y2={y}
                    stroke={grid}
                    strokeWidth={1}
                  />
                </G>
              );
            })}
            {rows.map((row, i) => {
              const h = (row._value / scaleMax) * innerH;
              const x = padL + i * (barW + gap);
              const y = padT + innerH - h;
              const on = active === i;
              return (
                <G key={`${row._label}-${i}`} onPress={() => setActive(i)}>
                  <Rect
                    x={x}
                    y={y}
                    width={barW}
                    height={Math.max(h, row._value ? 2 : 0)}
                    rx={Math.min(6, barW / 2)}
                    fill={on ? REPORT_BRAND.olive : color}
                    opacity={on ? 1 : 0.92}
                  />
                </G>
              );
            })}
          </Svg>
        ) : null}
        {width > 0 ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {ticks.map((t) => {
              const y = padT + innerH - (t / scaleMax) * innerH - 7;
              return (
                <Text
                  key={`yl-${t}`}
                  style={[styles.axis, { top: y, left: 0, color: tickFill, width: padL - 4 }]}
                >
                  {Number.isInteger(t) ? t : t.toFixed(0)}
                </Text>
              );
            })}
            {rows.map((row, i) => {
              if (i % step !== 0 && i !== n - 1) return null;
              const x = padL + i * (barW + gap);
              return (
                <Text
                  key={`xl-${i}`}
                  numberOfLines={1}
                  style={[
                    styles.axis,
                    {
                      top: height - 18,
                      left: Math.max(0, x - 10),
                      width: Math.max(barW + 20, 36),
                      color: tickFill,
                      textAlign: 'center',
                    },
                  ]}
                >
                  {row._label}
                </Text>
              );
            })}
          </View>
        ) : null}
      </ChartBox>
    </View>
  );
}

export function ReportAreaChart({
  data = [],
  valueKey = 'count',
  labelKey = 'date',
  color = REPORT_BRAND.olive,
  emptyLabel = 'Xog ma jirto weli.',
  formatLabel,
  height = 176,
}) {
  const gid = useMemo(() => `area${Math.random().toString(36).slice(2, 8)}`, []);
  const { isDark } = useTheme();
  const [width, setWidth] = useState(0);
  const rows = useMemo(
    () => toRows(data, valueKey, labelKey, formatLabel),
    [data, valueKey, labelKey, formatLabel]
  );

  if (!rows.length) return <EmptyChart label={emptyLabel} />;

  const padL = 28;
  const padR = 8;
  const padT = 12;
  const padB = 26;
  const innerW = Math.max(width - padL - padR, 1);
  const innerH = height - padT - padB;
  const maxVal = Math.max(...rows.map((r) => r._value), 1);
  const ticks = yTicks(maxVal);
  const scaleMax = ticks[ticks.length - 1] || 1;
  const n = rows.length;
  const stepX = n <= 1 ? innerW / 2 : innerW / (n - 1);
  const points = rows.map((row, i) => ({
    x: padL + i * stepX,
    y: padT + innerH - (row._value / scaleMax) * innerH,
  }));
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const area = `${line} L ${points[points.length - 1].x} ${padT + innerH} L ${points[0].x} ${padT + innerH} Z`;
  const grid = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(24,32,28,0.08)';
  const tickFill = isDark ? '#94a3b8' : '#59635d';
  const step = labelStep(n);

  return (
    <ChartBox height={height} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={color} stopOpacity={0.38} />
              <Stop offset="100%" stopColor={color} stopOpacity={0.03} />
            </LinearGradient>
          </Defs>
          {ticks.map((t) => {
            const y = padT + innerH - (t / scaleMax) * innerH;
            return (
              <Line
                key={`ag-${t}`}
                x1={padL}
                x2={width - padR}
                y1={y}
                y2={y}
                stroke={grid}
                strokeWidth={1}
              />
            );
          })}
          <Path d={area} fill={`url(#${gid})`} />
          <Path d={line} fill="none" stroke={color} strokeWidth={2.2} />
          {points.map((p, i) => (
            <Circle key={`c-${i}`} cx={p.x} cy={p.y} r={2.6} fill={color} />
          ))}
        </Svg>
      ) : null}
      {width > 0 ? (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {ticks.map((t) => {
            const y = padT + innerH - (t / scaleMax) * innerH - 7;
            return (
              <Text
                key={`ay-${t}`}
                style={[styles.axis, { top: y, left: 0, color: tickFill, width: padL - 4 }]}
              >
                {Number.isInteger(t) ? t : t.toFixed(0)}
              </Text>
            );
          })}
          {rows.map((row, i) => {
            if (i % step !== 0 && i !== n - 1) return null;
            return (
              <Text
                key={`ax-${i}`}
                numberOfLines={1}
                style={[
                  styles.axis,
                  {
                    top: height - 18,
                    left: Math.max(0, padL + i * stepX - 18),
                    width: 40,
                    color: tickFill,
                    textAlign: 'center',
                  },
                ]}
              >
                {row._label}
              </Text>
            );
          })}
        </View>
      ) : null}
    </ChartBox>
  );
}

export function ReportHorizontalBars({
  data = [],
  labelKey = 'name',
  valueKey = 'bookings',
  emptyLabel = 'Xog ma jirto weli.',
  barColor = REPORT_BRAND.forest,
}) {
  const { colors } = useTheme();
  const source = Array.isArray(data) ? data : [];
  if (!source.length) return <EmptyChart label={emptyLabel} />;
  const rows = source.map((d) => ({
    label: String(d[labelKey] ?? ''),
    value: Number(d[valueKey]) || 0,
  }));
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <View style={styles.hList}>
      {rows.map((row) => (
        <View key={row.label} style={styles.hRow}>
          <Text style={[styles.hLabel, { color: colors.text }]} numberOfLines={1}>
            {row.label}
          </Text>
          <View style={[styles.hTrack, { backgroundColor: colors.surfaceInset }]}>
            <View
              style={[
                styles.hFill,
                {
                  backgroundColor: barColor,
                  width: `${Math.max(6, (row.value / max) * 100)}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.hVal, { color: colors.muted }]}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

export function ReportStatusPills({ items = [], emptyLabel = 'Xog ma jirto weli.' }) {
  const { colors } = useTheme();
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return <EmptyChart label={emptyLabel} />;
  const total = list.reduce((sum, s) => sum + (Number(s.count) || 0), 0) || 1;

  return (
    <View>
      <View style={[styles.statusBar, { backgroundColor: colors.surfaceInset }]}>
        {list.map((s) => {
          const count = Number(s.count) || 0;
          const width = `${Math.max((count / total) * 100, count ? 4 : 0)}%`;
          return (
            <View
              key={String(s.status)}
              style={{ width, height: '100%', backgroundColor: statusTone(s.status) }}
            />
          );
        })}
      </View>
      <View style={styles.pills}>
        {list.map((s) => (
          <View
            key={String(s.status)}
            style={[styles.pill, { backgroundColor: colors.surfaceInset }]}
          >
            <View style={[styles.pillDot, { backgroundColor: statusTone(s.status) }]} />
            <Text style={[styles.pillText, { color: colors.text }]}>
              {labelForStatus(s.status)}
            </Text>
            <Text style={[styles.pillN, { color: colors.muted }]}>{s.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ReportPeakHours({ data = [], emptyLabel = 'Xog ma jirto weli.' }) {
  return (
    <ReportBarChart
      data={data}
      valueKey="count"
      labelKey="hour"
      color={REPORT_BRAND.olive}
      emptyLabel={emptyLabel}
      formatLabel={(hour) => formatHourLabel(hour)}
    />
  );
}

export function ReportPanelIcon({ name }) {
  return <Ionicons name={name} size={18} color={REPORT_BRAND.forest} />;
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  panelTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  panelIcon: { marginTop: 1 },
  panelTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  chartBox: {
    width: '100%',
    minWidth: 0,
    overflow: 'hidden',
  },
  empty: {
    paddingVertical: 36,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tip: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
    minHeight: 16,
  },
  axis: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '700',
  },
  hList: { gap: 10 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hLabel: { width: 92, fontSize: 12, fontWeight: '700' },
  hTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
  },
  hFill: { height: '100%', borderRadius: 6 },
  hVal: { width: 28, textAlign: 'right', fontSize: 12, fontWeight: '800' },
  statusBar: {
    height: 12,
    borderRadius: 999,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 12, fontWeight: '700' },
  pillN: { fontSize: 12, fontWeight: '800' },
});
