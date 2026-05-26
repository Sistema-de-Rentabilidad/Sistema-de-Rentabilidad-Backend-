const { faseEmpleados } = require('../data');

async function faseEmpleadoSeeder(client) {
  for (const faseEmpleado of faseEmpleados) {
    await client.query(
      `
      INSERT INTO fase_empleado (
        id_fase,
        id_empleado
      )
      VALUES
      ($1, $2)
    `,
      [faseEmpleado.id_fase, faseEmpleado.id_empleado]
    );
  }

  console.log('📌 Asignaciones de faseEmpleados creadas');
}

module.exports = faseEmpleadoSeeder;