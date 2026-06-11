const pool = require('../../src/config/db');

// Obtiene datos válidos para un proyecto
const getRelacionValidaProyecto = async (
    idProyecto
) => {

    /**
     * Obtener:
     * - una fase del proyecto
     * - un empleado asignado al proyecto
     */
    const result = await pool.query(
        `
        SELECT
            pe.id_proyecto,
            pe.id_empleado,
            f.id_fase
        FROM proyecto_empleado pe
        CROSS JOIN fase f
        WHERE pe.id_proyecto = $1
          AND f.id_proyecto = $1
        LIMIT 1
        `,
        [idProyecto]
    );

    if (result.rows.length === 0) {

        throw new Error(
            `No existen datos válidos para el proyecto ${idProyecto}`
        );

    }

    return result.rows[0];

};

/**
 * Crear registro de horas reutilizable
 */
const createRegistroHoras = async ({
    idProyecto,
    idFase,
    idEmpleado,
    fecha = new Date(),
    horas = 1,
    descripcion = 'QA_TEST'
}) => {

    /**
     * Validar:
     * - fase pertenece al proyecto
     * - empleado pertenece al proyecto
     */

    const validacion = await pool.query(
        `
        SELECT 1
        FROM proyecto_empleado pe
        INNER JOIN fase f
            ON f.id_proyecto = pe.id_proyecto
        WHERE pe.id_proyecto = $1
          AND pe.id_empleado = $2
          AND f.id_fase = $3
        LIMIT 1
        `,
        [
            idProyecto,
            idEmpleado,
            idFase
        ]
    );

    if (validacion.rows.length === 0) {

        throw new Error(
            'Relación inválida entre proyecto, fase y empleado'
        );

    }

    const result = await pool.query(
        `
        INSERT INTO registro_horas (
            id_proyecto,
            id_fase,
            id_empleado,
            fecha,
            horas,
            descripcion
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6
        )
        RETURNING *
        `,
        [
            idProyecto,
            idFase,
            idEmpleado,
            fecha,
            horas,
            descripcion
        ]
    );

    return result.rows[0];

};

/**
 * Elimina registro por ID
 */
const deleteRegistroHorasById = async (
    idRegistro
) => {

    await pool.query(
        `
        DELETE FROM registro_horas
        WHERE id_registro = $1
        `,
        [idRegistro]
    );

};

/**
 * Elimina registros por descripción
 *
 * Útil para limpieza masiva QA
 */
const deleteRegistroHorasByDescripcion = async (
    descripcion
) => {

    await pool.query(
        `
        DELETE FROM registro_horas
        WHERE descripcion = $1
        `,
        [descripcion]
    );

};

module.exports = {
    getRelacionValidaProyecto,
    createRegistroHoras,
    deleteRegistroHorasById,
    deleteRegistroHorasByDescripcion
};