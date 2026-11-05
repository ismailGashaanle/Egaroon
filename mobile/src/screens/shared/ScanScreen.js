import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import FadeIn from '../../components/FadeIn';
import Header from '../../components/Header';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Chip from '../../components/Chip';
import { ownerApi } from '../../api/owner';
import { stadiumsApi } from '../../api/stadiums';
import { useTheme } from '../../context/ThemeContext';
import {
  parseGateScanInput,
  formatSlotRange,
  formatMoney,
  formatWhen,
  formatCountdown,
  secondsUntil,
  pickGateTime,
} from '../../lib/gateScan';
import { radii, spacing, typography } from '../../theme';

const SCAN_COOLDOWN_MS = 2500;

const LOCK_SO = {
  not_scanned: 'Weli QR lama hubin — scan ka hor intaadan bilowin ciyaarta.',
  too_early: 'Ma bilaabi kartid — maaha wakhtigan. Sug ilaa wakhtiga booking-ka.',
  expired: 'Wakhtigagii aad ciyaari lahaydeen wuu dhacay — ma bilaabi kartid.',
};

/**
 * Owner + Manager gate QR check-in.
 * Requires stadiumId — booking must match this stadium + current slot window.
 * Bilow ciyaarta locked until QR validated (session) AND time window OK.
 */
