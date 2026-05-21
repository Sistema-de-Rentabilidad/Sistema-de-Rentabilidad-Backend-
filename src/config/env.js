require('dotenv').config({ quiet: true });

const REQUIRED_ENV_VARS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_EXPIRES',
  'FRONTEND_URL',
  'NODE_ENV',
];

const VALID_NODE_ENVS = new Set(['development', 'test', 'production']);
const VALID_RATE_LIMIT_STORES = new Set(['auto', 'memory', 'database']);
const MIN_JWT_SECRET_LENGTH = 32;

const parseIntegerEnv = (name, defaultValue, { min, max }) => {
  const rawValue = process.env[name];

  if (!rawValue) {
    return defaultValue;
  }

  const parsed = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} debe ser un entero entre ${min} y ${max}`);
  }

  return parsed;
};

const validateEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(`Faltan variables de entorno requeridas: ${missing.join(', ')}`);
  }

  if (!VALID_NODE_ENVS.has(process.env.NODE_ENV)) {
    throw new Error('NODE_ENV debe ser development, test o production');
  }

  if (process.env.JWT_SECRET.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET debe tener al menos ${MIN_JWT_SECRET_LENGTH} caracteres`);
  }

  if (!/^\d+(ms|s|m|h|d|w|y)?$/.test(process.env.JWT_EXPIRES)) {
    throw new Error('JWT_EXPIRES debe usar un formato como 15m, 1h o 1d');
  }

  let frontendUrl;
  try {
    frontendUrl = new URL(process.env.FRONTEND_URL);
  } catch {
    throw new Error('FRONTEND_URL debe ser una URL valida');
  }

  if (process.env.NODE_ENV === 'production' && frontendUrl.protocol !== 'https:') {
    throw new Error('FRONTEND_URL debe usar https en production');
  }

  if (frontendUrl.username || frontendUrl.password) {
    throw new Error('FRONTEND_URL no debe incluir credenciales');
  }

  if (!['http:', 'https:'].includes(frontendUrl.protocol)) {
    throw new Error('FRONTEND_URL debe usar http o https');
  }

  if (process.env.JWT_REQUIRE_CLAIMS === 'true' && (!process.env.JWT_ISSUER || !process.env.JWT_AUDIENCE)) {
    throw new Error('JWT_ISSUER y JWT_AUDIENCE son obligatorios si JWT_REQUIRE_CLAIMS=true');
  }

  if (process.env.LOGIN_RATE_LIMIT_STORE && !VALID_RATE_LIMIT_STORES.has(process.env.LOGIN_RATE_LIMIT_STORE)) {
    throw new Error('LOGIN_RATE_LIMIT_STORE debe ser auto, memory o database');
  }
};

validateEnv();

const FRONTEND_URL = process.env.FRONTEND_URL;
const FRONTEND_ORIGIN = new URL(FRONTEND_URL).origin;

module.exports = {
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES: process.env.JWT_EXPIRES,
  JWT_ISSUER: process.env.JWT_ISSUER || 'sistema-de-rentabilidad-backend',
  JWT_AUDIENCE: process.env.JWT_AUDIENCE || 'sistema-de-rentabilidad-client',
  JWT_REQUIRE_CLAIMS: process.env.JWT_REQUIRE_CLAIMS === 'true',
  FRONTEND_URL,
  FRONTEND_ORIGIN,
  NODE_ENV: process.env.NODE_ENV,
  LOGIN_RATE_LIMIT_STORE: process.env.LOGIN_RATE_LIMIT_STORE || 'auto',
  BCRYPT_SALT_ROUNDS: parseIntegerEnv('BCRYPT_SALT_ROUNDS', 10, { min: 10, max: 14 }),
  LOGIN_RATE_LIMIT_WINDOW_MS: parseIntegerEnv('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000, {
    min: 60 * 1000,
    max: 60 * 60 * 1000,
  }),
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS: parseIntegerEnv('LOGIN_RATE_LIMIT_MAX_ATTEMPTS', 10, {
    min: 1,
    max: 100,
  }),
};
