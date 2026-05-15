const express = require("express");
const router = express.Router();

const { login } = require("../auth/auth.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const authController = require("./auth.controller");

// POST /auth/login
router.post("/login", login);

module.exports = router;