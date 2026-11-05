import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import Toast from 'react-native-toast-message';
import { isConfirmedBooking } from './bookingStatus';
import { isExpoGo, isNativeMobile } from './expoRuntime';

const CHANNEL_ID = 'match-reminders';
const PREFIX = 'kul-match';

let Notifications = null;
let handlerReady = false;
let expoGoToastShown = false;

function toastDevBuildOnce(extra) {
  if (expoGoToastShown) return;
  expoGoToastShown = true;
  Toast.show({
    type: 'info',
    text1: 'Reminders need development build',
    text2: extra || 'Expo Go ma taageero ogeysiis buuxa — isticmaal dev build',
    visibilityTime: 4000,
  });
}

/**
 * Lazy-load expo-notifications only outside Expo Go.
 * Importing the module in Expo Go (SDK 53+) logs ERROR about Android push removal.
 */
function getNotifications() {
  if (!isNativeMobile() || Platform.OS === 'web') return null;
  if (isExpoGo()) return null;
  if (Notifications) return Notifications;
  try {
    // eslint-disable-next-line global-require
    Notifications = require('expo-notifications');
    if (!handlerReady && Notifications?.setNotificationHandler) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerReady = true;
    }
    return Notifications;
  } catch (err) {
    console.warn('[reminders] expo-notifications unavailable', err?.message);
    Notifications = null;
    return null;
  }
}

function reminderIds(bookingId) {
  const id = String(bookingId);
  return {
    t30a: `${PREFIX}-${id}-30a`,
    t30b: `${PREFIX}-${id}-30b`,
    t5: `${PREFIX}-${id}-5`,
  };
}

async function ensureAndroidChannel(N) {
  if (Platform.OS !== 'android' || !N?.setNotificationChannelAsync) return;
  await N.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Xusuusin ciyaarta',
    importance: N.AndroidImportance.MAX,
    vibrationPattern: [0, 400, 200, 400],
    sound: 'default',
    enableVibrate: true,
    lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
  });
}

/**
 * Request OS permission. Never throws — toast fallback if denied / Expo Go.
 * @returns {Promise<boolean>}
 */
export async function ensureReminderPermissions() {
  if (!isNativeMobile() || Platform.OS === 'web') return false;
  if (isExpoGo()) {
    toastDevBuildOnce();
    return false;
  }
  const N = getNotifications();
  if (!N) {
    toastDevBuildOnce('Ogeysiis lama heli karin');
    return false;
  }
  try {
    await ensureAndroidChannel(N);
    const current = await N.getPermissionsAsync();
    if (current.granted || current.ios?.status === N.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    const asked = await N.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
      },
    });
    if (asked.granted || asked.ios?.status === N.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }
    Toast.show({
      type: 'info',
      text1: 'Ogeysiis lama oggolaan',
      text2: 'Fur Settings → Notifications si aad u hesho xusuusin ciyaarta',
    });
    return false;
  } catch {
    Toast.show({
      type: 'info',
      text1: 'Ogeysiis lama sameyn karin',
      text2: 'Hubi settings-ka telefoonka',
    });
    return false;
  }
}

export async function cancelMatchReminders(bookingId) {
  if (!bookingId || Platform.OS === 'web') return;
  if (isExpoGo()) return;
  const N = getNotifications();
  if (!N?.cancelScheduledNotificationAsync) return;
  const ids = reminderIds(bookingId);
  await Promise.all(
    Object.values(ids).map((nid) =>
      N.cancelScheduledNotificationAsync(nid).catch(() => {})
    )
  );
}

function triggerAt(N, date) {
  return {
    type: N.SchedulableTriggerInputTypes.DATE,
    date,
    channelId: Platform.OS === 'android' ? CHANNEL_ID : undefined,
  };
}

