import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import PaymentConfirmModal from '../../components/PaymentConfirmModal';
import { useAuth } from '../../context/AuthContext';
import { bookingsApi } from '../../api/bookings';
import { isPartyPaid } from '../../lib/bookingStatus';
import { useTheme } from '../../context/ThemeContext';
import { typography } from '../../theme';

/**
 * Legacy / deep-link pay entry. Always opens PaymentConfirmModal —
 * never initiates payment from a one-tap button.
 * Prefer BookingDetail + openPay for new flows.
 *
 * Route params: bookingId, side ('teamA'|'teamB'), coverFullMatch?, phone?, name?
 */
export default function PayBookingScreen({ route, navigation }) {
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { user } = useAuth();
  const {
    bookingId,
    side: sideParam = 'teamA',
    coverFullMatch: coverParam = false,
    phone: defaultPhone,
    name: defaultName,
  } = route.params || {};

  const side = sideParam === 'teamB' ? 'teamB' : 'teamA';
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [payOpen, setPayOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await bookingsApi.get(bookingId);
        if (cancelled) return;
        setBooking(data.booking || data);
        setPayOpen(true);
      } catch (e) {
        Toast.show({ type: 'error', text1: 'Ballanka lama helin', text2: e.message });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  const goAfterPay = (b) => {
    const next = b || booking;
    if (coverParam || next?.coveredFullMatch) {
      navigation.replace('BookingDetail', { bookingId: next._id || bookingId });
      return;
    }
    const aPaid = isPartyPaid(next?.teamA);
    const confirmed = ['CONFIRMED', 'CHECKED_IN', 'SETTLED'].includes(next?.status);

    if (side === 'teamA' && aPaid && !next?.teamB && !confirmed) {
      navigation.replace('InviteTeamB', { bookingId: next._id || bookingId });
      return;
    }
    navigation.replace('BookingDetail', { bookingId: next._id || bookingId });
  };

  const onPaid = async () => {
    setPayOpen(false);
    try {
      const data = await bookingsApi.get(bookingId);
      const refreshed = data.booking || data;
      setBooking(refreshed);
      goAfterPay(refreshed);
    } catch {
      goAfterPay(booking);
    }
  };

  const onClose = () => {
    setPayOpen(false);
    navigation.replace('BookingDetail', { bookingId });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.brandGreen} />
        <Text style={styles.muted}>Waa la soo rarayaa…</Text>
      </View>
    );
  }

  if (!booking) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Lama helin</Text>
      </View>
    );
  }

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header
          title="Lacag-bixin"
          subtitle="Xaqiiji ka hor intaad bixiso"
          onBack={onClose}
        />
        <View style={styles.centered}>
          <Text style={styles.muted}>Fur foomka xaqiijinta…</Text>
        </View>
        <PaymentConfirmModal
          visible={payOpen}
          onClose={onClose}
          booking={booking}
          side={side}
          coverFullMatch={Boolean(coverParam)}
          defaultPhone={defaultPhone || user?.phone}
          defaultName={defaultName || user?.name}
          onPaid={onPaid}
        />
      </View>
    </FadeIn>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 24,
    },
    muted: { ...typography.body, color: colors.muted, textAlign: 'center' },
  });
}
