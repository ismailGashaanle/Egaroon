import { useId } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import Badge from '../common/Badge';
import ErrorBoundary from '../common/ErrorBoundary';
import { labelForStatus } from '../../lib/statusStyles';
import { useChartTheme } from '../../hooks/useChartTheme';
import { REPORT_BRAND, formatChartDay, formatHourLabel } from './reportBrand';

export function ReportPanel({ title, icon, action, children, className = '' }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={clsx(
        'rounded-[1.75rem] border border-black/[0.04] bg-white p-6 shadow-card sm:p-8 dark:border-dark-border dark:bg-dark-surface',
        className
      )}
    >
      {(title || action) && (
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon ? <span className="text-[#176B45] dark:text-dark-primary">{icon}</span> : null}
            <h2 className="font-display text-lg font-semibold text-[#18201C] dark:text-dark-text">{title}</h2>
          </div>
          {action}
        </div>
      )}
      {children}
    </motion.section>
  );
}

function ChartFrame({ children, className = 'h-56 sm:h-64', style }) {
  return (
    <ErrorBoundary fallback={<EmptyChart label="Chart unavailable." />}>
      <div className={clsx('report-chart w-full min-w-0 min-h-[14rem]', className)} style={style}>
        {children}
      </div>
    </ErrorBoundary>
  );
}

function EmptyChart({ label }) {
  return <p className="py-16 text-center text-sm text-muted dark:text-dark-muted">{label}</p>;
}

function toRows(data, valueKey, labelKey, formatLabel) {
  const labelFn = formatLabel || formatChartDay;
  return data.filter(Boolean).map((d, idx) => ({
    ...d,
    _label: labelFn(d[labelKey] ?? '', d, idx),
    _value: Number(d[valueKey]) || 0,
  }));
}

export function ReportBarChart({
  data = [],
  valueKey = 'count',
  labelKey = 'date',
  color = REPORT_BRAND.forest,
  emptyLabel = 'No data yet.',
  formatLabel,
}) {
  const theme = useChartTheme();
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return <EmptyChart label={emptyLabel} />;
  const chartRows = toRows(rows, valueKey, labelKey, formatLabel);

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartRows} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="_label"
            tick={{ fill: theme.tick, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: theme.tick, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={theme.tooltip}
            labelStyle={theme.tooltipLabel}
            itemStyle={theme.tooltipItem}
            cursor={{ fill: theme.cursor }}
            formatter={(v) => [v, '']}
          />
          <Bar dataKey="_value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={36} animationDuration={700} />
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ReportAreaChart({
  data = [],
  valueKey = 'count',
  labelKey = 'date',
  color = REPORT_BRAND.olive,
  emptyLabel = 'No data yet.',
  formatLabel,
}) {
  const theme = useChartTheme();
  const gid = `area-${useId().replace(/:/g, '')}`;
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return <EmptyChart label={emptyLabel} />;
  const chartRows = toRows(rows, valueKey, labelKey, formatLabel);

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartRows} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.38} />
              <stop offset="100%" stopColor={color} stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="_label"
            tick={{ fill: theme.tick, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: theme.tick, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={theme.tooltip}
            labelStyle={theme.tooltipLabel}
            itemStyle={theme.tooltipItem}
            cursor={{ stroke: color, strokeOpacity: 0.35 }}
            formatter={(v) => [v, '']}
          />
          <Area
            type="monotone"
            dataKey="_value"
            stroke={color}
            fill={`url(#${gid})`}
            strokeWidth={2}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ReportLineChart({
  data = [],
  valueKey = 'count',
  labelKey = 'date',
  color = REPORT_BRAND.forest,
  emptyLabel = 'No data yet.',
  formatLabel,
}) {
  const theme = useChartTheme();
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) return <EmptyChart label={emptyLabel} />;
  const chartRows = toRows(rows, valueKey, labelKey, formatLabel);

  return (
    <ChartFrame>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartRows} margin={{ top: 12, right: 8, left: 0, bottom: 4 }}>
          <CartesianGrid stroke={theme.grid} vertical={false} />
          <XAxis
            dataKey="_label"
            tick={{ fill: theme.tick, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: theme.tick, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={theme.tooltip}
            labelStyle={theme.tooltipLabel}
            itemStyle={theme.tooltipItem}
            formatter={(v) => [v, '']}
          />
          <Line
            type="monotone"
            dataKey="_value"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 5 }}
            animationDuration={800}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartFrame>
  );
}

export function ReportHorizontalBars({
  data = [],
  labelKey = 'name',
  valueKey = 'bookings',
  emptyLabel = 'No data yet.',
  barColor = REPORT_BRAND.forest,
}) {
  const theme = useChartTheme();
  const source = Array.isArray(data) ? data : [];
  if (!source.length) {
    return <p className="py-8 text-center text-sm text-muted dark:text-dark-muted">{emptyLabel}</p>;
  }
  const rows = source.map((d) => ({
    ...d,
    _label: String(d[labelKey] ?? ''),
    _value: Number(d[valueKey]) || 0,
  }));
  const height = Math.max(140, rows.length * 40);

  return (
    <ChartFrame className="w-full" style={{ height }}>
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid stroke={theme.grid} horizontal={false} />
            <XAxis type="number" tick={{ fill: theme.tick, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="_label"
              width={96}
              tick={{ fill: theme.tick, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={theme.tooltip}
              labelStyle={theme.tooltipLabel}
              itemStyle={theme.tooltipItem}
              cursor={{ fill: theme.cursor }}
              formatter={(v) => [v, '']}
            />
            <Bar dataKey="_value" fill={barColor} radius={[0, 6, 6, 0]} barSize={12} animationDuration={700} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function ReportStatusPills({ items = [], emptyLabel = 'No data yet.' }) {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) {
    return <p className="py-8 text-center text-sm text-muted dark:text-dark-muted">{emptyLabel}</p>;
  }
  const total = list.reduce((sum, s) => sum + (Number(s.count) || 0), 0) || 1;
  return (
    <div className="space-y-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-[#18201C]/[0.06] dark:bg-white/10">
        {list.map((s) => {
          const count = Number(s.count) || 0;
          const width = `${Math.max((count / total) * 100, count ? 4 : 0)}%`;
          const group = String(s.status || '').toUpperCase();
          const tone =
            /CANCEL|EXPIRE|NO_SHOW|FAIL|REJECT/.test(group)
              ? REPORT_BRAND.orange
              : /HOLD|PEND/.test(group)
                ? REPORT_BRAND.olive
                : REPORT_BRAND.forest;
          return (
            <div
              key={s.status}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width, background: tone }}
              title={`${labelForStatus(s.status)}: ${count}`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-2.5">
        {list.map((s) => (
          <li key={s.status}>
            <Badge status={s.status} dot className="px-3 py-1.5 text-xs">
              {labelForStatus(s.status)}
              <span className="ms-1 tabular-nums opacity-70">{s.count}</span>
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ReportPeakHours({ data = [], emptyLabel = 'No data yet.' }) {
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    return <p className="py-8 text-center text-sm text-muted dark:text-dark-muted">{emptyLabel}</p>;
  }
  return (
    <ReportBarChart
      data={rows}
      valueKey="count"
      labelKey="hour"
      color={REPORT_BRAND.olive}
      emptyLabel={emptyLabel}
      formatLabel={formatHourLabel}
    />
  );
}
