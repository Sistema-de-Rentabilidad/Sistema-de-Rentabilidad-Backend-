const express = require('express');
const router = express.Router();

const notaController = require('./nota.controller');
const { proyectoIdValidation, notaIdValidation, createNotaValidation, updateNotaValidation } = require('./nota.validation');

const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');
const empresa = require('../middlewares/empresaMiddleware');

// GET /proyectos/:id/notas
router.get('/proyectos/:id/notas', auth, role('propietario', 'lider'), empresa, proyectoIdValidation, notaController.getNotasByProyecto);

// POST /proyectos/:id/notas
router.post('/proyectos/:id/notas', auth, role('lider'), empresa, proyectoIdValidation, createNotaValidation, notaController.createNota);

// GET /notas/:id
router.get('/notas/:id', auth, role('propietario', 'lider'), empresa, notaIdValidation, notaController.getNotaById);

// PUT /notas/:id/desactivar (antes de PUT /:id para evitar ambigüedad)
router.put('/notas/:id/desactivar', auth, role('lider'), empresa, notaIdValidation, notaController.desactivarNota);

// PUT /notas/:id
router.put('/notas/:id', auth, role('lider'), empresa, notaIdValidation, updateNotaValidation, notaController.updateNota);

module.exports = router;
