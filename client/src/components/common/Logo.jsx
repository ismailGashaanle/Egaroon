function Mark({ className = '' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <circle cx="16" cy="16" r="16" fill="currentColor" />
      <path
        fill="#fff"
        d="M11.2 9h9.8v2.3h-7.5v3.2h6.2v2.3h-6.2v3.9H21.2V23H11.2V9z"
      />
    </svg>
  );
}

export default function Logo({ className = '', showWordmark = true, compact = false, size = 'md' }) {
  const sizes = {
    sm: { box: 'h-7 w-7', text: 'text-base' },
    md: { box: 'h-9 w-9', text: 'text-lg' },
    lg: { box: 'h-12 w-12', text: 'text-2xl' },
  };
  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <Mark className={`${s.box} shrink-0 text-forest dark:text-dark-primary`} />
      {showWordmark && !compact && (
        <span className={`font-display font-extrabold tracking-tight ${s.text} text-charcoal dark:text-dark-text`}>
          E-Garoon
        </span>
      )}
    </div>
  );
}
