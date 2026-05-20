const { FRONTEND_ORIGIN, NODE_ENV } = require("../../config/env");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_EXEMPT_PATHS = new Set(["/api/auth/login"]);

const isAllowedOrigin = (origin) => origin === FRONTEND_ORIGIN;

const getRequestOrigin = (req) => {
  const origin = req.get("origin");

  if (origin) {
    return origin;
  }

  const referer = req.get("referer");

  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

const csrfProtection = (req, res, next) => {
  const originalPath = req.originalUrl.split("?")[0];

  if (
    SAFE_METHODS.has(req.method) ||
    CSRF_EXEMPT_PATHS.has(req.path) ||
    CSRF_EXEMPT_PATHS.has(originalPath)
  ) {
    return next();
  }

  const requestOrigin = getRequestOrigin(req);

  if (!requestOrigin && NODE_ENV !== "production") {
    return next();
  }

  if (!isAllowedOrigin(requestOrigin)) {
    return res.status(403).json({
      success: false,
      message: "Origen de solicitud no permitido",
    });
  }

  return next();
};

module.exports = csrfProtection;
