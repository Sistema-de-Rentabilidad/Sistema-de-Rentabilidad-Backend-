const express = require('express');
const router = express.Router();

const { login, me, logout } = require('../auth/auth.controller');

const auth = require('../middlewares/authMiddleware');
const loginRateLimit = require('../middlewares/loginRateLimitMiddleware');

const { loginValidation } = require('./auth.validation');

// POST /auth/login
router.post('/login', loginRateLimit, loginValidation, login);

// GET /auth/me
router.get('/me', auth, me);

// POST /auth/logout
router.post('/logout', logout);

module.exports = router;
