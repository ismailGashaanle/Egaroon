import { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { getAccessToken } from '../api/axiosClient';
import { getSocket, disconnectSocket } from '../lib/socket';
import { bookingUpdated } from '../features/bookings/bookingSlice';
import toast from 'react-hot-toast';

// Connects once the user is authenticated, listens for booking/field
// updates, and disconnects on logout/unmount.
export function useSocket() {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector((state) => state.auth.status === 'authenticated');
  const socketRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      return;
    }

    const socket = getSocket(getAccessToken());
    socketRef.current = socket;
    socket.connect();

    const handleBookingUpdate = (booking) => {
      dispatch(bookingUpdated(booking));
    };
    const handlePaymentReceived = (payload) => {
      toast.success(payload?.message || 'Payment received');
    };

    const handleNotification = (payload) => {
      if (payload?.title) {
        toast(payload.title + (payload.body ? ` — ${payload.body}` : ''));
      }
    };
    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('booking:updated', handleBookingUpdate);
      socket.off('payment:received', handlePaymentReceived);
      socket.off('notification:new', handleNotification);
    };
  }, [isAuthenticated, dispatch]);

  return socketRef;
}

export function useFieldAvailabilitySubscription(fieldId) {
  useEffect(() => {
    if (!fieldId) return;
    const socket = getSocket(getAccessToken());
    socket.emit('field:subscribe', fieldId);
    return () => socket.emit('field:unsubscribe', fieldId);
  }, [fieldId]);
}

/** Live opponent lineup board — subscribe to booking room */
export function useBookingLineupSubscription(bookingId, onUpdated) {
  useEffect(() => {
    if (!bookingId || !onUpdated) return;
    const socket = getSocket(getAccessToken());
    socket.connect();
    socket.emit('booking:subscribe', bookingId);
    const handler = (payload) => {
      if (String(payload?.bookingId) === String(bookingId)) onUpdated(payload);
    };
    socket.on('lineup:updated', handler);
    return () => {
      socket.emit('booking:unsubscribe', bookingId);
      socket.off('lineup:updated', handler);
    };
  }, [bookingId, onUpdated]);
}
