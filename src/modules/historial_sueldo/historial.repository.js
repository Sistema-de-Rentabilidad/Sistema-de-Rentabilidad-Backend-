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
const cerrarHistorial = async (id_historial, fecha_fin) => {
    await pool.query(
        `UPDATE historial_sueldo
     SET fecha_fin = $1
     WHERE id_historial = $2`,
        [fecha_fin, id_historial]
    );
};

const findCambioHoy = async (id_usuario, fecha) => {
    const result = await pool.query(
        `SELECT id_historial
         FROM historial_sueldo
         WHERE id_usuario = $1
           AND fecha_inicio = $2`,
        [id_usuario, fecha]
    );

    return result.rows[0];
};

// crear nuevo
const create = async ({ id_usuario, tipo_pago, monto, fecha_inicio, horas_mensuales }) => {
    const result = await pool.query(
        `INSERT INTO historial_sueldo 
     (id_usuario, tipo_pago, monto, fecha_inicio, horas_mensuales)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [id_usuario, tipo_pago, monto, fecha_inicio, horas_mensuales]
    );

    return result.rows[0];
};

module.exports = {
    findActivo,
    cerrarHistorial,
    findCambioHoy,
    create
};