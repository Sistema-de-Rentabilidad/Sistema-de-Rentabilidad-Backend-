const pool = require("../../config/db");

const findFasesByProyecto = async (proyectoId) => {
  const res = await pool.query(
    `SELECT id_fase, nombre, horas_estimadas
     FROM fase
     WHERE id_proyecto = $1 AND is_active = true`,
    [proyectoId]
  );
  return res.rows;
};

const findFaseByNombreAndProyecto = async (nombre, proyectoId) => {
  const res = await pool.query(
    `SELECT id_fase FROM fase
     WHERE LOWER(nombre) = LOWER($1) AND id_proyecto = $2 AND is_active = true`,
    [nombre, proyectoId]
  );
  return res.rows[0] || null;
};

const createFase = async (data) => {
  const res = await pool.query(
    `INSERT INTO fase (id_proyecto, nombre, horas_estimadas, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING *`,
    [data.id_proyecto, data.nombre, data.horas_estimadas ?? 0]
  );
  return res.rows[0];
};

const findFaseById = async (faseId) => {
  const res = await pool.query(
    `SELECT f.id_fase, f.id_proyecto, f.nombre, f.horas_estimadas, p.id_empresa
     FROM fase f
     INNER JOIN proyecto p ON p.id_proyecto = f.id_proyecto
     WHERE f.id_fase = $1 AND f.is_active = true`,
    [faseId]
  );
  return res.rows[0] || null;
};

const updateFase = async (faseId, data) => {
  const res = await pool.query(
    `UPDATE fase
     SET nombre          = COALESCE($2, nombre),
         horas_estimadas = COALESCE($3, horas_estimadas)
     WHERE id_fase = $1
     RETURNING *`,
    [
      faseId,
      data.nombre ?? null,
      data.horas_estimadas !== undefined ? data.horas_estimadas : null,
    ]
  );
  return res.rows[0];
};

module.exports = {
  findFasesByProyecto,
  findFaseByNombreAndProyecto,
  findFaseById,
  createFase,
  updateFase
};
