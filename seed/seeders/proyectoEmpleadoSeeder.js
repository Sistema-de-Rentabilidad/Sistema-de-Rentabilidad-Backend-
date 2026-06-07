const { proyectoEmpleados } = require('../data');

async function proyectoEmpleadoSeeder(client) {
  for (const proyectoEmpleado of proyectoEmpleados) {
    await client.query(
      `
      INSERT INTO proyecto_empleado (
        id_proyecto,
        id_empleado
      )
      VALUES
      ($1, $2)
    `,
      [proyectoEmpleado.id_proyecto, proyectoEmpleado.id_empleado]
    );
  }

  console.log('📌 Asignaciones de proyectoEmpleados creadas');
}

module.exports = proyectoEmpleadoSeeder;