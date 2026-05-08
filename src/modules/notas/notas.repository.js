const pool = require("../../config/db");

const findProyectoById = async (proyectoId) => {
  const res = await pool.query(
    `SELECT id_proyecto, id_empresa, id_lider, is_active
     FROM proyecto
     WHERE id_proyecto = $1 AND is_active = true`,
    [proyectoId]
  );
  return res.rows[0] || null;
};

const findNotasByProyecto = async (proyectoId) => {
  const res = await pool.query(
    `SELECT n.id_nota, n.id_proyecto, n.id_lider, n.descripcion, n.fecha, n.is_active,
            u.nombre AS nombre_lider
     FROM notas_proyecto n
     LEFT JOIN usuario u ON u.id_usuario = n.id_lider
     WHERE n.id_proyecto = $1 AND n.is_active = true
     ORDER BY n.fecha DESC`,
    [proyectoId]
  );
  return res.rows;
};

const findNotaById = async (notaId) => {
  const res = await pool.query(
    `SELECT n.id_nota, n.id_proyecto, n.id_lider, n.descripcion, n.fecha, n.is_active,
            p.id_empresa
     FROM notas_proyecto n
     INNER JOIN proyecto p ON p.id_proyecto = n.id_proyecto
     WHERE n.id_nota = $1 AND n.is_active = true`,
    [notaId]
  );
  return res.rows[0] || null;
};

const insertNota = async (data) => {
  const res = await pool.query(
    `INSERT INTO notas_proyecto (id_proyecto, id_lider, descripcion, fecha, is_active)
     VALUES ($1, $2, $3, CURRENT_DATE, true)
     RETURNING *`,
    [data.id_proyecto, data.id_lider, data.descripcion]
  );
  return res.rows[0];
};

const updateNota = async (notaId, descripcion) => {
  const res = await pool.query(
    `UPDATE notas_proyecto
     SET descripcion = $2
     WHERE id_nota = $1
     RETURNING *`,
    [notaId, descripcion]
  );
  return res.rows[0];
};

const desactivarNota = async (notaId) => {
  const res = await pool.query(
    `UPDATE notas_proyecto SET is_active = false WHERE id_nota = $1 RETURNING *`,
    [notaId]
  );
  return res.rows[0];
};

module.exports = {
  findProyectoById,
  findNotasByProyecto,
  findNotaById,
  insertNota,
  updateNota,
  desactivarNota,
};
