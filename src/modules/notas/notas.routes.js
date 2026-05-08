const express = require("express");
const router = express.Router();
const notasController = require("./notas.controller");
const {
  proyectoIdValidation,
  notaIdValidation,
  createNotaValidation,
  updateNotaValidation,
} = require("./notas.validation");
const auth = require("../middlewares/authMiddleware");
const role = require("../middlewares/roleMiddleware");

// H43: Listar notas activas de un proyecto
router.get(
  "/proyectos/:id/notas",
  auth,
  role("propietario", "lider"),
  proyectoIdValidation,
  notasController.getNotasByProyecto
);

// H28: Registrar nota en un proyecto (solo el líder asignado al proyecto)
router.post(
  "/proyectos/:id/notas",
  auth,
  role("lider"),
  proyectoIdValidation,
  createNotaValidation,
  notasController.createNota
);

// H36: Editar una nota
router.put(
  "/notas/:id",
  auth,
  role("lider"),
  notaIdValidation,
  updateNotaValidation,
  notasController.updateNota
);

// Soft delete de nota
router.put(
  "/notas/:id/desactivar",
  auth,
  role("lider"),
  notaIdValidation,
  notasController.desactivarNota
);

module.exports = router;
