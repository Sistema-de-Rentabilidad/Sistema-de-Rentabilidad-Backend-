require('dotenv').config({ path: '.env.qa' });

const pool = require('../src/config/db');

const cleanSeeder = require('./seeders/cleanSeeder');

const empresaSeeder = require('./seeders/empresaSeeder');
const servicioSeeder = require('./seeders/servicioSeeder');
const usuarioSeeder = require('./seeders/usuarioSeeder');

const faseSeeder = require('./seeders/faseSeeder');

const proyectoSeeder = require('./seeders/proyectoSeeder');

const proyectoEmpleadoSeeder = require('./seeders/proyectoEmpleadoSeeder');
const faseEmpleadoSeeder = require('./seeders/faseEmpleadoSeeder');

const registroHorasSeeder = require('./seeders/registroHorasSeeder');
const marcajeSeeder = require('./seeders/marcajeSeeder');
const notaSeeder = require('./seeders/notaSeeder');
const sueldoSeeder = require('./seeders/sueldoSeeder');

async function runSeeds() {
  const client = await pool.connect();

  try {
    console.log('🌱 Iniciando seeds QA...');

    await client.query('BEGIN');

    // LIMPIEZA
    await cleanSeeder(client);

    // TABLAS BASE
    await empresaSeeder(client);
    await servicioSeeder(client);
    await usuarioSeeder(client);

    // DEPENDENCIAS
    await proyectoSeeder(client);
    await faseSeeder(client);

    // TABLAS RELACIONALES
    await proyectoEmpleadoSeeder(client);
    await faseEmpleadoSeeder(client);

    // ACTIVIDAD
    await registroHorasSeeder(client);
    await marcajeSeeder(client);
    await notaSeeder(client);
    await sueldoSeeder(client);

    await client.query('COMMIT');

    console.log('✅ Seeds QA ejecutados');
    console.log('');
    console.log('🔐 Password para usuarios creados: Qa123456*');
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('❌ Error ejecutando seeds:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

runSeeds();