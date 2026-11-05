import { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Switch,
  Linking,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import TextField from './TextField';
import Button from './Button';
import Chip from './Chip';
import { paymentsApi } from '../api/payments';
import { bookingsApi } from '../api/bookings';
import { useAuthFeatures } from '../hooks/useAuthFeatures';
import { formatMoney } from '../lib/dateUtils';
import {
  SO_CARRIERS,
  composedPhone,
  digitsOnly,
  phoneMatchesOperator,
  splitSomaliPhone,
  detectCarrierFromInput,
  extractSubscriberBody,
  formatPhoneDisplay,
} from '../lib/somaliPhone';
import {
  buildMatchSharePackage,
  resolveTeamAShareName,
  whatsAppShareUrl,
} from '../lib/matchShare';
import { matchPaymentProgress } from '../lib/matchJoinErrors';
import { useTheme } from '../context/ThemeContext';
import { spacing, typography, radii, shadows } from '../theme';

const OPERATORS = [
  {
    id: 'telesom',
    label: 'Telesom',
    sub: 'Zaad · 063',
    prefix: '063',
    color: '#00843D',
    bgColor: 'rgba(0, 132, 61, 0.08)',
    accent: '#FDB913',
    badge: 'T',
  },
  {
    id: 'somtel',
    label: 'Somtel',
    sub: 'eDahab · 065',
    prefix: '065',
    color: '#0A66C2',
    bgColor: 'rgba(10, 102, 194, 0.08)',
    accent: '#FFB800',
    badge: 'S',
  },
  {
    id: 'hormuud',
    label: 'Hormuud',
    sub: 'Waafi · 061',
    prefix: '061',
    color: '#059669',
    bgColor: 'rgba(5, 150, 105, 0.08)',
    accent: '#DC2626',
    badge: 'H',
  },
  {
    id: 'golis',
    label: 'Golis',
    sub: 'Sahal · 090',
    prefix: '090',
    color: '#0D9488',
    bgColor: 'rgba(13, 148, 136, 0.08)',
    accent: '#EA580C',
    badge: 'G',
  },
];

const NAME_RE = /^[\p{L}\p{N}\p{M}\s'.-]{2,80}$/u;

function sanitizeName(raw) {
  return String(raw || '')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

/**
 * Confirmation popup before mobile-money pay — prevents accidental Bixi.
 * Prices shown from booking (server SoT); never sent back as amount.
 */
export default function PaymentConfirmModal({
  visible,
  onClose,
  booking,
  side = 'teamA',
  coverFullMatch: coverParam = false,
  defaultPhone,
  defaultName,
  onPaid,
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = makeStyles(colors);
  const { sllPerUsd: featureRate } = useAuthFeatures();

  const [currencyChoice, setCurrencyChoice] = useState('USD');
  const [payerName, setPayerName] = useState('');
  const [coverFullMatch, setCoverFullMatch] = useState(Boolean(coverParam));
  const [operator, setOperator] = useState('hormuud');
  const [payerLocal, setPayerLocal] = useState('');
  const [inviteCarrier, setInviteCarrier] = useState('telesom');
  const [inviteLocal, setInviteLocal] = useState('');
  const [teamBName, setTeamBName] = useState('');
  const [teamBCarrier, setTeamBCarrier] = useState('telesom');
  const [teamBLocal, setTeamBLocal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const [isMock, setIsMock] = useState(false);
  const [warning, setWarning] = useState(null);
  const [sharePkg, setSharePkg] = useState(null);

  useEffect(() => {
    if (!visible) return;
    setCurrencyChoice('USD');
    setPayerName(sanitizeName(defaultName || ''));
    setCoverFullMatch(Boolean(coverParam));
    setInviteLocal('');
    setTeamBLocal('');
    setTeamBName('');
    setPaymentId(null);
    setIsMock(false);
    setWarning(null);
    setSharePkg(null);
    const split = splitSomaliPhone(defaultPhone || '');
    setOperator(split.carrierId || 'hormuud');
    setPayerLocal(split.localNumber || '');
  }, [visible, defaultPhone, defaultName, coverParam]);

  if (!booking) return null;

  const pricing = booking.pricing || {};
  const base = Number(pricing.baseTotalPrice ?? pricing.totalPrice ?? 0);
  const discount = Number(pricing.discountAmount || 0);
  const rentTotal = Number(pricing.stadiumRentTotal ?? pricing.totalPrice ?? base);
  const rentShare = Number(pricing.teamShare ?? rentTotal / 2);

  const derivedFeePerTeam =
    pricing.payableTeamShare != null && pricing.teamShare != null
      ? Math.max(0, Math.round((Number(pricing.payableTeamShare) - Number(pricing.teamShare)) * 100) / 100)
      : Number(booking?.financialSnapshot?.bookingFeeUsd || 0);
  const platformFee = Number(pricing.platformFee ?? derivedFeePerTeam ?? 0);
  const platformFeeFull = Number(
    pricing.platformFeeFullMatch ??
      (pricing.payableFullMatch != null && pricing.totalPrice != null
        ? Math.max(0, Math.round((Number(pricing.payableFullMatch) - Number(pricing.totalPrice)) * 100) / 100)
        : platformFee * 2)
  );

  const fullPayable = Number(pricing.payableFullMatch ?? (rentTotal + platformFeeFull));
  const teamShare = Number(
    pricing.payableTeamShare ??
      (booking?.[side]?.amountDue && Number(booking[side].amountDue) > rentShare
        ? Number(booking[side].amountDue)
        : rentShare + platformFee)
  );
  const activeFee = coverFullMatch ? platformFeeFull : platformFee;
  const activeRent = coverFullMatch ? rentTotal : rentShare;
  const party = booking?.[side];
  const amount = coverFullMatch ? fullPayable : teamShare;
  const rate = Number(
    booking?.financialSnapshot?.sllPerUsd ||
      booking?.pricing?.sllPerUsd ||
      featureRate ||
      8500
  );
  const amountSll = Math.round(amount * rate);
  const formatSll = (val) => `${Number(val || 0).toLocaleString()} SlSh`;
  const carrier = SO_CARRIERS.find((c) => c.id === operator) || SO_CARRIERS[0];
  const progress = matchPaymentProgress(booking);
  const canCoverFull =
    side === 'teamA' &&
    !['SUCCESS', 'HELD', 'SETTLED'].includes(booking?.teamA?.paymentStatus) &&
    !booking?.coveredFullMatch &&
    ['HELD', 'PAYMENT_PENDING'].includes(booking?.status);

  const finishAfterPay = async (payment) => {
    onPaid?.(payment);
    if (side === 'teamA' && !coverFullMatch) {
      try {
        const data = await bookingsApi.get(booking._id);
        const b = data.booking || data;
        if (b?.matchCode) {
          const pkg = buildMatchSharePackage({
            code: b.matchCode,
            teamAPhone: b.teamAPayerPhone || payment?.payerPhone || defaultPhone,
            teamAName: resolveTeamAShareName(b) || sanitizeName(payerName),
          });
          setSharePkg(pkg);
          return;
        }
      } catch {
        /* fall through */
      }
    }
    onClose?.();
  };

  const handlePayerPhoneChange = (raw) => {
    const detected = detectCarrierFromInput(raw);
    if (detected && detected.id !== operator) {
      setOperator(detected.id);
    }
    const clean = extractSubscriberBody(raw, detected?.id || operator);
    setPayerLocal(clean);
  };

  const handleSelectOperator = (opId) => {
    setOperator(opId);
    if (payerLocal) {
      const clean = extractSubscriberBody(payerLocal, opId);
      setPayerLocal(clean);
    }
  };

  const initiate = async () => {
    const name = sanitizeName(payerName);
    if (!name || !NAME_RE.test(name)) {
      Toast.show({ type: 'error', text1: 'Magaca ma saxna', text2: '2–80 xaraf / boos' });
      return;
    }
    const cleanBody = extractSubscriberBody(payerLocal, operator);
    if (!cleanBody || cleanBody.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Lambarka ma dhameystirna',
        text2: 'Fadlan geli 7-da lambar ee dambe (tusaale: 7856383)',
      });
      return;
    }
    const payerPhone = composedPhone(operator, cleanBody);
    if (!payerPhone || !phoneMatchesOperator(payerPhone, operator)) {
      Toast.show({
        type: 'error',
        text1: 'Lambarka ma saxna',
        text2: `Waa inuu noqdaa ${carrier.prefix}… ama dooro shirkadda saxda ah`,
      });
      return;
    }

    let teamBContactPhone;
    let invitePhoneTeamB;
    if (side === 'teamB') {
      const cleanB = extractSubscriberBody(teamBLocal, teamBCarrier);
      teamBContactPhone = cleanB ? composedPhone(teamBCarrier, cleanB) : payerPhone;
    } else if (side === 'teamA' && !coverFullMatch && inviteLocal) {
      const cleanInvite = extractSubscriberBody(inviteLocal, inviteCarrier);
      invitePhoneTeamB = cleanInvite ? composedPhone(inviteCarrier, cleanInvite) : null;
      if (!invitePhoneTeamB) {
        Toast.show({ type: 'error', text1: 'Lambarka Team B ma saxna' });
        return;
      }
    }

    setSubmitting(true);
    setWarning(null);
    try {
      const teamId = party?.team?._id || party?.team;
      const data = await paymentsApi.initiate({
        bookingId: booking._id,
        teamId,
        side,
        coverFullMatch: Boolean(coverFullMatch),
        carrierId: operator,
        operator,
        currency: currencyChoice,
        payCurrency: currencyChoice,
        amount: currencyChoice === 'SLL' ? amountSll : amount,
        amountUsd: amount,
        amountSll,
        exchangeRate: rate,
        phone: payerPhone,
        payerPhone,
        payerName: name,
        invitePhoneTeamB: invitePhoneTeamB || undefined,
        teamBContactPhone,
        teamBContactName:
          side === 'teamB' ? sanitizeName(teamBName) || undefined : undefined,
        idempotencyKey: `${booking._id}-${side}-${coverFullMatch ? 'full' : 'share'}-${currencyChoice}-${Date.now()}`,
      });
      const payment = data.payment;
      setPaymentId(payment._id);
      const isDemoOrMock =
        data.checkout?.mode === 'mock' ||
        data.checkout?.mode === 'demo' ||
        data.checkout?.provider === 'mock' ||
        data.checkout?.status === 'pending_ussd_push' ||
        payment.provider === 'mock' ||
        payment.provider === 'waafipay' ||
        payment.provider === 'dahabpay';
      setIsMock(Boolean(isDemoOrMock));
      if (data.warning) setWarning(data.warning);

      if (isDemoOrMock) {
        Toast.show({
          type: 'info',
          text1: '📱 Fariin USSD Push ayaa loo diray',
          text2: `Geli PIN-kaaga si aad u xaqiijiso lacagta`,
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Codsiga lacagta waa la diray',
        });
        await finishAfterPay(payment);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Lacag-bixinta way fashilantay',
        text2: err?.response?.data?.message || err?.message || 'Isku day mar kale',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const mockOk = async () => {
    if (!paymentId) return;
    setSubmitting(true);
    try {
      const data = await paymentsApi.mockConfirm(paymentId);
      Toast.show({ type: 'success', text1: 'Lacagta waa la helay' });
      await finishAfterPay(data.payment);
    } catch {
      Toast.show({ type: 'error', text1: 'Mock confirm wuu fashilmay' });
    } finally {
      setSubmitting(false);
    }
  };

  const mockFail = async () => {
    if (!paymentId) return;
    setSubmitting(true);
    try {
      await paymentsApi.mockFail(paymentId, 'Insufficient balance');
      Toast.show({ type: 'error', text1: 'Lacagta way fashilantay' });
      setPaymentId(null);
      setIsMock(false);
    } catch {
      Toast.show({ type: 'error', text1: 'Hawsha way fashilantay' });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCode = async () => {
    if (!sharePkg?.code) return;
    try {
      await Share.share({ message: sharePkg.code });
    } catch {
      Toast.show({ type: 'info', text1: sharePkg.code });
    }
  };

  const copyShare = async () => {
    if (!sharePkg?.text) return;
    try {
      await Share.share({ message: sharePkg.text });
    } catch {
      Toast.show({ type: 'info', text1: sharePkg.code });
    }
  };

  const shareWhatsApp = async () => {
    if (!sharePkg?.text) return;
    try {
      await Linking.openURL(whatsAppShareUrl(sharePkg.text));
    } catch {
      await copyShare();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={styles.brandHeader}>
            <View style={styles.handle} />
            <View style={styles.headerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.brandEyebrow}>E-Garoon</Text>
                <Text style={styles.title}>
                  {sharePkg ? 'Match Code diyaar' : 'Xaqiiji lacag-bixinta'}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <Text style={styles.close}>Xir</Text>
              </Pressable>
            </View>
          </View>

          {sharePkg ? (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.successTitle}>Lacagta waa la xaqiijiyay</Text>
              <Text style={styles.muted}>U dir Team B — code + telefoonkaaga kaliya</Text>

              {sharePkg.teamAName ? (
                <Text style={styles.metaLine}>
                  Kooxda: <Text style={styles.metaStrong}>{sharePkg.teamAName}</Text>
                </Text>
              ) : null}

              <Pressable onPress={copyCode} style={styles.codeChip}>
                <Text style={styles.codeLabel}>Match Code · riix copy</Text>
                <Text style={styles.code}>{sharePkg.code}</Text>
              </Pressable>

              {(sharePkg.teamAPhoneDisplay || sharePkg.teamAPhoneE164) && (
                <Text style={styles.metaLine}>
                  Telefoonka lacag-bixiyaha:{' '}
                  <Text style={styles.metaStrong}>
                    {sharePkg.teamAPhoneE164 || sharePkg.teamAPhoneDisplay}
                    {sharePkg.teamAPhoneLocal ? ` · ${sharePkg.teamAPhoneLocal}` : ''}
                  </Text>
                </Text>
              )}

              <View style={styles.stepsBox}>
                <Text style={styles.stepsTitle}>Tallaabooyinka Team B</Text>
                {(sharePkg.steps || []).map((step, i) => (
                  <View key={step} style={styles.stepRow}>
                    <View style={styles.stepNum}>
                      <Text style={styles.stepNumText}>{i + 1}</Text>
                    </View>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>

              <Button title="Copy / Share code" onPress={copyCode} style={{ marginTop: 4 }} />
              <Button
                title="Copy tilmaamaha"
                variant="outline"
                onPress={copyShare}
                style={{ marginTop: 8 }}
              />
              <Button
                title="WhatsApp"
                variant="navy"
                onPress={shareWhatsApp}
                style={{ marginTop: 8 }}
              />
              <Button title="Dhamee" variant="outline" onPress={onClose} style={{ marginTop: 8 }} />
            </ScrollView>
          ) : (
            <>
              <ScrollView
                contentContainerStyle={styles.body}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {progress ? (
                  <Text style={styles.progressHint}>
                    {progress.percent}% · ${Number(progress.paidAmount || 0).toFixed(2)} / $
                    {Number(progress.totalPrice || 0).toFixed(2)}
                  </Text>
                ) : null}

                {/* Currency choice (USD vs Somaliland Shilling) */}
                <Text style={styles.fieldLabel}>Dooro lacagta aad ku bixinayso (Payment Currency)</Text>
                <View style={styles.currencyRow}>
                  <Pressable
                    onPress={() => setCurrencyChoice('USD')}
                    style={[
                      styles.currencyBtn,
                      currencyChoice === 'USD' && styles.currencyBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyBtnTitle,
                        currencyChoice === 'USD' && styles.currencyBtnTitleActive,
                      ]}
                    >
                      {currencyChoice === 'USD' ? '● ' : '○ '}💵 USD ($)
                    </Text>
                    <Text
                      style={[
                        styles.currencyBtnSub,
                        currencyChoice === 'USD' && styles.currencyBtnSubActive,
                      ]}
                    >
                      {formatMoney(amount)}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setCurrencyChoice('SLL')}
                    style={[
                      styles.currencyBtn,
                      currencyChoice === 'SLL' && styles.currencyBtnActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyBtnTitle,
                        currencyChoice === 'SLL' && styles.currencyBtnTitleActive,
                      ]}
                    >
                      {currencyChoice === 'SLL' ? '● ' : '○ '}SlSh (Somaliland Shilling)
                    </Text>
                    <Text
                      style={[
                        styles.currencyBtnSub,
                        currencyChoice === 'SLL' && styles.currencyBtnSubActive,
                      ]}
                    >
                      {formatSll(amountSll)}
                    </Text>
                  </Pressable>
                </View>

                {currencyChoice === 'SLL' && (
                  <View style={styles.exchangeRateBox}>
                    <Text style={styles.exchangeRateText}>
                      Sarifka maanta: $1 = {rate.toLocaleString()} SlSh · Waxaa maamula Super Admin
                    </Text>
                  </View>
                )}

                <View style={styles.priceCard}>
                  {discount > 0 ? (
                    <>
                      <Row label="Qiimaha caadiga" value={formatMoney(base)} styles={styles} />
                      <Row
                        label="Dhimis"
                        value={`−${formatMoney(discount)}`}
                        styles={styles}
                      />
                    </>
                  ) : null}
                  <Row
                    label="Kirada garoonka"
                    value={formatMoney(activeRent)}
                    styles={styles}
                  />
                  {activeFee > 0 ? (
                    <Row
                      label={`Kharashka E-Garoon (${coverFullMatch ? 'Labada koox' : 'Kooxdaada'})`}
                      value={`+${formatMoney(activeFee)}`}
                      styles={styles}
                    />
                  ) : null}
                  <Row
                    label={coverFullMatch ? 'Wadarta (labada koox)' : 'Wadarta (qaybtaada)'}
                    value={
                      currencyChoice === 'SLL'
                        ? `${formatSll(amountSll)} (${formatMoney(amount)})`
                        : formatMoney(amount)
                    }
                    bold
                    green
                    styles={styles}
                    colors={colors}
                  />
                </View>

                {canCoverFull ? (
                  <View style={styles.switchRow}>
                    <Text style={styles.fieldLabel}>Bixi dhammaan ciyaarta</Text>
                    <Switch
                      value={coverFullMatch}
                      onValueChange={setCoverFullMatch}
                      trackColor={{ false: colors.border, true: colors.brandGreen }}
                      thumbColor={colors.white}
                    />
                  </View>
                ) : null}

                <TextField
                  label="Magaca kabtanka"
                  value={payerName}
                  onChangeText={setPayerName}
                  placeholder="Magacaaga"
                  autoCapitalize="words"
                  maxLength={80}
                />

                <Text style={styles.fieldLabel}>Shirkadda Mobile Money (Dooro Shirkaddaada)</Text>
                <View style={styles.companyGrid}>
                  {OPERATORS.map((op) => {
                    const isSelected = operator === op.id;
                    return (
                      <Pressable
                        key={op.id}
                        onPress={() => handleSelectOperator(op.id)}
                        style={[
                          styles.companyCard,
                          isSelected && {
                            borderColor: op.color,
                            backgroundColor: op.bgColor,
                            borderWidth: 2,
                          },
                        ]}
                      >
                        <View style={styles.companyHeader}>
                          <View style={[styles.companyBadge, { backgroundColor: op.color }]}>
                            <Text style={styles.companyBadgeText}>{op.badge}</Text>
                          </View>
                          <View style={styles.companyInfo}>
                            <Text style={[styles.companyName, isSelected && { color: op.color }]}>
                              {op.label}
                            </Text>
                            <Text style={styles.companySub}>{op.sub}</Text>
                          </View>
                        </View>
                        {isSelected && (
                          <View style={[styles.activeDot, { backgroundColor: op.color }]} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Lambarka lacag bixinta</Text>
                <View style={styles.phoneInputContainer}>
                  <View style={[styles.prefixBadge, { backgroundColor: carrier.color || colors.brandGreen }]}>
                    <Text style={styles.prefixBadgeText}>+252 · {carrier.prefix}</Text>
                  </View>
                  <TextField
                    style={styles.localField}
                    value={payerLocal}
                    onChangeText={handlePayerPhoneChange}
                    placeholder="7856383"
                    keyboardType="phone-pad"
                    maxLength={12}
                  />
                </View>

                {/* Live Confirmation Preview */}
                <View style={styles.phonePreviewBox}>
                  {payerLocal.length >= 6 ? (
                    <Text style={styles.phonePreviewValid}>
                      ✓ La xaqiijinayaa: +252 {carrier.prefix.slice(1)} {extractSubscriberBody(payerLocal, operator)} ({carrier.label} {carrier.service})
                    </Text>
                  ) : (
                    <Text style={styles.phonePreviewHint}>
                      Geli 7-da lambar ee dambe ee akoonkaaga ({payerLocal.length}/7)
                    </Text>
                  )}
                </View>

                {/* USSD Prompt Card when Payment Initiated in Demo/USSD mode */}
                {paymentId && isMock && (
                  <View style={styles.ussdCard}>
                    <View style={styles.ussdHeader}>
                      <Text style={styles.ussdBadge}>📱 FARIIN USSD PUSH</Text>
                      <Text style={styles.ussdSub}>
                        Fariin USSD ayaa loo diray lambarkaaga:
                      </Text>
                      <Text style={styles.ussdPhone}>
                        {composedPhone(operator, payerLocal) ? formatPhoneDisplay(composedPhone(operator, payerLocal)) : `+252 ${carrier.prefix.slice(1)} ${payerLocal}`}
                      </Text>
                      <Text style={styles.ussdOperator}>
                        {carrier.label} ({carrier.service}) · {currencyChoice === 'SLL' ? formatSll(amountSll) : formatMoney(amount)}
                      </Text>
                    </View>
                    <Text style={styles.ussdInstructions}>
                      Taleefankaaga fiiri oo geli PIN-kaaga sirta ah si aad u oggolaato lacagta.
                    </Text>
                  </View>
                )}

                {side === 'teamA' && !coverFullMatch ? (
                  <View style={styles.inviteBlock}>
                    <Text style={styles.fieldLabel}>
                      Telefoonka Team B (ikhtiyaari — xidhida invite)
                    </Text>
                    <View style={styles.ops}>
                      {SO_CARRIERS.map((c) => (
                        <Chip
                          key={c.id}
                          label={`${c.label} (${c.prefix})`}
                          selected={inviteCarrier === c.id}
                          onPress={() => setInviteCarrier(c.id)}
                          style={styles.opChip}
                        />
                      ))}
                    </View>
                    <TextField
                      value={inviteLocal}
                      onChangeText={(t) => {
                        const detected = detectCarrierFromInput(t);
                        if (detected && detected.id !== inviteCarrier) {
                          setInviteCarrier(detected.id);
                        }
                        setInviteLocal(extractSubscriberBody(t, detected?.id || inviteCarrier));
                      }}
                      placeholder="7856383"
                      keyboardType="phone-pad"
                    />
                  </View>
                ) : null}

                {side === 'teamB' ? (
                  <View style={styles.inviteBlock}>
                    <TextField
                      label="Magaca kabtanka B"
                      value={teamBName}
                      onChangeText={setTeamBName}
                      autoCapitalize="words"
                    />
                    <Text style={styles.fieldLabel}>Telefoonka kabtanka B</Text>
                    <View style={styles.ops}>
                      {SO_CARRIERS.map((c) => (
                        <Chip
                          key={c.id}
                          label={`${c.label} (${c.prefix})`}
                          selected={teamBCarrier === c.id}
                          onPress={() => setTeamBCarrier(c.id)}
                          style={styles.opChip}
                        />
                      ))}
                    </View>
                    <TextField
                      value={teamBLocal}
                      onChangeText={(t) => {
                        const detected = detectCarrierFromInput(t);
                        if (detected && detected.id !== teamBCarrier) {
                          setTeamBCarrier(detected.id);
                        }
                        setTeamBLocal(extractSubscriberBody(t, detected?.id || teamBCarrier));
                      }}
                      placeholder="7856383"
                      keyboardType="phone-pad"
                    />
                  </View>
                ) : null}

                {warning ? <Text style={styles.warn}>{warning}</Text> : null}
              </ScrollView>

              <View style={styles.footer}>
                {!paymentId ? (
                  <Button
                    title={
                      currencyChoice === 'SLL'
                        ? `Xaqiiji oo bixi ${formatSll(amountSll)}`
                        : `Xaqiiji oo bixi ${formatMoney(amount)}`
                    }
                    variant="white"
                    onPress={initiate}
                    loading={submitting}
                  />
                ) : isMock ? (
                  <View style={{ gap: 8 }}>
                    <Button
                      title="✓ Xaqiiji Lacagta (PIN la geliyay / Demo OK)"
                      variant="white"
                      onPress={mockOk}
                      loading={submitting}
                    />
                    <Button
                      title="✕ Jooji ama Fashili (Demo Fail)"
                      variant="danger"
                      onPress={mockFail}
                      loading={submitting}
                    />
                  </View>
                ) : (
                  <Button title="Sug…" variant="white" onPress={() => finishAfterPay()} />
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Row({ label, value, bold, green, styles, colors }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, bold && styles.bold]}>{label}</Text>
      <Text
        style={[
          styles.rowValue,
          bold && styles.bold,
          green && colors && { color: colors.brandGreen },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(30, 36, 51, 0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '92%',
      backgroundColor: colors.bg,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      overflow: 'hidden',
      ...shadows.lifted,
    },
    brandHeader: {
      backgroundColor: colors.brandGreen,
      paddingHorizontal: spacing.md,
      paddingTop: 10,
      paddingBottom: 14,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: 'rgba(255,255,255,0.45)',
      marginBottom: 10,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    brandEyebrow: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.8)',
      marginBottom: 2,
    },
    title: { fontSize: 18, fontWeight: '800', color: colors.white },
    closeBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: radii.sm,
      backgroundColor: 'rgba(255,255,255,0.18)',
    },
    close: { fontWeight: '700', color: colors.white, fontSize: 13 },
    body: { padding: spacing.md, paddingBottom: 28 },
    footer: {
      backgroundColor: colors.brandNavy,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
    },
    priceCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.22)',
      padding: 14,
      marginBottom: 8,
    },
    currencyRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 8,
    },
    currencyBtn: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    currencyBtnActive: {
      borderColor: colors.brandGreen,
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
    },
    currencyBtnTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 2,
    },
    currencyBtnTitleActive: {
      color: colors.brandGreen,
    },
    currencyBtnSub: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.muted,
    },
    currencyBtnSubActive: {
      color: colors.text,
      fontWeight: '700',
    },
    exchangeRateBox: {
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.25)',
      borderRadius: radii.sm,
      paddingVertical: 6,
      paddingHorizontal: 10,
      marginBottom: 10,
    },
    exchangeRateText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.brandGreen,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    rowLabel: { color: colors.muted, fontSize: 14 },
    rowValue: { color: colors.text, fontWeight: '600', fontSize: 14 },
    bold: { fontWeight: '800', color: colors.text, fontSize: 16 },
    fieldLabel: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.muted,
      marginBottom: 6,
      marginTop: 10,
    },
    companyGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    companyCard: {
      width: '48%',
      flexGrow: 1,
      backgroundColor: colors.surface,
      borderRadius: radii.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      padding: 10,
      position: 'relative',
    },
    companyHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    companyBadge: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    companyBadgeText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '800',
    },
    companyInfo: {
      flex: 1,
    },
    companyName: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.text,
    },
    companySub: {
      fontSize: 11,
      color: colors.muted,
      marginTop: 1,
    },
    activeDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 7,
      height: 7,
      borderRadius: 4,
    },
    phoneInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    prefixBadge: {
      height: 48,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prefixBadgeText: {
      color: '#FFFFFF',
      fontWeight: '800',
      fontSize: 13,
    },
    phonePreviewBox: {
      marginTop: 4,
      marginBottom: 8,
    },
    phonePreviewValid: {
      fontSize: 12,
      color: colors.brandGreen,
      fontWeight: '700',
    },
    phonePreviewHint: {
      fontSize: 11,
      color: colors.muted,
    },
    ussdCard: {
      backgroundColor: 'rgba(16, 185, 129, 0.08)',
      borderWidth: 1.5,
      borderColor: colors.brandGreen,
      borderRadius: radii.lg,
      padding: 14,
      marginTop: 10,
      marginBottom: 10,
    },
    ussdHeader: {
      alignItems: 'center',
      marginBottom: 8,
    },
    ussdBadge: {
      fontSize: 11,
      fontWeight: '800',
      color: colors.brandGreen,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    ussdSub: {
      fontSize: 12,
      color: colors.muted,
      textAlign: 'center',
    },
    ussdPhone: {
      fontSize: 18,
      fontWeight: '800',
      color: colors.text,
      marginTop: 2,
    },
    ussdOperator: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.brandGreen,
      marginTop: 2,
    },
    ussdInstructions: {
      fontSize: 12,
      color: colors.text,
      textAlign: 'center',
      lineHeight: 18,
      marginTop: 6,
    },
    ops: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
    opChip: { flexGrow: 0 },
    phoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    prefixBox: {
      height: 48,
      paddingHorizontal: 12,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceInset,
      justifyContent: 'center',
    },
    prefixText: { fontWeight: '700', color: colors.muted, fontSize: 13 },
    localField: { flex: 1, marginBottom: 0 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginVertical: 8,
    },
    inviteBlock: {
      marginTop: 8,
      padding: 12,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.2)',
      backgroundColor: 'rgba(16, 185, 129, 0.05)',
    },
    warn: { marginTop: 10, color: colors.statusPending, fontSize: 13 },
    progressHint: { marginBottom: 10, fontSize: 12, color: colors.muted, fontWeight: '600' },
    successTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 4 },
    muted: { color: colors.muted, marginBottom: 14, fontSize: 14 },
    metaLine: { color: colors.muted, fontSize: 13, marginBottom: 8 },
    metaStrong: { color: colors.text, fontWeight: '700' },
    codeChip: {
      backgroundColor: colors.brandNavy,
      borderRadius: radii.xl,
      borderWidth: 2,
      borderColor: 'rgba(16, 185, 129, 0.45)',
      paddingVertical: 18,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginBottom: 12,
    },
    codeLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      color: colors.brandBlue,
      marginBottom: 6,
    },
    code: {
      fontFamily: 'monospace',
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: 3,
      color: colors.brandGreen,
    },
    stepsBox: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: 'rgba(16, 185, 129, 0.2)',
      backgroundColor: colors.surface,
      padding: 14,
      marginBottom: 12,
    },
    stepsTitle: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.brandGreen,
      marginBottom: 10,
    },
    stepRow: { flexDirection: 'row', gap: 10, marginBottom: 8, alignItems: 'flex-start' },
    stepNum: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(16, 185, 129, 0.15)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepNumText: { fontSize: 12, fontWeight: '800', color: colors.brandGreen },
    stepText: { flex: 1, fontSize: 14, color: colors.text, lineHeight: 20, paddingTop: 2 },
  });
}
