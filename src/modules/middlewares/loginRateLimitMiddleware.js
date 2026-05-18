const loginAttemptsByIp = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 20;

const loginRateLimit = (req, res, next) => {
  const ip = req.ip || req.socket?.remoteAddress || "unknown";
  const now = Date.now();
  const current = loginAttemptsByIp.get(ip);

  if (!current || current.resetAt <= now) {
    loginAttemptsByIp.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  if (current.count >= RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    res.set("Retry-After", String(retryAfterSeconds));
    return res.status(429).json({
      message: "Demasiados intentos de login. Intenta nuevamente más tarde.",
      retryAfterSeconds,
    });
  }

  current.count += 1;
  loginAttemptsByIp.set(ip, current);
  return next();
};

module.exports = loginRateLimit;
