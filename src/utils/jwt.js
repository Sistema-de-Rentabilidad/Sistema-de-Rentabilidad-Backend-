const jwt = require("jsonwebtoken");
const {
  JWT_SECRET,
  JWT_EXPIRES,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_REQUIRE_CLAIMS
} = require("../config/env");

const generateToken = (payload) => {
  const options = {
    expiresIn: JWT_EXPIRES,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  };

  if (payload.id_usuario) {
    options.subject = String(payload.id_usuario);
  }

  return jwt.sign(payload, JWT_SECRET, {
    ...options,
  });
};

const verifyToken = (token) => {
  if (JWT_REQUIRE_CLAIMS) {
    return jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  }

  return jwt.verify(token, JWT_SECRET);
};

module.exports = { generateToken, verifyToken };
