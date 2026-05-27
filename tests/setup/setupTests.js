const path = require('path');
const dotenv = require('dotenv');

process.env.NODE_ENV = 'qa';

dotenv.config({
  path: path.resolve(__dirname, '../../.env.qa'),
  quiet: true,
});

afterAll(async () => {
  const dbPath = require.resolve('../../src/config/db');
  const cachedDb = require.cache[dbPath];

  if (cachedDb?.exports?.end) {
    await cachedDb.exports.end();
  }
});
