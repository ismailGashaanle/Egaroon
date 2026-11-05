const ApiError = require('../utils/ApiError');
const Stadium = require('../models/Stadium');
const redis = require('../config/redis');

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const FETCH_MS = 12000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const WMO = {
  0: { en: 'Clear', so: 'Cadaan / cadceed' },
  1: { en: 'Mainly clear', so: 'Inta badan caddeed' },
  2: { en: 'Partly cloudy', so: 'Daruuro qayb' },
  3: { en: 'Overcast', so: 'Cirka waa daruuran' },
  45: { en: 'Fog', so: 'Cee' },
  48: { en: 'Rime fog', so: 'Cee qabow' },
  51: { en: 'Light drizzle', so: 'Roob khafiif' },
  53: { en: 'Drizzle', so: 'Roob khafiif' },
  55: { en: 'Dense drizzle', so: 'Roob khafiif xooggan' },
  61: { en: 'Light rain', so: 'Roob yar' },
  63: { en: 'Rain', so: 'Roob' },
  65: { en: 'Heavy rain', so: 'Roob xooggan' },
  66: { en: 'Freezing rain', so: 'Roob qabow' },
  67: { en: 'Heavy freezing rain', so: 'Roob qabow xooggan' },
  71: { en: 'Light snow', so: 'Baraf yar' },
  73: { en: 'Snow', so: 'Baraf' },
  75: { en: 'Heavy snow', so: 'Baraf xooggan' },
  80: { en: 'Rain showers', so: 'Roob daadad' },
  81: { en: 'Rain showers', so: 'Roob daadad' },
  82: { en: 'Violent rain showers', so: 'Roob daadad xooggan' },
  95: { en: 'Thunderstorm', so: 'Onkod / hillaac' },
  96: { en: 'Thunderstorm with hail', so: 'Onkod iyo baraf-dhagax' },
  99: { en: 'Severe thunderstorm', so: 'Onkod aad u xun' },
};

function ymd(d = new Date()) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function ymdLocal(tz = 'Africa/Mogadishu') {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return ymd();
  }
}

