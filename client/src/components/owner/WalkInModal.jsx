import { useState } from 'react';
import toast from 'react-hot-toast';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Input from '../common/Input';
import SomaliPhoneInput from '../common/SomaliPhoneInput';
import { ownerApi } from '../../api/bookingApi';
import { composeSomaliPhone } from '../../lib/somaliPhone';
import { formatLabel, isSlotStartPast } from '../../lib/slotUtils';
import { useTranslation } from '../../i18n/LanguageContext';

const PAY_MODES = ['full', 'half_a'];
const PAY_METHODS = ['cash', 'zaad', 'edahab', 'hormuud'];

export default function WalkInModal({
  open,
  onClose,
  stadiumId,
  fieldId,
  slot,
  onBooked,
}) {
  const { t } = useTranslation();
  const [captainName, setCaptainName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [carrierId, setCarrierId] = useState('hormuud');
  const [localNumber, setLocalNumber] = useState('');
  const [payerCarrierId, setPayerCarrierId] = useState('hormuud');
  const [payerLocal, setPayerLocal] = useState('');
  const [payMode, setPayMode] = useState('full');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCaptainName('');
    setTeamName('');
    setLocalNumber('');
    setPayerLocal('');
    setPayMode('full');
    setPaymentMethod('cash');
  };

  const handleClose = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const captainPhone = composeSomaliPhone(carrierId, localNumber);
    if (!captainPhone) {
      toast.error(t('owner.walkInPhoneRequired'));
      return;
    }
    if (!stadiumId || !fieldId || !slot?.startISO || !slot?.endISO) {
      toast.error(t('owner.walkInSlotMissing'));
      return;
    }
    if (slot.isRecurring || String(slot.reason || '').startsWith('RECURRING') || slot.status === 'blocked') {
      toast.error(slot.teamName ? `Joogto · ${slot.teamName}` : t('owner.slotWeeklyTeam'));
      return;
    }
    if (slot.status === 'past' || isSlotStartPast(slot.startISO)) {
      toast.error(t('search.past'));
      return;
    }
    setSaving(true);
    try {
      const payerPhone = composeSomaliPhone(payerCarrierId, payerLocal);
      const { data } = await ownerApi.walkIn({
        stadiumId,
        fieldId,
        startTime: slot.startISO,
        endTime: slot.endISO,
        captainName: captainName.trim() || undefined,
        captainPhone,
        teamName: teamName.trim() || undefined,
        payMode,
        paymentMethod,
        payerPhone: payerPhone || undefined,
        payNow: true,
      });
      toast.success(
        `${t('owner.walkInOk')} · ${data.data.booking?.bookingCode || paymentMethod.toUpperCase()}`
      );
      reset();
      onBooked?.(data.data);
    } catch (err) {
      const errBody = err.response?.data?.error;
      toast.error(errBody?.details?.messageSo || errBody?.message || t('owner.walkInFail'));
    } finally {
      setSaving(false);
    }
  };

  const timeLabel = slot?.start ? `${formatLabel(slot.start)} – ${formatLabel(slot.end)}` : '';
  const price = slot?.pricing?.totalPrice != null ? `$${Number(slot.pricing.totalPrice).toFixed(2)}` : null;

  return (
    <Modal open={open} onClose={handleClose} title={t('owner.walkInTitle')} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="rounded-xl bg-forest/5 px-3 py-2 text-sm text-muted dark:bg-dark-primary/10">
          {timeLabel}
          {price ? ` · ${price}` : ''}
          <span className="mt-1 block text-xs">{t('owner.walkInHint')}</span>
        </p>

        <Input
          label={t('owner.walkInCaptain')}
          value={captainName}
          onChange={(e) => setCaptainName(e.target.value)}
          placeholder="Axmed Cali"
        />
        <SomaliPhoneInput
          label={t('owner.walkInPhone')}
          required
          carrierId={carrierId}
          onCarrierChange={setCarrierId}
          localNumber={localNumber}
          onLocalNumberChange={setLocalNumber}
        />
        <Input
          label={t('owner.teamName')}
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />

        <div>
          <p className="mb-1.5 text-sm font-medium text-charcoal dark:text-dark-text">
            {t('owner.walkInPayMode')}
          </p>
          <div className="flex flex-wrap gap-2">
            {PAY_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setPayMode(mode)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                  payMode === mode
                    ? 'bg-forest text-white'
                    : 'border border-border bg-white text-charcoal dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text'
                }`}
              >
                {t(`owner.payMode.${mode}`)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium text-charcoal dark:text-dark-text">
            {t('owner.walkInPayMethod')}
          </p>
          <div className="flex flex-wrap gap-2">
            {PAY_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={`rounded-full px-3 py-1.5 text-sm font-semibold capitalize ${
                  paymentMethod === method
                    ? 'bg-forest text-white'
                    : 'border border-border bg-white text-charcoal dark:border-dark-border dark:bg-dark-surface-2 dark:text-dark-text'
                }`}
              >
                {method === 'edahab' ? 'eDahab' : method}
              </button>
            ))}
          </div>
        </div>

        {paymentMethod !== 'cash' && (
          <SomaliPhoneInput
            label={t('owner.walkInPayerPhone')}
            carrierId={payerCarrierId}
            onCarrierChange={setPayerCarrierId}
            localNumber={payerLocal}
            onLocalNumberChange={setPayerLocal}
          />
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" loading={saving}>
            {t('owner.walkInSubmit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
