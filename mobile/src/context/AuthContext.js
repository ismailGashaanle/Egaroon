import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import Toast from 'react-native-toast-message';
import { authApi } from '../api/auth';
import {
  loadStoredToken,
  setAccessToken,
  setUnauthorizedHandler,
  setSuppressUnauthorizedToast,
} from '../api/client';
import { isMobileRole } from '../lib/roles';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  /** Clear local session only — used when JWT is dead (no logout API call). */
  const clearSession = useCallback(() => {
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession]);

  useEffect(() => {
    (async () => {
      setSuppressUnauthorizedToast(true);
      try {
        const token = await loadStoredToken();
        if (!token) return;
        const me = await authApi.me();
        if (!isMobileRole(me.role)) {
          await setAccessToken(null);
          Toast.show({
            type: 'error',
            text1: 'Door aan la taageerin',
            text2: 'Mobile-ka ma taageero Super Admin / Admin.',
          });
          return;
        }
        setUser(me);
      } catch {
        await setAccessToken(null);
      } finally {
        setSuppressUnauthorizedToast(false);
        setBooting(false);
      }
    })();
  }, []);

  const login = useCallback(async (email, password) => {
    const { user: next } = await authApi.login(email, password);
    if (!isMobileRole(next.role)) {
      await setAccessToken(null);
      throw new Error('Mobile-ka ma taageero door-kan (Admin).');
    }
    setUser(next);
    Toast.show({ type: 'success', text1: `Soo dhawoow, ${next.name?.split(' ')[0] || ''}` });
    return next;
  }, []);

  const register = useCallback(async (body) => {
    const { user: next } = await authApi.register(body);
    setUser(next);
    Toast.show({ type: 'success', text1: 'Akoonka waa la sameeyay' });
    return next;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    Toast.show({ type: 'info', text1: 'Waad ka baxday' });
  }, []);

  const updateProfile = useCallback(async (body) => {
    const next = await authApi.updateMe(body);
    setUser(next);
    Toast.show({ type: 'success', text1: 'Profile waa la cusboonaysiiyay' });
    return next;
  }, []);

  const value = useMemo(
    () => ({
      user,
      booting,
      login,
      register,
      logout,
      updateProfile,
      clearSession,
      isAuthenticated: !!user,
    }),
    [user, booting, login, register, logout, updateProfile, clearSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
