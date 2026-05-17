const pool = require("../../config/db");

const findByEmpresaId = async (empresaId) => {
  const result = await pool.query(
    `SELECT
        s.id_servicio,
        s.nombre,
        s.descripcion,
        e.nombre AS empresa
     FROM servicio s
     INNER JOIN empresa e
        ON e.id_empresa = s.id_empresa
     WHERE s.id_empresa = $1
     AND s.is_active = true
     ORDER BY s.is_active DESC, s.nombre ASC`,
    [empresaId]
  );

  return result.rows;
};

const findByNombreAndEmpresa = async (nombre, empresaId, servicioId = null) => {
  let query = `
    SELECT id_servicio, nombre
    FROM servicio
    WHERE LOWER(nombre) = LOWER($1)
    AND id_empresa = $2
  `;

  const params = [nombre.trim(), empresaId];

  if (servicioId) {
    query += ` AND id_servicio != $3`;
    params.push(servicioId);
  }

  const result = await pool.query(query, params);
  return result.rows[0];
};

const create = async ({ nombre, descripcion, empresaId }) => {
  const result = await pool.query(
    `INSERT INTO servicio (
        id_empresa,
        nombre,
        descripcion,
        is_active
     )
     VALUES ($1, $2, $3, true)
     RETURNING
        id_servicio,
        nombre,
        descripcion,
        id_empresa`,
    [empresaId, nombre, descripcion]
  );

  return result.rows[0];
};

const findById = async (servicioId) => {
  const result = await pool.query(
    `SELECT
        s.id_servicio,
        s.id_empresa,
        s.nombre,
        s.descripcion,
        e.nombre AS empresa
     FROM servicio s
     INNER JOIN empresa e
        ON e.id_empresa = s.id_empresa
     WHERE s.id_servicio = $1
       AND s.is_active = true`,
    [servicioId]
  );

  return result.rows[0];
};

const findByIdFull = async (servicioId) => {
  const result = await pool.query(
    `SELECT *
     FROM servicio
     WHERE id_servicio = $1`,
    [servicioId]
  );

  return result.rows[0];
};

const update = async (servicioId, { nombre, descripcion }) => {
  const result = await pool.query(
    `UPDATE servicio
     SET nombre = COALESCE($2, nombre),
         descripcion = COALESCE($3, descripcion)
     WHERE id_servicio = $1
     RETURNING id_servicio, nombre, descripcion, id_empresa`,
    [servicioId, nombre || null, descripcion || null]
  );

  return result.rows[0];
};

const desactivar = async (servicioId) => {
  const result = await pool.query(
    `UPDATE servicio
     SET is_active = false
     WHERE id_servicio = $1
     RETURNING id_servicio, nombre, is_active`,
    [servicioId]
  );

  return result.rows[0];
};

const countProyectosByServicio = async (servicioId) => {
  const result = await pool.query(
    "SELECT COUNT(*) AS count FROM proyecto WHERE id_servicio = $1",
    [servicioId]
  );
  return parseInt(result.rows[0].count, 10);
};

module.exports = {
  findByEmpresaId,
  findById,
  findByIdFull,
  findByNombreAndEmpresa,
  create,
  update,
  desactivar,
  countProyectosByServicio
};