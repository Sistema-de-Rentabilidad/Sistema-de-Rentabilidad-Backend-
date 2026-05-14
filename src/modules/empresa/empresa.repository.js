const pool = require('../../config/db');

const findAll = async () => {
  const result = await pool.query(`
    SELECT 
      e.id_empresa,
      e.nombre AS empresa_nombre,
      u.nombre AS propietario_nombre
    FROM empresa e
    LEFT JOIN usuario u 
      ON u.id_empresa = e.id_empresa 
      AND u.rol = 'propietario'
    ORDER BY e.id_empresa DESC
  `);

  return result.rows;
};

const findById = async (id) => {
  const result = await pool.query(
    'SELECT * FROM empresa WHERE id_empresa = $1',
    [id]
  );
  return result.rows[0];
};

const findByName = async (nombre) => {
  const result = await pool.query(
    'SELECT * FROM empresa WHERE nombre = $1',
    [nombre]
  );

  return result.rows[0];
};

const create = async ({ nombre }) => {
  const result = await pool.query(
    `INSERT INTO empresa (nombre)
     VALUES ($1)
     RETURNING id_empresa, nombre`,
    [nombre]
  );

  return result.rows[0];
};

const update = async (id, nombre) => {
  const result = await pool.query(
    `UPDATE empresa
     SET nombre = $1
     WHERE id_empresa = $2
     RETURNING id_empresa, nombre`,
    [nombre, id]
  );

  return result.rows[0];
};

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  update
};