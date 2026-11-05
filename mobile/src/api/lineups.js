import api from './client';

/** Lineup discovery — requires platform lineupEnabled */
export const lineupsApi = {
  /** Auth: latest boards for teams the caller captains */
  mine: (params = {}) =>
    api.get('/lineups/mine', { params }).then((r) => r.data.data),
  search: (q, params = {}) =>
    api.get('/lineups/search', { params: { q, ...params } }).then((r) => r.data.data),
  getTeamLineup: (teamId) =>
    api.get(`/lineups/teams/${teamId}`).then((r) => r.data.data),
};
