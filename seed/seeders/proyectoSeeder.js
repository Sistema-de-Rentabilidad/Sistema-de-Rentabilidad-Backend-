const { proyectos } = require('../data');

async function proyectoSeeder(client) {
  for (const proyecto of proyectos) {
    await client.query(
      `
      INSERT INTO proyecto(
        id_empresa,
        id_servicio,
        id_lider,
        nombre,
        descripcion,
        presupuesto,
        fecha_inicio,
        fecha_fin_estimada,
        fecha_fin_real,
        margen,
        is_active
      )
      VALUES (
        $1,$2,$3,$4,$5,
        $6,$7,$8,$9,$10,$11
      )
    `,
      [
        proyecto.id_empresa,
        proyecto.id_servicio,
        proyecto.id_lider,
        proyecto.nombre,
        proyecto.descripcion,
        proyecto.presupuesto,
        proyecto.fecha_inicio,
        proyecto.fecha_fin_estimada,
        proyecto.fecha_fin_real,
        proyecto.margen,
        proyecto.is_active,
      ]
    );
  }

  console.log('📁 Proyectos creados');
}

module.exports = proyectoSeeder;