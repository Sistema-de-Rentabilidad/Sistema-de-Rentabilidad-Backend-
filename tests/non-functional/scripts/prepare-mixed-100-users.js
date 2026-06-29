const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const pool = require('../../../src/config/db');
const { generateToken } = require('../../../src/utils/jwt');

const COMPANY_ID = 23;
const PASSWORD = process.env.K6_PASSWORD || '12345678';
const RUNTIME_FILE = path.resolve(
  __dirname,
  '../../../tmp/mixed-100-users-data.json'
);

const EXPECTED_COUNTS = {
  lider: 20,
  empleado: 80,
};

const fail = (message) => {
  throw new Error(message);
};

const validateUsers = (users) => {
  const leaders = users.filter((user) => user.rol === 'lider');
  const employees = users.filter((user) => user.rol === 'empleado');

  if (leaders.length !== EXPECTED_COUNTS.lider) {
    fail(`Se esperaban 20 lideres y se encontraron ${leaders.length}`);
  }

  if (employees.length !== EXPECTED_COUNTS.empleado) {
    fail(`Se esperaban 80 empleados y se encontraron ${employees.length}`);
  }

  if (users.some((user) => !user.is_active)) {
    fail('Todos los usuarios de carga deben estar activos');
  }

  if (
    users.some(
      (user) =>
        user.locked_until &&
        new Date(user.locked_until).getTime() > Date.now()
    )
  ) {
    fail('Hay usuarios de carga bloqueados');
  }

  return { leaders, employees };
};

const buildCohorts = ({ leaders, employees }) => {
  const employeesWithProject = employees.filter(
    (user) => user.id_proyecto && user.id_fase
  );
  const leadersWithProject = leaders.filter(
    (user) => user.id_proyecto && user.id_fase
  );

  if (employeesWithProject.length < 20) {
    fail(
      `Se necesitan 20 empleados con proyecto y fase; solo hay ${employeesWithProject.length}`
    );
  }

  if (leadersWithProject.length !== 20) {
    fail('Los 20 lideres deben tener un proyecto y una fase utilizables');
  }

  const hoursUsers = [
    ...employeesWithProject.slice(0, 20),
    ...leadersWithProject.slice(0, 5),
  ];
  const hoursIds = new Set(hoursUsers.map((user) => user.id_usuario));
  const remainingEmployees = employees
    .filter((user) => !hoursIds.has(user.id_usuario))
    .sort((a, b) => {
      const aAssigned = a.id_proyecto ? 1 : 0;
      const bAssigned = b.id_proyecto ? 1 : 0;
      return bAssigned - aAssigned || a.id_usuario - b.id_usuario;
    });

  const loginUsers = [
    ...leadersWithProject.slice(5, 9),
    ...remainingEmployees.slice(46, 50),
  ];
  const projectUsers = [
    ...leadersWithProject.slice(14),
    ...remainingEmployees.slice(0, 46),
  ];
  const entryUsers = remainingEmployees.slice(50, 60);
  const exitUsers = leadersWithProject.slice(9, 14);

  const cohorts = [
    ...loginUsers.map((user) => ({ ...user, operation: 'login' })),
    ...projectUsers.map((user) => ({ ...user, operation: 'get_proyectos' })),
    ...hoursUsers.map((user) => ({ ...user, operation: 'post_horas' })),
    ...entryUsers.map((user) => ({ ...user, operation: 'entrada' })),
    ...exitUsers.map((user) => ({ ...user, operation: 'salida' })),
  ];

  const uniqueUsers = new Set(cohorts.map((user) => user.id_usuario));
  const operationCounts = cohorts.reduce((counts, user) => {
    counts[user.operation] = (counts[user.operation] || 0) + 1;
    return counts;
  }, {});

  if (cohorts.length !== 100 || uniqueUsers.size !== 100) {
    fail('Cada uno de los 100 usuarios debe aparecer una sola vez');
  }

  const expectedOperations = {
    login: 8,
    get_proyectos: 52,
    post_horas: 25,
    entrada: 10,
    salida: 5,
  };

  for (const [operation, expected] of Object.entries(expectedOperations)) {
    if (operationCounts[operation] !== expected) {
      fail(
        `${operation} debe tener ${expected} usuarios y tiene ${operationCounts[operation] || 0}`
      );
    }
  }

  return { cohorts, exitUsers };
};

const validatePasswords = async (users) => {
  const validResults = await Promise.all(
    users.map((user) => bcrypt.compare(PASSWORD, user.password))
  );

  if (validResults.some((isValid) => !isValid)) {
    fail('K6_PASSWORD no coincide con todas las cuentas que haran login');
  }
};

const createRuntimeData = ({ cohorts, businessDate }) => ({
  preparedAt: new Date().toISOString(),
  businessDate,
  distribution: {
    login: 8,
    get_proyectos: 52,
    post_horas: 25,
    entrada: 10,
    salida: 5,
  },
  users: cohorts.map((user) => ({
    id_usuario: user.id_usuario,
    email: user.email,
    rol: user.rol,
    operation: user.operation,
    id_proyecto: user.id_proyecto || null,
    id_fase: user.id_fase || null,
    cookie: `access_token=${generateToken({
      id_usuario: user.id_usuario,
      email: user.email,
      rol: user.rol,
      id_empresa: user.id_empresa,
    })}`,
  })),
});

