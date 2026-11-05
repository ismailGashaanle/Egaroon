import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';
import { FaUserInjured } from 'react-icons/fa';
import { slotsForFormation } from '../../lib/formationLayouts';
import CldImage from '../common/CldImage';

function surnameLabel(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

/**
 * Pro formation board — dark green pitch, white markings, circular headshots
 * with black name labels (broadcast / lineup-board style).
 */
export default function FormationPitch({
  formationKey = '2-3-1',
  capacity = 7,
  players = [],
  onSlotClick,
  selectedSlot,
  editable = false,
  compact = false,
  showBench = true,
  className,
}) {
  const slots = slotsForFormation(formationKey, capacity);
  const bySlot = Object.fromEntries(
    (players || [])
      .filter((p) => p.status !== 'bench' && p.formationSlot)
      .map((p) => [p.formationSlot, p])
  );
  const bench = (players || []).filter((p) => p.status === 'bench');

  const tokenW = compact ? 'w-[3.25rem]' : 'w-[4.25rem]';
  const avatarSize = compact ? 'h-10 w-10' : 'h-12 w-12 sm:h-14 sm:w-14';
  const avatarPx = compact ? 40 : 56;

  return (
    <div className={clsx('w-full', className)}>
      <div
        className={clsx(
          'relative mx-auto w-full overflow-hidden rounded-xl shadow-lifted ring-1 ring-black/20',
          compact ? 'aspect-[2/3] max-w-xs' : 'aspect-[2/3] max-w-md'
        )}
        style={{
          background:
            'linear-gradient(180deg, #1a5c2e 0%, #0d3d1f 45%, #0a3320 100%)',
        }}
      >
        {/* Subtle turf stripes */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent 0, transparent 28px, rgba(0,0,0,0.35) 28px, rgba(0,0,0,0.35) 56px)',
          }}
        />

        {/* Pitch markings */}
        <div className="pointer-events-none absolute inset-[4%] border border-white/70">
          {/* Halfway */}
          <div className="absolute left-0 right-0 top-1/2 border-t border-white/70" />
          {/* Center circle + spot */}
          <div className="absolute left-1/2 top-1/2 h-[18%] w-[36%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70" />
          <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80" />

          {/* Top penalty / goal areas */}
          <div className="absolute left-1/2 top-0 h-[16%] w-[62%] -translate-x-1/2 border border-t-0 border-white/70" />
          <div className="absolute left-1/2 top-0 h-[7%] w-[32%] -translate-x-1/2 border border-t-0 border-white/70" />
          {/* Top D */}
          <div className="absolute left-1/2 top-[16%] h-[6%] w-[22%] -translate-x-1/2 rounded-b-full border border-t-0 border-white/50" />

          {/* Bottom penalty / goal areas */}
          <div className="absolute bottom-0 left-1/2 h-[16%] w-[62%] -translate-x-1/2 border border-b-0 border-white/70" />
          <div className="absolute bottom-0 left-1/2 h-[7%] w-[32%] -translate-x-1/2 border border-b-0 border-white/70" />
          <div className="absolute bottom-[16%] left-1/2 h-[6%] w-[22%] -translate-x-1/2 rounded-t-full border border-b-0 border-white/50" />

          {/* Corner arcs */}
          <div className="absolute left-0 top-0 h-3 w-3 rounded-br-full border-b border-r border-white/50" />
          <div className="absolute right-0 top-0 h-3 w-3 rounded-bl-full border-b border-l border-white/50" />
          <div className="absolute bottom-0 left-0 h-3 w-3 rounded-tr-full border-r border-t border-white/50" />
          <div className="absolute bottom-0 right-0 h-3 w-3 rounded-tl-full border-l border-t border-white/50" />
        </div>

        {slots.map((slot) => {
          const player = bySlot[slot.id];
          const selected = selectedSlot === slot.id;
          const injured = Boolean(player?.injured);
          const label = player ? surnameLabel(player.displayName) : slot.id;

          return (
            <motion.button
              key={slot.id}
              type="button"
              disabled={!editable}
              onClick={() => editable && onSlotClick?.(slot)}
              layout
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 420, damping: 26 }}
              className={clsx(
                'absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1',
                tokenW,
                editable && 'cursor-pointer'
              )}
              style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
            >
              <div className="relative">
                <motion.div
                  layout
                  className={clsx(
                    'flex items-center justify-center overflow-hidden rounded-full border-2 text-[10px] font-bold shadow-md transition-[box-shadow,border-color] duration-200',
                    avatarSize,
                    selected && 'border-amber-300 shadow-[0_0_0_3px_rgba(252,211,77,0.45)]',
                    !selected && injured && 'border-red-400',
                    !selected && !injured && player && 'border-white',
                    !selected && !player && 'border-dashed border-white/45 bg-black/30 text-white/70'
                  )}
                  style={
                    player && !selected
                      ? { backgroundColor: injured ? '#7f1d1d' : '#111' }
                      : undefined
                  }
                >
                  <AnimatePresence mode="wait">
                    {player?.photoUrl ? (
                      <motion.span
                        key={player.photoUrl}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full w-full"
                      >
                        <CldImage
                          src={player.photoUrl}
                          alt=""
                          width={avatarPx}
                          height={avatarPx}
                          crop
                          className="h-full w-full object-cover"
                        />
                      </motion.span>
                    ) : player ? (
                      <motion.span
                        key={player.displayName || slot.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-white"
                      >
                        {player.jerseyNumber || initials(player.displayName)}
                      </motion.span>
                    ) : (
                      <motion.span
                        key={`empty-${slot.id}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                      >
                        {slot.id}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
                {injured && (
                  <span
                    className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white shadow"
                    title="Injured"
                  >
                    <FaUserInjured size={8} />
                  </span>
                )}
              </div>
              <span
                className={clsx(
                  'max-w-full truncate rounded-sm px-1.5 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm sm:text-[10px]',
                  injured ? 'bg-red-800' : 'bg-black'
                )}
              >
                {label}
              </span>
            </motion.button>
          );
        })}
      </div>

      {showBench && bench.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-xl border border-amber-800/30 bg-[#2a2118] px-3 py-2.5 shadow-inner">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
            Bench
          </p>
          <div className="flex flex-wrap gap-3">
            <AnimatePresence initial={false}>
              {bench.map((p) => (
                <motion.div
                  key={p._id || p._key || `${p.displayName}-${p.jerseyNumber}`}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex w-14 flex-col items-center gap-1"
                >
                  <div className="relative">
                    <div
                      className={clsx(
                        'flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-amber-400/80 bg-amber-950 text-[10px] font-bold text-amber-100',
                        p.injured && 'border-red-400'
                      )}
                    >
                      {p.photoUrl ? (
                        <CldImage
                          src={p.photoUrl}
                          alt=""
                          width={40}
                          height={40}
                          crop
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        p.jerseyNumber || initials(p.displayName)
                      )}
                    </div>
                    {p.injured && (
                      <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white">
                        <FaUserInjured size={8} />
                      </span>
                    )}
                  </div>
                  <span className="max-w-full truncate rounded-sm bg-black px-1 py-0.5 text-center text-[9px] font-semibold uppercase text-white">
                    {surnameLabel(p.displayName)}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
