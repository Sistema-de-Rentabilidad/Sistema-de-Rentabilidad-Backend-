const pool = require("../../config/db");

const findByEmpresaId = async (empresaId) => {
  const result = await pool.query(
    `SELECT 
        p.id_proyecto,
        p.nombre,
        p.descripcion,
        p.presupuesto,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.id_servicio,
        s.nombre AS nombre_servicio,
        p.id_lider,
        u.nombre AS nombre_lider,
        p.is_active,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id_usuario', ue.id_usuario,
              'nombre', ue.nombre
            )
          ) FILTER (WHERE ue.id_usuario IS NOT NULL),
          '[]'
        ) AS empleados
     FROM proyecto p
     LEFT JOIN usuario u ON p.id_lider = u.id_usuario
     LEFT JOIN servicio s ON p.id_servicio = s.id_servicio
     LEFT JOIN proyecto_empleado pe 
       ON pe.id_proyecto = p.id_proyecto
     LEFT JOIN usuario ue 
       ON pe.id_empleado = ue.id_usuario
     WHERE p.id_empresa = $1
       AND u.id_empresa = $1
       AND s.id_empresa = $1
       AND p.is_active = true
     GROUP BY 
       p.id_proyecto,
       u.nombre,
       s.nombre
     ORDER BY p.fecha_inicio DESC`,
    [empresaId]
  );
  return result.rows;
};

const findBasicById = async (id) => {
  const res = await pool.query(
    `SELECT id_proyecto, id_empresa, nombre
     FROM proyecto
     WHERE id_proyecto = $1 AND is_active = true`,
    [id]
  );
  return res.rows[0];
};

const findById = async (proyectoId) => {
  const result = await pool.query(
    `SELECT
        p.id_proyecto,
        p.id_empresa,
        p.nombre,
        p.descripcion,
        p.presupuesto,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.fecha_fin_real,
        p.is_active,
        p.id_servicio,
        s.nombre AS servicio_nombre,
        p.id_lider,
        u.nombre AS lider_nombre,
        p.is_active,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id_usuario', ue.id_usuario,
              'nombre', ue.nombre
            )
          ) FILTER (WHERE ue.id_usuario IS NOT NULL),
          '[]'
        ) AS empleados
     FROM proyecto p
     LEFT JOIN servicio s ON s.id_servicio = p.id_servicio
     LEFT JOIN usuario u ON u.id_usuario = p.id_lider
     LEFT JOIN proyecto_empleado pe 
       ON pe.id_proyecto = p.id_proyecto
     LEFT JOIN usuario ue 
       ON ue.id_usuario = pe.id_empleado
     WHERE p.id_proyecto = $1
       AND p.is_active = true
     GROUP BY 
       p.id_proyecto,
       s.nombre,
       u.nombre`,
    [proyectoId]
  );

  return result.rows[0] || null;
};

