const pool = require("../../config/db");

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

module.exports = {
    setFailedLoginState,
    clearFailedLoginState
};
