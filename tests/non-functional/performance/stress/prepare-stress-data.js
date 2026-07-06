const bcrypt = require('bcrypt');
const crypto = require('crypto');

const COMPANY_ID = Number(process.env.K6_COMPANY_ID || 23);
const SERVICE_ID = Number(process.env.K6_SERVICE_ID || 31);
const PASSWORD = process.env.K6_PASSWORD || '12345678';
const LEADER_COUNT = 100;
const EMPLOYEE_COUNT = 400;
const PHASES_PER_PROJECT = 48;
const EXIT_READY_LEADERS = 29;
const RESET_STRESS_DAY = process.env.RESET_STRESS_DAY === 'YES';

let pool;

const assertPositiveInteger = (name, value) => {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} debe ser un entero positivo`);
  }
};

const prepare = async () => {
  if (process.env.ALLOW_PRODUCTION_STRESS_DATA !== 'YES') {
    throw new Error(
      'Debes indicar ALLOW_PRODUCTION_STRESS_DATA=YES para crear datos dedicados'
    );
  }

  assertPositiveInteger('K6_COMPANY_ID', COMPANY_ID);
  assertPositiveInteger('K6_SERVICE_ID', SERVICE_ID);

  pool = require('../../../../src/config/db');
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('prepare-stress-operativo-500'))"
    );

    const scopeResult = await client.query(
      `SELECT
         e.id_empresa,
         e.nombre AS empresa_nombre,
         s.id_servicio,
         s.nombre AS servicio_nombre
       FROM empresa e
       JOIN servicio s
         ON s.id_empresa = e.id_empresa
        AND s.id_servicio = $2
        AND s.is_active = true
       WHERE e.id_empresa = $1`,
      [COMPANY_ID, SERVICE_ID]
    );

    if (scopeResult.rowCount !== 1) {
      throw new Error(
        `No existe la empresa ${COMPANY_ID} con el servicio activo ${SERVICE_ID}`
      );
    }

    let resetHours = { rowCount: 0 };
    let resetMarks = { rowCount: 0 };
    let resetRateLimits = { rowCount: 0 };

    if (RESET_STRESS_DAY) {
      resetHours = await client.query(
        `DELETE FROM registro_horas rh
         USING usuario u
         WHERE u.id_usuario = rh.id_empleado
           AND u.id_empresa = $1
           AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'
           AND rh.fecha = timezone('America/Lima', now())::date
           AND rh.descripcion LIKE 'K6-STRESS-OP %'`,
        [COMPANY_ID]
      );

      resetMarks = await client.query(
        `DELETE FROM marcaje m
         USING usuario u
         WHERE u.id_usuario = m.id_usuario
           AND u.id_empresa = $1
           AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'
           AND m.fecha = timezone('America/Lima', now())::date`,
        [COMPANY_ID]
      );

      const emailHashes = [
        ...Array.from(
          { length: LEADER_COUNT },
          (_, index) => `lider.load${index + 1}@test.com`
        ),
        ...Array.from(
          { length: EMPLOYEE_COUNT },
          (_, index) => `empleado.load${index + 1}@test.com`
        ),
      ].map((email) =>
        crypto.createHash('sha256').update(email).digest('hex')
      );

      resetRateLimits = await client.query(
        `WITH stress_ips AS (
           SELECT DISTINCT ip
           FROM private.login_rate_limits
           WHERE email_hash = ANY($1::text[])
             AND ip IS NOT NULL
         )
         DELETE FROM private.login_rate_limits limits
         WHERE limits.email_hash = ANY($1::text[])
            OR (
              limits.email_hash IS NULL
              AND limits.ip IN (SELECT ip FROM stress_ips)
            )`,
        [emailHashes]
      );
    }

    const staleOpenMarksResult = await client.query(
      `DELETE FROM marcaje m
       USING usuario u
       WHERE u.id_usuario = m.id_usuario
         AND u.id_empresa = $1
         AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'
         AND m.hora_salida IS NULL
         AND m.fecha <> timezone('America/Lima', now())::date`,
      [COMPANY_ID]
    );

    const leadersResult = await client.query(
      `INSERT INTO usuario (
         id_empresa,
         nombre,
         email,
         password,
         rol,
         is_active
       )
       SELECT
         $1,
         'K6 Stress Lider ' || load_index,
         'lider.load' || load_index || '@test.com',
         $2,
         'lider',
         true
       FROM generate_series(1, $3::int) AS load_users(load_index)
       ON CONFLICT (email) DO NOTHING`,
      [COMPANY_ID, passwordHash, LEADER_COUNT]
    );

    const employeesResult = await client.query(
      `INSERT INTO usuario (
         id_empresa,
         nombre,
         email,
         password,
         rol,
         is_active
       )
       SELECT
         $1,
         'K6 Stress Empleado ' || load_index,
         'empleado.load' || load_index || '@test.com',
         $2,
         'empleado',
         true
       FROM generate_series(1, $3::int) AS load_users(load_index)
       ON CONFLICT (email) DO NOTHING`,
      [COMPANY_ID, passwordHash, EMPLOYEE_COUNT]
    );

    const salaryResult = await client.query(
      `INSERT INTO historial_sueldo (
         id_usuario,
         tipo_pago,
         monto,
         fecha_inicio,
         fecha_fin,
         horas_mensuales
       )
       SELECT
         u.id_usuario,
         'mensual',
         3000,
         timezone('America/Lima', now())::date,
         NULL,
         160
       FROM usuario u
       WHERE u.id_empresa = $1
         AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'
         AND NOT EXISTS (
           SELECT 1
           FROM historial_sueldo hs
           WHERE hs.id_usuario = u.id_usuario
             AND hs.fecha_inicio <= timezone('America/Lima', now())::date
             AND (
               hs.fecha_fin IS NULL
               OR hs.fecha_fin >= timezone('America/Lima', now())::date
             )
         )`,
      [COMPANY_ID]
    );

    const projectsResult = await client.query(
      `INSERT INTO proyecto (
         id_empresa,
         id_servicio,
         id_lider,
         nombre,
         descripcion,
         presupuesto,
         fecha_inicio,
         fecha_fin_estimada,
         fecha_fin_real,
         margen,
         estado,
         is_active
       )
       SELECT
         $1,
         $2,
         u.id_usuario,
         'K6 STRESS OP Proyecto Lider ' || load_users.load_index,
         'Proyecto dedicado para la prueba de stress operativo',
         100000,
         timezone('America/Lima', now())::date,
         timezone('America/Lima', now())::date + 365,
         NULL,
         20,
         'Ejecución',
         true
       FROM usuario u
       CROSS JOIN LATERAL (
         SELECT substring(
           u.email FROM '^lider\\.load([0-9]+)@test\\.com$'
         )::int AS load_index
       ) load_users
       WHERE u.id_empresa = $1
         AND u.rol = 'lider'
         AND u.email ~ '^lider\\.load[0-9]+@test\\.com$'
         AND load_users.load_index BETWEEN 1 AND $3
         AND NOT EXISTS (
           SELECT 1
           FROM proyecto p
           WHERE p.id_empresa = u.id_empresa
             AND p.id_lider = u.id_usuario
             AND p.is_active = true
             AND p.estado <> 'Finalizado'
             AND p.fecha_fin_real IS NULL
         )`,
      [COMPANY_ID, SERVICE_ID, LEADER_COUNT]
    );

    const phasesResult = await client.query(
      `WITH leader_projects AS (
         SELECT DISTINCT ON (u.id_usuario)
           u.id_usuario,
           p.id_proyecto
         FROM usuario u
         JOIN proyecto p
           ON p.id_lider = u.id_usuario
          AND p.id_empresa = u.id_empresa
          AND p.is_active = true
          AND p.estado <> 'Finalizado'
          AND p.fecha_fin_real IS NULL
         WHERE u.id_empresa = $1
           AND u.email ~ '^lider\\.load[0-9]+@test\\.com$'
         ORDER BY u.id_usuario, p.id_proyecto
       )
       INSERT INTO fase (
         id_proyecto,
         nombre,
         horas_estimadas,
         is_active
       )
       SELECT
         lp.id_proyecto,
         'K6 Stress Fase ' || lpad(phase_number::text, 2, '0'),
         100,
         true
       FROM leader_projects lp
       CROSS JOIN generate_series(1, $2::int) AS phases(phase_number)
       WHERE NOT EXISTS (
         SELECT 1
         FROM fase f
         WHERE f.id_proyecto = lp.id_proyecto
           AND f.nombre =
             'K6 Stress Fase ' || lpad(phase_number::text, 2, '0')
       )`,
      [COMPANY_ID, PHASES_PER_PROJECT]
    );

    const assignmentsResult = await client.query(
      `WITH leader_projects AS (
         SELECT DISTINCT ON (leader_index)
           leader_index,
           p.id_proyecto
         FROM usuario u
         CROSS JOIN LATERAL (
           SELECT substring(
             u.email FROM '^lider\\.load([0-9]+)@test\\.com$'
           )::int AS leader_index
         ) indexes
         JOIN proyecto p
           ON p.id_lider = u.id_usuario
          AND p.id_empresa = u.id_empresa
          AND p.is_active = true
          AND p.estado <> 'Finalizado'
          AND p.fecha_fin_real IS NULL
         WHERE u.id_empresa = $1
           AND u.email ~ '^lider\\.load[0-9]+@test\\.com$'
         ORDER BY leader_index, p.id_proyecto
       ),
       employees AS (
         SELECT
           u.id_usuario,
           substring(
             u.email FROM '^empleado\\.load([0-9]+)@test\\.com$'
           )::int AS employee_index
         FROM usuario u
         WHERE u.id_empresa = $1
           AND u.email ~ '^empleado\\.load[0-9]+@test\\.com$'
       )
       INSERT INTO proyecto_empleado (id_proyecto, id_empleado)
       SELECT
         lp.id_proyecto,
         employees.id_usuario
       FROM employees
       JOIN leader_projects lp
         ON lp.leader_index =
           ((employees.employee_index - 1) % $2::int) + 1
       ON CONFLICT (id_proyecto, id_empleado) DO NOTHING`,
      [COMPANY_ID, LEADER_COUNT]
    );

    const marksResult = await client.query(
      `WITH exit_users AS (
         SELECT u.id_usuario
         FROM usuario u
         WHERE u.id_empresa = $1
           AND u.rol = 'lider'
           AND substring(
             u.email FROM '^lider\\.load([0-9]+)@test\\.com$'
           )::int BETWEEN 1 AND $2
       )
       INSERT INTO marcaje (
         id_usuario,
         fecha,
         hora_entrada
       )
       SELECT
         exit_users.id_usuario,
         timezone('America/Lima', now())::date,
         timezone('America/Lima', now()) - interval '2 minutes'
       FROM exit_users
       WHERE NOT EXISTS (
         SELECT 1
         FROM marcaje m
         WHERE m.id_usuario = exit_users.id_usuario
           AND m.fecha = timezone('America/Lima', now())::date
       )`,
      [COMPANY_ID, EXIT_READY_LEADERS]
    );

    const verificationResult = await client.query(
      `SELECT
         COUNT(*) FILTER (
           WHERE u.email ~ '^lider\\.load[0-9]+@test\\.com$'
         )::int AS leaders,
         COUNT(*) FILTER (
           WHERE u.email ~ '^empleado\\.load[0-9]+@test\\.com$'
         )::int AS employees
       FROM usuario u
       WHERE u.id_empresa = $1
         AND u.is_active = true`,
      [COMPANY_ID]
    );

    const { leaders, employees } = verificationResult.rows[0];

    if (leaders < LEADER_COUNT || employees < EMPLOYEE_COUNT) {
      throw new Error(
        `Preparacion incompleta: ${leaders} lideres y ${employees} empleados`
      );
    }

    await client.query('COMMIT');

    const scope = scopeResult.rows[0];
    console.log(
      `Empresa: ${scope.empresa_nombre} (${scope.id_empresa}), ` +
      `servicio: ${scope.servicio_nombre} (${scope.id_servicio})`
    );
    console.log(`Lideres creados: ${leadersResult.rowCount}`);
    console.log(`Empleados creados: ${employeesResult.rowCount}`);
    console.log(`Historiales mensuales creados: ${salaryResult.rowCount}`);
    console.log(`Proyectos creados: ${projectsResult.rowCount}`);
    console.log(`Fases creadas: ${phasesResult.rowCount}`);
    console.log(`Asignaciones de empleados creadas: ${assignmentsResult.rowCount}`);
    console.log(
      `Marcajes abiertos de otros dias eliminados: ${staleOpenMarksResult.rowCount}`
    );
    console.log(`Marcajes abiertos para salida: ${marksResult.rowCount}`);
    if (RESET_STRESS_DAY) {
      console.log(`Horas K6 reiniciadas hoy: ${resetHours.rowCount}`);
      console.log(`Marcajes K6 reiniciados hoy: ${resetMarks.rowCount}`);
      console.log(`Ventanas de login reiniciadas: ${resetRateLimits.rowCount}`);
    }
    console.log(`Total dedicado: ${leaders} lideres y ${employees} empleados`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

if (require.main === module) {
  prepare()
    .catch((error) => {
      console.error(`No se pudo preparar la base de stress: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool) {
        await pool.end();
      }
    });
}
