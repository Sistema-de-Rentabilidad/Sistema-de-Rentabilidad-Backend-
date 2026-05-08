const express = require("express");
const router = express.Router();
const fasesController = require("./fases.controller");
const {
  proyectoIdValidation,
  faseIdValidation,
  createFaseValidation,
  updateFaseValidation,
} = require("./fases.validation");
const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");

// H39: Listar fases activas de un proyecto
router.get(
  "/proyectos/:id/fases",
  auth,
  role("propietario", "lider"),
  proyectoIdValidation,
  fasesController.getFasesByProyecto
);

// H40: Crear fase en un proyecto
router.post(
  "/proyectos/:id/fases",
  auth,
  role("propietario"),
  proyectoIdValidation,
  createFaseValidation,
  fasesController.createFase
);

// H41: Obtener una fase por ID
router.get(
  "/fases/:id",
  auth,
  role("propietario", "lider"),
  faseIdValidation,
  fasesController.getFaseById
);

// H41: Actualizar una fase
router.put(
  "/fases/:id",
  auth,
  role("propietario"),
  faseIdValidation,
  updateFaseValidation,
  fasesController.updateFase
);

module.exports = router;
