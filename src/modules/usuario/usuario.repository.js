const pool = require("../../config/db");

const findById = async (usuarioId) => {
  const result = await pool.query(
    `SELECT id_usuario, nombre, email, rol, id_empresa
     FROM usuario WHERE id_usuario = $1 AND is_active= true LIMIT 1`,
    [usuarioId]
  );
  return result.rows[0] || null;
};

// const findAllOwners = async () => {
//   const result = await pool.query(`
//     SELECT
//       u.id_usuario,
//       u.nombre,
//       u.email,
//       u.is_active,
//       u.id_empresa,
//       e.nombre AS empresa_nombre
//     FROM usuario u
//     LEFT JOIN empresa e ON u.id_empresa = e.id_empresa
//     WHERE u.rol = 'propietario'
//     ORDER BY u.id_usuario ASC
//   `);
//   return result.rows;
// };

// 👑 admin
const findOnlypropietario = async (currentUserId) => {
  const result = await pool.query(`
    SELECT 
      u.id_usuario,
      u.nombre,
      u.email,
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

// 🏢 propietario
const findByEmpresa = async (id_empresa, currentUserId) => {
  const result = await pool.query(
    `SELECT id_usuario, nombre, email, rol, is_active
     FROM usuario
     WHERE id_empresa = $1 AND is_active IS NOT FALSE AND id_usuario != $2`,
    [id_empresa, currentUserId]
  );
  return result.rows;
};

// const findByEmpresaRole = async (id_empresa, rol) => {
//   const result = await pool.query(
//     `SELECT id_usuario, nombre, email, rol, is_active
//      FROM usuario
//      WHERE id_empresa = $1 AND rol = $2 AND is_active IS NOT FALSE`,
//     [id_empresa, rol]
//   );
//   return result.rows;
// };

const findByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM usuario WHERE email = $1",
    [email]
  );
  return result.rows[0];
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

const update = async (id, { nombre, email, password, id_empresa, is_active, rol }) => {
  const result = await pool.query(
    `UPDATE usuario
     SET nombre      = COALESCE($2, nombre),
         email       = COALESCE($3, email),
         password    = COALESCE($4, password),
         id_empresa  = COALESCE($5, id_empresa),
         is_active   = COALESCE($6, is_active),
         rol         = COALESCE($7, rol)
     WHERE id_usuario = $1
     RETURNING id_usuario, nombre, email, rol, id_empresa, is_active`,
    [id, nombre || null, email || null, password || null,
      id_empresa !== undefined ? id_empresa : null,
      is_active !== undefined ? is_active : null,
      rol !== undefined ? rol : null]
  );
  return result.rows[0];
};

const deactivate = async (id) => {
  const result = await pool.query(
    `UPDATE usuario SET is_active = false WHERE id_usuario = $1
     RETURNING id_usuario, nombre, is_active`,
    [id]
  );
  return result.rows[0];
};

const hardDelete = async (id) => {
  // Remove from junction tables first to avoid FK violations
  await pool.query("DELETE FROM proyecto_empleado WHERE id_empleado = $1", [id]).catch(() => { });
  await pool.query("DELETE FROM proyecto_lider   WHERE id_lider    = $1", [id]).catch(() => { });
  await pool.query("DELETE FROM registro_horas   WHERE id_empleado = $1", [id]).catch(() => { });
  const result = await pool.query(
    "DELETE FROM usuario WHERE id_usuario = $1 RETURNING id_usuario, nombre",
    [id]
  );
  return result.rows[0];
};

module.exports = {
  findById,
  // findAllOwners,
  findOnlypropietario,
  findByEmpresa,
  // findByEmpresaRole,
  findByEmail,
  findPropietarioByEmpresa,
  create,
  update,
  deactivate,
  hardDelete,
};
