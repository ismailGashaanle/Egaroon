/**
 * E-Garoon brand tokens — single source for StyleSheet UIs.
 * Aligned with web `client/src/index.css` (@theme).
 */

export const brand = {
  brandGreen: '#10B981',
  brandBlue: '#38BDF8',
  brandNavy: '#1E2433',
  brandGradient: ['#10B981', '#38BDF8'],
  warmwhite: '#f5f5f2',
  forestDark: '#059669',
  forestLight: '#34D399',
  accent: '#f4a261',
};

/** Semantic status — shared across modes */
export const status = {
  statusConfirmed: '#059669',
  statusConfirmedBg: '#d1fae5',
  statusPending: '#94652a',
  statusPendingBg: '#f6eedf',
  statusCancelled: '#a33a32',
  statusCancelledBg: '#f7e7e5',
  statusInfo: '#0284c7',
  statusInfoBg: '#e0f2fe',
  slotAvailable: '#10B981',
  slotBooked: '#a33a32',
  slotCancelled: '#a33a32',
  slotSelected: '#f4a261',
  danger: '#a33a32',
  success: '#059669',
  info: '#0284c7',
};

export const lightColors = {
  ...brand,
  ...status,
  mode: 'light',
  primary: brand.brandGreen,
  forest: brand.brandGreen,
  bg: brand.warmwhite,
  surface: '#ffffff',
  white: '#ffffff',
  surfaceInset: '#eef0ed',
  charcoal: '#1f2937',
  text: '#1f2937',
  muted: '#59635d',
  border: '#e5e7eb',
  disabled: '#a5ada7',
  // Dark aliases → light values (compat)
  darkBg: brand.brandNavy,
  darkSurface: '#252b3b',
  darkSurface2: '#2d3448',
  darkText: brand.warmwhite,
  darkMuted: '#94a3b8',
  darkBorder: '#3a4258',
  orange: brand.brandGreen,
  orangeDark: brand.forestDark,
  navy: brand.brandNavy,
  navySoft: '#252b3b',
};

export const darkColors = {
  ...brand,
  ...status,
  mode: 'dark',
  primary: brand.brandGreen,
  forest: brand.brandGreen,
  bg: brand.brandNavy,
  surface: '#252b3b',
  white: '#ffffff',
  surfaceInset: '#2d3448',
  charcoal: brand.warmwhite,
  text: brand.warmwhite,
  muted: '#94a3b8',
  border: '#3a4258',
  disabled: '#64748b',
  darkBg: brand.brandNavy,
  darkSurface: '#252b3b',
  darkSurface2: '#2d3448',
  darkText: brand.warmwhite,
  darkMuted: '#94a3b8',
  darkBorder: '#3a4258',
  // Status on dark surfaces
  statusConfirmedBg: 'rgba(16, 185, 129, 0.18)',
  statusPendingBg: 'rgba(148, 101, 42, 0.22)',
  statusCancelledBg: 'rgba(163, 58, 50, 0.22)',
  statusInfoBg: 'rgba(2, 132, 199, 0.2)',
  orange: brand.brandGreen,
  orangeDark: brand.forestDark,
  navy: brand.brandNavy,
  navySoft: '#252b3b',
};

/** @deprecated Prefer useTheme().colors — kept for gradual migration */
export const colors = lightColors;

export const typography = {
  h1: { fontSize: 32, fontWeight: '700', lineHeight: 38, letterSpacing: -0.4 },
  h2: { fontSize: 24, fontWeight: '700', lineHeight: 30 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  h4: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 24 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 20 },
  overline: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  pageX: 16,
  pageY: 16,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 16,
  card: 14,
  button: 12,
  chip: 10,
  full: 999,
};

export const shadows = {
  soft: {
    shadowColor: '#1f2937',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  card: {
    shadowColor: '#1f2937',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  lifted: {
    shadowColor: '#1f2937',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
};

/** Softer elevation on dark navy so cards don’t look muddy */
export const darkShadows = {
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 2,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 4,
  },
  lifted: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 8,
  },
};

export function paletteFor(mode) {
  return mode === 'dark' ? darkColors : lightColors;
}

export function shadowsFor(mode) {
  return mode === 'dark' ? darkShadows : shadows;
}

export default { colors, lightColors, darkColors, typography, spacing, radii, shadows };
