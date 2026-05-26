const { servicios } = require('../data');

async function servicioSeeder(client) {
  for (const servicio of servicios) {
    await client.query(
      `
      INSERT INTO servicio(
        id_empresa, 
        nombre, 
        descripcion,
        is_active
      )
      VALUES ($1,$2,$3,$4)
    `,
      [
        servicio.id_empresa,
        servicio.nombre,
        servicio.descripcion,
        servicio.is_active
      ]
    );
  }

  console.log('🛠 Servicios creados');
}

module.exports = servicioSeeder;