const pool = require('../../config/db');

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

const findById = async (id) => {
  const res = await pool.query(
    `SELECT
        n.id_nota,
        n.id_proyecto,
        n.id_lider,
        n.descripcion,
        n.fecha,
        p.id_empresa,
        p.fecha_fin_real,
        p.estado,
        u.nombre AS nombre_lider
     FROM nota n
     INNER JOIN proyecto p
       ON p.id_proyecto = n.id_proyecto
     LEFT JOIN usuario u
       ON u.id_usuario = n.id_lider
     WHERE n.id_nota = $1
       AND n.is_active = true`,
    [id]
  );
  return res.rows[0] || null;
};

const findByIdFull = async (id) => {
  const result = await pool.query(
    `SELECT
        n.id_nota,
        n.id_proyecto,
        n.id_lider,
        n.descripcion,
        n.fecha,
        n.is_active,
        p.id_empresa,
        p.fecha_fin_real,
        p.estado
     FROM nota n
     INNER JOIN proyecto p
       ON n.id_proyecto = p.id_proyecto
     WHERE n.id_nota = $1`,
    [id]
  );

  return result.rows[0];
};

const update = async (id, descripcion) => {
  const res = await pool.query(
    `UPDATE nota
     SET descripcion = $2
     WHERE id_nota = $1
     RETURNING *`,
    [id, descripcion]
  );
  return res.rows[0];
};

const desactivar = async (id) => {
  const res = await pool.query(
    `UPDATE nota SET is_active = false WHERE id_nota = $1 RETURNING *`,
    [id]
  );
  return res.rows[0];
};

module.exports = {
  findByProyecto,
  findById,
  findByIdFull,
  create,
  update,
  desactivar,
};
