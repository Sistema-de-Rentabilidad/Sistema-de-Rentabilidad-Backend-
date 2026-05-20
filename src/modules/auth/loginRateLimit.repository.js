const pool = require("../../config/db");

const toInterval = (windowMs) => `${Math.ceil(windowMs / 1000)} seconds`;

const recordAttempt = async ({ key, ip, emailHash, windowMs }) => {
  const result = await pool.query(
    `INSERT INTO private.login_rate_limits (
       key,
       ip,
       email_hash,
       attempt_count,
       reset_at,
       first_attempt_at,
       updated_at
     )
     VALUES ($1, $2::inet, $3, 1, NOW() + ($4::text)::interval, NOW(), NOW())
     ON CONFLICT (key) DO UPDATE
     SET ip = EXCLUDED.ip,
         email_hash = EXCLUDED.email_hash,
         attempt_count = CASE
           WHEN private.login_rate_limits.reset_at <= NOW() THEN 1
           ELSE private.login_rate_limits.attempt_count + 1
         END,
         reset_at = CASE
           WHEN private.login_rate_limits.reset_at <= NOW() THEN NOW() + ($4::text)::interval
           ELSE private.login_rate_limits.reset_at
         END,
         first_attempt_at = CASE
           WHEN private.login_rate_limits.reset_at <= NOW() THEN NOW()
           ELSE private.login_rate_limits.first_attempt_at
         END,
         updated_at = NOW()
     RETURNING attempt_count, reset_at`,
    [key, ip, emailHash, toInterval(windowMs)]
  );

  return result.rows[0];
};

module.exports = {
  recordAttempt,
};
