const pool = require('../../config/db');

const exists = async (idEmpleado, idFase) => {
    const result = await pool.query(
        `SELECT 1
    FROM fase_empleado
    WHERE id_empleado = $1
      AND id_fase = $2`,
        [idEmpleado, idFase]
    );

    return result.rowCount > 0;
};

const create = async (idEmpleado, idFase) => {
    const result = await pool.query(
        `INSERT INTO fase_empleado
    (id_empleado, id_fase)
    VALUES ($1, $2)
    RETURNING *`,
        [idEmpleado, idFase]
    );

    return result.rows[0];
};

module.exports = {
    exists,
    create
};