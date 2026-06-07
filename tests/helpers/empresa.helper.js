const pool = require('../../src/config/db');

async function crearEmpresaTemporal() {
    const timestamp = Date.now();

    const nombre = `QA Empresa ${timestamp}`;

    const res = await pool.query(
        `INSERT INTO empresa (nombre) VALUES ($1) RETURNING *`,
        [nombre]
    );

    return res.rows[0];
}

async function eliminarEmpresaTemporal(idEmpresa) {
    if (!idEmpresa) return;

    await pool.query(
        `DELETE FROM empresa WHERE id_empresa = $1`,
        [idEmpresa]
    );
}

module.exports = {
    crearEmpresaTemporal,
    eliminarEmpresaTemporal
};
