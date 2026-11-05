import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import AppRoutes from './routes/AppRoutes';
import { restoreSession, sessionExpired } from './features/auth/authSlice';
import { setUnauthorizedHandler } from './api/axiosClient';
import { useTheme } from './hooks/useTheme';
import { useSocket } from './hooks/useSocket';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useLanguage } from './i18n/LanguageContext';
import Offline from './pages/Offline';

export default function App() {
  const dispatch = useDispatch();
  const { isRtl } = useLanguage();
  useTheme();
  useSocket();
  const { isOffline, checking, retry } = useOnlineStatus();

  useEffect(() => {
    setUnauthorizedHandler(() => dispatch(sessionExpired()));
    dispatch(restoreSession());
  }, [dispatch]);

  if (isOffline) {
    return <Offline checking={checking} onRetry={retry} />;
  }

  return (
    <>
      <AppRoutes />
      <Toaster
        position={isRtl ? 'top-left' : 'top-right'}
        toastOptions={{
          duration: 3500,
          style: {
            background: 'var(--color-surface)',
            color: 'var(--color-charcoal)',
            border: '1px solid var(--color-border)',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#A33A32', secondary: '#fff' } },
        }}
      />
    </>
  );
}
