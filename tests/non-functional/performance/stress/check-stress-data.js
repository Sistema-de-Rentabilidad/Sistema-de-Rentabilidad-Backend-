const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const LEVELS = [100, 150, 200, 250, 300, 350, 400, 450, 500];
const OPERATIONS = [
  'login',
  'get_proyectos',
  'post_horas',
  'marcaje_entrada',
  'marcaje_salida',
];
const ALLOCATION_PRIORITY = [
  'marcaje_salida',
  'marcaje_entrada',
  'post_horas',
  'login',
  'get_proyectos',
];
const RUNTIME_METADATA_FILE = path.resolve(
  __dirname,
  '../../../../tmp/stress-operativo-runtime-meta.json'
);
const RUNTIME_USERS_FILE = path.resolve(
  __dirname,
  '../../../../tmp/stress-operativo-runtime-users.json'
);
const DEFAULT_STRESS_ORIGIN =
  'https://sistema-de-rentabilidad-arb9c.ondigitalocean.app';
const STRESS_ORIGIN = process.env.K6_ORIGIN || DEFAULT_STRESS_ORIGIN;
const PASSWORD = process.env.K6_PASSWORD || '12345678';
const PASSWORD_CONCURRENCY = 10;

let pool;

const expectedDistribution = (target) => {
  const extraSteps = (target - 100) / 50;

  return {
    login: 8,
    get_proyectos: 52 + (28 * extraSteps),
    post_horas: 25 + (14 * extraSteps),
    marcaje_entrada: 10 + (5 * extraSteps),
    marcaje_salida: 5 + (3 * extraSteps),
  };
};

const addedDistribution = (target) => (
  target === 100
    ? expectedDistribution(100)
    : {
        login: 0,
        get_proyectos: 28,
        post_horas: 14,
        marcaje_entrada: 5,
        marcaje_salida: 3,
      }
);

const validateCredentials = async (rows, password) => {
  const validated = [];

  for (let index = 0; index < rows.length; index += PASSWORD_CONCURRENCY) {
    const chunk = rows.slice(index, index + PASSWORD_CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (row) => ({
        ...row,
        credential_valid: await bcrypt.compare(password, row.password_hash),
      }))
    );

    validated.push(...results);
  }

  return validated.map(({ password_hash: _passwordHash, ...row }) => row);
};

const buildEligibility = (row) => {
  const unlocked = !row.locked_until ||
    new Date(row.locked_until).getTime() <= Date.now();
  const base = row.is_active === true &&
    Boolean(row.associated_company_id) &&
    row.credential_valid === true &&
    unlocked;
  const canMark = base &&
    ['lider', 'empleado'].includes(row.rol) &&
    !(row.rol === 'empleado' && row.tipo_pago === 'por_hora');

  return {
    login: base,
    get_proyectos: base && Boolean(row.visible_project_id),
    post_horas:
      base &&
      Array.isArray(row.hour_assignments) &&
      row.hour_assignments.length > 0,
    marcaje_entrada: canMark && !row.today_mark_id,
    marcaje_salida:
      canMark &&
      Boolean(row.today_mark_id) &&
      Boolean(row.hora_entrada) &&
      !row.hora_salida &&
      row.exit_time_valid === true &&
      (row.rol === 'lider' || row.has_hours_today === true),
  };
};

const candidateFlexibility = (candidate) => (
  OPERATIONS.reduce(
    (total, operation) => total + (candidate.eligibility[operation] ? 1 : 0),
    0
  )
);

const hourAssignmentCount = (candidate) => (
  Array.isArray(candidate.hour_assignments)
    ? candidate.hour_assignments.length
    : 0
);

const allocateForTarget = (candidates, target) => {
  const required = expectedDistribution(target);
  const used = new Set();
  const selected = Object.fromEntries(
    OPERATIONS.map((operation) => [operation, []])
  );
  const shortfalls = {};

  for (const operation of ALLOCATION_PRIORITY) {
    const eligible = candidates
      .filter(
        (candidate) =>
          !used.has(candidate.id_usuario) &&
          candidate.eligibility[operation]
      )
      .sort((a, b) => {
        if (operation === 'post_horas') {
          const assignmentDifference =
            hourAssignmentCount(b) - hourAssignmentCount(a);

          if (assignmentDifference !== 0) {
            return assignmentDifference;
          }
        }

        return (
          candidateFlexibility(a) - candidateFlexibility(b) ||
          a.load_index - b.load_index ||
          a.id_usuario - b.id_usuario
        );
      });
    const chosen = eligible.slice(0, required[operation]);

    selected[operation].push(...chosen);
    chosen.forEach((candidate) => used.add(candidate.id_usuario));

    if (chosen.length < required[operation]) {
      shortfalls[operation] = required[operation] - chosen.length;
    }
  }

  return {
    target,
    required,
    selected,
    shortfalls,
    ready: Object.keys(shortfalls).length === 0,
  };
};

