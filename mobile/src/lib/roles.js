import { colors } from '../theme';

export const ROLES = {
  TEAM_CAPTAIN: 'team_captain',
  STADIUM_OWNER: 'stadium_owner',
  STADIUM_MANAGER: 'stadium_manager',
};

export function isMobileRole(role) {
  return (
    role === ROLES.TEAM_CAPTAIN ||
    role === ROLES.STADIUM_OWNER ||
    role === ROLES.STADIUM_MANAGER
  );
}

/** Empty past hours (Dhacay / lost) — staff only, never team captains. */
export function canViewLostSlots(role) {
  return (
    role === ROLES.STADIUM_OWNER ||
    role === ROLES.STADIUM_MANAGER ||
    role === 'admin' ||
    role === 'super_admin'
  );
}

/** Status tint — uses static light palette (status hues are mode-stable). */
export function statusColor(status) {
  const s = String(status || '').toLowerCase();
  if (['confirmed', 'paid', 'checked_in', 'completed'].some((x) => s.includes(x))) {
    return colors.statusConfirmed;
  }
  if (['cancelled', 'expired', 'failed', 'no_show'].some((x) => s.includes(x))) {
    return colors.statusCancelled;
  }
  if (['pending', 'held', 'hold'].some((x) => s.includes(x))) {
    return colors.statusPending;
  }
  return colors.accent;
}
