const mongoose = require('mongoose');
const env = require('./env');
const { ensureMongoIndexes } = require('./mongoIndexes');

async function connectDB() {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    console.log('[mongo] connected');
  });
  mongoose.connection.on('error', (err) => {
    console.error('[mongo] connection error:', err.message);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[mongo] disconnected');
  });

  try {
    await mongoose.connect(env.mongoUri, {
      serverSelectionTimeoutMS: 8000,
      // Serverless: many short-lived instances share one Atlas cluster, keep each pool small.
      ...(process.env.VERCEL ? { maxPoolSize: 5 } : {}),
    });
  } catch (err) {
    console.error('[mongo] failed to connect:', err.message);
    console.error('[mongo] Check MONGO_URI in server/.env');
    console.error('[mongo] Local example: mongodb://127.0.0.1:27017/kulansiiye');
    throw err;
  }
  await ensureMongoIndexes();
}

module.exports = connectDB;
