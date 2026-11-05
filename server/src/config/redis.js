const Redis = require('ioredis');
const env = require('./env');

/**
 * Redis is used for short-lived booking slot locks (SET NX EX).
 * In development (or when REDIS_ENABLED=false / Redis unreachable), we fall back
 * to an in-process Map. That is fine for a single Node process — multi-instance
 * deployments need a real Redis.
 */

let client = null;
let redisAvailable = false;
let usingMemory = false;
let initPromise = null;

/** @type {Map<string, { value: string, expiresAt: number }>} */
const memoryStore = new Map();

function cleanupExpiredMemoryKeys() {
  const now = Date.now();
  for (const [key, entry] of memoryStore) {
    if (entry.expiresAt <= now) memoryStore.delete(key);
  }
}

function memorySetEx(key, value, ttlSec) {
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

function memorySetNxEx(key, value, ttlSec) {
  cleanupExpiredMemoryKeys();
  const existing = memoryStore.get(key);
  if (existing && existing.expiresAt > Date.now()) {
    return null;
  }
  memoryStore.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
  return 'OK';
}

function memoryDel(key) {
  memoryStore.delete(key);
}

function switchToMemory(reason) {
  if (usingMemory && !redisAvailable) return;
  usingMemory = true;
  redisAvailable = false;
  console.warn(`[redis] ${reason}`);
  console.warn(
    '[redis] using in-memory lock store (single-process only — start Redis or set REDIS_URL for multi-instance)'
  );
}

/**
 * Probe Redis once (lazy). Safe to call repeatedly.
 * Never throws — falls back to memory on failure / REDIS_ENABLED=false.
 */
function initRedis() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    if (!env.redisEnabled) {
      switchToMemory('REDIS_ENABLED=false — skipping Redis');
      return;
    }

    try {
      client = new Redis(env.redisUrl, {
        maxRetriesPerRequest: 1,
        connectTimeout: 3000,
        enableOfflineQueue: false,
        lazyConnect: true,
        retryStrategy(times) {
          if (times > 3) return null;
          return Math.min(times * 200, 1000);
        },
      });

      client.on('connect', () => {
        console.log('[redis] connected');
      });

      client.on('ready', () => {
        redisAvailable = true;
        usingMemory = false;
      });

      client.on('error', (err) => {
        // Avoid spamming stack traces — message is enough
        console.error('[redis] error:', err.message);
      });

      client.on('end', () => {
        redisAvailable = false;
      });

      await client.connect();
      await client.ping();
      redisAvailable = true;
      usingMemory = false;
      console.log('[redis] ready');
    } catch (err) {
      if (client) {
        try {
          client.disconnect();
        } catch {
          /* ignore */
        }
        client = null;
      }
      redisAvailable = false;
      const hint =
        env.nodeEnv === 'production'
          ? 'production without Redis — locks are in-process only; multi-instance is unsafe'
          : `unavailable (${err.message}) — continuing with memory fallback`;
      switchToMemory(hint);
    }
  })();

  return initPromise;
}

function getRedisClient() {
  return client;
}

function isRedisAvailable() {
  return redisAvailable;
}

function isUsingMemoryFallback() {
  return usingMemory || !redisAvailable;
}

/**
 * SET key value EX ttl NX — returns 'OK' if acquired, null if already held.
 */
async function setNxEx(key, ttlSec, value = '1') {
  await initRedis();

  if (redisAvailable && client) {
    try {
      return await client.set(key, value, 'EX', ttlSec, 'NX');
    } catch (err) {
      switchToMemory(`command failed (${err.message})`);
      return memorySetNxEx(key, value, ttlSec);
    }
  }

  return memorySetNxEx(key, value, ttlSec);
}

/** SET key value EX ttl — overwrites. Used for one-time OAuth exchange codes. */
async function setEx(key, ttlSec, value) {
  await initRedis();
  if (redisAvailable && client) {
    try {
      return await client.set(key, value, 'EX', ttlSec);
    } catch (err) {
      switchToMemory(`setEx failed (${err.message})`);
      memorySetEx(key, value, ttlSec);
      return 'OK';
    }
  }
  memorySetEx(key, value, ttlSec);
  return 'OK';
}

async function del(key) {
  await initRedis();

  if (redisAvailable && client) {
    try {
      await client.del(key);
      return;
    } catch (err) {
      console.warn('[redis] del failed, clearing memory key:', err.message);
    }
  }

  memoryDel(key);
}

function memoryGet(key) {
  cleanupExpiredMemoryKeys();
  const entry = memoryStore.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memoryIncr(key, ttlSec) {
  cleanupExpiredMemoryKeys();
  const existing = memoryStore.get(key);
  const now = Date.now();
  if (!existing || existing.expiresAt <= now) {
    memoryStore.set(key, { value: '1', expiresAt: now + ttlSec * 1000 });
    return 1;
  }
  const next = Number(existing.value || 0) + 1;
  memoryStore.set(key, { value: String(next), expiresAt: existing.expiresAt });
  return next;
}

/** GET string value or null. */
async function get(key) {
  await initRedis();
  if (redisAvailable && client) {
    try {
      return await client.get(key);
    } catch (err) {
      switchToMemory(`get failed (${err.message})`);
      return memoryGet(key);
    }
  }
  return memoryGet(key);
}

/**
 * INCR key; set EX ttlSec on first increment.
 * Returns the new count.
 */
async function incr(key, ttlSec = 900) {
  await initRedis();
  if (redisAvailable && client) {
    try {
      const count = await client.incr(key);
      if (count === 1) await client.expire(key, ttlSec);
      return count;
    } catch (err) {
      switchToMemory(`incr failed (${err.message})`);
      return memoryIncr(key, ttlSec);
    }
  }
  return memoryIncr(key, ttlSec);
}

module.exports = {
  getRedisClient,
  initRedis,
  isRedisAvailable,
  isUsingMemoryFallback,
  setNxEx,
  setEx,
  del,
  get,
  incr,
};