/* ─── findByLider ───────────────────────────────────────────────────────── */
const findByLider = async (liderId) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT
          p.id_proyecto,
          p.nombre,
          p.descripcion,
          p.presupuesto,
          p.fecha_inicio,
          p.fecha_fin_estimada,
          p.is_active,
          s.nombre AS servicio_nombre
       FROM proyecto p
       INNER JOIN proyecto_lider pl ON pl.id_proyecto = p.id_proyecto
       LEFT JOIN  servicio s        ON s.id_servicio  = p.id_servicio
       WHERE pl.id_lider = $1 AND p.is_active = true
       ORDER BY p.id_proyecto DESC`,
      [liderId]
    );
    return result.rows;
  } catch {
    // Fallback cuando proyecto_lider aún no existe
    const result = await pool.query(
      `SELECT
          p.id_proyecto, p.nombre, p.descripcion, p.presupuesto,
          p.horas_estimadas, p.fecha_inicio, p.fecha_fin_estimada,
          p.is_active, s.nombre AS servicio_nombre
       FROM proyecto p
       LEFT JOIN servicio s ON s.id_servicio = p.id_servicio
       WHERE p.id_lider = $1 AND p.is_active = true
       ORDER BY p.id_proyecto DESC`,
      [liderId]
    );
    return result.rows;
  }
};

/* ─── findByEmpleado (via horas registradas — legacy) ───────────────────── */
const findByEmpleado = async (empleadoId) => {
  const result = await pool.query(
    `SELECT DISTINCT
        p.id_proyecto,
        p.nombre,
        p.descripcion,
        p.presupuesto,
        p.horas_estimadas,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.is_active,
        s.nombre AS servicio_nombre,
        u.nombre AS lider_nombre
     FROM proyecto p
     INNER JOIN registro_horas rh ON rh.id_proyecto = p.id_proyecto
     LEFT JOIN  servicio s        ON s.id_servicio  = p.id_servicio
     LEFT JOIN  usuario  u        ON u.id_usuario   = p.id_lider
     WHERE rh.id_empleado = $1 AND p.is_active = true
     ORDER BY p.id_proyecto DESC`,
    [empleadoId]
  );
  return result.rows;
};

/* ─── findActiveByEmpresa ───────────────────────────────────────────────── */
const findActiveByEmpresa = async (empresaId) => {
  const result = await pool.query(
    `SELECT
        p.id_proyecto,
        p.nombre,
        p.descripcion,
        p.id_lider,
        u.nombre AS lider_nombre,
        s.nombre AS servicio_nombre
     FROM proyecto p
     LEFT JOIN usuario  u ON u.id_usuario  = p.id_lider
     LEFT JOIN servicio s ON s.id_servicio = p.id_servicio
     WHERE p.id_empresa = $1 AND p.is_active = true
     ORDER BY p.nombre ASC`,
    [empresaId]
  );
  return result.rows;
};

/* ─── findAssignedByEmpleado — sin fallback (solo proyecto_empleado) ────── */
const findAssignedByEmpleado = async (empleadoId) => {
  const result = await pool.query(
    `SELECT DISTINCT
        p.id_proyecto,
        p.nombre,
        p.descripcion,
        p.horas_estimadas,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.is_active,
        s.nombre AS servicio_nombre,
        u.nombre AS lider_nombre
     FROM proyecto p
     INNER JOIN proyecto_empleado pe ON pe.id_proyecto = p.id_proyecto
     LEFT JOIN  servicio s           ON s.id_servicio  = p.id_servicio
     LEFT JOIN  usuario  u           ON u.id_usuario   = p.id_lider
     WHERE pe.id_empleado = $1 AND p.is_active = true
     ORDER BY p.id_proyecto DESC`,
    [empleadoId]
  );
  return result.rows;
};

const findByNombreAndEmpresa = async (nombre, empresaId) => {
  const res = await pool.query(
    `SELECT id_proyecto 
     FROM proyecto
     WHERE LOWER(nombre) = LOWER($1)
       AND id_empresa = $2
       AND is_active = true`,
    [nombre, empresaId]
  );

  return res.rows[0];
};

const findServicioById = async (id) => {
  const res = await pool.query(
    'SELECT id_servicio, id_empresa FROM servicio WHERE id_servicio = $1',
    [id]
  );
  return res.rows[0];
};

const findUsuarioById = async (id) => {
  const res = await pool.query(
    `SELECT id_usuario, id_empresa, rol 
     FROM usuario 
     WHERE id_usuario = $1`,
    [id]
  );
  return res.rows[0];
};

const findUsuariosByIds = async (ids) => {
  const res = await pool.query(
    `SELECT id_usuario, id_empresa, rol
     FROM usuario 
     WHERE id_usuario = ANY($1)`,
    [ids]
  );
  return res.rows;
};

const create = async (data) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const proyectoRes = await client.query(
      `INSERT INTO proyecto (
        nombre, 
        descripcion, 
        presupuesto, 
        fecha_inicio, 
        fecha_fin_estimada, 
        id_servicio, 
        id_lider, 
        id_empresa, 
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true)
      RETURNING *`,
      [
        data.nombre,
        data.descripcion ?? null,
        data.presupuesto,
        data.fecha_inicio,
        data.fecha_fin_estimada,
        data.id_servicio,
        data.id_lider,
        data.empresaId
      ]
    );

    const proyecto = proyectoRes.rows[0];

    // empleados (batch insert limpio)
    if (data.empleados.length > 0) {
      const values = data.empleados
        .map((_, i) => `($1, $${i + 2})`)
        .join(',');

      await client.query(
        `INSERT INTO proyecto_empleado (id_proyecto, id_empleado)
         VALUES ${values}`,
        [proyecto.id_proyecto, ...data.empleados]
      );
    }

    await client.query('COMMIT');

    return proyecto;

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const update = async (proyectoId, data) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // update base
    const res = await client.query(
      `UPDATE proyecto
       SET nombre = COALESCE($2, nombre),
           descripcion = COALESCE($3, descripcion),
           presupuesto = COALESCE($4, presupuesto),
           fecha_inicio = COALESCE($5, fecha_inicio),
           fecha_fin_estimada = COALESCE($6, fecha_fin_estimada),
           id_servicio = COALESCE($7, id_servicio),
           id_lider = COALESCE($8, id_lider)
       WHERE id_proyecto = $1
       RETURNING *`,
      [
        proyectoId,
        data.nombre ?? null,
        data.descripcion ?? null,
        data.presupuesto ?? null,
        data.fecha_inicio ?? null,
        data.fecha_fin_estimada ?? null,
        data.id_servicio ?? null,
        data.id_lider ?? null
      ]
    );

    // SYNC empleados
    if (data.empleados) {

      // eliminar actuales
      await client.query(
        `DELETE FROM proyecto_empleado WHERE id_proyecto = $1`,
        [proyectoId]
      );

      // insertar nuevos
      if (data.empleados.length > 0) {
        const values = data.empleados
          .map((_, i) => `($1, $${i + 2})`)
          .join(',');

        await client.query(
          `INSERT INTO proyecto_empleado (id_proyecto, id_empleado)
           VALUES ${values}`,
          [proyectoId, ...data.empleados]
        );
      }
    }

    await client.query('COMMIT');

    return res.rows[0];

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/* ─── deactivate / activate / hardDelete ───────────────────────────────── */
const deactivate = async (proyectoId) => {
  const result = await pool.query(
    `UPDATE proyecto SET is_active = false WHERE id_proyecto = $1
     RETURNING id_proyecto, nombre, is_active`,
    [proyectoId]
  );
  return result.rows[0];
};

const activate = async (proyectoId) => {
  const result = await pool.query(
    `UPDATE proyecto SET is_active = true WHERE id_proyecto = $1
     RETURNING id_proyecto, nombre, is_active`,
    [proyectoId]
  );
  return result.rows[0];
};

const hardDelete = async (proyectoId) => {
  const result = await pool.query(
    `DELETE FROM proyecto WHERE id_proyecto = $1 RETURNING id_proyecto, nombre`,
    [proyectoId]
  );
  return result.rows[0];
};

/* ─── proyecto_empleado helpers ─────────────────────────────────────────── */
const findEmpleadosByProyecto = async (proyectoId) => {
  try {
    const result = await pool.query(
      `SELECT pe.id_empleado, u.nombre, u.email
       FROM proyecto_empleado pe
       INNER JOIN usuario u ON u.id_usuario = pe.id_empleado
       WHERE pe.id_proyecto = $1`,
      [proyectoId]
    );
    return result.rows;
  } catch {
    return [];
  }
};

const syncEmpleados = async (proyectoId, empleadoIds) => {
  await pool.query("DELETE FROM proyecto_empleado WHERE id_proyecto = $1", [proyectoId]);
  if (!empleadoIds || empleadoIds.length === 0) return;
  const values = empleadoIds.map((eid, i) => `($1, $${i + 2})`).join(", ");
  await pool.query(
    `INSERT INTO proyecto_empleado (id_proyecto, id_empleado) VALUES ${values}`,
    [proyectoId, ...empleadoIds]
  );
};

/* ─── proyecto_lider helpers ────────────────────────────────────────────── */
const findLideresByProyecto = async (proyectoId) => {
  try {
    const result = await pool.query(
      `SELECT pl.id_lider, u.nombre, u.email
       FROM proyecto_lider pl
       INNER JOIN usuario u ON u.id_usuario = pl.id_lider
       WHERE pl.id_proyecto = $1
       ORDER BY pl.id_lider ASC`,
      [proyectoId]
    );
    return result.rows;
  } catch {
    return [];
  }
};

const syncLideres = async (proyectoId, liderIds) => {
  await pool.query("DELETE FROM proyecto_lider WHERE id_proyecto = $1", [proyectoId]);
  if (!liderIds || liderIds.length === 0) return;
  // Máximo 3 líderes por proyecto
  const ids = liderIds.slice(0, 3);
  const values = ids.map((lid, i) => `($1, $${i + 2})`).join(", ");
  await pool.query(
    `INSERT INTO proyecto_lider (id_proyecto, id_lider) VALUES ${values}`,
    [proyectoId, ...ids]
  );
};

/* ─── Resumen de horas por empleado ─────────────────────────────────────── */
const findHorasResumenByProyecto = async (proyectoId) => {
  const result = await pool.query(
    `SELECT
        u.id_usuario,
        u.nombre AS empleado_nombre,
        SUM(rh.horas)  AS total_horas,
        COUNT(rh.id_registro) AS total_registros,
        STRING_AGG(DISTINCT rh.descripcion, ' | ') AS tareas
     FROM registro_horas rh
     INNER JOIN usuario u ON u.id_usuario = rh.id_empleado
     WHERE rh.id_proyecto = $1
     GROUP BY u.id_usuario, u.nombre
     ORDER BY total_horas DESC`,
    [proyectoId]
  );
  return result.rows;
};

module.exports = {
  findByEmpresaId,
  findBasicById,
  findById,
  findByLider,
  findByEmpleado,
  findActiveByEmpresa,
  findAssignedByEmpleado,
  findByNombreAndEmpresa,
  findServicioById,
  findUsuarioById,
  findUsuariosByIds,
  create,
  update,
  deactivate,
  activate,
  hardDelete,
  findEmpleadosByProyecto,
  syncEmpleados,
  findLideresByProyecto,
  syncLideres,
  findHorasResumenByProyecto,
};
