import { NativeModules, Platform } from 'react-native';

/**
 * True when running inside Expo Go (store client), not a dev/standalone build.
 * Prefer expo-constants; fall back to native ExponentConstants.
 */
export function isExpoGo() {
  try {
    // eslint-disable-next-line global-require, import/no-extraneous-dependencies
    const Constants = require('expo-constants').default || require('expo-constants');
    if (Constants?.appOwnership === 'expo') return true;
    if (Constants?.executionEnvironment === 'storeClient') return true;
  } catch {
    /* package optional at resolve time */
  }
  const exp = NativeModules.ExponentConstants || NativeModules.ExpoConstants;
  if (exp?.appOwnership === 'expo') return true;
  if (exp?.executionEnvironment === 'storeClient') return true;
  return false;
}

export function isNativeMobile() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}
