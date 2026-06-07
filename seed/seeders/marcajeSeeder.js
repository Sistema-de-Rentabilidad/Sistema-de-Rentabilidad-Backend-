const dayjs = require('dayjs');
const { marcajes } = require('../data');

function randomHour(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function marcajesSeeder(client) {
  for (const marcaje of marcajes) {
    const fecha = dayjs()
      .subtract(Math.floor(Math.random() * 15), 'day')
      .format('YYYY-MM-DD');

    // Entrada entre 8 y 10 AM
    const horaEntrada = dayjs(fecha)
      .hour(randomHour(8, 10))
      .minute(randomHour(0, 59))
      .second(0)
      .format('YYYY-MM-DD HH:mm:ss');

    // Salida entre 5 y 7 PM
    const horaSalida = dayjs(fecha)
      .hour(randomHour(17, 19))
      .minute(randomHour(0, 59))
      .second(0)
      .format('YYYY-MM-DD HH:mm:ss');

    await client.query(
      `
      INSERT INTO marcaje(
        id_usuario,
        fecha,
        hora_entrada,
        hora_salida
      )
      VALUES ($1,$2,$3,$4)
    `,
      [
        marcaje.id_usuario,
        fecha,
        horaEntrada,
        horaSalida
      ]
    );
  }

  console.log('🕒 Marcajes creados');
}

module.exports = marcajesSeeder;