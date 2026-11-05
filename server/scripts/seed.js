/**
 * Demo seed script — creates test users, stadium, fields, and a team.
 *
 * Usage:
 *   npm run seed              # skip if demo data already exists
 *   npm run seed -- --force   # drop demo collections and re-seed
 *
 * Requires MongoDB (see server/.env.example). Redis is NOT required for seeding.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const Team = require('../src/models/Team');
const Stadium = require('../src/models/Stadium');
const Field = require('../src/models/Field');
const { ROLES } = require('../src/constants/roles');
const { normalizeSomaliPhone } = require('../src/utils/somaliPhone');

const DEMO_PASSWORD = 'Demo1234!';
const DEMO_DOMAIN = 'demo.kulansiiye';

const DEMO_USERS = [
  { email: `captain@${DEMO_DOMAIN}`, name: 'Demo Captain', role: ROLES.TEAM_CAPTAIN, phone: '0611000001' },
  {
    email: `captain2@${DEMO_DOMAIN}`,
    name: 'Demo Captain B',
    role: ROLES.TEAM_CAPTAIN,
    phone: '0637000001',
  },
  { email: `owner@${DEMO_DOMAIN}`, name: 'Demo Owner', role: ROLES.STADIUM_OWNER, phone: '0651000002' },
  { email: `admin@${DEMO_DOMAIN}`, name: 'Demo Admin', role: ROLES.ADMIN, phone: '0901000003' },
  { email: `super@${DEMO_DOMAIN}`, name: 'Demo Super Admin', role: ROLES.SUPER_ADMIN, phone: '0611000004' },
];

const STADIUM_IMAGE =
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80';
const FIELD_IMAGE =
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80';

function printCredentials() {
  console.log('\nDemo credentials (password for all: Demo1234!):');
  DEMO_USERS.forEach((u) => console.log(`  ${u.role.padEnd(16)} ${u.email}`));
}

async function seed() {
  const force = process.argv.includes('--force');

  await connectDB();

  const demoEmails = DEMO_USERS.map((u) => u.email);
  const demoOwnerEmail = `owner@${DEMO_DOMAIN}`;

  if (!force) {
    const captain = await User.findOne({ email: `captain@${DEMO_DOMAIN}` });
    const owner = await User.findOne({ email: demoOwnerEmail });
    const stadium = owner ? await Stadium.findOne({ owner: owner._id, name: 'Banadir Sports Arena' }) : null;
    if (captain && stadium) {
      console.log('[seed] Demo data already exists. Run with --force to re-seed.');
      printCredentials();
      await mongoose.disconnect();
      return;
    }
  }

  if (force) {
    console.log('[seed] --force: clearing demo data…');
    const demoUsers = await User.find({ email: { $in: demoEmails } });
    const demoUserIds = demoUsers.map((u) => u._id);
    const demoStadiums = await Stadium.find({ owner: { $in: demoUserIds } });
    const demoStadiumIds = demoStadiums.map((s) => s._id);

    await Field.deleteMany({ stadium: { $in: demoStadiumIds } });
    await Stadium.deleteMany({ _id: { $in: demoStadiumIds } });
    await Team.deleteMany({ captain: { $in: demoUserIds } });
    await User.deleteMany({ email: { $in: demoEmails } });
  }

  // Legacy geo index cleanup handled by connectDB → dropLegacyStadiumGeoIndexes()

  // If a previous seed partially failed, clean up demo users before re-creating.
  const partialUsers = await User.find({ email: { $in: demoEmails } });
  if (partialUsers.length > 0) {
    const partialIds = partialUsers.map((u) => u._id);
    const partialStadiums = await Stadium.find({ owner: { $in: partialIds } });
    await Field.deleteMany({ stadium: { $in: partialStadiums.map((s) => s._id) } });
    await Stadium.deleteMany({ owner: { $in: partialIds } });
    await Team.deleteMany({ captain: { $in: partialIds } });
    await User.deleteMany({ _id: { $in: partialIds } });
    console.log('[seed] cleaned up partial demo data from previous run');
  }

  const passwordHash = await User.hashPassword(DEMO_PASSWORD);
  const createdUsers = {};

  for (const spec of DEMO_USERS) {
    const user = await User.create({
      name: spec.name,
      email: spec.email,
      phone: normalizeSomaliPhone(spec.phone),
      passwordHash,
      role: spec.role,
      status: 'active',
      isEmailVerified: true,
    });
    createdUsers[spec.email] = user;
    console.log(`[seed] user  ${spec.role} → ${spec.email} · ${user.phone}`);
  }

  const captain = createdUsers[`captain@${DEMO_DOMAIN}`];
  const captainB = createdUsers[`captain2@${DEMO_DOMAIN}`];
  const owner = createdUsers[`owner@${DEMO_DOMAIN}`];

  const team = await Team.create({
    name: 'Demo FC',
    captain: captain._id,
    city: 'Hargeisa',
    region: 'Woqooyi Galbeed',
    players: [
      { name: 'Ahmed Ali', position: 'GK', jerseyNumber: 1 },
      { name: 'Hassan Noor', position: 'DEF', jerseyNumber: 4 },
      { name: 'Omar Farah', position: 'MID', jerseyNumber: 8 },
      { name: 'Yusuf Ibrahim', position: 'FWD', jerseyNumber: 9 },
    ],
  });
  console.log(`[seed] team  Demo FC (${team._id})`);

  const teamB = await Team.create({
    name: 'Ceelasha United',
    captain: captainB._id,
    city: 'Hargeisa',
    region: 'Woqooyi Galbeed',
  });
  console.log(`[seed] team  Ceelasha United (${teamB._id}) — invite via Telesom 0637000001`);

  // On force re-seed, drop stadiums collection to clear legacy geo indexes from old schema.
  if (force) {
    try {
      await mongoose.connection.db.dropCollection('stadiums');
      console.log('[seed] dropped stadiums collection (clears legacy geo index)');
    } catch (err) {
      if (err.codeName !== 'NamespaceNotFound') throw err;
    }
  }

  const stadiumPayload = {
    owner: owner._id,
    name: 'Banadir Sports Arena',
    description: 'Premium artificial turf venue in the heart of Hargeisa. Floodlit fields, parking, and changing rooms.',
    images: [STADIUM_IMAGE],
    address: 'KM4, Hodan District',
    city: 'Hargeisa',
    region: 'Woqooyi Galbeed',
    area: 'Xaafadda Shacabka',
    latLng: { lat: 2.0469, lng: 45.3182 },
    facilities: ['parking', 'lighting', 'showers', 'seating'],
    openingTime: '06:00',
    closingTime: '23:00',
    status: 'approved',
    ratingAverage: 4.5,
    ratingCount: 12,
  };

  const stadium = await Stadium.create(stadiumPayload);
  console.log(`[seed] stadium  ${stadium.name} (${stadium._id}) — approved`);

  const fields = [
    {
      name: 'Field A — 7v7',
      type: '7v7',
      capacity: 7,
      images: [FIELD_IMAGE],
      pricingMode: 'per_player',
      pricePerPlayer: 5,
      openingTime: '08:00',
      closingTime: '22:00',
    },
    {
      name: 'Field B — 5v5',
      type: '5v5',
      capacity: 5,
      images: [FIELD_IMAGE],
      pricingMode: 'fixed',
      fixedPrice: 40,
      openingTime: '08:00',
      closingTime: '22:00',
    },
  ];

  for (const spec of fields) {
    const field = await Field.create({ stadium: stadium._id, ...spec });
    console.log(`[seed] field  ${field.name} (${field._id})`);
  }

  console.log('\n✅ Seed complete!\n');
  console.log('Demo credentials (password for all: Demo1234!):\n');
  console.log('  Role              Email                      Dashboard');
  console.log('  ─────────────────────────────────────────────────────────');
  console.log('  Team Captain      captain@demo.kulansiiye    /app  · Hormuud 0611000001');
  console.log('  Team Captain B    captain2@demo.kulansiiye   /app  · Telesom 0637000001');
  console.log('  Stadium Owner     owner@demo.kulansiiye      /owner');
  console.log('  Admin             admin@demo.kulansiiye      /admin');
  console.log('  Super Admin       super@demo.kulansiiye      /super-admin');
  console.log('\nStadium is pre-approved — captains can search and book immediately.');
  console.log('Invite Team B by phone after paying: 0637000001 (captain2).');
  console.log(`Team ID for booking tests: ${team._id}`);

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