export default function ScanScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState(route.params?.bookingCode || '');
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [forceDemo, setForceDemo] = useState(__DEV__);
  const [preview, setPreview] = useState(null);
  const [joogtoResult, setJoogtoResult] = useState(null);
  const [renewing, setRenewing] = useState(false);
  const [started, setStarted] = useState(false);
  const [qrVerified, setQrVerified] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [stadiums, setStadiums] = useState([]);
  const [stadiumId, setStadiumId] = useState(route.params?.stadiumId || '');
  const lastScan = useRef('');
  const cooldownUntil = useRef(0);
  const processing = useRef(false);

  const cameraSupported = Platform.OS !== 'web';
  const timeState = preview?.timeState;
  const needsCountdown = timeState === 'too_early' && Boolean(preview?.startsAt);

  useEffect(() => {
    const p = route.params || {};
    if (p.bookingCode) setCode(String(p.bookingCode));
    if (p.stadiumId) setStadiumId(String(p.stadiumId));
  }, [route.params?.bookingCode, route.params?.stadiumId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await stadiumsApi.mine();
        const list = data.stadiums || data || [];
        if (cancelled) return;
        const arr = Array.isArray(list) ? list : [];
        setStadiums(arr);
        setStadiumId((prev) => prev || (arr[0] ? String(arr[0]._id) : ''));
      } catch {
        /* ignore — validate will fail without stadium */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!needsCountdown) return undefined;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [needsCountdown]);

  const countdownSecs = needsCountdown
    ? secondsUntil(preview.startsAt, nowTick)
    : preview?.secondsUntilStart || 0;

  useEffect(() => {
    if (!preview?.startsAt || preview.timeState !== 'too_early') return;
    const earlyMs = 10 * 60 * 1000;
    const openFrom = new Date(preview.startsAt).getTime() - earlyMs;
    if (nowTick < openFrom) return;
    setPreview((prev) => {
      if (!prev || prev.timeState !== 'too_early') return prev;
      return {
        ...prev,
        timeState: 'ok',
        canStart: true,
        canStartMatch: Boolean(qrVerified),
        secondsUntilStart: Math.max(
          0,
          Math.ceil((new Date(prev.startsAt).getTime() - nowTick) / 1000)
        ),
        messageEn: 'Time slot matches — you can start the game.',
        messageSo: 'Wakhtiga waa sax — waad bilaabi kartaa ciyaarta.',
        lockReason: qrVerified ? null : 'not_scanned',
        lockMessageSo: qrVerified ? null : LOCK_SO.not_scanned,
      };
    });
  }, [nowTick, preview?.startsAt, preview?.timeState, qrVerified]);

  const fail = useCallback((title, message) => {
    setPreview(null);
    setJoogtoResult(null);
    setStarted(false);
    setQrVerified(false);
    Toast.show({
      type: 'error',
      text1: title,
      text2: message || '',
      visibilityTime: 4500,
    });
  }, []);

  const applyResult = useCallback(
    (result, { asStarted, scanned } = {}) => {
      const summary = result?.gateSummary;
      if (!summary) {
        fail('Check-in fashilmay', 'Jawaabta server-ka waa madhan');
        return;
      }
      const time = pickGateTime(result);
      const verified =
        scanned !== false &&
        (Boolean(result.qrVerified) ||
          Boolean(summary.qrVerified) ||
          Boolean(result.validateOnly) ||
          Boolean(asStarted) ||
          Boolean(result.alreadyCheckedIn));
      setQrVerified(verified);
      setPreview({
        ...summary,
        ...time,
        qrVerified: verified,
        canStartMatch:
          result.canStartMatch ?? summary.canStartMatch ?? (verified && time.canStart),
        lockReason: result.lockReason ?? summary.lockReason,
        lockMessageSo: result.lockMessageSo || summary.lockMessageSo,
        lockMessageEn: result.lockMessageEn || summary.lockMessageEn,
        alreadyCheckedIn: Boolean(result.alreadyCheckedIn),
        forcedOutsideWindow: Boolean(result.forcedOutsideWindow),
        booking: result.booking,
        detailCard: result.detailCard || summary.detailCard,
      });
      setStarted(Boolean(asStarted) || Boolean(result.alreadyCheckedIn));
      if (summary.bookingCode) setCode(summary.bookingCode);
      setNowTick(Date.now());
    },
    [fail]
  );

  const requireStadium = useCallback(() => {
    if (!stadiumId) {
      fail('Dooro garoonka', 'Scan waa inuu noqdaa garoonka booking-ku ku yaallo');
      return false;
    }
    return true;
  }, [fail, stadiumId]);

  const validate = useCallback(
    async (raw) => {
      const parsed = parseGateScanInput(raw);
      if (!parsed) {
        fail('Geli tixraac ama scan QR', 'Code lama helin');
        return;
      }
      if (processing.current) return;
      processing.current = true;
      setBusy(true);
      setPreview(null);
      setJoogtoResult(null);
      setStarted(false);
      setQrVerified(false);

      if (parsed.isJoogto) {
        try {
          const result = await ownerApi.verifyJoogtoCard({
            qrToken: parsed.qrToken,
            cardNumber: parsed.cardNumber,
            pin: parsed.pin,
            stadiumId: stadiumId || undefined,
          });
          setJoogtoResult(result);
          setQrVerified(Boolean(result.valid && result.canPlay));
          if (result.canPlay) {
            Toast.show({
              type: 'success',
              text1: 'Kaarka Waa Ansax! 🟢',
              text2: `${result.membership?.teamName || 'Kooxda'} · ${result.cardStatus === 'grace_period' ? 'Muddo-dhaaf (Grace)' : 'Firfircoon'}`,
            });
          } else {
            Toast.show({
              type: 'error',
              text1: 'Kaarka Waa Xidhan / Dhacay! 🔴',
              text2: result.message || 'Fadlan bixi lacagta bisha si kaarku u shaqeeyo',
            });
          }
        } catch (e) {
          fail('Kaarka Joogto lama helin ama waa been-abuur', e.message);
        } finally {
          setBusy(false);
          processing.current = false;
          cooldownUntil.current = Date.now() + SCAN_COOLDOWN_MS;
        }
        return;
      }

      if (!requireStadium()) {
        setBusy(false);
        processing.current = false;
        return;
      }

      try {
        const result = await ownerApi.checkIn({
          ...parsed,
          stadiumId,
          force: forceDemo,
          validateOnly: true,
        });
        applyResult(result, { asStarted: false, scanned: true });
        const time = pickGateTime(result);
        if (result.alreadyCheckedIn) {
          Toast.show({
            type: 'info',
            text1: 'Hore ayaa loo check-in-gareeyay',
            text2: result.gateSummary?.bookingCode || '',
          });
        } else if (time.timeState === 'too_early') {
          Toast.show({
            type: 'info',
            text1: 'Maaha wakhtigan / maalintaan',
            text2: time.messageSo || LOCK_SO.too_early,
          });
        } else if (time.timeState === 'expired') {
          Toast.show({
            type: 'error',
            text1: 'Your time slot expired',
            text2: time.messageSo || LOCK_SO.expired,
          });
        } else if (time.timeState === 'late') {
          Toast.show({
            type: 'error',
            text1: 'Kooxdu way daahday',
            text2: time.messageSo || time.messageEn,
          });
        } else {
          Toast.show({
            type: 'success',
            text1: 'QR waa sax · wakhtiga waa hadda',
            text2: 'Riix Bilow ciyaarta si aad u bilowdo',
          });
        }
      } catch (e) {
        fail('QR / check-in khalad', e.message);
      } finally {
        setBusy(false);
        processing.current = false;
        cooldownUntil.current = Date.now() + SCAN_COOLDOWN_MS;
      }
    },
    [applyResult, fail, forceDemo, requireStadium, stadiumId]
  );

  const startGame = useCallback(async () => {
    if (!requireStadium()) return;
    if (!qrVerified && !(forceDemo && __DEV__)) {
      Toast.show({
        type: 'error',
        text1: 'QR lama hubin',
        text2: LOCK_SO.not_scanned,
      });
      return;
    }
    const raw = code.trim() || preview?.bookingCode;
    const parsed = parseGateScanInput(raw);
    if (!parsed) {
      fail('Code ma jiro', 'Scan ama geli tixraac');
      return;
    }
    setStarting(true);
    try {
      const result = await ownerApi.checkIn({
        ...parsed,
        stadiumId,
        force: forceDemo,
        validateOnly: false,
      });
      applyResult(result, { asStarted: true, scanned: true });
      if (result.alreadyCheckedIn) {
        Toast.show({
          type: 'info',
          text1: 'Hore ayaa loo check-in-gareeyay',
          text2: result.messageSo || result.gateSummary?.bookingCode || '',
        });
      } else if (result.forcedOutsideWindow) {
        Toast.show({ type: 'info', text1: 'Started (force / demo)' });
      } else {
        Toast.show({ type: 'success', text1: 'Ciyaarta waa bilowday', text2: 'IN_PROGRESS' });
      }
    } catch (e) {
      const details = e.details || e.response?.data?.error?.details || {};
      const msg = details.messageSo || details.lockMessageSo || e.message || '';
      const already =
        details.code === 'ALREADY_EXISTS' ||
        /hore ayaa|already checked|already exists|already processed/i.test(String(msg));
      if (already) {
        Toast.show({
          type: 'info',
          text1: 'Hore ayaa loo check-in-gareeyay',
          text2: msg || '',
        });
        setStarted(true);
        setQrVerified(true);
        return;
      }
      fail('Bilow fashilmay', msg);
    } finally {
      setStarting(false);
    }
  }, [
    applyResult,
    code,
    fail,
    forceDemo,
    preview,
    qrVerified,
    requireStadium,
    stadiumId,
  ]);

  const onBarcode = useCallback(
    ({ data }) => {
      if (!data || busy || processing.current) return;
      if (Date.now() < cooldownUntil.current) return;
      if (data === lastScan.current) return;
      lastScan.current = data;
      validate(data);
    },
    [busy, validate]
  );

  const timeOk =
    preview &&
    (Boolean(preview.canStart) || (forceDemo && __DEV__)) &&
    preview.timeState !== 'expired';

  const canStartGame =
    preview &&
    !started &&
    qrVerified &&
    timeOk &&
    !preview.alreadyCheckedIn;

  const bilowDisabled =
    busy || starting || started || preview?.alreadyCheckedIn || !canStartGame;

  const lockBannerSo = (() => {
    if (started || preview?.alreadyCheckedIn) return null;
    if (!qrVerified) return LOCK_SO.not_scanned;
    if (preview?.lockMessageSo) return preview.lockMessageSo;
    if (timeState === 'too_early') return preview?.messageSo || LOCK_SO.too_early;
    if (timeState === 'expired') return preview?.messageSo || LOCK_SO.expired;
    return null;
  })();

  const reset = () => {
    setPreview(null);
    setJoogtoResult(null);
    setStarted(false);
    setQrVerified(false);
    setCode(route.params?.bookingCode || '');
    lastScan.current = '';
  };

  const handleJoogtoPay = useCallback(
    async (recurringId, amount, currency) => {
      if (!recurringId) return;
      setRenewing(true);
      try {
        const res = await ownerApi.markJoogtoPaid(recurringId, {
          amountPaid: amount,
          currency: currency || 'USD',
          paymentMethod: 'cash',
          notes: 'Albaabka Garoonka (Gate Mobile Renewal)',
        });
        Toast.show({
          type: 'success',
          text1: 'Lacagta bisha waa la xaqiijiyay! 🟢',
          text2: `Kaarka waa la cusboonaysiiyay 1 bil (${res.receipt?.receiptNumber || ''})`,
        });
        if (joogtoResult?.membership?.cardNumber) {
          const reCheck = await ownerApi.verifyJoogtoCard({
            cardNumber: joogtoResult.membership.cardNumber,
            stadiumId,
          });
          setJoogtoResult(reCheck);
          setQrVerified(Boolean(reCheck.valid && reCheck.canPlay));
        }
      } catch (e) {
        Toast.show({
          type: 'error',
          text1: 'Lacag-bixinta waa fashilantay',
          text2: e.message,
        });
      } finally {
        setRenewing(false);
      }
    },
    [joogtoResult, stadiumId]
  );

  return (
    <FadeIn>
      <View style={styles.screen}>
        <Header title="Scan" subtitle="QR / tixraac albaabka" variant="green" />

        <Pressable
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: colors.surface,
            paddingHorizontal: spacing.md,
            paddingVertical: 10,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: colors.border,
          }}
          onPress={() => navigation.navigate('OwnerJoogto')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ backgroundColor: 'rgba(56, 189, 248, 0.15)', padding: 6, borderRadius: radii.full }}>
              <Ionicons name="card" size={16} color="#0284c7" />
            </View>
            <View>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.charcoal }}>
                Maamulka Kaadhadhka Joogtada ah
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                Liiska kooxaha, xaqiijinta lacagta, & VIP Passes
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.stadiumLabel}>Garoonka aad joogto *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
            {stadiums.map((s) => (
              <Chip
                key={String(s._id)}
                label={s.name}
                selected={stadiumId === String(s._id)}
                onPress={() => {
                  setStadiumId(String(s._id));
                  setPreview(null);
                  setQrVerified(false);
                }}
                style={{ marginRight: 8 }}
              />
            ))}
          </ScrollView>
          {!stadiumId ? (
            <Text style={styles.muted}>Dooro garoonka ka hor intaadan scan-garayn.</Text>
          ) : null}

          {!cameraSupported ? (
            <Card style={styles.cameraOff}>
              <Ionicons name="camera-outline" size={28} color={colors.muted} />
              <Text style={styles.muted}>
                Kamarada waxay ku shaqeysaa Android / iOS device — Expo web ma taageero
                camera scan.
              </Text>
            </Card>
          ) : cameraOn && permission?.granted ? (
            <View style={styles.cameraWrap}>
              <CameraView
                style={styles.flex}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={busy || starting ? undefined : onBarcode}
              />
              <View style={styles.scanHint}>
                <Ionicons name="scan-outline" size={18} color={colors.white} />
                <Text style={styles.scanHintText}>Ku toosi QR match pass</Text>
              </View>
              <Pressable
                style={styles.closeCam}
                onPress={() => setCameraOn(false)}
                hitSlop={8}
              >
                <Ionicons name="close" size={22} color={colors.white} />
              </Pressable>
            </View>
          ) : (
            <Card style={styles.cameraOff}>
              <Ionicons name="qr-code-outline" size={32} color={colors.brandGreen} />
              <Text style={styles.muted}>Kamarada waa xiran</Text>
              <Button
                title="Fur kamarada"
                variant="outline"
                style={styles.cameraBtn}
                onPress={async () => {
                  if (!permission?.granted) {
                    const res = await requestPermission();
                    if (!res.granted) {
                      Toast.show({
                        type: 'error',
                        text1: 'Kamarada waa loo baahan yahay',
                      });
                      return;
                    }
                  }
                  setCameraOn(true);
                }}
              />
            </Card>
          )}

          <Text style={styles.label}>Ama geli tixraac gacanta</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="characters"
            autoCorrect={false}
            value={code}
            onChangeText={(t) => {
              setCode(t);
              setQrVerified(false);
              setPreview(null);
            }}
            placeholder="KUL-XXXXXX ama QR JSON"
            placeholderTextColor={colors.muted}
          />

          {__DEV__ ? (
            <Pressable
              style={styles.forceRow}
              onPress={() => setForceDemo((v) => !v)}
            >
              <Ionicons
                name={forceDemo ? 'checkbox' : 'square-outline'}
                size={22}
                color={forceDemo ? colors.brandGreen : colors.muted}
              />
              <Text style={styles.forceText}>
                Check in anyway (dev / window dhaaf)
              </Text>
            </Pressable>
          ) : null}

          {lockBannerSo && !started ? (
            <Card style={styles.lockCard}>
              <Text style={styles.lockText}>{lockBannerSo}</Text>
            </Card>
          ) : null}

          <View style={styles.actions}>
            <Button
              title="Xaqiiji QR"
              variant="outline"
              disabled={busy || starting || !code.trim()}
              loading={busy}
              onPress={() => validate(code.trim())}
              style={styles.actionBtn}
            />
            <Button
              title={
                started || preview?.alreadyCheckedIn
                  ? 'Ciyaarta waa bilowday'
                  : 'Bilow ciyaarta'
              }
              variant="primary"
              disabled={bilowDisabled}
              loading={starting}
              onPress={startGame}
              style={styles.actionBtn}
            />
          </View>

          {preview ? (
            <GateResultCard
              summary={preview}
              timeState={timeState}
              countdownSecs={countdownSecs}
              started={started || preview.alreadyCheckedIn}
              qrVerified={qrVerified}
              colors={colors}
              styles={styles}
              onClear={reset}
            />
          ) : null}

          {joogtoResult ? (
            <JoogtoGateCard
              result={joogtoResult}
              renewing={renewing}
              onPay={handleJoogtoPay}
              onClear={reset}
              colors={colors}
              styles={styles}
            />
          ) : null}
        </ScrollView>
      </View>
    </FadeIn>
  );
}