const buildOrderedUsers = (allocation) => {
  const operationIndexes = Object.fromEntries(
    OPERATIONS.map((operation) => [operation, 0])
  );
  const users = [];

  for (const level of LEVELS.filter((value) => value <= allocation.target)) {
    const additions = addedDistribution(level);

    for (const operation of OPERATIONS) {
      for (let count = 0; count < additions[operation]; count += 1) {
        const operationIndex = operationIndexes[operation];
        const candidate = allocation.selected[operation][operationIndex];

        if (!candidate) {
          throw new Error(
            `Asignacion incompleta para ${operation} en el nivel ${level}`
          );
        }

        operationIndexes[operation] += 1;
        users.push({
          ...candidate,
          operation,
        });
      }
    }
  }

  return users;
};

const printCapacity = (candidates, allocations) => {
  const unlocked = (candidate) =>
    !candidate.locked_until ||
    new Date(candidate.locked_until).getTime() <= Date.now();
  const counts = {
    dedicated: candidates.length,
    active: candidates.filter((candidate) => candidate.is_active === true).length,
    credentials: candidates.filter((candidate) => candidate.credential_valid).length,
    company: candidates.filter(
      (candidate) => candidate.associated_company_id
    ).length,
    unlocked: candidates.filter(unlocked).length,
    visibleProjects: candidates.filter(
      (candidate) => candidate.eligibility.get_proyectos
    ).length,
    hours: candidates.filter(
      (candidate) => candidate.eligibility.post_horas
    ).length,
    hourAssignments: candidates.reduce(
      (total, candidate) => total + hourAssignmentCount(candidate),
      0
    ),
    entry: candidates.filter(
      (candidate) => candidate.eligibility.marcaje_entrada
    ).length,
    exit: candidates.filter(
      (candidate) => candidate.eligibility.marcaje_salida
    ).length,
  };

  console.log('Resumen de datos dedicados para stress');
  console.log(`Usuarios encontrados: ${counts.dedicated}`);
  console.log(`Usuarios activos: ${counts.active}`);
  console.log(`Credenciales validas: ${counts.credentials}`);
  console.log(`Usuarios con empresa: ${counts.company}`);
  console.log(`Usuarios no bloqueados: ${counts.unlocked}`);
  console.log(`Usuarios con proyectos visibles: ${counts.visibleProjects}`);
  console.log(`Usuarios listos para horas: ${counts.hours}`);
  console.log(`Combinaciones proyecto/fase disponibles: ${counts.hourAssignments}`);
  console.log(`Usuarios disponibles para entrada: ${counts.entry}`);
  console.log(`Usuarios preparados para salida: ${counts.exit}`);
  console.log('');
  console.log('Capacidad por nivel');

  for (const allocation of allocations) {
    if (allocation.ready) {
      console.log(`${allocation.target} VUs: LISTO`);
      continue;
    }

    const details = Object.entries(allocation.shortfalls)
      .map(([operation, missing]) => `${operation}: faltan ${missing}`)
      .join(', ');
    console.log(`${allocation.target} VUs: NO LISTO (${details})`);
  }
};

const printProposal = (allocation) => {
  if (!allocation) {
    console.log('La base ya cubre el objetivo maximo de 500 VUs.');
    return;
  }

  console.log('');
  console.log(`Datos a preparar para alcanzar ${allocation.target} VUs:`);

  for (const [operation, missing] of Object.entries(allocation.shortfalls)) {
    const suggestions = {
      login:
        'usuarios dedicados activos, no bloqueados, con empresa y K6_PASSWORD valido',
      get_proyectos:
        'usuarios dedicados con un proyecto activo visible segun su rol',
      post_horas:
        'usuarios con proyecto no finalizado, fase activa y sin registro duplicado hoy',
      marcaje_entrada:
        'lideres o empleados no pagados por hora y sin marcaje de hoy',
      marcaje_salida:
        'usuarios con entrada abierta; los empleados tambien requieren horas registradas hoy',
    };

    console.log(`- ${operation}: ${missing} ${suggestions[operation]}`);
  }

  console.log(
    'No se insertaron datos. Crea o prepara esas cuentas manualmente y vuelve a ejecutar el checker.'
  );
};

