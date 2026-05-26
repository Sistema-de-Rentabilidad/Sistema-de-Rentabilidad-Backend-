const dayjs = require('dayjs');
const { notas } = require('../data');

async function notasSeeder(client) {
  for (const nota of notas) {
    const fecha = dayjs()
      .subtract(Math.floor(Math.random() * 20), 'day')
      .format('YYYY-MM-DD HH:mm:ss');

    await client.query(
      `
      INSERT INTO nota(
        id_lider,
        id_proyecto,
        descripcion,
        fecha,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5)
    `,
      [
        nota.id_usuario,
        nota.id_proyecto,
        nota.descripcion,
        fecha,
        nota.is_active
      ]
    );
  }

  console.log('📝 Notas creadas');
}

module.exports = notasSeeder;