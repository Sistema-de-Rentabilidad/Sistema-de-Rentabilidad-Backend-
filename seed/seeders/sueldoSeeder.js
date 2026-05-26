const { historialSueldos } = require('../data');

async function sueldoSeeder(client) {
  for (const sueldo of historialSueldos) {
    await client.query(
      `
      INSERT INTO historial_sueldo (
        id_usuario,
        tipo_pago,
        monto,
        fecha_inicio,
        horas_mensuales
      )
      VALUES ($1,$2,$3,$4,$5)
    `,
      [
        sueldo.id_usuario,
        sueldo.tipo_pago,
        sueldo.monto,
        sueldo.fecha_inicio,
        sueldo.horas_mensuales
      ]
    );
  }

  console.log('🛠 sueldos creados');
}

module.exports = sueldoSeeder;