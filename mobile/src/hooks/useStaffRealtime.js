import { useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../lib/roles';
import { getAccessToken } from '../api/client';
import { getSocket, disconnectSocket } from '../lib/socket';

/**
 * Owner / manager near-real-time booking alerts via Socket.IO `user:{id}` room.
 * In-app toast only (notification:new). No Expo push — avoids Expo Go ERROR spam.
 * Typed server events (booking:created / match:started) still reach the same room;
 * toast is driven by the persisted Notification emit to avoid duplicates.
 */
export function useStaffRealtime() {
  const { user, isAuthenticated } = useAuth();

  const isStaff =
    user?.role === ROLES.STADIUM_OWNER || user?.role === ROLES.STADIUM_MANAGER;

  useEffect(() => {
    if (!isAuthenticated || !isStaff) {
      disconnectSocket();
      return undefined;
    }

    const token = getAccessToken();
    if (!token) return undefined;

    const socket = getSocket(token);
    socket.connect();

    const onNotification = (payload) => {
      const title = payload?.title;
      const body = payload?.body || '';
      if (!title && !body) return;
      Toast.show({
        type: 'info',
        text1: title || 'Ogeysiis',
        text2: body || undefined,
        visibilityTime: 4500,
      });
    };

    socket.on('notification:new', onNotification);

    return () => {
      socket.off('notification:new', onNotification);
    };
  }, [isAuthenticated, isStaff, user?.id]);
}