function parseDate(raw) {
  const s = String(raw || '').trim() || ymd();
  if (!DATE_RE.test(s)) {
    throw ApiError.badRequest('date must be YYYY-MM-DD');
  }
  const d = new Date(`${s}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw ApiError.badRequest('Invalid date');
  }
  return s;
}

function conditionFor(code) {
  const c = WMO[Number(code)] || { en: 'Unknown', so: 'Lama yaqaan' };
  return { weatherCode: Number(code) || 0, condition: c.en, conditionSo: c.so };
}

async function fetchJson(url) {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), FETCH_MS);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw ApiError.badRequest(`Weather provider error (${res.status})`);
    }
    return res.json();
  } catch (err) {
    if (err.isApiError) throw err;
    if (err.name === 'AbortError') {
      throw ApiError.badRequest('Weather request timed out');
    }
    throw ApiError.badRequest('Weather provider unreachable');
  } finally {
    clearTimeout(t);
  }
}

function pickSomalia(results) {
  const list = Array.isArray(results) ? results : [];
  if (!list.length) return null;
  return list.find((r) => String(r.country_code || '').toUpperCase() === 'SO') || list[0];
}

async function geocode({ q, city, region, country }) {
  const name = String(q || [city, region, country || 'Somalia'].filter(Boolean).join(', ')).trim();
  if (name.length < 2) {
    throw ApiError.badRequest('Provide city, region, or q');
  }
  const url = `${GEO_URL}?name=${encodeURIComponent(name)}&count=8&language=en&format=json`;
  const data = await fetchJson(url);
  const hit = pickSomalia(data.results);
  if (!hit) {
    throw ApiError.notFound(`No place found for "${name}"`);
  }
  return {
    name: hit.name,
    city: hit.name,
    admin1: hit.admin1 || region || '',
    region: hit.admin1 || region || '',
    country: hit.country || country || '',
    countryCode: hit.country_code || '',
    latitude: hit.latitude,
    longitude: hit.longitude,
    timezone: hit.timezone || 'Africa/Mogadishu',
  };
}

function dayDiffFromToday(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((target - today) / 86400000);
}

function dailyAt(pack, dateStr) {
  const idx = (pack.time || []).indexOf(dateStr);
  if (idx < 0) return null;
  const get = (key) => {
    const arr = pack[key];
    return Array.isArray(arr) ? arr[idx] : null;
  };
  return {
    date: dateStr,
    weatherCode: get('weather_code'),
    tempMax: get('temperature_2m_max'),
    tempMin: get('temperature_2m_min'),
    feelsMax: get('apparent_temperature_max'),
    rainMm: get('rain_sum') ?? get('precipitation_sum'),
    precipMm: get('precipitation_sum'),
    rainChance: get('precipitation_probability_max'),
    windKmh: get('wind_speed_10m_max'),
    gustKmh: get('wind_gusts_10m_max'),
    uvIndex: get('uv_index_max'),
    sunrise: get('sunrise'),
    sunset: get('sunset'),
  };
}

function hoursForDate(hourly, dateStr) {
  if (!hourly?.time) return [];
  const out = [];
  for (let i = 0; i < hourly.time.length; i += 1) {
    const stamp = hourly.time[i];
    if (!String(stamp).startsWith(dateStr)) continue;
    const hour = Number(String(stamp).slice(11, 13));
    const { condition, conditionSo, weatherCode } = conditionFor(hourly.weather_code?.[i]);
    out.push({
      time: stamp,
      hour,
      temp: hourly.temperature_2m?.[i] ?? null,
      feels: hourly.apparent_temperature?.[i] ?? null,
      rainMm: hourly.rain?.[i] ?? hourly.precipitation?.[i] ?? null,
      rainChance: hourly.precipitation_probability?.[i] ?? null,
      humidity: hourly.relative_humidity_2m?.[i] ?? null,
      windKmh: hourly.wind_speed_10m?.[i] ?? null,
      cloudCover: hourly.cloud_cover?.[i] ?? null,
      visibilityM: hourly.visibility?.[i] ?? null,
      weatherCode,
      condition,
      conditionSo,
    });
  }
  return out;
}

function buildRisks(day, hours) {
  const risks = [];
  const code = Number(day.weatherCode) || 0;
  const rain = Number(day.rainMm) || 0;
  const chance = Number(day.rainChance) || 0;
  const wind = Number(day.windKmh) || 0;
  const gust = Number(day.gustKmh) || 0;
  const tMax = Number(day.tempMax);
  const tMin = Number(day.tempMin);
  const hourStorm = hours.some((h) => Number(h.weatherCode) >= 95);
  const hourHeavy = hours.some((h) => Number(h.rainMm) >= 4);

  if (code >= 95 || hourStorm) {
    risks.push({
      code: 'THUNDERSTORM',
      severity: 'high',
      title: 'Thunderstorm / lightning',
      titleSo: 'Onkod / hillaac',
      detail: 'Lightning risk — outdoor play is unsafe.',
    });
  }
  if (rain >= 15 || code === 65 || code === 82 || hourHeavy) {
    risks.push({
      code: 'HEAVY_RAIN',
      severity: 'high',
      title: 'Heavy rain',
      titleSo: 'Roob xooggan',
      detail: `${rain.toFixed(1)} mm expected — pitch likely flooded / unplayable.`,
    });
  } else if (rain >= 5 || chance >= 70) {
    risks.push({
      code: 'RAIN',
      severity: 'medium',
      title: 'Rain',
      titleSo: 'Roob',
      detail: `${rain.toFixed(1)} mm · ${chance || '—'}% chance. Pitch may be wet.`,
    });
  } else if (rain >= 1 || chance >= 40) {
    risks.push({
      code: 'LIGHT_RAIN',
      severity: 'low',
      title: 'Light rain possible',
      titleSo: 'Roob khafiif suurtagal',
      detail: `${rain.toFixed(1)} mm · ${chance || '—'}% chance.`,
    });
  }
  if (wind >= 50 || gust >= 70) {
    risks.push({
      code: 'STRONG_WIND',
      severity: 'high',
      title: 'Strong wind',
      titleSo: 'Dabayl xooggan',
      detail: `${Math.round(wind)} km/h (gusts ${Math.round(gust || wind)}).`,
    });
  } else if (wind >= 35) {
    risks.push({
      code: 'WIND',
      severity: 'medium',
      title: 'Windy',
      titleSo: 'Dabayl',
      detail: `${Math.round(wind)} km/h — ball control harder outdoors.`,
    });
  }
  if (Number.isFinite(tMax) && tMax >= 40) {
    risks.push({
      code: 'EXTREME_HEAT',
      severity: 'high',
      title: 'Extreme heat',
      titleSo: 'Kulayl aad u daran',
      detail: `High ${Math.round(tMax)}°C — heat illness risk.`,
    });
  } else if (Number.isFinite(tMax) && tMax >= 35) {
    risks.push({
      code: 'HEAT',
      severity: 'medium',
      title: 'Hot',
      titleSo: 'Kulayl',
      detail: `High ${Math.round(tMax)}°C — extra water / shade.`,
    });
  }
  if (Number.isFinite(tMin) && tMin <= 8) {
    risks.push({
      code: 'COLD',
      severity: 'low',
      title: 'Cold',
      titleSo: 'Qabow',
      detail: `Low ${Math.round(tMin)}°C.`,
    });
  }
  if (code === 45 || code === 48) {
    risks.push({
      code: 'FOG',
      severity: 'medium',
      title: 'Fog / poor visibility',
      titleSo: 'Cee / aragti xun',
      detail: 'Reduced visibility on the pitch.',
    });
  }
  if (Number(day.uvIndex) >= 8) {
    risks.push({
      code: 'HIGH_UV',
      severity: 'low',
      title: 'High UV',
      titleSo: 'UV sare',
      detail: `UV index ${day.uvIndex}.`,
    });
  }

  let level = 'good';
  let label = 'Good for play';
  let labelSo = 'Wanaagsan ciyaar';
  if (risks.some((r) => r.code === 'THUNDERSTORM' || r.code === 'HEAVY_RAIN')) {
    level = 'unplayable';
    label = 'Unplayable / unsafe';
    labelSo = 'Lama ciyaari karo / khatar';
  } else if (risks.some((r) => r.severity === 'high')) {
    level = 'poor';
    label = 'Poor conditions';
    labelSo = 'Xaalad xun';
  } else if (risks.some((r) => r.severity === 'medium')) {
    level = 'caution';
    label = 'Play with caution';
    labelSo = 'Taxaddar';
  }

  return {
    play: { level, label, labelSo },
    risks,
  };
}

function outlookFromDaily(pack) {
  const times = pack.time || [];
  return times.map((date) => {
    const row = dailyAt(pack, date);
    const cond = conditionFor(row?.weatherCode);
    return {
      date,
      tempMin: row?.tempMin ?? null,
      tempMax: row?.tempMax ?? null,
      rainMm: row?.rainMm ?? null,
      rainChance: row?.rainChance ?? null,
      ...cond,
    };
  });
}

async function loadWeather(lat, lng, dateStr, timezone) {
  const diff = dayDiffFromToday(dateStr);
  const dailyForecast =
    'weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,rain_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset';
  const hourlyForecast =
    'temperature_2m,apparent_temperature,precipitation,precipitation_probability,rain,weather_code,wind_speed_10m,relative_humidity_2m,visibility,cloud_cover';
  const dailyArchive =
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,rain_sum,wind_speed_10m_max,sunrise,sunset';
  const hourlyArchive =
    'temperature_2m,precipitation,rain,weather_code,wind_speed_10m,relative_humidity_2m';
  const common = `latitude=${lat}&longitude=${lng}&timezone=${encodeURIComponent(timezone || 'auto')}`;

  let url;
  let dailyVars = dailyForecast;
  if (diff >= -90 && diff <= 16) {
    url = `${FORECAST_URL}?${common}&start_date=${dateStr}&end_date=${dateStr}&daily=${dailyForecast}&hourly=${hourlyForecast}`;
  } else if (diff < -90) {
    dailyVars = dailyArchive;
    url = `${ARCHIVE_URL}?${common}&start_date=${dateStr}&end_date=${dateStr}&daily=${dailyArchive}&hourly=${hourlyArchive}`;
  } else {
    throw ApiError.badRequest('Forecast is available up to 16 days ahead');
  }

  const data = await fetchJson(url);
  const day = dailyAt(data.daily || {}, dateStr);
  if (!day) {
    throw ApiError.notFound('No weather for that date');
  }
  const hours = hoursForDate(data.hourly || {}, dateStr);
  const { play, risks } = buildRisks(day, hours);
  const cond = conditionFor(day.weatherCode);
  const midday = hours.find((h) => h.hour === 12) || hours[Math.floor(hours.length / 2)];

  let outlook = [];
  if (diff >= -1 && diff <= 7) {
    try {
      const end = new Date(`${dateStr}T12:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 6);
      const endStr = ymd(end);
      const oUrl = `${FORECAST_URL}?${common}&start_date=${dateStr}&end_date=${endStr}&daily=${dailyVars}`;
      const oData = await fetchJson(oUrl);
      outlook = outlookFromDaily(oData.daily || {});
    } catch {
      outlook = [];
    }
  }

  return {
    date: dateStr,
    isForecast: diff >= -90 && diff <= 16 && diff >= -5,
    isHistorical: diff < -5,
    timezone: data.timezone || timezone || 'auto',
    utcOffsetSeconds: data.utc_offset_seconds,
    summary: {
      ...cond,
      tempMin: day.tempMin,
      tempMax: day.tempMax,
      tempNow: midday?.temp ?? null,
      feelsMax: day.feelsMax,
      rainMm: day.rainMm,
      precipMm: day.precipMm,
      rainChance: day.rainChance,
      windKmh: day.windKmh,
      gustKmh: day.gustKmh,
      humidity: midday?.humidity ?? null,
      uvIndex: day.uvIndex,
      sunrise: day.sunrise,
      sunset: day.sunset,
    },
    play,
    risks,
    hours,
    outlook,
  };
}

