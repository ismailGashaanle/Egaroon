import axiosClient from './axiosClient';

/** Lineup discovery — requires platform lineupEnabled */
export const lineupApi = {
  /** Auth: latest boards for teams the caller captains */
  mine: (params = {}) => axiosClient.get('/lineups/mine', { params }),
  search: (q, params = {}) =>
    axiosClient.get('/lineups/search', { params: { q, ...params } }),
  getTeamLineup: (teamId) => axiosClient.get(`/lineups/teams/${teamId}`),
};
