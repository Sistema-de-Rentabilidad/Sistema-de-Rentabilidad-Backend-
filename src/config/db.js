// src/config/db.js
const { Pool, types } = require('pg');
const { DATABASE_URL, DB_CONNECTION_TIMEOUT_MS } = require('./env');

types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: DATABASE_URL,

  // Supabase siempre requiere SSL (dev y prod)
  ssl: { rejectUnauthorized: false },

  // ⚡ configuración del pool (optimización)
  max: 20, // máximo conexiones
  idleTimeoutMillis: 30000, // 30s
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS // timeout conexión
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool PostgreSQL:', err.message);
});

module.exports = pool;