async function resolvePlace(query) {
  const lat = query.lat != null && query.lat !== '' ? Number(query.lat) : NaN;
  const lng = query.lng != null && query.lng !== '' ? Number(query.lng) : NaN;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return {
      name: query.q || query.city || 'Coordinates',
      city: query.city || '',
      region: query.region || '',
      country: query.country || '',
      latitude: lat,
      longitude: lng,
      timezone: query.timezone || 'Africa/Mogadishu',
    };
  }

  if (query.stadiumId) {
    const stadium = await Stadium.findById(query.stadiumId).select(
      'name city region area address latLng'
    );
    if (!stadium) throw ApiError.notFound('Stadium not found');
    const slat = stadium.latLng?.lat;
    const slng = stadium.latLng?.lng;
    if (Number.isFinite(slat) && Number.isFinite(slng)) {
      return {
        name: stadium.name,
        city: stadium.city || '',
        region: stadium.region || '',
        country: 'Somalia',
        latitude: slat,
        longitude: slng,
        timezone: 'Africa/Mogadishu',
        stadiumId: String(stadium._id),
      };
    }
    const geo = await geocode({
      city: stadium.city || stadium.area,
      region: stadium.region,
      q: [stadium.city, stadium.region, stadium.name].filter(Boolean).join(', '),
    });
    return { ...geo, name: stadium.name, stadiumId: String(stadium._id) };
  }

  return geocode(query);
}

