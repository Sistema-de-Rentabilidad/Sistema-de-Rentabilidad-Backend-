const pool = require("../../config/db");

const findByProyecto = async (proyectoId) => {
  const res = await pool.query(
    `SELECT f.id_fase, f.nombre, f.horas_estimadas, COALESCE(SUM(h.horas), 0) AS horas_trabajadas
     FROM fase f
     LEFT JOIN registro_horas h
       ON h.id_fase = f.id_fase
     WHERE f.id_proyecto = $1
       AND f.is_active = true
     GROUP BY f.id_fase, f.nombre, f.horas_estimadas
     ORDER BY f.id_fase`,
    [proyectoId]
  );

  return res.rows;
};

const findByNombreAndProyecto = async (nombre, proyectoId) => {
  const res = await pool.query(
    `SELECT id_fase FROM fase
     WHERE LOWER(nombre) = LOWER($1) AND id_proyecto = $2 AND is_active = true`,
    [nombre, proyectoId]
  );
  return res.rows[0] || null;
};

const create = async (data) => {
  const res = await pool.query(
    `INSERT INTO fase (id_proyecto, nombre, horas_estimadas, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING id_fase, id_proyecto, nombre, horas_estimadas`,
    [data.id_proyecto, data.nombre, data.horas_estimadas ?? 0]
  );
  return res.rows[0] || null;
};

const findById = async (id) => {
  const res = await pool.query(
    `SELECT f.id_fase, f.id_proyecto, f.nombre, f.horas_estimadas, p.id_empresa
     FROM fase f
     INNER JOIN proyecto p ON p.id_proyecto = f.id_proyecto
     WHERE f.id_fase = $1 AND f.is_active = true AND p.is_active = true`,
    [id]
  );
  return res.rows[0] || null;
};

const findByIdFull = async (id) => {
  const res = await pool.query(
    `SELECT *
     FROM fase
     WHERE id_fase = $1`,
    [id]
  );

  return res.rows[0] || null;
};

const update = async (id, data) => {
  const res = await pool.query(
    `UPDATE fase
     SET nombre          = COALESCE($2, nombre),
         horas_estimadas = COALESCE($3, horas_estimadas)
     WHERE id_fase = $1
     RETURNING id_fase, id_proyecto, nombre, horas_estimadas`,
    [
      id,
      data.nombre ?? null,
      data.horas_estimadas !== undefined ? data.horas_estimadas : null,
    ]
  );
  return res.rows[0] || null;
};

const desactivar = async (id) => {
  const res = await pool.query(
    `UPDATE fase
     SET is_active = false
     WHERE id_fase = $1
     RETURNING id_fase, id_proyecto, nombre, horas_estimadas, is_active`,
    [id]
  );

  return res.rows[0];
};

module.exports = {
  findByProyecto,
  findByNombreAndProyecto,
  create,
  findById,
  findByIdFull,
  update,
  desactivar
};