function GateResultCard({
  summary,
  timeState,
  countdownSecs,
  started,
  qrVerified,
  colors,
  styles,
  onClear,
}) {
  const teamA = summary.teamA;
  const teamB = summary.teamB;
  const payments = summary.payments || [];
  const currency = summary.pricing?.currency || 'USD';
  const isTooEarly = timeState === 'too_early';
  const isExpired = timeState === 'expired';
  const isLate = timeState === 'late';
  const isOk = timeState === 'ok' || (!timeState && !isLate);
  const blockStart = isTooEarly || isExpired;
  const startLabel = formatWhen(summary.startsAt || summary.startTime);
  const card = summary.detailCard;

  let title = 'Match pass sax ah';
  let icon = 'ticket-outline';
  let iconColor = colors.brandGreen;
  if (started) {
    title = 'Albaab OK · Ciyaarta bilowday';
    icon = 'checkmark-circle';
    iconColor = colors.brandGreen;
  } else if (isExpired) {
    title = 'Your time slot expired';
    icon = 'close-circle';
    iconColor = colors.white;
  } else if (isTooEarly) {
    title = 'Wakhtigu weli ma bilaaban';
    icon = 'time-outline';
    iconColor = colors.white;
  } else if (isLate) {
    title = 'Dib u dhac / Late';
    icon = 'warning';
    iconColor = colors.statusCancelled;
  } else if (isOk) {
    title = 'Wakhtiga waa hadda · OK';
    icon = 'checkmark-circle';
    iconColor = colors.brandGreen;
  }

  return (
    <Card
      style={[
        styles.resultCard,
        started
          ? styles.resultOk
          : blockStart
            ? styles.resultBlocked
            : isLate
              ? styles.resultLate
              : isOk
                ? styles.resultOk
                : null,
      ]}
    >
      <View style={styles.resultHead}>
        <Ionicons name={icon} size={26} color={iconColor} />
        <View style={styles.flex}>
          <Text style={[styles.resultTitle, blockStart ? styles.resultTitleOnRed : null]}>
            {title}
          </Text>
          <Text style={[styles.resultCode, blockStart ? styles.resultCodeOnRed : null]}>
            {summary.bookingCode}
          </Text>
        </View>
        <Pressable onPress={onClear} hitSlop={10}>
          <Ionicons
            name="close-circle"
            size={22}
            color={blockStart ? 'rgba(255,255,255,0.85)' : colors.muted}
          />
        </Pressable>
      </View>

      <Row
        label="QR hubin"
        value={qrVerified ? 'Haa · la xaqiijiyay' : 'Maya'}
        styles={styles}
        onRed={blockStart}
      />

      {isTooEarly ? (
        <View style={styles.redBanner}>
          <Text style={styles.redBannerTitle}>Slot is not now — waiting</Text>
          <Text style={styles.redBannerText}>
            Ma bilaabi kartid — maaha wakhtigan
          </Text>
          <Text style={styles.redBannerText}>
            Wakhtigaagu wuxuu bilaabmaa {startLabel}
          </Text>
          <Text style={styles.countdown}>
            {formatCountdown(countdownSecs)}
          </Text>
        </View>
      ) : null}

      {isExpired ? (
        <View style={styles.redBanner}>
          <Text style={styles.redBannerTitle}>Your time slot expired</Text>
          <Text style={styles.redBannerText}>
            Wakhtigagii aad ciyaari lahaydeen wuu dhacay — ma bilaabi kartid.
          </Text>
        </View>
      ) : null}

      {isLate && !started ? (
        <View style={styles.lateBanner}>
          <Text style={styles.lateText}>
            {summary.messageSo ||
              `Kooxdu way daahday ${summary.late?.minutesLate ?? '—'} daqiiqo (grace ${
                summary.late?.graceMinutes ?? 15
              } min). API wali wuu oggol yahay ilaa waqtiga dhamaadka.`}
          </Text>
        </View>
      ) : null}

      {summary.coveredFullMatch ? (
        <View style={styles.notePill}>
          <Ionicons name="information-circle" size={16} color={colors.statusInfo} />
          <Text style={styles.noteText}>
            Team A ayaa lacagta oo dhan bixiyay (full match)
          </Text>
        </View>
      ) : null}

      <Row
        label="Garoon"
        value={summary.stadiumName || '—'}
        styles={styles}
        onRed={blockStart}
      />
      <Row
        label="Field"
        value={summary.fieldName || '—'}
        styles={styles}
        onRed={blockStart}
      />
      <Row
        label="Waqtiga"
        value={formatSlotRange(summary.startTime, summary.endTime)}
        styles={styles}
        onRed={blockStart}
      />
      <Row
        label="Status"
        value={summary.status || '—'}
        styles={styles}
        onRed={blockStart}
      />

      <Text style={[styles.sectionLabel, blockStart ? styles.sectionLabelOnRed : null]}>
        Captain / lacag
      </Text>
      <Row
        label="Captain"
        value={card?.captainName || teamA?.captainName || '—'}
        styles={styles}
        onRed={blockStart}
      />
      <Row
        label="Telefoon"
        value={card?.captainPhone || teamA?.captainPhone || '—'}
        styles={styles}
        onRed={blockStart}
      />
      {card?.paymentMethodLabel || card?.paymentMethod ? (
        <Row
          label="Nooca lacagta"
          value={card.paymentMethodLabel || card.paymentMethod}
          styles={styles}
          onRed={blockStart}
        />
      ) : null}
      {card?.carrier?.label ? (
        <Row
          label="Carrier"
          value={card.carrier.label}
          styles={styles}
          onRed={blockStart}
        />
      ) : null}
      {teamB ? (
        <Row
          label="Team B"
          value={
            [teamB.teamName, teamB.captainName, teamB.captainPhone]
              .filter(Boolean)
              .join(' · ') || '—'
          }
          styles={styles}
          onRed={blockStart}
        />
      ) : (
        <Row label="Team B" value="Lama casuumin" styles={styles} onRed={blockStart} />
      )}

      <Text style={[styles.sectionLabel, blockStart ? styles.sectionLabelOnRed : null]}>
        Lacagta
      </Text>
      <Row
        label="Total"
        value={formatMoney(summary.pricing?.totalPrice, currency)}
        styles={styles}
        onRed={blockStart}
      />
      {payments.length === 0 ? (
        <Row label="Payments" value="Ma jiro diiwaan" styles={styles} onRed={blockStart} />
      ) : (
        payments.map((p, i) => (
          <View key={`${p.tixraac || i}-${p.side}`} style={styles.payBlock}>
            <Row
              label={p.coverFullMatch ? 'Full match' : p.side === 'teamB' ? 'Team B' : 'Team A'}
              value={`${formatMoney(p.amount, currency)}${
                p.paymentMethodLabel || p.operator
                  ? ` · ${p.paymentMethodLabel || p.operator}`
                  : ''
              }`}
              styles={styles}
              onRed={blockStart}
            />
            <Row
              label="Payer phone"
              value={p.payerPhone || '—'}
              styles={styles}
              onRed={blockStart}
            />
            <Row
              label="Taariikh"
              value={formatWhen(p.paidAt)}
              styles={styles}
              onRed={blockStart}
            />
            <Row
              label="Tixraac"
              value={p.tixraac || '—'}
              styles={styles}
              onRed={blockStart}
            />
          </View>
        ))
      )}
    </Card>
  );
}