/**
 * Weather + rain + outdoor match risks for a day and place.
 * Place: stadiumId, lat/lng, or city/region/q.
 */
async function lookup(query = {}) {
  const dateStr = parseDate(query.date);
  const place = await resolvePlace(query);
  const cacheKey = `weather:v1:${Number(place.latitude).toFixed(3)}:${Number(place.longitude).toFixed(3)}:${dateStr}`;
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { ...JSON.parse(cached), cached: true };
    }
  } catch {
    /* ignore cache */
  }

  const wx = await loadWeather(place.latitude, place.longitude, dateStr, place.timezone);
  const payload = {
    source: 'open-meteo',
    cached: false,
    place,
    ...wx,
  };
  const ttl = wx.isHistorical ? 7 * 24 * 3600 : 20 * 60;
  try {
    await redis.setEx(cacheKey, ttl, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
  return payload;
}

const WeatherCity = require('../models/WeatherCity');

const DEFAULT_CITIES = [
  {
    slug: 'hargeisa',
    name: 'Hargeisa',
    nameSo: 'Hargeysa',
    aliases: ['Hargeysa', 'Hargeisa'],
    region: 'Maroodi Jeex',
    latitude: 9.56,
    longitude: 44.065,
  },
  {
    slug: 'muqdisho',
    name: 'Mogadishu',
    nameSo: 'Muqdisho',
    aliases: ['Muqdisho', 'Mogadishu', 'Mogadiscio', 'Xamar'],
    region: 'Banaadir',
    latitude: 2.03711,
    longitude: 45.34375,
  },
  {
    slug: 'burao',
    name: 'Burao',
    nameSo: 'Burco',
    aliases: ['Burco', 'Burao'],
    region: 'Togdheer',
    latitude: 9.522,
    longitude: 45.534,
  },
  {
    slug: 'borama',
    name: 'Borama',
    nameSo: 'Boorama',
    aliases: ['Boorama', 'Boroma', 'Borama'],
    region: 'Awdal',
    latitude: 9.936,
    longitude: 43.184,
  },
];

const LEVEL_RANK = { good: 0, caution: 1, poor: 2, unplayable: 3 };

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function addDaysYmd(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

function worstDay(snapshots = []) {
  let worst = null;
  for (const row of snapshots) {
    const level = row?.play?.level || 'good';
    if (!worst || LEVEL_RANK[level] > LEVEL_RANK[worst.play?.level || 'good']) {
      worst = row;
    }
  }
  return worst;
}

function toPublicCity(doc) {
  const o = doc?.toObject ? doc.toObject() : { ...doc };
  return {
    id: String(o._id),
    slug: o.slug,
    name: o.name,
    nameSo: o.nameSo || o.name,
    aliases: o.aliases || [],
    region: o.region || '',
    latitude: o.latitude,
    longitude: o.longitude,
    timezone: o.timezone,
    active: o.active !== false,
    isDefault: Boolean(o.isDefault),
    lastPlayLevel: o.lastPlayLevel || null,
    lastFetchedAt: o.lastFetchedAt || null,
    lastSnapshot: o.lastSnapshot || null,
    outlook: o.outlook || [],
  };
}

async function ensureDefaultCities() {
  for (const row of DEFAULT_CITIES) {
    await WeatherCity.findOneAndUpdate(
      { slug: row.slug },
      {
        $setOnInsert: {
          ...row,
          timezone: 'Africa/Mogadishu',
          active: true,
          isDefault: true,
        },
      },
      { upsert: true, returnDocument: 'after' }
    );
  }
}

async function listCities() {
  await ensureDefaultCities();
  const docs = await WeatherCity.find({ active: true }).sort({ nameSo: 1, name: 1 });
  return docs.map(toPublicCity);
}

async function addCity({ name, region, nameSo } = {}) {
  const label = String(name || '').trim();
  if (label.length < 2) throw ApiError.badRequest('City name is required');
  await ensureDefaultCities();
  const slug = slugify(nameSo || label);
  const safe = escapeRegex(label);
  const existing = await WeatherCity.findOne({
    $or: [
      { slug },
      { name: new RegExp(`^${safe}$`, 'i') },
      { nameSo: new RegExp(`^${safe}$`, 'i') },
      { aliases: new RegExp(`^${safe}$`, 'i') },
    ],
  });
  if (existing) {
    if (!existing.active) {
      existing.active = true;
      await existing.save();
      return toPublicCity(existing);
    }
    throw ApiError.conflict(`City already tracked: ${existing.nameSo || existing.name}`);
  }
  const geo = await geocode({ city: label, region, country: 'Somalia' });
  const doc = await WeatherCity.create({
    slug: slug || slugify(geo.name),
    name: geo.name || label,
    nameSo: nameSo || label,
    aliases: [...new Set([label, geo.name, nameSo].filter(Boolean))],
    region: region || geo.region || geo.admin1 || '',
    latitude: geo.latitude,
    longitude: geo.longitude,
    timezone: geo.timezone || 'Africa/Mogadishu',
    active: true,
    isDefault: false,
  });
  try {
    await refreshCity(doc);
  } catch (err) {
    console.warn('[weather] refresh after add failed', err.message);
  }
  return toPublicCity(await WeatherCity.findById(doc._id));
}

async function removeCity(cityId) {
  const doc = await WeatherCity.findById(cityId);
  if (!doc) throw ApiError.notFound('City not found');
  if (doc.isDefault) {
    throw ApiError.badRequest('Default cities (Hargeisa, Muqdisho, Burao, Borama) cannot be removed — deactivate via support if needed.');
  }
  doc.active = false;
  await doc.save();
  return { id: String(doc._id), removed: true };
}

async function refreshCity(cityDoc, { days = 2 } = {}) {
  const city =
    cityDoc && cityDoc.slug && typeof cityDoc.save === 'function'
      ? cityDoc
      : await WeatherCity.findById(cityDoc);
  if (!city || !city.active) throw ApiError.notFound('City not found');
  const start = ymdLocal(city.timezone);
  const snapshots = [];
  for (let i = 0; i < days; i += 1) {
    const dateStr = addDaysYmd(start, i);
    const wx = await lookup({
      lat: city.latitude,
      lng: city.longitude,
      date: dateStr,
      city: city.name,
      timezone: city.timezone,
    });
    snapshots.push({
      date: dateStr,
      play: wx.play,
      risks: wx.risks || [],
      summary: wx.summary,
    });
  }
  const worst = worstDay(snapshots) || snapshots[0];
  city.lastSnapshot = snapshots[0] || null;
  city.outlook = snapshots;
  city.lastPlayLevel = worst?.play?.level || 'good';
  city.lastFetchedAt = new Date();
  await city.save();

  if (LEVEL_RANK[city.lastPlayLevel] >= LEVEL_RANK.caution && Boolean(require('./platformSettings.service').getBusiness().weatherEnabled)) {
    try {
      await notifyCityRisk(city, worst);
    } catch (err) {
      console.warn('[weather] notify failed', city.slug, err.message);
    }
  }
  return toPublicCity(city);
}

async function refreshAll(opts = {}) {
  await ensureDefaultCities();
  const cities = await WeatherCity.find({ active: true });
  const results = [];
  for (const city of cities) {
    try {
      results.push(await refreshCity(city, opts));
    } catch (err) {
      console.warn('[weather] refresh city failed', city.slug, err.message);
      results.push({ id: String(city._id), slug: city.slug, error: err.message });
    }
  }
  return results;
}

function isAlertLevel(level) {
  return LEVEL_RANK[level] >= LEVEL_RANK.caution;
}

async function listAlerts({ date } = {}) {
  await ensureDefaultCities();
  const dateStr = date ? parseDate(date) : ymdLocal();
  let cities = await WeatherCity.find({ active: true }).sort({ nameSo: 1, name: 1 });
  const neverFetched = cities.filter((c) => !c.lastFetchedAt);
  if (neverFetched.length) {
    for (const city of neverFetched) {
      try {
        await refreshCity(city);
      } catch {
        /* keep empty snapshot */
      }
    }
    cities = await WeatherCity.find({ active: true }).sort({ nameSo: 1, name: 1 });
  }
  const fresh = cities;
  const alerts = [];
  for (const city of fresh) {
    const day =
      (city.outlook || []).find((o) => o.date === dateStr) ||
      (city.lastSnapshot?.date === dateStr ? city.lastSnapshot : null) ||
      city.lastSnapshot;
    const level = day?.play?.level || city.lastPlayLevel;
    if (!isAlertLevel(level)) continue;
    alerts.push({
      id: `${city.slug}-${day?.date || dateStr}`,
      cityId: String(city._id),
      slug: city.slug,
      city: city.name,
      citySo: city.nameSo || city.name,
      region: city.region || '',
      date: day?.date || dateStr,
      level,
      play: day?.play || { level },
      risks: day?.risks || [],
      summary: day?.summary || null,
      headlineSo: alertHeadlineSo(level, city, day),
      headline: alertHeadlineEn(level, city, day),
    });
  }
  alerts.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level]);
  return {
    date: dateStr,
    alerts,
    cities: fresh.map(toPublicCity),
  };
}

