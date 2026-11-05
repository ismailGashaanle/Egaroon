export const PATH_STEPS = [
  { key: 'path1', hint: 'path1Hint', src: '/services/step-find.webp' },
  { key: 'path2', hint: 'path2Hint', src: '/services/step-hold.webp' },
  { key: 'path3', hint: 'path3Hint', src: '/services/step-team1.webp' },
  { key: 'path4', hint: 'path4Hint', src: '/services/step-team2.webp' },
  { key: 'path5', hint: 'path5Hint', src: '/services/step-play.webp' },
  { key: 'path6', hint: 'path6Hint', src: '/services/step-paid.webp' },
];

export const PATH_KEYS = PATH_STEPS.map((s) => s.key);

export const SYSTEMS = [
  { key: 'sysBook', hint: 'sysBookHint', to: '/search-fields', icon: 'book', featured: true },
  { key: 'sysPay', hint: 'sysPayHint', to: '/pricing', icon: 'pay', featured: true },
  { key: 'sysTeam', hint: 'sysTeamHint', to: '/register', icon: 'team' },
  { key: 'sysOwner', hint: 'sysOwnerHint', to: '/register', icon: 'owner' },
  { key: 'sysCup', hint: 'sysCupHint', to: '/tournaments', icon: 'cup' },
  { key: 'sysMatch', hint: 'sysMatchHint', to: '/how-it-works', icon: 'match' },
];
