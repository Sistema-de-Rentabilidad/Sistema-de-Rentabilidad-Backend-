const pool = require('../../config/db');

const setFailedLoginState = async (idUsuario, attempts, lockedUntil) => {
    const result = await pool.query(
        `UPDATE usuario
         SET failed_login_attempts = $1,
             locked_until = $2,
             last_failed_login_at = NOW()
         WHERE id_usuario = $3
         RETURNING failed_login_attempts, locked_until`,
        [attempts, lockedUntil, idUsuario]
    );

    return result.rows[0] || null;
};

const clearFailedLoginState = async (idUsuario) => {
    await pool.query(
        `UPDATE usuario
         SET failed_login_attempts = 0,
             locked_until = NULL,
             last_failed_login_at = NULL
         WHERE id_usuario = $1`,
        [idUsuario]
    );
};

const findActiveUserById = async (idUsuario) => {
    const result = await pool.query(
        `SELECT
            u.id_usuario,
            u.nombre,
            u.email,
            u.rol,
            u.id_empresa,
            u.is_active,
            hs.tipo_pago
         FROM usuario u
         LEFT JOIN historial_sueldo hs
           ON hs.id_usuario = u.id_usuario
          AND hs.fecha_fin IS NULL
         WHERE u.id_usuario = $1
           AND u.is_active = true`,
        [idUsuario]
    );

    return result.rows[0] || null;
};

module.exports = {
    setFailedLoginState,
    clearFailedLoginState,
    findActiveUserById
};
