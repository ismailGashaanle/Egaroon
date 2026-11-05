const Tournament = require('../models/Tournament');
const TournamentTeam = require('../models/TournamentTeam');
const Fixture = require('../models/Fixture');
const Stadium = require('../models/Stadium');
const AvailabilityBlock = require('../models/AvailabilityBlock');
const Team = require('../models/Team');
const ApiError = require('../utils/ApiError');

async function createTournament(ownerId, payload) {
  const stadium = await Stadium.findById(payload.stadiumId);
  if (!stadium) throw ApiError.notFound('Stadium not found');
  if (stadium.owner.toString() !== ownerId) {
    throw ApiError.forbidden('You can only create tournaments for your own stadiums');
  }

  const tournament = await Tournament.create({
    name: payload.name,
    description: payload.description,
    stadium: stadium._id,
    owner: ownerId,
    fields: payload.fieldIds || [],
    maxTeams: payload.maxTeams,
    registrationFee: payload.registrationFee,
    currency: payload.currency || 'USD',
    startDate: payload.startDate,
    endDate: payload.endDate,
    registrationDeadline: payload.registrationDeadline,
    matchDurationMinutes: payload.matchDurationMinutes || 60,
    format: payload.format || 'GROUP_AND_KNOCKOUT',
    rules: payload.rules,
    prize: payload.prize,
    status: payload.publish ? 'OPEN' : 'DRAFT',
  });

  // Block public booking on tournament window for selected fields (BR-011)
  if (payload.blockSlots !== false && tournament.fields?.length) {
    for (const fieldId of tournament.fields) {
      await AvailabilityBlock.create({
        field: fieldId,
        startsAt: tournament.startDate,
        endsAt: tournament.endDate,
        type: 'tournament',
        reason: `Tournament: ${tournament.name}`,
        createdBy: ownerId,
      });
    }
  }

  return tournament;
}

async function listTournaments({ stadiumId, status, mineOwnerId } = {}) {
  const filter = {};
  if (stadiumId) filter.stadium = stadiumId;
  if (status) filter.status = status;
  if (mineOwnerId) filter.owner = mineOwnerId;
  if (!mineOwnerId && !status) {
    filter.status = { $in: ['OPEN', 'IN_PROGRESS', 'COMPLETED'] };
  }
  return Tournament.find(filter)
    .populate('stadium', 'name city region area')
    .sort({ startDate: 1 });
}

async function getTournament(id) {
  const tournament = await Tournament.findById(id).populate('stadium', 'name city region area images');
  if (!tournament) throw ApiError.notFound('Tournament not found');
  const teams = await TournamentTeam.find({ tournament: id })
    .populate('team', 'name logoUrl')
    .populate('captain', 'firstName lastName');
  const fixtures = await Fixture.find({ tournament: id })
    .populate('homeTeam', 'name')
    .populate('awayTeam', 'name')
    .sort({ startTime: 1 });
  return { tournament, teams, fixtures, standings: buildStandings(teams, fixtures) };
}

async function registerTeam({ tournamentId, teamId, captainId }) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (tournament.status !== 'OPEN') {
    throw ApiError.conflict('Tournament is not open for registration');
  }
  if (new Date() > tournament.registrationDeadline) {
    throw ApiError.conflict('Registration deadline has passed');
  }

  const team = await Team.findById(teamId);
  if (!team) throw ApiError.notFound('Team not found');
  if (team.captain.toString() !== captainId) {
    throw ApiError.forbidden('Only the team captain can register');
  }

  const count = await TournamentTeam.countDocuments({
    tournament: tournamentId,
    status: { $ne: 'WITHDRAWN' },
  });
  if (count >= tournament.maxTeams) {
    throw ApiError.conflict('Tournament is full');
  }

  try {
    const entry = await TournamentTeam.create({
      tournament: tournamentId,
      team: teamId,
      captain: captainId,
      status: tournament.registrationFee > 0 ? 'REGISTERED' : 'CONFIRMED',
      paymentStatus: tournament.registrationFee > 0 ? 'PENDING' : 'PAID',
      feePaid: tournament.registrationFee > 0 ? 0 : tournament.registrationFee,
    });
    return entry;
  } catch (err) {
    if (err.code === 11000) throw ApiError.conflict('Team already registered');
    throw err;
  }
}

/** Dev helper: mark registration fee paid (mock). */
async function confirmRegistrationPayment({ tournamentId, teamId, captainId }) {
  const entry = await TournamentTeam.findOne({ tournament: tournamentId, team: teamId });
  if (!entry) throw ApiError.notFound('Registration not found');
  if (entry.captain.toString() !== captainId) throw ApiError.forbidden('Not your registration');

  const tournament = await Tournament.findById(tournamentId);
  entry.paymentStatus = 'PAID';
  entry.status = 'CONFIRMED';
  entry.feePaid = tournament.registrationFee;
  await entry.save();
  return entry;
}

