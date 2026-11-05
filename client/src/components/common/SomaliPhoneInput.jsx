import {
  SO_CARRIERS,
  composeSomaliPhone,
  digitsOnly,
  formatPhoneDisplay,
  normalizeSomaliPhone,
  splitSomaliPhone,
  detectCarrierFromInput,
  extractSubscriberBody,
} from '../../lib/somaliPhone';
import Select from '../common/Select';
import Input from '../common/Input';

/**
 * Somali carrier phone input — Hormuud 061, Telesom 063, Somtel 065, Golis 090.
 * Accepts short local body OR pasted full intl/local (063… / +252…).
 * Automatically detects carrier when full number is typed or pasted.
 */
export default function SomaliPhoneInput({
  label = 'Mobile',
  carrierId,
  onCarrierChange,
  localNumber,
  onLocalNumberChange,
  required,
  hint,
  lockCarrier = false,
  showPreview = true,
}) {
  const carrier = SO_CARRIERS.find((c) => c.id === carrierId) || SO_CARRIERS[0];
  const composed = composeSomaliPhone(carrier.id, localNumber);
  const preview = composed ? formatPhoneDisplay(composed) : null;

  const handleDigitsChange = (rawInput) => {
    const detected = detectCarrierFromInput(rawInput);
    if (detected && onCarrierChange && detected.id !== carrier.id) {
      onCarrierChange(detected.id);
    }
    const clean = extractSubscriberBody(rawInput, detected?.id || carrier.id);
    onLocalNumberChange(clean);
  };

  const defaultHint =
    hint ||
    `Tusaale ${carrier.label}: ${carrier.prefix}… ama geli 7-da lambar ee dambe (tusaale: 7856383)`;

  return (
    <div className="space-y-2">
      {!lockCarrier && (
        <Select
          label={label}
          value={carrier.id}
          onChange={(e) => onCarrierChange(e.target.value)}
          required={required}
        >
          {SO_CARRIERS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label} ({c.prefix})
            </option>
          ))}
        </Select>
      )}
      {lockCarrier && label && (
        <p className="text-sm font-medium text-charcoal dark:text-dark-text">{label}</p>
      )}
      <div className="flex gap-2">
        <div className="flex h-[42px] shrink-0 items-center rounded-xl border border-border bg-warmwhite px-3 text-sm font-semibold text-muted dark:border-dark-border dark:bg-dark-surface">
          SO +252 · {carrier.prefix}
        </div>
        <Input
          placeholder={`${carrier.hint.replace(carrier.prefix, '').trim() || 'XXX XXX'} · ama ${carrier.prefix}… / +252…`}
          value={localNumber}
          onChange={(e) => handleDigitsChange(e.target.value)}
          required={required}
          className="flex-1"
        />
      </div>
      {showPreview && preview && (
        <p className="text-xs font-medium text-brand-green dark:text-brand-green">
          La xaqiijinayaa: {preview}
        </p>
      )}
      <p className="text-xs text-muted dark:text-dark-muted">{defaultHint}</p>
    </div>
  );
}

export function composedPhone(carrierId, localNumber) {
  return composeSomaliPhone(carrierId, localNumber);
}