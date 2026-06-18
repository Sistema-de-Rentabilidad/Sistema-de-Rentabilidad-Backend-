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

const countProyectosActivosByUsuario = async (idEmpleado) => {
    const result = await pool.query(
        `SELECT COUNT(*) 
         FROM proyecto_empleado pe
         INNER JOIN proyecto p ON pe.id_proyecto = p.id_proyecto
         WHERE pe.id_empleado = $1 
           AND p.is_active = true 
           AND p.fecha_fin_real IS NULL`,
        [idEmpleado]
    );
    return parseInt(result.rows[0].count, 10);
};

module.exports = {
    exists,
    countProyectosActivosByUsuario
};