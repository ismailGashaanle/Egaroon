import clsx from 'clsx';
import AnimatedNumber from '../common/AnimatedNumber';

const TONES = {
  forest: 'bg-[#176B45]/10 text-[#176B45] dark:bg-[#176B45]/20 dark:text-[#7dcaa6]',
  olive: 'bg-[#6B8E3A]/15 text-[#6B8E3A] dark:bg-[#6B8E3A]/20 dark:text-[#b5d07a]',
  orange: 'bg-[#D98A3A]/15 text-[#D98A3A] dark:bg-[#D98A3A]/20 dark:text-[#e8b06a]',
  charcoal: 'bg-[#18201C]/8 text-[#18201C] dark:bg-white/10 dark:text-dark-text',
};

export default function ReportKpiCard({ icon, label, value, hint, tone = 'forest' }) {
  return (
    <article className="rounded-[1.6rem] border border-black/[0.04] bg-white px-5 py-6 shadow-card transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-lifted dark:border-dark-border dark:bg-dark-surface">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted dark:text-dark-muted">
          {label}
        </p>
        {icon ? (
          <div
            className={clsx(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg',
              TONES[tone] || TONES.forest
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
      <p className="mt-4 font-display text-[1.85rem] font-bold leading-none tracking-tight text-[#18201C] dark:text-dark-text">
        <AnimatedNumber value={value} />
      </p>
      {hint ? <p className="mt-2 text-sm text-muted dark:text-dark-muted">{hint}</p> : null}
    </article>
  );
}
