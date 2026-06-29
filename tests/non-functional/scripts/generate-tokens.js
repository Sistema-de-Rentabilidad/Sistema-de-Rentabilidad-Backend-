const fs = require('fs');

// 1. Simular variables de entorno para que jwt.js no falle
process.env.JWT_SECRET = "1b9a4a530e12b595cf4819d9424526837a9e46bfdce7cc79f08d824a62ef2cae295ef17aabd62d94f90e6c2df4695c6c178cee675e06983ad5dbb90631028d66";
process.env.JWT_EXPIRES = "1d";
process.env.JWT_ISSUER = "sistema-de-rentabilidad-backend";
process.env.JWT_AUDIENCE = "sistema-de-rentabilidad-client";
process.env.JWT_REQUIRE_CLAIMS = "false";

// 2. Importar tu función real
const { generateToken } = require('../../../src/utils/jwt');

const usuarios = require("./usuariosCarga.json");

const tokens = usuarios.map((u) => ({
  email: u.email,
  cookie: `access_token=${generateToken({
    id_usuario: u.id_usuario,
    email: u.email,
    rol: u.rol,
    id_empresa: u.id_empresa,
  })}`,
}));

fs.writeFileSync(
  "./tests/non-functional/performance/tokens.json",
  JSON.stringify(tokens, null, 2)
);

console.log(`${tokens.length} tokens generados`);