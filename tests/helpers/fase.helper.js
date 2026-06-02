const pool = require('../../src/config/db');

const crearFaseTemporal = async (overrides = {}) => {

    const result = await pool.query(
        `
        INSERT INTO fase (
            id_proyecto,
            nombre,
            horas_estimadas
        )
        VALUES
        (
            $1,$2,$3
        )
        RETURNING *
        `,
        [
            overrides.id_proyecto || 1,
            overrides.nombre || `Fase QA ${Date.now()}`,
            overrides.horas_estimadas || 40
        ]
    );

    return result.rows[0];
};

const eliminarFaseTemporal = async (idFase) => {

    await pool.query(
        `DELETE FROM fase WHERE id_fase = $1`,
        [idFase]
    );
};

module.exports = {
    crearFaseTemporal,
    eliminarFaseTemporal
};