async function assignGroups({ tournamentId, ownerId, groupSize = 4 }) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (tournament.owner.toString() !== ownerId) throw ApiError.forbidden('Not your tournament');

  const teams = await TournamentTeam.find({
    tournament: tournamentId,
    status: 'CONFIRMED',
  });
  if (teams.length < 2) throw ApiError.badRequest('Need at least 2 confirmed teams');

  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let idx = 0;
  for (let i = 0; i < teams.length; i += 1) {
    const groupIndex = Math.floor(i / groupSize);
    teams[i].group = letters[groupIndex] || `G${groupIndex + 1}`;
    await teams[i].save();
    idx += 1;
  }

  tournament.status = 'IN_PROGRESS';
  await tournament.save();

  // Generate round-robin fixtures per group
  const byGroup = {};
  for (const t of teams) {
    if (!byGroup[t.group]) byGroup[t.group] = [];
    byGroup[t.group].push(t);
  }

  await Fixture.deleteMany({ tournament: tournamentId, round: 'GROUP' });

  const fixtures = [];
  for (const [group, groupTeams] of Object.entries(byGroup)) {
    for (let i = 0; i < groupTeams.length; i += 1) {
      for (let j = i + 1; j < groupTeams.length; j += 1) {
        fixtures.push({
          tournament: tournamentId,
          group,
          round: 'GROUP',
          homeTeam: groupTeams[i].team,
          awayTeam: groupTeams[j].team,
          status: 'SCHEDULED',
        });
      }
    }
  }
  if (fixtures.length) await Fixture.insertMany(fixtures);

  return getTournament(tournamentId);
}

async function recordResult({ fixtureId, ownerId, homeScore, awayScore, notes }) {
  const fixture = await Fixture.findById(fixtureId);
  if (!fixture) throw ApiError.notFound('Fixture not found');
  const tournament = await Tournament.findById(fixture.tournament);
  if (!tournament || tournament.owner.toString() !== ownerId) {
    throw ApiError.forbidden('Not your tournament');
  }

  fixture.homeScore = homeScore;
  fixture.awayScore = awayScore;
  fixture.notes = notes;
  fixture.status = 'FINISHED';
  await fixture.save();
  return fixture;
}

function buildStandings(teams, fixtures) {
  const table = {};
  for (const t of teams) {
    if (!t.group || t.status === 'WITHDRAWN') continue;
    const key = `${t.group}:${t.team._id || t.team}`;
    table[key] = {
      group: t.group,
      teamId: t.team._id || t.team,
      teamName: t.team?.name || 'Team',
      P: 0,
      W: 0,
      D: 0,
      L: 0,
      GF: 0,
      GA: 0,
      GD: 0,
      PTS: 0,
    };
  }

  for (const f of fixtures) {
    if (f.status !== 'FINISHED' || f.round !== 'GROUP') continue;
    const homeId = f.homeTeam._id || f.homeTeam;
    const awayId = f.awayTeam._id || f.awayTeam;
    const homeKey = Object.keys(table).find((k) => k.endsWith(`:${homeId}`));
    const awayKey = Object.keys(table).find((k) => k.endsWith(`:${awayId}`));
    if (!homeKey || !awayKey) continue;

    const home = table[homeKey];
    const away = table[awayKey];
    home.P += 1;
    away.P += 1;
    home.GF += f.homeScore;
    home.GA += f.awayScore;
    away.GF += f.awayScore;
    away.GA += f.homeScore;

    if (f.homeScore > f.awayScore) {
      home.W += 1;
      home.PTS += 3;
      away.L += 1;
    } else if (f.homeScore < f.awayScore) {
      away.W += 1;
      away.PTS += 3;
      home.L += 1;
    } else {
      home.D += 1;
      away.D += 1;
      home.PTS += 1;
      away.PTS += 1;
    }
    home.GD = home.GF - home.GA;
    away.GD = away.GF - away.GA;
  }

  const rows = Object.values(table);
  rows.sort((a, b) => {
    if (a.group !== b.group) return a.group.localeCompare(b.group);
    if (b.PTS !== a.PTS) return b.PTS - a.PTS;
    if (b.GD !== a.GD) return b.GD - a.GD;
    return b.GF - a.GF;
  });
  return rows;
}

async function publishTournament(tournamentId, ownerId) {
  const tournament = await Tournament.findById(tournamentId);
  if (!tournament) throw ApiError.notFound('Tournament not found');
  if (tournament.owner.toString() !== ownerId) throw ApiError.forbidden('Not your tournament');
  tournament.status = 'OPEN';
  await tournament.save();
  return tournament;
}

module.exports = {
  createTournament,
  listTournaments,
  getTournament,
  registerTeam,
  confirmRegistrationPayment,
  assignGroups,
  recordResult,
  publishTournament,
  buildStandings,
};
