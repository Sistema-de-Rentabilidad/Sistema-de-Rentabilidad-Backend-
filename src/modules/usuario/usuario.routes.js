const express = require('express');
const router = express.Router();

const usuarioController = require('./usuario.controller');
const { createUsuarioValidation, usuarioIdParamValidation, updateUsuarioValidation } = require('./usuario.validation');

const auth = require('../../modules/middlewares/authMiddleware');
const role = require('../../modules/middlewares/roleMiddleware');

// GET /usuarios
router.get('/', auth, role('admin', 'propietario'), usuarioController.getUsuarios);

// POST /usuarios (admin crea propietario y propietario crea empleado/lider)
router.post('/', auth, role('admin', 'propietario'), createUsuarioValidation, usuarioController.createUsuario);

// GET /usuarios/:id
router.get('/:id', auth, role('admin', 'propietario', 'lider', 'empleado'), usuarioIdParamValidation, usuarioController.getUsuarioById);

// PUT /usuarios/:id/desactivar
router.put('/:id/desactivar', auth, role('admin', 'propietario'), usuarioIdParamValidation, usuarioController.desactivarUsuario);

// PUT /usuarios/:id
router.put('/:id', auth, role('admin', 'propietario', 'lider', 'empleado'), usuarioIdParamValidation, updateUsuarioValidation, usuarioController.updateUsuario);

module.exports = router;
