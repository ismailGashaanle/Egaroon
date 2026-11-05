const ROLES = {
  TEAM_CAPTAIN: 'team_captain',
  STADIUM_OWNER: 'stadium_owner',
  STADIUM_MANAGER: 'stadium_manager',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

const ALL_ROLES = Object.values(ROLES);

function canViewLostSlots(role) {
  return (
    role === ROLES.STADIUM_OWNER ||
    role === ROLES.STADIUM_MANAGER ||
    role === ROLES.ADMIN ||
    role === ROLES.SUPER_ADMIN
  );
}

module.exports = { ROLES, ALL_ROLES, canViewLostSlots };
