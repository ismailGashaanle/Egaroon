import { StyleSheet } from 'react-native';
import { BaseToast, ErrorToast } from 'react-native-toast-message';
import { brand, radii, typography } from '../theme';

/** Brand-colored toast — works in light & dark (surface card on either). */
export function makeToastConfig(colors) {
  const c = colors || {
    surface: '#ffffff',
    charcoal: '#1f2937',
    muted: '#59635d',
    brandGreen: brand.brandGreen,
    statusCancelled: '#a33a32',
    statusInfo: '#0284c7',
  };

  const base = {
    borderLeftWidth: 5,
    borderRadius: radii.md,
    backgroundColor: c.surface,
    height: 'auto',
    minHeight: 56,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  };

  return {
    success: (props) => (
      <BaseToast
        {...props}
        style={[base, { borderLeftColor: c.brandGreen }]}
        contentContainerStyle={styles.content}
        text1Style={[styles.text1, { color: c.charcoal || c.text }]}
        text2Style={[styles.text2, { color: c.muted }]}
        text2NumberOfLines={3}
      />
    ),
    error: (props) => (
      <ErrorToast
        {...props}
        style={[base, { borderLeftColor: c.statusCancelled }]}
        contentContainerStyle={styles.content}
        text1Style={[styles.text1, { color: c.charcoal || c.text }]}
        text2Style={[styles.text2, { color: c.muted }]}
        text2NumberOfLines={4}
      />
    ),
    info: (props) => (
      <BaseToast
        {...props}
        style={[base, { borderLeftColor: c.statusInfo }]}
        contentContainerStyle={styles.content}
        text1Style={[styles.text1, { color: c.charcoal || c.text }]}
        text2Style={[styles.text2, { color: c.muted }]}
        text2NumberOfLines={3}
      />
    ),
  };
}

/** Static fallback before ThemeProvider mounts */
export const toastConfig = makeToastConfig();

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 12,
  },
  text1: {
    ...typography.h4,
    fontSize: 14,
  },
  text2: {
    ...typography.caption,
  },
});
