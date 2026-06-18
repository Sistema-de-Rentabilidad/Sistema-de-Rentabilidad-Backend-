const crypto = require("crypto");
const net = require("net");
const loginRateLimitRepository = require("../auth/loginRateLimit.repository");
const {
  LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
  LOGIN_RATE_LIMIT_WINDOW_MS,
  LOGIN_RATE_LIMIT_STORE,
  NODE_ENV,
} = require("../../config/env");

const memoryAttempts = new Map();
let databaseFallbackLogged = false;

const normalizeEmail = (email) => {
  if (typeof email !== "string") {
    return null;
  }

  const normalized = email.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
};

const hashValue = (value) => crypto.createHash("sha256").update(value).digest("hex");

const getClientIp = (req) => {
  const forwardedFor = req.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || "unknown";
};

const getInetOrNull = (ip) => {
  if (net.isIP(ip)) {
    return ip;
  }

  if (ip?.startsWith("::ffff:") && net.isIP(ip.slice(7))) {
    return ip.slice(7);
  }

  return null;
};

const shouldUseDatabase = () => (
  LOGIN_RATE_LIMIT_STORE === "database" ||
  (LOGIN_RATE_LIMIT_STORE === "auto" && NODE_ENV === "production")
);

const shouldBypassRateLimit = () => (
  NODE_ENV !== "production" &&
  (process.env.JEST_WORKER_ID || process.env.LOGIN_RATE_LIMIT_DISABLED === "true")
);

const recordMemoryAttempt = (key) => {
  const now = Date.now();
  const current = memoryAttempts.get(key);

  if (!current || current.resetAt <= now) {
    const next = { count: 1, resetAt: now + LOGIN_RATE_LIMIT_WINDOW_MS };
    memoryAttempts.set(key, next);
    return next;
  }

  current.count += 1;
  memoryAttempts.set(key, current);
  return current;
};

const recordDatabaseAttempt = async ({ key, ip, emailHash }) => {
  const result = await loginRateLimitRepository.recordAttempt({
    key,
    ip: getInetOrNull(ip),
    emailHash,
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  });

  return {
    count: Number(result.attempt_count),
    resetAt: new Date(result.reset_at).getTime(),
  };
};

const recordAttempt = async (descriptor) => {
  if (!shouldUseDatabase()) {
    return recordMemoryAttempt(descriptor.key);
  }

  try {
    return await recordDatabaseAttempt(descriptor);
  } catch (error) {
    if (!databaseFallbackLogged) {
      databaseFallbackLogged = true;
      console.error("Login rate limit database fallback:", error.message);
    }

    return recordMemoryAttempt(descriptor.key);
  }
};

const createDescriptors = (req) => {
  const ip = getClientIp(req);
  const email = normalizeEmail(req.body?.email);
  const descriptors = [
    {
      key: `login:ip:${ip}`,
      ip,
      emailHash: null,
    },
  ];

  if (email) {
    descriptors.push({
      key: `login:email:${hashValue(email)}`,
      ip,
      emailHash: hashValue(email),
    });
  }

  return descriptors;
};

const loginRateLimit = async (req, res, next) => {
  try {
    if (shouldBypassRateLimit()) {
      return next();
    }

    const descriptors = createDescriptors(req);

    for (const descriptor of descriptors) {
      const current = await recordAttempt(descriptor);

      if (current.count > LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
        const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - Date.now()) / 1000));
        res.set("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({
          message: "Demasiados intentos de login. Intenta nuevamente mas tarde.",
          retryAfterSeconds,
        });
      }
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = loginRateLimit;
