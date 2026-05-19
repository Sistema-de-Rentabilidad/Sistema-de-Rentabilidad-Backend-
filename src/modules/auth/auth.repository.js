const pool = require("../../config/db");

//Buscar usuario por email (para validar email único)
const findUserByEmail = async (email) => {
    const query = `
    SELECT id_usuario, id_empresa, nombre, email, password, rol, is_active, failed_login_attempts,
    locked_until, last_failed_login_at
    FROM usuario
    WHERE email = $1
    LIMIT 1
  `;

    const result = await pool.query(query, [email]);

    return result.rows[0] || null;
};

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
        `SELECT id_usuario, id_empresa, nombre, email, rol, is_active
         FROM usuario
         WHERE id_usuario = $1
           AND is_active = true
         LIMIT 1`,
        [idUsuario]
    );

    return result.rows[0] || null;
};

module.exports = {
    findUserByEmail,
    setFailedLoginState,
    clearFailedLoginState,
    findActiveUserById
};
