const express = require("express");
const router = express.Router();

const { login } = require("../auth/auth.controller");
const loginRateLimit = require("../middlewares/loginRateLimitMiddleware");

// POST /auth/login
router.post("/login", loginRateLimit, login);

module.exports = router;
