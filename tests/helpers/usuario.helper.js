const bcrypt = require('bcrypt');
const pool = require('../../src/config/db');

async function crearUsuarioTemporal() {

    const timestamp = Date.now();

    const passwordPlano = 'Qa123456*';

    const passwordHash = await bcrypt.hash(
        passwordPlano,
        10
    );

    const result = await pool.query(
        `
        INSERT INTO usuario (
            id_empresa,
            nombre,
            email,
            password,
            rol
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
            1,
            `QA Usuario ${timestamp}`,
            `qa_${timestamp}@test.com`,
            passwordHash,
            'propietario'
        ]
    );

    return {
        ...result.rows[0],
        passwordPlano
    };

}

async function eliminarUsuarioTemporal(idUsuario) {

    await pool.query(
        `
        DELETE FROM usuario
        WHERE id_usuario = $1
        `,
        [idUsuario]
    );

}

module.exports = {
    crearUsuarioTemporal,
    eliminarUsuarioTemporal
};