function Row({ label, value, styles, onRed }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, onRed ? styles.rowLabelOnRed : null]}>{label}</Text>
      <Text style={[styles.rowValue, onRed ? styles.rowValueOnRed : null]}>{value}</Text>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.md, paddingBottom: 40 },
    stadiumLabel: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: '700',
      marginBottom: 6,
    },
    flex: { flex: 1 },
    cameraWrap: {
      height: 260,
      borderRadius: radii.card,
      overflow: 'hidden',
      marginBottom: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: '#000',
    },
    scanHint: {
      position: 'absolute',
      bottom: 12,
      left: 12,
      right: 12,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: radii.md,
    },
    scanHintText: { color: colors.white, ...typography.caption, fontWeight: '600' },
    closeCam: {
      position: 'absolute',
      top: 10,
      right: 10,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 20,
      padding: 6,
    },
    cameraOff: { alignItems: 'center', paddingVertical: 28, gap: 8 },
    muted: {
      color: colors.muted,
      textAlign: 'center',
      marginBottom: 8,
      ...typography.caption,
    },
    cameraBtn: { paddingHorizontal: 20, minWidth: 160 },
    label: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radii.md,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.charcoal,
      marginBottom: 10,
    },
    forceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 12,
    },
    forceText: { ...typography.caption, color: colors.muted, flex: 1 },
    lockCard: {
      marginBottom: 12,
      borderColor: colors.statusCancelled || '#F59E0B',
      backgroundColor: colors.statusCancelledBg || '#FFFBEB',
    },
    lockText: {
      ...typography.caption,
      color: colors.statusCancelled || '#B45309',
      fontWeight: '700',
    },
    actions: { gap: 10, marginBottom: 16 },
    actionBtn: { width: '100%' },
    resultCard: { marginTop: 4 },
    resultOk: {
      borderColor: colors.statusConfirmed,
      backgroundColor: colors.statusConfirmedBg,
    },
    resultLate: {
      borderColor: colors.statusCancelled,
      backgroundColor: colors.statusCancelledBg,
    },
    resultBlocked: {
      borderColor: colors.statusCancelled,
      backgroundColor: colors.statusCancelled,
    },
    resultHead: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 10,
    },
    resultTitle: {
      ...typography.h4,
      color: colors.charcoal,
    },
    resultTitleOnRed: { color: colors.white },
    resultCode: {
      ...typography.caption,
      color: colors.muted,
      fontWeight: '700',
      letterSpacing: 0.4,
    },
    resultCodeOnRed: { color: 'rgba(255,255,255,0.85)' },
    redBanner: {
      backgroundColor: 'rgba(0,0,0,0.18)',
      borderRadius: radii.sm,
      padding: 12,
      marginBottom: 12,
    },
    redBannerTitle: {
      ...typography.h4,
      color: colors.white,
      marginBottom: 4,
    },
    redBannerText: {
      ...typography.caption,
      color: colors.white,
      fontWeight: '600',
      marginBottom: 2,
    },
    countdown: {
      marginTop: 10,
      fontSize: 28,
      fontWeight: '700',
      color: colors.white,
      letterSpacing: 1,
      fontVariant: ['tabular-nums'],
    },
    lateBanner: {
      backgroundColor: colors.statusCancelledBg,
      borderRadius: radii.sm,
      padding: 10,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.statusCancelled,
    },
    lateText: {
      ...typography.caption,
      color: colors.statusCancelled,
      fontWeight: '600',
    },
    notePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 10,
    },
    noteText: { ...typography.caption, color: colors.statusInfo, flex: 1 },
    sectionLabel: {
      ...typography.overline,
      color: colors.muted,
      marginTop: 12,
      marginBottom: 6,
    },
    sectionLabelOnRed: { color: 'rgba(255,255,255,0.75)' },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 4,
    },
    rowLabel: { ...typography.caption, color: colors.muted, flexShrink: 0 },
    rowLabelOnRed: { color: 'rgba(255,255,255,0.75)' },
    rowValue: {
      ...typography.caption,
      color: colors.charcoal,
      fontWeight: '600',
      flex: 1,
      textAlign: 'right',
    },
    rowValueOnRed: { color: colors.white },
    payBlock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 6,
      marginTop: 6,
    },
  });
}

