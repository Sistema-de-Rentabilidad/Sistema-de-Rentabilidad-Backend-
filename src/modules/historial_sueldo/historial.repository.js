const pool = require('../../config/db');

// busca historial activo (sin fecha_fin)
const findActivo = async (id_usuario) => {
    const result = await pool.query(
        `SELECT * FROM historial_sueldo
     WHERE id_usuario = $1 AND fecha_fin IS NULL`,
        [id_usuario]
    );

    return result.rows[0];
};

// cerrar historial
const cerrarHistorial = async (id_historial) => {
    await pool.query(
        `UPDATE historial_sueldo
         SET fecha_fin = CURRENT_DATE - INTERVAL '1 day'
         WHERE id_historial = $1`,
        [id_historial]
    );
};

const findCambioHoy = async (id_usuario) => {
    const result = await pool.query(
        `SELECT id_historial
         FROM historial_sueldo
         WHERE id_usuario = $1
           AND DATE(fecha_inicio) = CURRENT_DATE`,
        [id_usuario]
    );

    return result.rows[0];
};

// crear nuevo
const create = async ({ id_usuario, tipo_pago, monto, horas_mensuales }) => {
    const result = await pool.query(
        `INSERT INTO historial_sueldo 
        (id_usuario, tipo_pago, monto, fecha_inicio, horas_mensuales)
        VALUES ($1, $2, $3, CURRENT_DATE, $4)
        RETURNING *`,
        [id_usuario, tipo_pago, monto, horas_mensuales]
    );

    return result.rows[0];
};

module.exports = {
    findActivo,
    cerrarHistorial,
    findCambioHoy,
    create
};