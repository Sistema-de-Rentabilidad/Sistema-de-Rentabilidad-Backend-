const pool = require('../../config/db');

const findAll = async (empresaId) => {
  let query = `
  WITH costo_proyecto AS (
      SELECT
          rh.id_proyecto,
          SUM(
            CASE
              WHEN hs.tipo_pago = 'por_hora'
                THEN hs.monto * rh.horas
              WHEN hs.tipo_pago = 'mensual'
                THEN (hs.monto / NULLIF(hs.horas_mensuales, 0)) * rh.horas
              ELSE 0
            END) AS costo_total
      FROM registro_horas rh
      INNER JOIN historial_sueldo hs
        ON hs.id_usuario = rh.id_usuario
      INNER JOIN proyecto p2
        ON p2.id_proyecto = rh.id_proyecto
      WHERE (rh.fecha BETWEEN hs.fecha_inicio
          AND COALESCE(hs.fecha_fin, CURRENT_DATE))
      AND rh.fecha >= p2.fecha_inicio
      AND rh.fecha <= CURRENT_DATE
      GROUP BY rh.id_proyecto
    )
    SELECT
        p.id_proyecto,
        p.nombre,
        p.descripcion,
        p.presupuesto,
        p.margen,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.fecha_fin_real,
        p.id_servicio,
        s.nombre AS nombre_servicio,
        p.id_lider,
        u.nombre AS nombre_lider,

        COALESCE(cp.costo_total, 0)
          AS costo_real,
        (p.presupuesto - COALESCE(cp.costo_total, 0)) AS rentabilidad,

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
     LEFT JOIN costo_proyecto cp
       ON cp.id_proyecto = p.id_proyecto
     LEFT JOIN usuario u
       ON p.id_lider = u.id_usuario
     LEFT JOIN servicio s
       ON p.id_servicio = s.id_servicio
     LEFT JOIN proyecto_empleado pe
       ON pe.id_proyecto = p.id_proyecto
     LEFT JOIN usuario ue
       ON pe.id_empleado = ue.id_usuario
     WHERE p.id_empresa = $1
       AND p.is_active = true
     GROUP BY p.id_proyecto, u.nombre, s.nombre, cp.costo_total
     ORDER BY p.fecha_inicio DESC`;

  const result = await pool.query(query, [empresaId]);

  return result.rows;
};

const findAllByLider = async ({ empresaId, liderId }) => {
  const result = await pool.query(
    `SELECT
        p.id_proyecto,
        p.nombre,
        p.descripcion,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.fecha_fin_real,
        p.id_servicio,
        s.nombre AS nombre_servicio,
        p.id_lider,
        u.nombre AS nombre_lider,

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
    LEFT JOIN usuario u
       ON p.id_lider = u.id_usuario
    LEFT JOIN servicio s
       ON p.id_servicio = s.id_servicio
     LEFT JOIN proyecto_empleado pe
       ON pe.id_proyecto = p.id_proyecto
     LEFT JOIN usuario ue
       ON pe.id_empleado = ue.id_usuario
    WHERE p.id_empresa = $1
      AND p.id_lider = $2
      AND p.is_active = true
    GROUP BY p.id_proyecto, u.nombre, s.nombre
    ORDER BY p.fecha_inicio DESC`,
    [empresaId, liderId]
  );

  return result.rows;
};

const findAllByEmpleado = async ({ empresaId, empleadoId }) => {
  const result = await pool.query(
    `SELECT
        p.id_proyecto,
        p.nombre,
        p.descripcion,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.fecha_fin_real,
        p.id_servicio,
        s.nombre AS nombre_servicio,
        p.id_lider,
        u.nombre AS nombre_lider
     FROM proyecto p
     INNER JOIN proyecto_empleado pe
       ON pe.id_proyecto = p.id_proyecto
     LEFT JOIN servicio s
       ON s.id_servicio = p.id_servicio
     LEFT JOIN usuario u
       ON u.id_usuario = p.id_lider
     WHERE p.id_empresa = $1
       AND pe.id_empleado = $2
       AND p.is_active = true
     ORDER BY p.fecha_inicio DESC`,
    [empresaId, empleadoId]
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

const create = async (data) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const proyectoRes = await client.query(
      `INSERT INTO proyecto (
        nombre, 
        descripcion, 
        presupuesto, 
        margen,
        fecha_inicio, 
        fecha_fin_estimada, 
        id_servicio, 
        id_lider, 
        id_empresa, 
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
      RETURNING *`,
      [
        data.nombre,
        data.descripcion ?? null,
        data.presupuesto,
        data.margen ?? null,
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

const findBasicById = async (id) => {
  const res = await pool.query(
    `SELECT id_proyecto, id_empresa, id_lider, nombre, fecha_fin_real, is_active
     FROM proyecto
     WHERE id_proyecto = $1`,
    [id]
  );

  return res.rows[0] || null;
};

const findById = async (proyectoId) => {
  const result = await pool.query(
    `SELECT
        p.id_proyecto,
        p.nombre,
        p.descripcion,
        p.presupuesto,
        p.margen,
        p.fecha_inicio,
        p.fecha_fin_estimada,
        p.fecha_fin_real,
        p.id_servicio,
        p.id_empresa,
        s.nombre AS servicio_nombre,
        p.id_lider,
        u.nombre AS lider_nombre,
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
           margen = COALESCE($5, margen),
           fecha_inicio = COALESCE($6, fecha_inicio),
           fecha_fin_estimada = COALESCE($7, fecha_fin_estimada),
           id_servicio = COALESCE($8, id_servicio),
           id_lider = COALESCE($9, id_lider)
       WHERE id_proyecto = $1
       RETURNING *`,
      [
        proyectoId,
        data.nombre ?? null,
        data.descripcion ?? null,
        data.presupuesto ?? null,
        data.margen ?? null,
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

const desactivar = async (proyectoId) => {
  const result = await pool.query(
    `UPDATE proyecto
     SET is_active = false
     WHERE id_proyecto = $1
     RETURNING *`,
    [proyectoId]
  );

  return result.rows[0];
};

const finalizar = async (proyectoId) => {
  const result = await pool.query(
    `
    UPDATE proyecto
    SET fecha_fin_real = NOW()
    WHERE id_proyecto = $1
    RETURNING *
    `,
    [proyectoId]
  );

  return result.rows[0];
};

/* ─── Resumen de horas por fase ─────────────────────────────────────────── */
const findHorasResumenByProyecto = async (proyectoId) => {
  const result = await pool.query(
    `SELECT
        p.id_proyecto,
        p.nombre AS proyecto_nombre,
        f.id_fase,
        f.nombre AS fase_nombre,
        COALESCE(SUM(rh.horas), 0) AS total_horas,
        COUNT(rh.id_registro) AS total_registros
     FROM registro_horas rh
     INNER JOIN proyecto p ON p.id_proyecto = rh.id_proyecto
     LEFT JOIN fase f
       ON f.id_fase = rh.id_fase
      AND f.id_proyecto = rh.id_proyecto
     WHERE rh.id_proyecto = $1
     GROUP BY p.id_proyecto, p.nombre, f.id_fase, f.nombre
     ORDER BY f.nombre NULLS LAST`,
    [proyectoId]
  );
  return result.rows;
};

module.exports = {
  findAll,
  findAllByLider,
  findAllByEmpleado,
  findByNombreAndEmpresa,
  create,
  findBasicById,
  findById,
  update,
  desactivar,
  finalizar,
  findHorasResumenByProyecto,
};
