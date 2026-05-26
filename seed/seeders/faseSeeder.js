const { fases } = require('../data');

async function faseSeeder(client) {
  for (const fase of fases) {
    await client.query(
      `
      INSERT INTO fase (
        id_proyecto,
        nombre,
        horas_estimadas,
        is_active
      )
      VALUES
      ($1, $2, $3, $4)
    `,
      [
        fase.id_proyecto,
        fase.nombre,
        fase.horas_estimadas,
        fase.is_active
      ]
    );
  }

  console.log('🧩 Fases creadas');
}

module.exports = faseSeeder;