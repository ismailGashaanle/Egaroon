import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  paletteFor,
  shadowsFor,
  typography,
  spacing,
  radii,
} from '../theme';

const STORAGE_KEY = 'kulansiiye_theme_mode';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
          setModeState(stored);
        } else if (system === 'dark') {
          setModeState('dark');
        }
      } catch {
        /* keep light */
      } finally {
        setReady(true);
      }
    })();
  }, [system]);

  const setMode = useCallback(async (next) => {
    const value = next === 'dark' ? 'dark' : 'light';
    setModeState(value);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const value = useMemo(() => {
    const colors = paletteFor(mode);
    const shadows = shadowsFor(mode);
    return {
      mode,
      isDark: mode === 'dark',
      ready,
      colors,
      shadows,
      typography,
      spacing,
      radii,
      setMode,
      toggleMode,
    };
  }, [mode, ready, setMode, toggleMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
