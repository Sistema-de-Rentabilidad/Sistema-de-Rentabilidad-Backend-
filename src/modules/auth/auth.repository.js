const pool = require("../../config/db");

//Buscar usuario por email (para validar email único)
const findUserByEmail = async (email) => {
    const query = `
    SELECT id_usuario, id_empresa, nombre, email, password, rol, is_active
    FROM usuario
    WHERE email = $1
    LIMIT 1
  `;

    const result = await pool.query(query, [email]);

    return result.rows[0] || null;
};

module.exports = {
    findUserByEmail
};