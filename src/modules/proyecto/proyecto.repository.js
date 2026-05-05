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
        p.id_lider,
        p.is_active,
        u.nombre AS nombre_lider
     FROM proyecto p
     JOIN usuario u ON p.id_lider = u.id_usuario
     WHERE p.id_empresa = $1
       AND p.is_active = true
     ORDER BY p.fecha_inicio DESC`,
    [empresaId]
  );
  return result.rows;
};

/* ─── findById ──────────────────────────────────────────────────────────── */
const findById = async (proyectoId) => {
  const result = await pool.query(
    `SELECT
        p.id_proyecto,
        p.id_empresa,
        p.nombre,
        p.descripcion,
        p.presupuesto,
        p.horas_estimadas,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.fecha_fin_real,
        p.is_active,
        p.id_servicio,
        s.nombre AS servicio_nombre,
        p.id_lider,
        u.nombre AS lider_nombre
     FROM proyecto p
     LEFT JOIN servicio s ON s.id_servicio = p.id_servicio
     LEFT JOIN usuario  u ON u.id_usuario  = p.id_lider
     WHERE p.id_proyecto = $1 AND p.is_active = true`,
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
          p.horas_estimadas,
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

/* ─── create ────────────────────────────────────────────────────────────── */
const create = async ({ id_empresa, id_servicio, id_lider, nombre, descripcion, presupuesto, horas_estimadas, fecha_inicio, fecha_fin_estimada }) => {
  const result = await pool.query(
    `INSERT INTO proyecto
       (id_empresa, id_servicio, id_lider, nombre, descripcion, presupuesto, horas_estimadas, fecha_inicio, fecha_fin_estimada, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
     RETURNING id_proyecto, nombre, descripcion, presupuesto, horas_estimadas, fecha_inicio, fecha_fin_estimada, id_empresa, id_servicio, id_lider`,
    [id_empresa, id_servicio || null, id_lider || null, nombre, descripcion || null,
     presupuesto || null, horas_estimadas || null, fecha_inicio || null, fecha_fin_estimada || null]
  );
  return result.rows[0];
};

/* ─── update ────────────────────────────────────────────────────────────── */
const update = async (proyectoId, { id_servicio, id_lider, nombre, descripcion, presupuesto, horas_estimadas, fecha_inicio, fecha_fin_estimada, fecha_fin_real }) => {
  const result = await pool.query(
    `UPDATE proyecto
     SET nombre             = COALESCE($2,  nombre),
         descripcion        = COALESCE($3,  descripcion),
         presupuesto        = COALESCE($4,  presupuesto),
         horas_estimadas    = COALESCE($5,  horas_estimadas),
         fecha_inicio       = COALESCE($6,  fecha_inicio),
         fecha_fin_estimada = COALESCE($7,  fecha_fin_estimada),
         fecha_fin_real     = COALESCE($8,  fecha_fin_real),
         id_servicio        = COALESCE($9,  id_servicio),
         id_lider           = COALESCE($10, id_lider)
     WHERE id_proyecto = $1
     RETURNING id_proyecto, nombre, descripcion, presupuesto, horas_estimadas,
               fecha_inicio, fecha_fin_estimada, fecha_fin_real, id_empresa, id_servicio, id_lider`,
    [proyectoId, nombre || null, descripcion || null, presupuesto || null, horas_estimadas || null,
     fecha_inicio || null, fecha_fin_estimada || null, fecha_fin_real || null,
     id_servicio || null, id_lider || null]
  );
  return result.rows[0];
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
  findById,
  findByLider,
  findByEmpleado,
  findActiveByEmpresa,
  findAssignedByEmpleado,
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
