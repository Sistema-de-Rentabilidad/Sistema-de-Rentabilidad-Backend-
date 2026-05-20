const pool = require("../../config/db");

// admin
const findOnlypropietario = async (currentUserId) => {
  const result = await pool.query(`
    SELECT 
      u.id_usuario,
      u.nombre,
      u.email,
      u.is_active,
      u.id_empresa,
      e.nombre AS empresa_nombre
    FROM usuario u
    INNER JOIN empresa e ON u.id_empresa = e.id_empresa
    WHERE u.rol = 'propietario'
      AND u.is_active = true
      AND u.id_usuario != $1
    ORDER BY u.id_usuario ASC
  `, [currentUserId]);

  return result.rows;
};

// propietario
const findByEmpresa = async (id_empresa, currentUserId) => {
  const result = await pool.query(
    `SELECT id_usuario, nombre, email, rol, is_active
     FROM usuario
     WHERE id_empresa = $1 AND is_active IS NOT FALSE AND id_usuario != $2`,
    [id_empresa, currentUserId]
  );
  return result.rows || null;
};

const findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM usuario WHERE email = $1",
    [email]
  );
  return result.rows[0] || null;
};

const findPropietarioByEmpresa = async (id_empresa) => {
  const result = await pool.query(
    `SELECT id_usuario 
     FROM usuario
     WHERE id_empresa = $1 
     AND rol = 'propietario'
     AND is_active = true`,
    [id_empresa]
  );

  return result.rows[0];
};

const create = async ({ nombre, email, password, rol, id_empresa }) => {
  const result = await pool.query(
    `INSERT INTO usuario (nombre, email, password, rol, id_empresa, is_active)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id_usuario, nombre, email, rol, id_empresa, is_active`,
    [nombre, email, password, rol, id_empresa]
  );
  return result.rows[0];
};

const findById = async (id) => {
  const result = await pool.query(
    `SELECT
      u.id_usuario,
      u.nombre,
      u.email,
      u.rol,
      u.id_empresa,
      hs.tipo_pago,
      hs.monto,
      hs.horas_mensuales
    FROM usuario u
    LEFT JOIN historial_sueldo hs
      ON hs.id_usuario = u.id_usuario
      AND hs.fecha_fin IS NULL
    WHERE u.id_usuario = $1
      AND u.is_active = true`,
    [id]
  );

  return result.rows[0] || null;
};

const findByIdFull = async (id) => {
  const result = await pool.query(
    `SELECT *
     FROM usuario
     WHERE id_usuario = $1`,
    [id]
  );

  return result.rows[0] || null;
};

const findByIds = async (ids) => {
  const res = await pool.query(
    `SELECT id_usuario, id_empresa, rol
     FROM usuario 
     WHERE id_usuario = ANY($1)`,
    [ids]
  );

  return res.rows;
};

const update = async (id_usuario, { nombre, email, password }) => {
  const result = await pool.query(
    `UPDATE usuario
     SET
       nombre = COALESCE($1, nombre),
       email = COALESCE($2, email),
       password = COALESCE($3, password)
     WHERE id_usuario = $4
     RETURNING *`,
    [nombre, email, password, id_usuario]
  );

  return result.rows[0];
};

const desactivar = async (id_usuario) => {
  const result = await pool.query(
    `UPDATE usuario
     SET is_active = false
     WHERE id_usuario = $1
     RETURNING id_usuario, nombre, email, rol, id_empresa, is_active`,
    [id_usuario]
  );

  return result.rows[0];
};

module.exports = {
  findOnlypropietario,
  findByEmpresa,
  findByEmail,
  findPropietarioByEmpresa,
  create,
  findById,
  findByIdFull,
  findByIds,
  update,
  desactivar
};