function JoogtoGateCard({ result, renewing, onPay, onClear, colors, styles }) {
  const m = result.membership || {};
  const isOk = result.valid && result.canPlay;
  const isGrace = result.cardStatus === 'grace_period';
  const isExpired = !result.canPlay || result.cardStatus === 'expired' || result.cardStatus === 'blocked';

  const badgeBg = isOk && !isGrace ? '#059669' : isGrace ? '#d97706' : '#dc2626';
  const badgeTitle = isOk && !isGrace ? 'FIRFIRCOON (ANSAX)' : isGrace ? 'MUDDO-DHAAF (GRACE PERIOD)' : 'XIDHAN / DHACAY';

  const validUntilStr = m.billingCycle?.endDate ? new Date(m.billingCycle.endDate).toLocaleDateString() : '—';

  return (
    <Card style={{ marginTop: spacing.md, padding: spacing.md, borderWidth: 2, borderColor: badgeBg, borderRadius: radii.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ backgroundColor: badgeBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.full }}>
          <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>{badgeTitle}</Text>
        </View>
        <Pressable onPress={onClear} hitSlop={8}>
          <Ionicons name="close-circle" size={24} color={colors.muted} />
        </Pressable>
      </View>

      <Text style={{ fontSize: 18, fontWeight: '800', color: colors.charcoal, marginBottom: 2 }}>{m.teamName || 'Kooxda Joogtada ah'}</Text>
      <Text style={{ fontSize: 12, color: colors.brandGreen, fontWeight: '700', marginBottom: 10 }}>Kaarka: {m.cardNumber || '—'} · PIN: {m.securityPin || '****'}</Text>

      <View style={{ backgroundColor: isExpired ? '#fef2f2' : isGrace ? '#fffbeb' : '#f0fdf4', padding: 12, borderRadius: radii.sm, marginBottom: 12 }}>
        <Text style={{ fontSize: 13, fontWeight: '600', color: isExpired ? '#991b1b' : isGrace ? '#92400e' : '#166534', lineHeight: 18 }}>
          {result.message}
        </Text>
      </View>

      <View style={{ gap: 6, marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Kabtanka:</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.charcoal }}>{m.captainName || '—'} ({m.captainPhone || '—'})</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Waqtiga Ciyaarta:</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.charcoal }}>{m.startTimeLocal || m.startTime || '—'} – {m.endTimeLocal || m.endTime || '—'}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Ansax ilaa:</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: colors.charcoal }}>{validUntilStr}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: colors.muted }}>Lacagta Bisha:</Text>
          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.brandGreen }}>${m.monthlyFee || 0} USD</Text>
        </View>
      </View>

      {isExpired || isGrace ? (
        <Button
          title={renewing ? 'Waa la diiwaangelinayaa...' : `Xaqiiji Lacagta ($${m.monthlyFee || 0})`}
          variant="primary"
          loading={renewing}
          onPress={() => onPay(m._id, m.monthlyFee, m.currency)}
          style={{ marginTop: 6 }}
        />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 6 }}>
          <Ionicons name="checkmark-circle" size={18} color="#059669" />
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#059669' }}>Xaqiijinta albaabka waa guul · Ciyaartu way bilaaban kartaa</Text>
        </View>
      )}
    </Card>
  );
}
