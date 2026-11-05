/**
 * Create (or promote) a user with a given role without seeding demo data.
 * ADMIN_ROLE: super_admin (default) | admin | stadium_owner | stadium_manager
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='long-password' \
 *   ADMIN_NAME='Your Name' ADMIN_PHONE=0634123456 \
 *   MONGO_URI='mongodb+srv://...' npm run create-admin
 *
 * If a user with that email exists it is promoted and its password reset.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const mongoose = require('mongoose');
const User = require('../src/models/User');
const { ROLES } = require('../src/constants/roles');
const { normalizeSomaliPhone } = require('../src/utils/somaliPhone');

async function main() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = String(process.env.ADMIN_NAME || 'Super Admin').trim();
  const phone = normalizeSomaliPhone(process.env.ADMIN_PHONE || '');
  const role = process.env.ADMIN_ROLE || ROLES.SUPER_ADMIN;
  const allowed = [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.STADIUM_OWNER, ROLES.STADIUM_MANAGER];
  if (!allowed.includes(role)) throw new Error(`ADMIN_ROLE must be one of: ${allowed.join(', ')}`);
  // Non-staff accounts get a temporary password the user must replace on first login.
  const mustChangePassword = role === ROLES.STADIUM_OWNER || role === ROLES.STADIUM_MANAGER;

  if (!email.includes('@')) throw new Error('Set ADMIN_EMAIL');
  if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');
  if (!phone) throw new Error('Set ADMIN_PHONE to a valid Somali mobile (e.g. 0634123456)');

  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });

  const passwordHash = await User.hashPassword(password);
  let user = await User.findOne({ email });
  if (user) {
    user.role = role;
    user.mustChangePassword = mustChangePassword;
    user.passwordHash = passwordHash;
    user.status = 'active';
    user.deletedAt = null;
    await user.save();
    console.log(`Updated existing user ${email} to ${role}`);
  } else {
    const phoneTaken = await User.findOne({ phone });
    if (phoneTaken) throw new Error(`Phone ${phone} already belongs to ${phoneTaken.email}`);
    user = await User.create({
      name,
      email,
      phone,
      passwordHash,
      role,
      mustChangePassword,
      authProviders: ['local'],
      isEmailVerified: true,
      isPhoneVerified: true,
    });
    console.log(`Created ${role} ${email}`);
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
