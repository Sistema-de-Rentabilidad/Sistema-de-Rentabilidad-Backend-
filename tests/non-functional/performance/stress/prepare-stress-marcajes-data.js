const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

dotenv.config({ quiet: true });

const COMPANY_ID = 23;
const EXIT_ONLY = process.argv.includes('--salida');
const RUN_ID = process.env.RUN_ID;
const BASE_URL = (
  process.env.BASE_URL ||
  'https://sistema-de-rentabilidad-arb9c.ondigitalocean.app/api'
).replace(/\/+$/, '');
const META_FILE = path.resolve(
  __dirname,
  `../../../../tmp/stress-marcajes${EXIT_ONLY ? '-salida' : ''}-runtime-meta.json`
);
const USERS_FILE = path.resolve(
  __dirname,
  `../../../../tmp/stress-marcajes${EXIT_ONLY ? '-salida' : ''}-runtime-users.json`
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const main = async () => {
  assert(
    process.env.ALLOW_PRODUCTION_STRESS_DATA === 'YES',
    'Debes indicar ALLOW_PRODUCTION_STRESS_DATA=YES'
  );
  assert(
    RUN_ID && /^[A-Za-z0-9-]{3,32}$/.test(RUN_ID),
    'RUN_ID debe tener 3-32 letras, numeros o guiones'
  );
  assert(process.env.DATABASE_URL, 'Falta DATABASE_URL');
  assert(process.env.JWT_SECRET, 'Falta JWT_SECRET del despliegue');
  assert(process.env.JWT_EXPIRES, 'Falta JWT_EXPIRES');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('prepare-stress-marcajes-500'))"
    );

    const dateResult = await client.query(
      `SELECT timezone('America/Lima', now())::date::text AS business_date`
    );
    const businessDate = dateResult.rows[0].business_date;

    const deletedMarks = await client.query(
      `DELETE FROM marcaje m
       USING usuario u
       WHERE m.id_usuario = u.id_usuario
         AND (m.fecha = $1::date OR m.hora_salida IS NULL)
         AND u.id_empresa = $2
         AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'`,
      [businessDate, COMPANY_ID]
    );

    const deletedHours = await client.query(
      `DELETE FROM registro_horas rh
       USING usuario u
       WHERE rh.id_empleado = u.id_usuario
         AND rh.fecha = $1::date
         AND u.id_empresa = $2
         AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'
         AND (
           rh.descripcion LIKE 'K6-STRESS-OP %'
           OR rh.descripcion LIKE 'K6-STRESS-MARCAJES %'
         )`,
      [businessDate, COMPANY_ID]
    );

    const insertedHours = await client.query(
      `WITH employees AS (
         SELECT u.id_usuario
         FROM usuario u
         WHERE u.id_empresa = $2
           AND u.rol = 'empleado'
           AND u.is_active = true
           AND u.email ~ '^empleado\\.load[0-9]+@test\\.com$'
       ),
       assignments AS (
         SELECT
           e.id_usuario,
           selected.id_proyecto,
           selected.id_fase
         FROM employees e
         JOIN LATERAL (
           SELECT p.id_proyecto, f.id_fase
           FROM proyecto_empleado pe
           JOIN proyecto p
             ON p.id_proyecto = pe.id_proyecto
            AND p.is_active = true
           JOIN fase f
             ON f.id_proyecto = p.id_proyecto
            AND f.is_active = true
           WHERE pe.id_empleado = e.id_usuario
             AND NOT EXISTS (
               SELECT 1
               FROM registro_horas existing
               WHERE existing.id_empleado = e.id_usuario
                 AND existing.fecha = $1::date
             )
           ORDER BY p.id_proyecto, f.id_fase
           LIMIT 1
         ) selected ON true
       )
       INSERT INTO registro_horas (
         id_empleado,
         id_proyecto,
         id_fase,
         fecha,
         horas,
         descripcion
       )
       SELECT
         id_usuario,
         id_proyecto,
         id_fase,
         $1::date,
         0.5,
         'K6-STRESS-MARCAJES ' || $3
       FROM assignments`,
      [businessDate, COMPANY_ID, RUN_ID]
    );

    const insertedMarks = EXIT_ONLY
      ? await client.query(
          `INSERT INTO marcaje (id_usuario, fecha, hora_entrada)
           SELECT
             u.id_usuario,
             $1::date,
             timezone('America/Lima', now()) - INTERVAL '10 minutes'
           FROM usuario u
           WHERE u.id_empresa = $2
             AND u.is_active = true
             AND (u.locked_until IS NULL OR u.locked_until <= NOW())
             AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'`,
          [businessDate, COMPANY_ID]
        )
      : { rowCount: 0 };

    const usersResult = await client.query(
      `SELECT
         u.id_usuario,
         u.email,
         u.rol,
         u.id_empresa,
         substring(
           u.email FROM '\\.load([0-9]+)@test\\.com$'
         )::int AS load_index,
         salary.tipo_pago,
         EXISTS (
           SELECT 1
           FROM registro_horas rh
           WHERE rh.id_empleado = u.id_usuario
             AND rh.fecha = $1::date
         ) AS has_hours,
         EXISTS (
           SELECT 1
           FROM marcaje m
           WHERE m.id_usuario = u.id_usuario
             AND m.fecha = $1::date
             AND m.hora_entrada IS NOT NULL
         ) AS has_entry,
         EXISTS (
           SELECT 1
           FROM marcaje m
           WHERE m.id_usuario = u.id_usuario
             AND m.fecha = $1::date
             AND m.hora_salida IS NOT NULL
         ) AS has_exit,
         EXISTS (
           SELECT 1
           FROM marcaje m
           WHERE m.id_usuario = u.id_usuario
             AND m.fecha < $1::date
             AND m.hora_salida IS NULL
         ) AS has_old_open_mark
       FROM usuario u
       LEFT JOIN LATERAL (
         SELECT hs.tipo_pago
         FROM historial_sueldo hs
         WHERE hs.id_usuario = u.id_usuario
           AND hs.fecha_inicio <= $1::date
           AND (hs.fecha_fin IS NULL OR hs.fecha_fin >= $1::date)
         ORDER BY hs.fecha_inicio DESC
         LIMIT 1
       ) salary ON true
       WHERE u.id_empresa = $2
         AND u.is_active = true
         AND (u.locked_until IS NULL OR u.locked_until <= NOW())
         AND u.email ~ '^(lider|empleado)\\.load[0-9]+@test\\.com$'
       ORDER BY u.rol DESC, load_index`,
      [businessDate, COMPANY_ID]
    );

    const leaders = usersResult.rows
      .filter((user) => user.rol === 'lider')
      .sort((a, b) => a.load_index - b.load_index);
    const employees = usersResult.rows
      .filter((user) => user.rol === 'empleado')
      .sort((a, b) => a.load_index - b.load_index);

    assert(leaders.length === 100, `Se esperaban 100 lideres y hay ${leaders.length}`);
    assert(
      employees.length === 400,
      `Se esperaban 400 empleados y hay ${employees.length}`
    );
    assert(
      usersResult.rows.every((user) => user.tipo_pago === 'mensual'),
      'Todos los usuarios deben tener sueldo mensual vigente'
    );
    assert(
      employees.every((user) => user.has_hours),
      'Todos los empleados deben tener horas registradas hoy'
    );
    assert(
      usersResult.rows.every((user) => !user.has_old_open_mark),
      'Todos los usuarios deben quedar sin marcajes historicos abiertos'
    );
    if (EXIT_ONLY) {
      assert(insertedMarks.rowCount === 500, 'No se crearon las 500 entradas');
      assert(
        usersResult.rows.every((user) => user.has_entry && !user.has_exit),
        'Los 500 usuarios deben tener entrada y ninguna salida'
      );
    } else {
      assert(
        usersResult.rows.every((user) => !user.has_entry),
        'Todos los usuarios deben quedar sin marcaje de hoy'
      );
    }

    await client.query('COMMIT');

    const orderedUsers = [];
    for (let index = 0; index < leaders.length; index += 1) {
      orderedUsers.push(leaders[index]);
      orderedUsers.push(...employees.slice(index * 4, (index + 1) * 4));
    }

    const runtimeUsers = orderedUsers.map((user, index) => {
      const token = jwt.sign(
        {
          id_usuario: user.id_usuario,
          email: user.email,
          rol: user.rol,
          id_empresa: user.id_empresa,
        },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.JWT_EXPIRES,
          issuer:
            process.env.JWT_ISSUER || 'sistema-de-rentabilidad-backend',
          audience:
            process.env.JWT_AUDIENCE || 'sistema-de-rentabilidad-client',
          subject: String(user.id_usuario),
        }
      );

      return {
        slot: index + 1,
        id_usuario: user.id_usuario,
        email: user.email,
        rol: user.rol,
        id_empresa: user.id_empresa,
        cookie: `access_token=${token}`,
      };
    });
    const verification = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Cookie: runtimeUsers[0].cookie },
      signal: AbortSignal.timeout(15000),
    });
    assert(
      verification.status === 200,
      'JWT_SECRET no coincide con el despliegue: /auth/me rechazo la cookie'
    );
    const metadata = {
      schemaVersion: 1,
      preparedAt: new Date().toISOString(),
      businessDate,
      runId: RUN_ID,
      operation: EXIT_ONLY ? 'salida' : 'combinada',
      userCount: runtimeUsers.length,
      baseUsers: 100,
      burstUsers: 400,
    };

    fs.mkdirSync(path.dirname(META_FILE), { recursive: true });
    fs.writeFileSync(META_FILE, JSON.stringify(metadata, null, 2));
    fs.writeFileSync(USERS_FILE, JSON.stringify(runtimeUsers));

    console.log(`Preparacion aprobada | fecha=${businessDate} | RUN_ID=${RUN_ID}`);
    console.log(`Marcajes de hoy o abiertos reiniciados: ${deletedMarks.rowCount}`);
    console.log(`Horas K6 reiniciadas: ${deletedHours.rowCount}`);
    console.log(`Horas K6 creadas: ${insertedHours.rowCount}`);
    if (EXIT_ONLY) console.log(`Entradas preparadas: ${insertedMarks.rowCount}`);
    console.log('500 cookies generadas sin login; firma validada contra /auth/me');
    console.log('Runtime: 100 lideres + 400 empleados, ordenados 1:4');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(`No se pudo preparar stress de marcajes: ${error.message}`);
  process.exitCode = 1;
});
