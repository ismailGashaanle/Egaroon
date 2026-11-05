/**
 * Rewrite the old brand name inside the saved Site Content (hero, testimonials, policies, contact).
 *
 *   node scripts/rebrand-site-content.js            # preview only, writes nothing
 *   node scripts/rebrand-site-content.js --apply    # save the changes
 *
 * Only plain text is touched: URLs (images, links) are left alone.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');

const APPLY = process.argv.includes('--apply');

function rebrand(text) {
  return text
    .replace(/\bsupport@kulansiiye\.com\b/g, 'support@egaroon.com')
    .replace(/\bKULANSIIYE\b/g, 'E-GAROON')
    .replace(/\bKulansiiye\b/g, 'E-Garoon');
}

function walk(node, path, changes) {
  if (typeof node === 'string') {
    if (/^https?:\/\//i.test(node.trim())) return node;
    const next = rebrand(node);
    if (next !== node) changes.push({ path, before: node, after: next });
    return next;
  }
  if (Array.isArray(node)) return node.map((v, i) => walk(v, `${path}[${i}]`, changes));
  if (node && typeof node === 'object' && !(node instanceof Date) && !(node._bsontype)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = k === '_id' ? v : walk(v, path ? `${path}.${k}` : k, changes);
    return out;
  }
  return node;
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  const col = mongoose.connection.collection('sitecontents');
  const doc = await col.findOne({ key: 'default' });
  if (!doc) {
    console.log('No saved site content — nothing to change.');
    return;
  }

  const changes = [];
  const updated = walk(doc, '', changes);

  for (const c of changes) {
    const i = c.before.search(/kulansiiye/i);
    const snip = (s) => s.slice(Math.max(0, i - 25), i + 45).replace(/\s+/g, ' ');
    console.log(`${c.path}\n   - …${snip(c.before)}…\n   + …${snip(c.after)}…`);
  }
  console.log(`\n${changes.length} field(s) contain the old brand name.`);

  if (!changes.length) return;
  if (!APPLY) {
    console.log('Preview only. Re-run with --apply to save.');
    return;
  }
  const { _id, ...rest } = updated;
  await col.updateOne({ _id: doc._id }, { $set: rest });
  console.log('Saved.');
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
