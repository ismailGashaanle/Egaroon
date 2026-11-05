import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiKey, FiPhone, FiArrowRight, FiSearch, FiAlertCircle } from 'react-icons/fi';
import PageTransition from '../components/common/PageTransition';
import PageHeader from '../components/common/PageHeader';
import Card from '../components/common/Card';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import SomaliPhoneInput, { composedPhone } from '../components/common/SomaliPhoneInput';
import {
  JoinMatchSteps,
  MatchPaymentProgress,
} from '../components/booking/MatchPaymentProgress';
import { bookingApi } from '../api/bookingApi';
import { joinMatchErrorMessage, matchPaymentProgress } from '../lib/matchJoinErrors';
import { splitSomaliPhone } from '../lib/somaliPhone';

/**
 * Team B: Match Code + Team A payer phone → preview → join → pay (anti-scam).
 * Prefills from ?code=&teamAPhone= (safe share link — no secrets).
 */
export default function JoinMatchCode() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [code, setCode] = useState('');
  const [carrierId, setCarrierId] = useState('hormuud');
  const [localNumber, setLocalNumber] = useState('');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [shakeKey, setShakeKey] = useState(0);

  useEffect(() => {
    const qCode = String(searchParams.get('code') || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');
    const qPhone = String(searchParams.get('teamAPhone') || '').trim();
    if (qCode) setCode(qCode);
    if (qPhone) {
      const split = splitSomaliPhone(qPhone);
      if (split.carrierId) setCarrierId(split.carrierId);
      if (split.localNumber) setLocalNumber(split.localNumber);
    }
  }, [searchParams]);

  const normalize = (raw) =>
    String(raw || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '');

  const showError = (msg) => {
    setFieldError(msg);
    setShakeKey((k) => k + 1);
    toast.error(msg);
  };

  const lookup = async () => {
    const c = normalize(code);
    const teamAPhone = composedPhone(carrierId, localNumber);
    setFieldError('');
    if (!/^SG-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(c)) {
      showError('Format: SG-XXXX-XXXX');
      return;
    }
    if (!teamAPhone) {
      showError('Geli telefoonka Team A (lacagta lagu bixiyay)');
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const { data } = await bookingApi.lookupMatchCode(c, teamAPhone, carrierId);
      setPreview(data.data);
      setFieldError('');
    } catch (err) {
      showError(joinMatchErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const join = async () => {
    if (!preview?.booking) return;
    const teamAPhone = composedPhone(carrierId, localNumber);
    setJoining(true);
    try {
      const { data } = await bookingApi.joinByCode({
        matchCode: preview.booking.matchCode,
        teamAPhone,
        carrierId,
        teamACarrier: carrierId,
      });
      toast.success('Waad ku biirtay — bixi qaybtaada');
      const id = data.data.booking?._id || preview.booking.id;
      navigate(`/app/bookings/${id}?pay=1&side=teamB`);
    } catch (err) {
      showError(joinMatchErrorMessage(err, 'Ku biirid ma suurtogelin'));
    } finally {
      setJoining(false);
    }
  };

  const b = preview?.booking;
  const progress = b ? matchPaymentProgress(preview) : null;
  const step = b ? 'confirm' : 'code';

  return (
    <PageTransition>
      <PageHeader
        title="Dhammee lacagta"
        description="Geli Match Code + telefoonka Team A — dhammee lacagta Team B"
        breadcrumbs={[
          { label: 'Bookings', to: '/app/bookings' },
          { label: 'Dhammee lacagta' },
        ]}
      />

      <Card className="mx-auto max-w-lg space-y-5 overflow-hidden p-6">
        <JoinMatchSteps active={step} />

        <p className="text-sm leading-relaxed text-muted dark:text-dark-muted">
          Code kaliya kuma filna — waa inaad ogaato telefoonka Team A ee lacagta lagu bixiyay
          (kabtanka A wuxuu kuu diraa WhatsApp).
        </p>

        <motion.div
          key={shakeKey}
          animate={fieldError ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className="space-y-4"
        >
          <Input
            label="Match Code"
            icon={<FiKey />}
            value={code}
            onChange={(e) => {
              setCode(normalize(e.target.value));
              setFieldError('');
            }}
            placeholder="SG-XXXX-XXXX"
            hint="Tusaale: SG-A3K9-M2P7"
          />
          <SomaliPhoneInput
            label="Telefoonka Team A (payer)"
            carrierId={carrierId}
            onCarrierChange={setCarrierId}
            localNumber={localNumber}
            onLocalNumberChange={(v) => {
              setLocalNumber(v);
              setFieldError('');
            }}
            required
            hint="Telefoonka lacagta Team A lagu bixiyay — tusaale Telesom 063… ama +25263… (ma aha kanaga)"
          />

          <AnimatePresence>
            {fieldError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-start gap-2 rounded-lg bg-status-cancelled-bg px-3 py-2 text-sm text-status-cancelled-text"
              >
                <FiAlertCircle className="mt-0.5 shrink-0" size={16} />
                {fieldError}
              </motion.p>
            )}
          </AnimatePresence>

          <Button loading={loading} onClick={lookup} className="w-full" icon={<FiSearch />}>
            Raadi Match Code
          </Button>
        </motion.div>

        <AnimatePresence>
          {b && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="space-y-4 rounded-xl border border-brand-green/20 bg-warmwhite p-4 dark:border-brand-green/30 dark:bg-dark-elevated"
            >
              {progress && <MatchPaymentProgress progress={progress} />}

              <div className="space-y-1 text-sm">
                <p className="font-semibold text-charcoal dark:text-dark-text">
                  {b.stadium?.name} · {b.field?.name}
                </p>
                <p className="text-muted dark:text-dark-muted">
                  {new Date(b.startTime).toLocaleString()} →{' '}
                  {new Date(b.endTime).toLocaleTimeString()}
                </p>
                <p>
                  Team A:{' '}
                  <span className="font-medium">{b.teamA?.team?.name || '—'}</span>
                  {' · '}
                  {progress?.teamAPaid ? 'waa bixiyay ✓' : b.teamA?.paymentStatus}
                </p>
                <p className="pt-1 text-lg font-bold text-charcoal dark:text-dark-text">
                  Team B: ${Number(b.teamBAmountDue || 0).toFixed(2)}
                </p>
              </div>

              {b.invitePhoneLocked && (
                <p className="text-xs text-status-pending-text">
                  Match Code-kan wuxuu u xidhan yahay telefoonka akoonkaaga.
                </p>
              )}
              {preview.window?.phase && (
                <p className="text-xs text-status-pending-text">
                  Window: {preview.window.phase} · {preview.window.secondsRemaining}s left
                </p>
              )}

              {b.teamBJoined ? (
                <Button
                  className="w-full"
                  icon={<FiArrowRight />}
                  onClick={() => navigate(`/app/bookings/${b.id}?pay=1&side=teamB`)}
                >
                  Fur ballanka — bixi
                </Button>
              ) : (
                <Button className="w-full" loading={joining} onClick={join} icon={<FiPhone />}>
                  Ku biir oo bixi
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-muted">
          Ama{' '}
          <Link to="/app/bookings" className="text-brand-green underline">
            My Bookings
          </Link>
        </p>
      </Card>
    </PageTransition>
  );
}
