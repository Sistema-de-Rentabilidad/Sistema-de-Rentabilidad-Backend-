const pool = require('../../config/db');

const ahoraLimaSql = "timezone('America/Lima', now())";
let registroHorasEmpleadoColumnPromise;

const getRegistroHorasEmpleadoColumn = async () => {
  if (!registroHorasEmpleadoColumnPromise) {
    registroHorasEmpleadoColumnPromise = pool.query(
      `SELECT column_name
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'registro_horas'
         AND column_name IN ('id_empleado', 'id_usuario')
       ORDER BY CASE column_name WHEN 'id_empleado' THEN 0 ELSE 1 END
       LIMIT 1`
    ).then((result) => result.rows[0]?.column_name || 'id_empleado');
  }

  return registroHorasEmpleadoColumnPromise;
};

const normalizeRegistroHorasRow = (row) => {
  if (!row) return row;

  const empleadoId = row.id_empleado ?? row.id_usuario;
  return {
    ...row,
    id_empleado: empleadoId,
    id_usuario: empleadoId
  };
};

const findByLider = async (liderId) => {
  const empleadoColumn = await getRegistroHorasEmpleadoColumn();

  try {
    const result = await pool.query(
      `SELECT
          rh.id_registro,
          rh.id_proyecto,
          rh.${empleadoColumn} AS id_empleado,
          rh.${empleadoColumn} AS id_usuario,
          rh.fecha,
          rh.horas,
          rh.descripcion,
          NULL::timestamp AS created_at,
          p.nombre AS proyecto_nombre,
          u.nombre AS usuario_nombre
       FROM registro_horas rh
       INNER JOIN proyecto p ON p.id_proyecto = rh.id_proyecto
       INNER JOIN usuario  u ON u.id_usuario  = rh.${empleadoColumn}
       WHERE EXISTS (
         SELECT 1 FROM proyecto_lider pl
         WHERE pl.id_proyecto = p.id_proyecto AND pl.id_lider = $1
       )
       ORDER BY rh.fecha DESC, rh.id_registro DESC`,
      [liderId]
    );
    return result.rows.map(normalizeRegistroHorasRow);
  } catch {
    // Fallback cuando proyecto_lider aún no existe
    const result = await pool.query(
      `SELECT
          rh.id_registro,
          rh.id_proyecto,
          rh.${empleadoColumn} AS id_empleado,
          rh.${empleadoColumn} AS id_usuario,
          rh.fecha,
          rh.horas,
          rh.descripcion,
          NULL::timestamp AS created_at,
          p.nombre AS proyecto_nombre,
          u.nombre AS usuario_nombre
       FROM registro_horas rh
       INNER JOIN proyecto p ON p.id_proyecto = rh.id_proyecto
       INNER JOIN usuario  u ON u.id_usuario  = rh.${empleadoColumn}
       WHERE p.id_lider = $1
       ORDER BY rh.fecha DESC, rh.id_registro DESC`,
      [liderId]
    );
    return result.rows.map(normalizeRegistroHorasRow);
  }
};

const findByEmpleado = async (idEmpleado, empresaId) => {
  const empleadoColumn = await getRegistroHorasEmpleadoColumn();

  const result = await pool.query(
    `SELECT
      rh.id_registro,
      rh.fecha,
      rh.horas,
      rh.descripcion,
      rh.${empleadoColumn} AS id_empleado,
      rh.${empleadoColumn} AS id_usuario,
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
      ON rh.${empleadoColumn} = u.id_usuario
    WHERE rh.${empleadoColumn} = $1
      AND u.id_empresa = $2
    ORDER BY rh.fecha DESC
    `,
    [idEmpleado, empresaId]
  );

  return result.rows.map(normalizeRegistroHorasRow);
};

const findByProyecto = async (proyectoId) => {
  const empleadoColumn = await getRegistroHorasEmpleadoColumn();

  const result = await pool.query(
    `SELECT
        rh.id_registro,
        rh.id_proyecto,
        rh.${empleadoColumn} AS id_empleado,
        rh.${empleadoColumn} AS id_usuario,
        rh.fecha,
        rh.horas,
        rh.descripcion,
        NULL::timestamp AS created_at,
        u.nombre AS usuario_nombre
     FROM registro_horas rh
     INNER JOIN usuario u ON u.id_usuario = rh.${empleadoColumn}
     WHERE rh.id_proyecto = $1
     ORDER BY rh.fecha DESC`,
    [proyectoId]
  );
  return result.rows.map(normalizeRegistroHorasRow);
};

const getTotalHorasByEmpleadoYFecha = async (idEmpleado, fecha) => {
  const empleadoColumn = await getRegistroHorasEmpleadoColumn();

  const result = await pool.query(
    `SELECT COALESCE(SUM(horas), 0) AS total
    FROM registro_horas
    WHERE ${empleadoColumn} = $1
      AND fecha = $2`,
    [idEmpleado, fecha]
  );

  return result.rows[0].total;
};

const getHorasTrabajadasByEmpleadoYFecha = async (idEmpleado, fecha) => {
  const result = await pool.query(
    `SELECT
        CASE
          WHEN hora_entrada IS NULL THEN NULL
          ELSE GREATEST(
            EXTRACT(EPOCH FROM (COALESCE(hora_salida, ${ahoraLimaSql})::timestamp - hora_entrada::timestamp)) / 3600,
            0
          )
        END AS horas_trabajadas
     FROM marcaje
     WHERE id_usuario = $1
       AND fecha = $2
     LIMIT 1`,
    [idEmpleado, fecha]
  );

  return result.rows[0]?.horas_trabajadas ?? null;
};

const create = async ({ id_empleado, id_proyecto, id_fase, fecha, horas, descripcion }) => {
  const empleadoColumn = await getRegistroHorasEmpleadoColumn();

  const result = await pool.query(
    `INSERT INTO registro_horas
    (${empleadoColumn}, id_proyecto, id_fase, fecha, horas, descripcion)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *`,
    [id_empleado, id_proyecto, id_fase, fecha, horas, descripcion]
  );

  return normalizeRegistroHorasRow(result.rows[0]);
};

const findById = async (id) => {
  const result = await pool.query(
    `SELECT *
    FROM registro_horas
    WHERE id_registro = $1`,
    [id]
  );

  return normalizeRegistroHorasRow(result.rows[0]);
};

const getTotalHorasSinRegistro = async (idEmpleado, fecha, id) => {
  const empleadoColumn = await getRegistroHorasEmpleadoColumn();

  const result = await pool.query(
    `SELECT COALESCE(SUM(horas), 0) AS total
    FROM registro_horas
    WHERE ${empleadoColumn} = $1
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

  return normalizeRegistroHorasRow(result.rows[0]);
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
