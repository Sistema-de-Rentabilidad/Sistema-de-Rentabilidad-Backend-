async function cleanSeeder(client) {
  await client.query(`
    TRUNCATE TABLE
      proyecto_empleado,
      fase_empleado,
      registro_horas,
      marcaje,
      nota,
      fase,
      proyecto,
      historial_sueldo,
      usuario,
      servicio,
      empresa
    RESTART IDENTITY CASCADE;
  `);

  console.log('🧹 Datos limpiados');
}

module.exports = cleanSeeder;