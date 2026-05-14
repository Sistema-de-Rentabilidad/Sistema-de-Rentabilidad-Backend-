const express = require("express");
const router = express.Router();

const faseController = require("./fase.controller");
const { proyectoIdValidation, faseIdValidation, createFaseValidation, updateFaseValidation } = require("./fase.validation");

const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");
const empresa = require('../middlewares/empresaMiddleware');

// GET /proyectos/:id/fases
router.get("/proyectos/:id/fases", auth, role("propietario", "lider"), empresa, proyectoIdValidation, faseController.getFasesByProyecto);

// POST /proyectos/:id/fases
router.post("/proyectos/:id/fases", auth, role("propietario"), empresa, proyectoIdValidation, createFaseValidation, faseController.createFase);

// GET /fases/:id
router.get("/fases/:id", auth, role("propietario", "lider"), empresa, faseIdValidation, faseController.getFaseById);

// PUT /fases/:id
router.put("/fases/:id", auth, role("propietario"), empresa, faseIdValidation, updateFaseValidation, faseController.updateFase);

module.exports = router;