const prepare = async () => {
  if (process.env.ALLOW_PRODUCTION_LOAD !== 'YES') {
    fail('Debes indicar ALLOW_PRODUCTION_LOAD=YES');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('prepare-mixed-100-users'))"
    );

    const usersResult = await client.query(
      `SELECT
         u.id_usuario,
         u.email,
         u.password,
         u.rol,
         u.id_empresa,
         u.is_active,
         u.locked_until,
         COALESCE(employee_assignment.id_proyecto, leader_assignment.id_proyecto)
           AS id_proyecto,
         COALESCE(employee_assignment.id_fase, leader_assignment.id_fase)
           AS id_fase
       FROM usuario u
       LEFT JOIN LATERAL (
         SELECT p.id_proyecto, f.id_fase
         FROM proyecto_empleado pe
         JOIN proyecto p
           ON p.id_proyecto = pe.id_proyecto
          AND p.id_empresa = u.id_empresa
          AND p.is_active = true
          AND p.estado <> 'Finalizado'
          AND p.fecha_fin_real IS NULL
         JOIN LATERAL (
           SELECT id_fase
           FROM fase
           WHERE id_proyecto = p.id_proyecto
             AND is_active = true
           ORDER BY id_fase
           LIMIT 1
         ) f ON true
         WHERE pe.id_empleado = u.id_usuario
         ORDER BY p.id_proyecto
         LIMIT 1
       ) employee_assignment ON u.rol = 'empleado'
       LEFT JOIN LATERAL (
         SELECT p.id_proyecto, f.id_fase
         FROM proyecto p
         JOIN LATERAL (
           SELECT id_fase
           FROM fase
           WHERE id_proyecto = p.id_proyecto
             AND is_active = true
           ORDER BY id_fase
           LIMIT 1
         ) f ON true
         WHERE p.id_lider = u.id_usuario
           AND p.id_empresa = u.id_empresa
           AND p.is_active = true
           AND p.estado <> 'Finalizado'
           AND p.fecha_fin_real IS NULL
         ORDER BY p.id_proyecto
         LIMIT 1
       ) leader_assignment ON u.rol = 'lider'
       WHERE u.id_empresa = $1
         AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'
       ORDER BY u.id_usuario`,
      [COMPANY_ID]
    );

    const { leaders, employees } = validateUsers(usersResult.rows);
    const { cohorts, exitUsers } = buildCohorts({ leaders, employees });
    const loginUsers = cohorts.filter((user) => user.operation === 'login');

    await validatePasswords(loginUsers);

    const projectsResult = await client.query(
      `SELECT COUNT(DISTINCT p.id_lider)::int AS total
       FROM proyecto p
       JOIN usuario u ON u.id_usuario = p.id_lider
       WHERE u.id_empresa = $1
         AND u.email ~ '^lider\\.load[0-9]+@test\\.com$'
         AND p.is_active = true
         AND p.estado <> 'Finalizado'
         AND p.fecha_fin_real IS NULL
         AND (
           SELECT COUNT(*)
           FROM fase f
           WHERE f.id_proyecto = p.id_proyecto
             AND f.is_active = true
         ) >= 3`,
      [COMPANY_ID]
    );

    if (projectsResult.rows[0].total !== 20) {
      fail('Los 20 lideres deben tener un proyecto activo con al menos 3 fases');
    }

    const rateLimitResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM private.login_rate_limits
       WHERE reset_at > NOW()`
    );

    if (rateLimitResult.rows[0].total > 0) {
      fail('Hay ventanas de rate limit activas; espera a que expiren antes de preparar');
    }

    const dateResult = await client.query(
      `SELECT
         timezone('America/Lima', now())::date::text AS business_date,
         EXTRACT(
           EPOCH FROM (
             date_trunc('day', timezone('America/Lima', now()))
             + interval '1 day'
             - timezone('America/Lima', now())
           )
         )::int AS seconds_to_midnight`
    );
    const { business_date: businessDate, seconds_to_midnight: secondsToMidnight } =
      dateResult.rows[0];

    if (secondsToMidnight < 20 * 60) {
      fail('No prepares la prueba a menos de 20 minutos de medianoche en Lima');
    }

    const loadUserIds = cohorts.map((user) => user.id_usuario);
    const exitUserIds = exitUsers.map((user) => user.id_usuario);

    const deletedHours = await client.query(
      `DELETE FROM registro_horas
       WHERE id_empleado = ANY($1::int[])
         AND fecha = $2::date`,
      [loadUserIds, businessDate]
    );
    const deletedMarks = await client.query(
      `DELETE FROM marcaje
       WHERE id_usuario = ANY($1::int[])
         AND fecha = $2::date`,
      [loadUserIds, businessDate]
    );

    await client.query(
      `INSERT INTO marcaje (id_usuario, fecha, hora_entrada)
       SELECT
         id_usuario,
         $2::date,
         timezone('America/Lima', now()) - interval '1 minute'
       FROM unnest($1::int[]) AS users(id_usuario)`,
      [exitUserIds, businessDate]
    );

    await client.query('COMMIT');

    const runtimeData = createRuntimeData({ cohorts, businessDate });
    fs.mkdirSync(path.dirname(RUNTIME_FILE), { recursive: true });
    fs.writeFileSync(RUNTIME_FILE, JSON.stringify(runtimeData, null, 2));

    console.log(`Base preparada para ${businessDate}`);
    console.log(`Registros de horas eliminados: ${deletedHours.rowCount}`);
    console.log(`Marcajes eliminados: ${deletedMarks.rowCount}`);
    console.log(`Entradas abiertas para salida: ${exitUserIds.length}`);
    console.log(`Sesiones generadas: ${RUNTIME_FILE}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

prepare()
  .catch((error) => {
    console.error(`No se pudo preparar la prueba: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
