const pool = require("../../config/db");

const ahoraLimaSql = "timezone('America/Lima', now())";

const findByLider = async (liderId) => {
  try {
    const result = await pool.query(
      `SELECT
          rh.id_registro,
          rh.id_proyecto,
          rh.id_empleado,
          rh.fecha,
          rh.horas_trabajadas AS horas,
          rh.descripcion,
          rh.created_at,
          p.nombre AS proyecto_nombre,
          u.nombre AS empleado_nombre
       FROM registro_horas rh
       INNER JOIN proyecto p ON p.id_proyecto = rh.id_proyecto
       INNER JOIN usuario  u ON u.id_usuario  = rh.id_empleado
       WHERE EXISTS (
         SELECT 1 FROM proyecto_lider pl
         WHERE pl.id_proyecto = p.id_proyecto AND pl.id_lider = $1
       )
       ORDER BY rh.fecha DESC, rh.id_registro DESC`,
      [liderId]
    );
    return result.rows;
  } catch {
    // Fallback cuando proyecto_lider aún no existe
    const result = await pool.query(
      `SELECT
          rh.id_registro,
          rh.id_proyecto,
          rh.id_empleado,
          rh.fecha,
          rh.horas_trabajadas AS horas,
          rh.descripcion,
          rh.created_at,
          p.nombre AS proyecto_nombre,
          u.nombre AS empleado_nombre
       FROM registro_horas rh
       INNER JOIN proyecto p ON p.id_proyecto = rh.id_proyecto
       INNER JOIN usuario  u ON u.id_usuario  = rh.id_empleado
       WHERE p.id_lider = $1
       ORDER BY rh.fecha DESC, rh.id_registro DESC`,
      [liderId]
    );
    return result.rows;
  }
};

const findByEmpleado = async (idEmpleado, empresaId) => {
  const result = await pool.query(
    `SELECT
      rh.id_registro,
      rh.fecha,
      rh.horas,
      rh.descripcion,
      p.id_proyecto,
      p.nombre AS proyecto_nombre,
      f.id_fase,
      f.nombre AS fase_nombre
    FROM registro_horas rh
    INNER JOIN proyecto p
      ON rh.id_proyecto = p.id_proyecto
    INNER JOIN fase f
      ON rh.id_fase = f.id_fase
    INNER JOIN usuario u
      ON rh.id_empleado = u.id_usuario
    WHERE rh.id_empleado = $1
      AND u.id_empresa = $2
    ORDER BY rh.fecha DESC
    `,
    [idEmpleado, empresaId]
  );

  return result.rows;
};

const findByProyecto = async (proyectoId) => {
  const result = await pool.query(
    `SELECT
        rh.id_registro,
        rh.id_proyecto,
        rh.id_empleado,
        rh.fecha,
        rh.horas_trabajadas AS horas,
        rh.descripcion,
        rh.created_at,
        u.nombre AS empleado_nombre
     FROM registro_horas rh
     INNER JOIN usuario u ON u.id_usuario = rh.id_empleado
     WHERE rh.id_proyecto = $1
     ORDER BY rh.fecha DESC`,
    [proyectoId]
  );
  return result.rows;
};

const getTotalHorasByEmpleadoYFecha = async (idEmpleado, fecha) => {
  const result = await pool.query(
    `SELECT COALESCE(SUM(horas), 0) AS total
    FROM registro_horas
    WHERE id_empleado = $1
      AND fecha = $2`,
    [idEmpleado, fecha]
  );

  return result.rows[0].total;
};

const getHorasTrabajadasByEmpleadoYFecha = async (idEmpleado, fecha) => {
  const result = await pool.query(
    `SELECT
        CASE
          WHEN hora_entrada IS NULL THEN 0
          ELSE GREATEST(
            EXTRACT(EPOCH FROM (COALESCE(hora_salida, ${ahoraLimaSql})::timestamp - hora_entrada::timestamp)) / 3600,
            0
          )
        END AS horas_trabajadas
     FROM marcaje
     WHERE id_empleado = $1
       AND fecha = $2
     LIMIT 1`,
    [idEmpleado, fecha]
  );

  return result.rows[0]?.horas_trabajadas ?? null;
};

const create = async ({ id_empleado, id_proyecto, id_fase, fecha, horas, descripcion }) => {
  const result = await pool.query(
    `INSERT INTO registro_horas
    (id_empleado, id_proyecto, id_fase, fecha, horas, descripcion)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [id_empleado, id_proyecto, id_fase, fecha, horas, descripcion]
  );

  return result.rows[0];
};

const findById = async (id) => {
  const result = await pool.query(
    `SELECT *
    FROM registro_horas
    WHERE id_registro = $1`,
    [id]
  );

  return result.rows[0];
};

const getTotalHorasSinRegistro = async (idEmpleado, fecha, id) => {
  const result = await pool.query(
    `SELECT COALESCE(SUM(horas), 0) AS total
    FROM registro_horas
    WHERE id_empleado = $1
      AND fecha = $2
      AND id_registro != $3`,
    [idEmpleado, fecha, id]
  );

  return result.rows[0].total;
};

const update = async ({ id, id_proyecto, id_fase, horas, descripcion }) => {
  const result = await pool.query(
    `UPDATE registro_horas
    SET
      id_proyecto = $1,
      id_fase = $2,
      horas = $3,
      descripcion = $4
    WHERE id_registro = $5
    RETURNING *`,
    [id_proyecto, id_fase, horas, descripcion, id]
  );

  return result.rows[0];
};

module.exports = {
  findByLider,
  findByEmpleado,
  findByProyecto,
  getTotalHorasByEmpleadoYFecha,
  getHorasTrabajadasByEmpleadoYFecha,
  create,
  findById,
  getTotalHorasSinRegistro,
  update
};
