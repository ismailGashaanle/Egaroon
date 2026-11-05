/**
 * Dynamic regional support contacts (city / xafad / phone).
 */
const env = require('./env');

function getDefaultSupport() {
  try {
    const { getBusiness } = require('../services/platformSettings.service');
    return getBusiness().support || env.support;
  } catch {
    return env.support;
  }
}

const OFFICES = [
  {
    id: 'hq',
    region: 'Woqooyi Galbeed',
    city: 'Hargeisa',
    area: 'Xaafadda Shacabka',
    hours: '08:00 – 22:00',
  },

];

function listContacts({ city, region } = {}) {
  const def = getDefaultSupport();
  let rows = OFFICES.map((o) => ({
    ...o,
    phone: o.phone || def.phone,
    email: o.email || def.email,
    whatsapp: o.whatsapp || def.whatsapp,
  }));
  if (city) {
    const c = String(city).toLowerCase();
    rows = rows.filter((r) => r.city.toLowerCase().includes(c));
  }
  if (region) {
    const g = String(region).toLowerCase();
    rows = rows.filter((r) => r.region.toLowerCase().includes(g));
  }
  return {
    default: {
      phone: def.phone,
      email: def.email,
      whatsapp: def.whatsapp,
    },
    contacts: rows.length ? rows : OFFICES.map((o) => ({ ...o, phone: def.phone, email: def.email, whatsapp: def.whatsapp })),
  };
}

module.exports = { listContacts, OFFICES };
