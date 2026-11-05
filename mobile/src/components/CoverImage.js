import { useState } from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

/**
 * Stadium / field cover. Falls back to a pitch-tinted placeholder if no URL.
 */
export default function CoverImage({
  uri,
  height = 176,
  children,
  style,
  iconSize = 42,
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const show = Boolean(uri) && !failed;

  return (
    <View style={[{ height, backgroundColor: colors.brandNavy, overflow: 'hidden' }, style]}>
      {show ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={styles.placeholder}>
          <View style={[styles.pitch, { borderColor: 'rgba(16,185,129,0.28)' }]} />
          <Ionicons name="football-outline" size={iconSize} color="rgba(16,185,129,0.55)" />
        </View>
      )}
      <View pointerEvents="none" style={styles.scrim} />
      {children ? (
        <View style={styles.children} pointerEvents="box-none">
          {children}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E2433',
  },
  pitch: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 14,
    bottom: 14,
    borderWidth: 1.5,
    borderRadius: 8,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 32, 0.22)',
  },
  children: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
});
