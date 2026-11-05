import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import RootNavigator from './src/navigation/RootNavigator';
import { makeToastConfig } from './src/lib/toastConfig';
import { attachReminderListeners } from './src/lib/matchReminders';
import { useStaffRealtime } from './src/hooks/useStaffRealtime';

function StaffRealtimeBridge() {
  useStaffRealtime();
  return null;
}

function AppShell() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    try {
      return attachReminderListeners();
    } catch (err) {
      console.warn('[app] reminder listeners skipped', err?.message);
      return undefined;
    }
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'light'} />
      <StaffRealtimeBridge />
      <RootNavigator />
      <Toast config={makeToastConfig(colors)} />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <AppShell />
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
