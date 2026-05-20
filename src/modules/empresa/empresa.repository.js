const pool = require('../../config/db');

const findAll = async () => {
  const res = await pool.query(
    `SELECT 
      e.id_empresa,
      e.nombre AS empresa_nombre,
      u.nombre AS propietario_nombre
    FROM empresa e
    LEFT JOIN LATERAL (
      SELECT nombre
      FROM usuario
      WHERE id_empresa = e.id_empresa
        AND rol = 'propietario'
      ORDER BY is_active DESC NULLS LAST, id_usuario DESC
      LIMIT 1
    ) u ON true
    ORDER BY e.id_empresa DESC`);

  return res.rows || null;
};

const findByNombre = async (nombre) => {
  const res = await pool.query(
    'SELECT * FROM empresa WHERE nombre = $1',
    [nombre]
  );

  return res.rows[0] || null;
};

const create = async ({ nombre }) => {
  const res = await pool.query(
    `INSERT INTO empresa (nombre)
     VALUES ($1)
     RETURNING *`,
    [nombre]
  );

  return res.rows[0] || null;
};

const findById = async (id) => {
  const res = await pool.query(
    `SELECT 
      e.id_empresa,
      e.nombre AS empresa_nombre,
      u.nombre AS propietario_nombre
    FROM empresa e
    LEFT JOIN LATERAL (
      SELECT nombre
      FROM usuario
      WHERE id_empresa = e.id_empresa
        AND rol = 'propietario'
      LIMIT 1
    ) u ON true
    WHERE e.id_empresa = $1`,
    [id]
  );

  return res.rows[0] || null;
};

const update = async (id, nombre) => {
  const res = await pool.query(
    `UPDATE empresa
     SET nombre = $2
     WHERE id_empresa = $1
     RETURNING *`,
    [id, nombre ?? null]
  );

  return res.rows[0] || null;
};

module.exports = {
  findAll,
  findById,
  findByNombre,
  create,
  update
};
