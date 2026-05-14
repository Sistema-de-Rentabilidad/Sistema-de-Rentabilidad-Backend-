const express = require("express");
const router = express.Router();

const usuarioController = require("./usuario.controller");
const { createUsuarioValidation } = require("./usuario.validation");

const auth = require("../../modules/middlewares/authMiddleware");
const role = require("../../modules/middlewares/roleMiddleware");

// GET /usuarios
router.get(
    '/',
    auth,
    role('admin', 'propietario'),
    usuarioController.getUsuarios
);

// POST /usuarios (admin crea propietario y propietario crea empleado/lider)
router.post(
    '/',
    auth,
    role('admin', 'propietario'), // ambos pueden entrar
    createUsuarioValidation,
    usuarioController.createUsuario
);

// PUT /usuarios/:id — admin y propietario (y self-update para cualquier rol)
router.put("/:id", auth, role("admin", "propietario", "lider", "empleado"), usuarioController.updateUsuario);

// DELETE /usuarios/:id — desactivar (soft delete)
router.delete("/:id", auth, role("admin", "propietario"), usuarioController.deleteUsuario);

// DELETE /usuarios/:id/permanente — eliminar físicamente (hard delete)
router.delete("/:id/permanente", auth, role("admin", "propietario"), usuarioController.hardDeleteUsuario);

// DELETE /usuarios/:id/hard-delete — alias used by the frontend
router.delete("/:id/hard-delete", auth, role("admin", "propietario"), usuarioController.hardDeleteUsuario);

module.exports = router;
