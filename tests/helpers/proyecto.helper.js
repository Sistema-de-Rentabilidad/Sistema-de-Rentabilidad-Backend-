const pool = require('../../src/config/db');

const crearProyectoTemporal = async (overrides = {}) => {

    const proyecto = {
        id_empresa: 1,
        id_servicio: 1,
        id_lider: 3,
        nombre: `Proyecto QA ${Date.now()}`,
        descripcion: 'Proyecto temporal testing',
        presupuesto: 1000,
        fecha_inicio: '2025-01-01',
        fecha_fin_estimada: '2025-12-31',
        margen: 20,
        ...overrides
    };

    const result = await pool.query(
        `
        INSERT INTO proyecto (
            id_empresa,
            id_servicio,
            id_lider,
            nombre,
            descripcion,
            presupuesto,
            fecha_inicio,
            fecha_fin_estimada,
            margen
        )
        VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9
        )
        RETURNING *
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
            proyecto.margen
        ]
    );

    return result.rows[0];

};

const eliminarProyectoTemporal = async (idProyecto) => {

    await pool.query(
        `
        DELETE FROM proyecto
        WHERE id_proyecto = $1
        `,
        [idProyecto]
    );

};

module.exports = {
    crearProyectoTemporal,
    eliminarProyectoTemporal
};