async function scheduleOne(N, { id, title, body, when, data }) {
  if (!(when instanceof Date) || Number.isNaN(when.getTime())) return;
  if (when.getTime() <= Date.now() + 2000) return;
  await N.scheduleNotificationAsync({
    identifier: id,
    content: {
      title,
      body,
      sound: 'default',
      priority: N.AndroidNotificationPriority.MAX,
      data: data || {},
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: triggerAt(N, when),
  });
}

/**
 * Schedule T-30m (2 pulses ~4s apart) + T-5m when booking is CONFIRMED+.
 * Cancels prior schedules for this booking first.
 * In Expo Go: no-op + one soft toast (never loads push APIs).
 */
export async function syncMatchReminders(booking) {
  const bookingId = booking?._id || booking?.id;
  if (!bookingId || !booking?.startTime) {
    return { scheduled: false, reason: 'missing' };
  }

  if (Platform.OS === 'web') {
    return { scheduled: false, reason: 'web' };
  }

  if (isExpoGo()) {
    toastDevBuildOnce();
    return { scheduled: false, reason: 'expo_go' };
  }

  const status = booking.status;
  if (['CANCELLED', 'EXPIRED', 'COMPLETED', 'SETTLED'].includes(status)) {
    await cancelMatchReminders(bookingId);
    return { scheduled: false, reason: 'terminal' };
  }

  if (!isConfirmedBooking(status) && status !== 'CHECKED_IN' && status !== 'IN_PROGRESS') {
    await cancelMatchReminders(bookingId);
    return { scheduled: false, reason: 'not_confirmed' };
  }

  const allowed = await ensureReminderPermissions();
  if (!allowed) {
    await cancelMatchReminders(bookingId);
    return { scheduled: false, reason: 'denied' };
  }

  const N = getNotifications();
  if (!N) {
    return { scheduled: false, reason: 'unavailable' };
  }

  await cancelMatchReminders(bookingId);

  const start = new Date(booking.startTime);
  const stadium =
    typeof booking.stadium === 'object'
      ? booking.stadium?.name
      : booking.matchPass?.stadiumName || 'Garoon';
  const field =
    typeof booking.field === 'object'
      ? booking.field?.name
      : booking.matchPass?.fieldName || '';
  const place = [stadium, field].filter(Boolean).join(' · ');
  const ids = reminderIds(bookingId);

  const t30 = new Date(start.getTime() - 30 * 60 * 1000);
  const t30b = new Date(t30.getTime() + 4000);
  const t5 = new Date(start.getTime() - 5 * 60 * 1000);

  const baseData = {
    type: 'match_reminder',
    bookingId: String(bookingId),
  };

  try {
    await scheduleOne(N, {
      id: ids.t30a,
      title: '⏱ 30 daqiiqo — ciyaarta',
      body: `Diyaariso! ${place}. Tus Match Pass / QR albaabka.`,
      when: t30,
      data: { ...baseData, pulse: 1, offsetMin: 30 },
    });
    await scheduleOne(N, {
      id: ids.t30b,
      title: '⏱ 30 daqiiqo — xusuusin 2aad',
      body: `Weli 30 daqiiqo. ${place}`,
      when: t30b,
      data: { ...baseData, pulse: 2, offsetMin: 30 },
    });
    await scheduleOne(N, {
      id: ids.t5,
      title: '🚨 Ciyaarta waa dhowdahay',
      body: 'Please be ready — ciyaarta waa dhowdahay. Tag albaabka / tus QR.',
      when: t5,
      data: { ...baseData, pulse: 1, offsetMin: 5 },
    });
    return { scheduled: true, at30: t30.toISOString(), at5: t5.toISOString() };
  } catch (err) {
    Toast.show({
      type: 'info',
      text1: 'Xusuusin lama qorsheyn',
      text2: err?.message || 'Hubi settings',
    });
    return { scheduled: false, reason: 'error' };
  }
}

/** Loud haptic when a match reminder arrives in foreground. */
export async function playReminderAlert(notification) {
  const data = notification?.request?.content?.data || {};
  if (data.type !== 'match_reminder') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, 350);
  } catch {
    /* ignore */
  }
  const mins = data.offsetMin;
  Toast.show({
    type: 'info',
    text1:
      mins === 5
        ? 'Ciyaarta waa dhowdahay'
        : mins === 30
          ? '30 daqiiqo ka hor'
          : 'Xusuusin ciyaarta',
    text2: notification?.request?.content?.body || 'Please be ready',
  });
}

export function attachReminderListeners() {
  if (Platform.OS === 'web' || isExpoGo()) return () => {};
  try {
    const N = getNotifications();
    if (!N?.addNotificationReceivedListener) return () => {};
    const sub = N.addNotificationReceivedListener((n) => {
      playReminderAlert(n);
    });
    return () => {
      try {
        sub.remove();
      } catch {
        /* ignore */
      }
    };
  } catch (err) {
    console.warn('[reminders] listener attach failed', err?.message);
    return () => {};
  }
}
