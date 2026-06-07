const { registroHoras } = require('../data');
const dayjs = require('dayjs');

async function registroHorasSeeder(client) {
  for (const registro of registroHoras) {
    const fechaRandom = dayjs()
      .subtract(Math.floor(Math.random() * 30), 'day')
      .format('YYYY-MM-DD');

    const horasRandom = Math.floor(Math.random() * 8) + 1;

    await client.query(
      `
      INSERT INTO registro_horas(
        id_empleado,
        id_proyecto,
        fecha,
        horas,
        descripcion,
        id_fase
      )
      VALUES ($1,$2,$3,$4,$5,$6)
    `,
      [
        registro.id_empleado,
        registro.id_proyecto,
        fechaRandom,
        horasRandom,
        registro.descripcion,
        registro.id_fase
      ]
    );
  }

  console.log('⏱️ Registros de horas creados');
}

module.exports = registroHorasSeeder;