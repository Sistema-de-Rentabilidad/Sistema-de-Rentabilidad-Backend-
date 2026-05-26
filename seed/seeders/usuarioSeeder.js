const { usuarios } = require('../data');
const { hashPassword } = require('../../src/utils/hash');

async function usuarioSeeder(client) {
  const passwordHash = await hashPassword('Qa123456*');

  for (const usuario of usuarios) {
    await client.query(
      `
      INSERT INTO usuario(
        id_empresa,
        nombre,
        email,
        password,
        rol,
        is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
      [
        usuario.id_empresa,
        usuario.nombre,
        usuario.email,
        passwordHash,
        usuario.rol,
        usuario.is_active,
      ]
    );
  }

  console.log('👥 Usuarios creados');
}

module.exports = usuarioSeeder;