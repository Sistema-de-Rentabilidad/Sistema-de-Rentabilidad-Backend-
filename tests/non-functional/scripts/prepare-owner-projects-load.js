const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const pool = require('../../../src/config/db');

const PASSWORD = process.env.K6_PASSWORD || '12345678';
const RUNTIME_FILE = path.resolve(
  __dirname,
  '../../../tmp/owner-projects-load-data.json'
);

const fail = (message) => {
  throw new Error(message);
};

const validateOwners = async (owners) => {
  if (owners.length !== 5) {
    fail(`Se esperaban 5 propietarios de carga y se encontraron ${owners.length}`);
  }

  if (owners.some((owner, index) => owner.load_index !== index + 1)) {
    fail('Deben existir propietario.carga1@test.com hasta propietario.carga5@test.com');
  }

  if (owners.some((owner) => !owner.is_active)) {
    fail('Los 5 propietarios deben estar activos');
  }

  if (owners.some((owner) => !owner.id_empresa)) {
    fail('Cada propietario debe tener una empresa asociada');
  }

  const ownerWithoutService = owners.find((owner) => !owner.id_servicio);
  if (ownerWithoutService) {
    fail(`${ownerWithoutService.email} no tiene un servicio activo`);
  }

  const lockedOwner = owners.find(
    (owner) =>
      owner.locked_until &&
      new Date(owner.locked_until).getTime() > Date.now()
  );
  if (lockedOwner) {
    fail(`${lockedOwner.email} esta bloqueado`);
  }

  const passwordResults = await Promise.all(
    owners.map((owner) => bcrypt.compare(PASSWORD, owner.password))
  );
  const invalidPasswordIndex = passwordResults.findIndex((isValid) => !isValid);

  if (invalidPasswordIndex >= 0) {
    fail(`K6_PASSWORD no coincide con ${owners[invalidPasswordIndex].email}`);
  }
};

const prepare = async () => {
  const ownersResult = await pool.query(
    `WITH owner_candidates AS (
       SELECT
         u.id_usuario,
         u.email,
         u.password,
         u.rol,
         u.id_empresa,
         u.is_active,
         u.locked_until,
         substring(
           u.email FROM '^propietario\\.carga([0-9]+)@test\\.com$'
         )::int AS load_index
       FROM usuario u
       INNER JOIN empresa e ON e.id_empresa = u.id_empresa
       WHERE u.rol = 'propietario'
         AND u.email ~ '^propietario\\.carga[0-9]+@test\\.com$'
     )
     SELECT
       owner_candidates.*,
       service.id_servicio
     FROM owner_candidates
     LEFT JOIN LATERAL (
       SELECT s.id_servicio
       FROM servicio s
       WHERE s.id_empresa = owner_candidates.id_empresa
         AND s.is_active = true
       ORDER BY s.id_servicio
       LIMIT 1
     ) service ON true
     WHERE owner_candidates.load_index BETWEEN 1 AND 5
     ORDER BY owner_candidates.load_index`
  );

  const owners = ownersResult.rows;
  await validateOwners(owners);

  const rateLimitResult = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM private.login_rate_limits
     WHERE reset_at > NOW()`
  );

  if (rateLimitResult.rows[0].total > 0) {
    fail('Hay ventanas de rate limit activas; espera a que expiren');
  }

  const runtimeData = {
    owners: owners.map((owner) => ({
      id_usuario: owner.id_usuario,
      email: owner.email,
      rol: owner.rol,
      id_empresa: owner.id_empresa,
      id_servicio: owner.id_servicio,
    })),
  };

  fs.mkdirSync(path.dirname(RUNTIME_FILE), { recursive: true });
  fs.writeFileSync(RUNTIME_FILE, JSON.stringify(runtimeData, null, 2));

  console.log('Datos de propietarios validados');
  for (const owner of runtimeData.owners) {
    console.log(
      `${owner.email} | empresa ${owner.id_empresa} | servicio ${owner.id_servicio}`
    );
  }
  console.log(`Runtime generado: ${RUNTIME_FILE}`);
};

prepare()
  .catch((error) => {
    console.error(`No se pudo preparar la prueba: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
