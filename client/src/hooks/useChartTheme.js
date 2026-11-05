import { useSelector } from 'react-redux';

/** Recharts axis/tooltip colors that stay readable in light and dark. */
export function useChartTheme() {
  const theme = useSelector((s) => s.ui?.theme);
  const dark = theme === 'dark';
  return {
    dark,
    grid: dark ? 'rgba(255,255,255,0.1)' : 'rgba(24,32,28,0.08)',
    tick: dark ? '#94a3b8' : '#59635d',
    tooltip: {
      backgroundColor: dark ? '#252b3b' : '#ffffff',
      border: `1px solid ${dark ? '#3a4258' : '#e5e7eb'}`,
      borderRadius: 12,
      color: dark ? '#f5f5f2' : '#18201C',
      fontSize: 12,
      boxShadow: dark ? '0 8px 24px rgb(0 0 0 / 0.35)' : '0 8px 24px rgb(24 32 28 / 0.1)',
    },
    tooltipLabel: { color: dark ? '#f5f5f2' : '#18201C', fontWeight: 600 },
    tooltipItem: { color: dark ? '#94a3b8' : '#59635d' },
    cursor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(23,107,69,0.08)',
  };
}
