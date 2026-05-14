const express = require("express");
const router = express.Router();

const { login } = require("../auth/auth.controller");
const authMiddleware = require("../middlewares/authMiddleware");
const roleMiddleware = require("../middlewares/roleMiddleware");
const authController = require("./auth.controller");

router.post("/login", login);

//admin crea propietario
router.post(
    "/register-propietario",
    authMiddleware,
    roleMiddleware("admin"),
    authController.registerOwner,
);

module.exports = router;