const { empresas } = require('../data');

async function empresaSeeder(client) {
  for (const empresa of empresas) {
    await client.query(
      `
      INSERT INTO empresa(nombre)
      VALUES ($1)
    `,
      [empresa.nombre]
    );
  }

  console.log('🏢 Empresas creadas');
}

module.exports = empresaSeeder;