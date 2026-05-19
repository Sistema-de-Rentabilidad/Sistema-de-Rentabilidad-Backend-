const ACCESS_TOKEN_COOKIE = "access_token";
const ONE_DAY_MS = 1000 * 60 * 60 * 24;

const isProduction = process.env.NODE_ENV === "production";

const accessTokenCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: ONE_DAY_MS,
  path: "/",
};

const clearAccessTokenCookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/",
};

module.exports = {
  ACCESS_TOKEN_COOKIE,
  accessTokenCookieOptions,
  clearAccessTokenCookieOptions,
};
