const pool = require("../../config/db");

const findByProyecto = async (proyectoId) => {
  const res = await pool.query(
    `SELECT n.id_nota, n.id_lider, n.descripcion, n.fecha, u.nombre AS nombre_lider
     FROM nota n
     LEFT JOIN usuario u ON u.id_usuario = n.id_lider
     WHERE n.id_proyecto = $1 AND n.is_active = true
     ORDER BY n.fecha DESC`,
    [proyectoId]
  );
  return res.rows;
};

const create = async (data) => {
  const res = await pool.query(
    `INSERT INTO nota (id_proyecto, id_lider, descripcion, fecha, is_active)
     VALUES ($1, $2, $3, CURRENT_DATE, true)
     RETURNING *`,
    [data.id_proyecto, data.id_lider, data.descripcion]
  );
  return res.rows[0];
};

const findById = async (notaId) => {
  const res = await pool.query(
    `SELECT n.id_nota, n.id_lider, n.descripcion, n.fecha, p.id_empresa, u.nombre AS nombre_lider
     FROM nota n
     INNER JOIN proyecto p
       ON p.id_proyecto = n.id_proyecto
     LEFT JOIN usuario u
       ON u.id_usuario = n.id_lider
     WHERE n.id_nota = $1
       AND n.is_active = true`,
    [notaId]
  );
  return res.rows[0] || null;
};

const update = async (notaId, descripcion) => {
  const res = await pool.query(
    `UPDATE nota
     SET descripcion = $2
     WHERE id_nota = $1
     RETURNING *`,
    [notaId, descripcion]
  );
  return res.rows[0];
};

const desactivarNota = async (notaId) => {
  const res = await pool.query(
    `UPDATE nota SET is_active = false WHERE id_nota = $1 RETURNING *`,
    [notaId]
  );
  return res.rows[0];
};

module.exports = {
  findByProyecto,
  findById,
  create,
  update,
  desactivarNota,
};
