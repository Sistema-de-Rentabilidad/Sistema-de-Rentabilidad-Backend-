const express = require("express");
const router = express.Router();

const fasesController = require("./fases.controller");
const { proyectoIdValidation, faseIdValidation, createFaseValidation, updateFaseValidation } = require("./fases.validation");

const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");
const empresa = require('../middlewares/empresaMiddleware');

// GET /proyectos/:id/fases
router.get("/proyectos/:id/fases", auth, role("propietario", "lider"), empresa, proyectoIdValidation, fasesController.getFasesByProyecto);

// POST /proyectos/:id/fases
router.post("/proyectos/:id/fases", auth, role("propietario"), empresa, proyectoIdValidation, createFaseValidation, fasesController.createFase);

// GET /fases/:id
router.get("/fases/:id", auth, role("propietario", "lider"), empresa, faseIdValidation, fasesController.getFaseById);

// PUT /fases/:id
router.put("/fases/:id", auth, role("propietario"), empresa, faseIdValidation, updateFaseValidation, fasesController.updateFase);

module.exports = router;