function rainHint(day) {
  const mm = day?.summary?.rainMm;
  const chance = day?.summary?.rainChance;
  if (mm != null && Number(mm) > 0) return `${Number(mm).toFixed(1)} mm roob`;
  if (chance != null) return `${Math.round(chance)}% roob`;
  return day?.risks?.[0]?.titleSo || day?.play?.labelSo || '';
}

function alertHeadlineSo(level, city, day) {
  const place = city.nameSo || city.name;
  const rain = rainHint(day);
  if (level === 'unplayable') {
    return `${place}: lama ciyaari karo — ${rain || 'roob / onkod'}`.trim();
  }
  if (level === 'poor') {
    return `${place}: xaalad xun ciyaarta — ${rain || 'roob ama dabayl'}`.trim();
  }
  return `${place}: taxaddar — ${rain || 'roob suurtagal'}`.trim();
}

function alertHeadlineEn(level, city, day) {
  const place = city.name;
  if (level === 'unplayable') return `${place}: unsafe / unplayable`;
  if (level === 'poor') return `${place}: poor conditions for play`;
  return `${place}: play with caution`;
}

async function notifyCityRisk(city, day) {
  const level = day?.play?.level;
  if (!isAlertLevel(level)) return;
  const dateStr = day.date || ymd();
  const eventKey = `weather:${city.slug}:${dateStr}:${level}`;
  const stadiums = await Stadium.find({
    status: 'approved',
    $or: matchCityQuery(city),
  }).select('_id city name');

  const { notifyStadiumStaff } = require('./notification.service');
  const title = 'Digniin cimilo';
  const body = alertHeadlineSo(level, city, day);
  for (const stadium of stadiums) {
    await notifyStadiumStaff({
      stadiumId: stadium._id,
      type: 'WEATHER_RISK',
      title,
      body,
      eventKey: `${eventKey}:${stadium._id}`,
      socketEvent: 'weather:alert',
      meta: {
        kind: 'WEATHER_RISK',
        city: city.nameSo || city.name,
        slug: city.slug,
        date: dateStr,
        level,
      },
    });
  }
}

function matchCityQuery(city) {
  const names = [...new Set([city.name, city.nameSo, ...(city.aliases || [])].filter(Boolean))];
  return names.map((n) => ({ city: new RegExp(`^${escapeRegex(n)}$`, 'i') }));
}

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  lookup,
  ensureDefaultCities,
  listCities,
  addCity,
  removeCity,
  refreshCity,
  refreshAll,
  listAlerts,
};

