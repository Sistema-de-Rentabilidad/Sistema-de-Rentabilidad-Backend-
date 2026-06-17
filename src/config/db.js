// src/config/db.js
const { Pool, types } = require('pg');
const { DATABASE_URL } = require('./env');

types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: DATABASE_URL,

  // Supabase siempre requiere SSL (dev y prod)
  ssl: { rejectUnauthorized: false },

  // ⚡ configuración del pool (optimización)
  max: 10, // máximo conexiones
  idleTimeoutMillis: 30000, // 30s
  connectionTimeoutMillis: 5000 // timeout conexión
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool PostgreSQL:', err.message);
});

module.exports = pool;
