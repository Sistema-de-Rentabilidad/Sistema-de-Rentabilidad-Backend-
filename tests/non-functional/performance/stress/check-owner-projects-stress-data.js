const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ quiet: true });

const RUN_ID = process.env.RUN_ID;
const PASSWORD = process.env.K6_PASSWORD || '12345678';
const RUNTIME_FILE = path.resolve(
  __dirname,
  '../../../../tmp/owner-projects-write-stress-runtime.json'
);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const main = async () => {
  assert(
    RUN_ID && /^[A-Za-z0-9-]{3,32}$/.test(RUN_ID),
    'RUN_ID es obligatorio y debe tener 3-32 letras, numeros o guiones'
  );
  assert(process.env.DATABASE_URL, 'DATABASE_URL es obligatorio');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 10000,
  });
  const client = await pool.connect();

  try {
    await client.query('BEGIN READ ONLY');

    const { rows: owners } = await client.query(
      `WITH owners AS (
         SELECT
           u.id_usuario, u.email, u.password, u.rol, u.id_empresa,
           u.is_active, u.locked_until,
           substring(
             u.email FROM '^propietario\\.carga([1-5])@test\\.com$'
           )::int AS load_index
         FROM usuario u
         WHERE u.email ~ '^propietario\\.carga[1-5]@test\\.com$'
       )
       SELECT
         o.*,
         service.id_servicio,
         COUNT(p.id_proyecto)::int AS active_projects
       FROM owners o
       JOIN empresa e ON e.id_empresa = o.id_empresa
       LEFT JOIN LATERAL (
         SELECT s.id_servicio
         FROM servicio s
         WHERE s.id_empresa = o.id_empresa AND s.is_active = true
         ORDER BY s.id_servicio
         LIMIT 1
       ) service ON true
       LEFT JOIN proyecto p
         ON p.id_empresa = o.id_empresa AND p.is_active = true
       GROUP BY
         o.id_usuario, o.email, o.password, o.rol, o.id_empresa,
         o.is_active, o.locked_until, o.load_index, service.id_servicio
       ORDER BY o.load_index`
    );

    assert(owners.length === 5, `Se encontraron ${owners.length} de 5 propietarios`);

    for (const [offset, owner] of owners.entries()) {
      const email = `propietario.carga${offset + 1}@test.com`;
      assert(owner.email === email, `Falta ${email}`);
      assert(owner.rol === 'propietario' && owner.is_active, `${email} no esta habilitado`);
      assert(
        !owner.locked_until || new Date(owner.locked_until) <= new Date(),
        `${email} esta bloqueado`
      );
      assert(owner.id_servicio, `${email} no tiene servicio activo`);
      assert(await bcrypt.compare(PASSWORD, owner.password), `Password invalido para ${email}`);
    }

    const emailHashes = owners.map(({ email }) =>
      crypto.createHash('sha256').update(email).digest('hex')
    );
    const rateLimits = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM private.login_rate_limits
       WHERE reset_at > NOW() AND email_hash = ANY($1::text[])`,
      [emailHashes]
    );
    assert(rateLimits.rows[0].total === 0, 'Hay rate limits activos para los propietarios');

    const prefix = `K6_OWNER_STRESS_${RUN_ID}_`;
    const collisions = await client.query(
      `SELECT COUNT(*)::int AS total
       FROM proyecto
       WHERE LEFT(nombre, LENGTH($1)) = $1`,
      [prefix]
    );
    assert(collisions.rows[0].total === 0, `RUN_ID ya utilizado: ${RUN_ID}`);

    const dateResult = await client.query(
      `SELECT timezone('America/Lima', now())::date::text AS business_date`
    );
    await client.query('COMMIT');

    const runtime = {
      schemaVersion: 1,
      preparedAt: new Date().toISOString(),
      businessDate: dateResult.rows[0].business_date,
      runId: RUN_ID,
      maxProjects: 20000,
      owners: owners.map((owner) => ({
        id_usuario: owner.id_usuario,
        email: owner.email,
        id_empresa: owner.id_empresa,
        id_servicio: owner.id_servicio,
        activeProjects: owner.active_projects,
      })),
    };

    fs.mkdirSync(path.dirname(RUNTIME_FILE), { recursive: true });
    fs.writeFileSync(RUNTIME_FILE, JSON.stringify(runtime, null, 2));

    console.log(`Preflight aprobado | RUN_ID=${RUN_ID}`);
    for (const owner of runtime.owners) {
      console.log(
        `${owner.email} | empresa ${owner.id_empresa} | ` +
        `servicio ${owner.id_servicio} | proyectos ${owner.activeProjects}`
      );
    }
    console.log(`Runtime: ${RUNTIME_FILE}`);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(`Preflight rechazado: ${error.message}`);
  process.exitCode = 1;
});