const readDatabaseSnapshot = async (client) => {
  await client.query(
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY'
  );

  try {
    const dateResult = await client.query(
      `SELECT
         timezone('America/Lima', now())::date::text AS business_date`
    );
    const businessDate = dateResult.rows[0].business_date;
    const usersResult = await client.query(
      `SELECT
         u.id_usuario,
         u.email,
         u.password AS password_hash,
         u.rol,
         u.id_empresa,
         e.id_empresa AS associated_company_id,
         u.is_active,
         u.locked_until,
         substring(
           u.email FROM '\\.load([0-9]+)@test\\.com$'
         )::int AS load_index,
         salary.tipo_pago,
         visible_project.id_proyecto AS visible_project_id,
         hours_assignment.assignments AS hour_assignments,
         today_mark.id_marcaje AS today_mark_id,
         today_mark.hora_entrada,
         today_mark.hora_salida,
         (
           today_mark.hora_entrada IS NOT NULL
           AND today_mark.hora_entrada < timezone('America/Lima', now())
         ) AS exit_time_valid,
         (today_hours.total_records > 0) AS has_hours_today
       FROM usuario u
       LEFT JOIN empresa e
         ON e.id_empresa = u.id_empresa
       LEFT JOIN LATERAL (
         SELECT hs.tipo_pago
         FROM historial_sueldo hs
         WHERE hs.id_usuario = u.id_usuario
           AND hs.fecha_inicio <= $1::date
           AND (hs.fecha_fin IS NULL OR hs.fecha_fin >= $1::date)
         ORDER BY hs.fecha_inicio DESC
         LIMIT 1
       ) salary ON true
       LEFT JOIN LATERAL (
         SELECT p.id_proyecto
         FROM proyecto p
         WHERE p.id_empresa = u.id_empresa
           AND p.is_active = true
           AND (
             (u.rol = 'lider' AND p.id_lider = u.id_usuario)
             OR (
               u.rol = 'empleado'
               AND EXISTS (
                 SELECT 1
                 FROM proyecto_empleado pe
                 WHERE pe.id_proyecto = p.id_proyecto
                   AND pe.id_empleado = u.id_usuario
               )
             )
           )
         ORDER BY p.id_proyecto
         LIMIT 1
       ) visible_project ON true
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*)::int AS total_records,
           COALESCE(SUM(rh_today.horas), 0)::numeric AS total_hours
         FROM registro_horas rh_today
         WHERE rh_today.id_empleado = u.id_usuario
           AND rh_today.fecha = $1::date
       ) today_hours ON true
       LEFT JOIN LATERAL (
         SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id_proyecto', available.id_proyecto,
               'id_fase', available.id_fase
             )
             ORDER BY available.id_proyecto, available.id_fase
           ),
           '[]'::jsonb
         ) AS assignments
         FROM (
           SELECT p.id_proyecto, f.id_fase
           FROM proyecto p
           JOIN fase f
             ON f.id_proyecto = p.id_proyecto
            AND f.is_active = true
           WHERE p.id_empresa = u.id_empresa
             AND p.is_active = true
             AND p.estado <> 'Finalizado'
             AND p.fecha_fin_real IS NULL
             AND (
               (u.rol = 'lider' AND p.id_lider = u.id_usuario)
               OR (
                 u.rol = 'empleado'
                 AND EXISTS (
                   SELECT 1
                   FROM proyecto_empleado pe
                   WHERE pe.id_proyecto = p.id_proyecto
                     AND pe.id_empleado = u.id_usuario
                 )
               )
             )
             AND NOT EXISTS (
               SELECT 1
               FROM registro_horas rh_duplicate
               WHERE rh_duplicate.id_empleado = u.id_usuario
                 AND rh_duplicate.id_fase = f.id_fase
                 AND rh_duplicate.fecha = $1::date
             )
           ORDER BY p.id_proyecto, f.id_fase
           LIMIT GREATEST(
             0,
             FLOOR((24 - today_hours.total_hours) / 0.5)::int
           )
         ) available
       ) hours_assignment ON true
       LEFT JOIN marcaje today_mark
         ON today_mark.id_usuario = u.id_usuario
        AND today_mark.fecha = $1::date
       WHERE u.rol IN ('lider', 'empleado')
         AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'
       ORDER BY load_index, u.id_usuario`,
      [businessDate]
    );
    const rateLimitResult = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM private.login_rate_limits
       WHERE reset_at > NOW()`
    );

    await client.query('COMMIT');

    return {
      businessDate,
      users: usersResult.rows,
      activeRateLimitWindows: rateLimitResult.rows[0].total,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

const createRuntime = ({
  allocation,
  businessDate,
  frontendOrigin,
  generateToken,
}) => {
  const orderedUsers = buildOrderedUsers(allocation);

  return {
    schemaVersion: 2,
    prefix: 'K6-STRESS-OP',
    preparedAt: new Date().toISOString(),
    businessDate,
    origin: frontendOrigin,
    capacity: {
      maxSupportedVUs: allocation.target,
      supportedLevels: LEVELS.filter((level) => level <= allocation.target),
    },
    distribution: expectedDistribution(allocation.target),
    batches: LEVELS
      .filter((level) => level <= allocation.target)
      .map((level) => ({
        target: level,
        added: addedDistribution(level),
      })),
    users: orderedUsers.map((user, index) => {
      const hourAssignments =
        user.operation === 'post_horas' ? user.hour_assignments : [];
      const firstAssignment = hourAssignments[0];

      return {
        slot: index + 1,
        id_usuario: user.id_usuario,
        email: user.email,
        rol: user.rol,
        id_empresa: user.id_empresa,
        operation: user.operation,
        id_proyecto: firstAssignment?.id_proyecto || null,
        id_fase: firstAssignment?.id_fase || null,
        hour_assignments: hourAssignments,
        cookie: `access_token=${generateToken({
          id_usuario: user.id_usuario,
          email: user.email,
          rol: user.rol,
          id_empresa: user.id_empresa,
        })}`,
      };
    }),
  };
};

const main = async () => {
  if (process.env.ALLOW_PRODUCTION_STRESS !== 'YES') {
    throw new Error('Debes indicar ALLOW_PRODUCTION_STRESS=YES');
  }

  pool = require('../../../../src/config/db');
  const { generateToken } = require('../../../../src/utils/jwt');
  const client = await pool.connect();
  let snapshot;

  try {
    snapshot = await readDatabaseSnapshot(client);
  } finally {
    client.release();
  }

  const validatedRows = await validateCredentials(
    snapshot.users,
    PASSWORD
  );
  const candidates = validatedRows.map((row) => ({
    ...row,
    eligibility: buildEligibility(row),
  }));
  const allocations = LEVELS.map((level) =>
    allocateForTarget(candidates, level)
  );
  const supported = allocations.filter((allocation) => allocation.ready);
  const maximumAllocation = supported.at(-1);

  printCapacity(candidates, allocations);

  if (snapshot.activeRateLimitWindows > 0) {
    console.warn('');
    console.warn(
      `Advertencia: hay ${snapshot.activeRateLimitWindows} ventanas de rate limit activas.`
    );
    console.warn(
      'El origen de la futura ejecucion puede ser distinto; si aparece 429, espera a que expire la ventana.'
    );
  }

  if (!maximumAllocation) {
    printProposal(allocations[0]);
    throw new Error(
      'La base no alcanza el minimo de 100 VUs; no se genero un runtime nuevo'
    );
  }

  const runtime = createRuntime({
    allocation: maximumAllocation,
    businessDate: snapshot.businessDate,
    frontendOrigin: STRESS_ORIGIN,
    generateToken,
  });

  const { users, ...metadata } = runtime;
  metadata.userCount = users.length;
  metadata.usersFile = path.basename(RUNTIME_USERS_FILE);

  fs.mkdirSync(path.dirname(RUNTIME_METADATA_FILE), { recursive: true });
  fs.writeFileSync(
    RUNTIME_METADATA_FILE,
    JSON.stringify(metadata, null, 2)
  );
  fs.writeFileSync(
    RUNTIME_USERS_FILE,
    JSON.stringify(users)
  );

  console.log('');
  console.log(`Maximo ejecutable con los datos actuales: ${maximumAllocation.target} VUs`);
  console.log(`Metadatos generados: ${RUNTIME_METADATA_FILE}`);
  console.log(`Usuarios compartidos generados: ${RUNTIME_USERS_FILE}`);

  const nextUnsupported = allocations.find(
    (allocation) => allocation.target > maximumAllocation.target
  );
  printProposal(nextUnsupported);
};

if (require.main === module) {
  main()
    .catch((error) => {
      console.error(`No se pudo verificar el stress operativo: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (pool) {
        await pool.end();
      }
    });
}

module.exports = {
  allocateForTarget,
  buildEligibility,
  buildOrderedUsers,
  expectedDistribution,
};
