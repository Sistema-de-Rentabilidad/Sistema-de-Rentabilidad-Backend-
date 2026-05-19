const express = require("express");
const router = express.Router();

const { login, me, logout } = require("../auth/auth.controller");
const auth = require("../middlewares/authMiddleware");
const loginRateLimit = require("../middlewares/loginRateLimitMiddleware");

// POST /auth/login
router.post("/login", loginRateLimit, login);
router.get("/me", auth, me);
router.post("/logout", logout);

module.exports = router;
