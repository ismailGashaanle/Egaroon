import Input from '../common/Input';
import Textarea from '../common/Textarea';

const LANGS = [
  { code: 'so', label: 'Soomaali' },
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
];

/**
 * Three-locale text editor (SO / EN / AR).
 * value: { so, en, ar }
 */
export default function LocaleFields({
  label,
  value = {},
  onChange,
  multiline = false,
  rows = 3,
  hint,
  placeholder,
}) {
  const setLang = (code) => (e) => {
    onChange({ ...value, [code]: e.target.value });
  };

  return (
    <div className="space-y-2">
      {label && <p className="text-sm font-medium text-charcoal dark:text-dark-text">{label}</p>}
      {hint && <p className="text-xs text-muted dark:text-dark-muted">{hint}</p>}
      <div className="grid gap-2 sm:grid-cols-3">
        {LANGS.map(({ code, label: langLabel }) =>
          multiline ? (
            <Textarea
              key={code}
              label={langLabel}
              rows={rows}
              value={value[code] || ''}
              onChange={setLang(code)}
              placeholder={placeholder}
            />
          ) : (
            <Input
              key={code}
              label={langLabel}
              value={value[code] || ''}
              onChange={setLang(code)}
              placeholder={placeholder}
            />
          )
        )}
      </div>
    </div>
  );
}
