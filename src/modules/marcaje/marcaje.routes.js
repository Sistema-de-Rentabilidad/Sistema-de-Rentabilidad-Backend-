const express = require("express");
const router = express.Router();

const marcajeController = require("./marcaje.controller");
const { marcajeBodyValidation, getMarcajesValidation } = require("./marcaje.validation");

const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");
const empresa = require("../middlewares/empresaMiddleware");

// GET /marcajes
router.get("/", auth, role("empleado"), empresa, getMarcajesValidation, marcajeController.getMarcajes);

// POST /marcajes/entrada
router.post("/entrada", auth, role("empleado"), empresa, marcajeBodyValidation, marcajeController.marcarEntrada);

// POST /marcajes/salida
router.post("/salida", auth, role("empleado"), empresa, marcajeBodyValidation, marcajeController.marcarSalida);

module.exports = router;
