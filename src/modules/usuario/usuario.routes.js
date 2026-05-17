const express = require("express");
const router = express.Router();

const usuarioController = require("./usuario.controller");
const { createUsuarioValidation } = require("./usuario.validation");

const auth = require("../../modules/middlewares/authMiddleware");
const role = require("../../modules/middlewares/roleMiddleware");

// GET /usuarios
router.get('/', auth, role('admin', 'propietario'), usuarioController.getUsuarios);

// POST /usuarios (admin crea propietario y propietario crea empleado/lider)
router.post('/', auth, role('admin', 'propietario'), createUsuarioValidation, usuarioController.createUsuario);

// PUT /usuarios/:id — admin y propietario (y self-update para cualquier rol)
router.put("/:id", auth, role("admin", "propietario", "lider", "empleado"), usuarioController.updateUsuario);

// DELETE /usuarios/:id — desactivar (soft delete)
router.delete("/:id", auth, role("admin", "propietario"), usuarioController.deleteUsuario);

module.exports = router;
