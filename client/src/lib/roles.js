export const ROLES = {
  TEAM_CAPTAIN: 'team_captain',
  STADIUM_OWNER: 'stadium_owner',
  STADIUM_MANAGER: 'stadium_manager',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

export const ROLE_LABELS = {
  [ROLES.TEAM_CAPTAIN]: 'Team Captain',
  [ROLES.STADIUM_OWNER]: 'Stadium Owner',
  [ROLES.STADIUM_MANAGER]: 'Stadium Manager',
  [ROLES.ADMIN]: 'Admin',
  [ROLES.SUPER_ADMIN]: 'Super Admin',
};

/** Empty past hours (Dhacay / lost) — owner, manager, admin, super admin only. */
export function canViewLostSlots(role) {
  return (
    role === ROLES.STADIUM_OWNER ||
    role === ROLES.STADIUM_MANAGER ||
    role === ROLES.ADMIN ||
    role === ROLES.SUPER_ADMIN
  );
}

export const dashboardPathForRole = (role) => {
  switch (role) {
    case ROLES.STADIUM_OWNER:
    case ROLES.STADIUM_MANAGER:
      return '/owner';
    case ROLES.ADMIN:
      return '/admin';
    case ROLES.SUPER_ADMIN:
      return '/super-admin';
    default:
      return '/app';
  }
};
