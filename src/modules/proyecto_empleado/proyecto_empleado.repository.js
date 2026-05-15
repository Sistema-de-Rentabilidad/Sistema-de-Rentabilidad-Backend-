const pool = require('../../config/db');

const exists = async (idEmpleado, idProyecto) => {
    const result = await pool.query(
        `SELECT 1
    FROM proyecto_empleado
    WHERE id_empleado = $1
      AND id_proyecto = $2`,
        [idEmpleado, idProyecto]
    );

    return result.rowCount > 0;
};

module.exports = {
    exists
};