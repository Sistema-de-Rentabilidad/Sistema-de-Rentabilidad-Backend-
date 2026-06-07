const bcrypt = require('bcrypt');
const pool = require('../../src/config/db');
const { crearEmpresaTemporal, eliminarEmpresaTemporal } = require('./empresa.helper');

async function crearUsuarioTemporal(options = {}) {

    const {
        rol = 'propietario',
        idEmpresa = null,
        nombre = null,
        email = null,
        passwordPlano = 'Qa123456*',
        isActive = true,
    } = options;

    const timestamp = Date.now();

    const passwordHash = await bcrypt.hash(
        passwordPlano,
        10
    );

    const empresa = idEmpresa ? { id_empresa: idEmpresa } : await crearEmpresaTemporal();

    const userNombre = nombre || `QA Usuario ${timestamp}`;
    const userEmail = (email || `qa_${rol}_${timestamp}@test.com`).toLowerCase();

    const result = await pool.query(
        `
        INSERT INTO usuario (
            id_empresa,
            nombre,
            email,
            password,
            rol,
            is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
        `,
        [
            empresa.id_empresa,
            userNombre,
            userEmail,
            passwordHash,
            rol,
            isActive,
        ]
    );

    return {
        ...result.rows[0],
        passwordPlano,
        __createdEmpresaId: empresa.id_empresa
    };

}

async function eliminarUsuarioTemporal(idUsuario) {

    // Obtener empresa asociada antes de eliminar el usuario
    const res = await pool.query(
        `SELECT id_empresa FROM usuario WHERE id_usuario = $1`,
        [idUsuario]
    );

    const idEmpresa = res.rows[0]?.id_empresa;

    await pool.query(
        `
        DELETE FROM historial_sueldo
        WHERE id_usuario = $1
        `,
        [idUsuario]
    );

    await pool.query(
        `
        DELETE FROM usuario
        WHERE id_usuario = $1
        `,
        [idUsuario]
    );

    // Si la empresa parece ser temporal (nombre empieza con 'QA Empresa '), eliminarla
    if (idEmpresa) {
        const empresaRes = await pool.query(
            `SELECT nombre FROM empresa WHERE id_empresa = $1`,
            [idEmpresa]
        );

        const nombre = empresaRes.rows[0]?.nombre || '';

        if (nombre.startsWith('QA Empresa ')) {
            await eliminarEmpresaTemporal(idEmpresa);
        }
    }

}

module.exports = {
    crearUsuarioTemporal,
    eliminarUsuarioTemporal
};