const express = require('express');
const router = express.Router();

const servicioController = require('./servicio.controller');
const { createServicioValidation, updateServicioValidation, servicioIdParamValidation } = require('./servicio.validation');

const auth = require('../../modules/middlewares/authMiddleware');
const role = require('../../modules/middlewares/roleMiddleware');
const empresa = require('../middlewares/empresaMiddleware');

// GET /servicios
router.get('/', auth, role('propietario'), empresa, servicioController.getServicios);

// POST /servicios
router.post('/', auth, role('propietario'), empresa, createServicioValidation, servicioController.createServicio);

// GET /servicios/:id
router.get('/:id', auth, role('propietario'), empresa, servicioIdParamValidation, servicioController.getServicioById);

// PUT /servicios/:id/desactivar (antes de PUT /:id para evitar ambigüedad)
router.put('/:id/desactivar', auth, role('propietario'), empresa, servicioIdParamValidation, servicioController.desactivarServicio);

// PUT /servicios/:id
router.put('/:id', auth, role('propietario'), empresa, servicioIdParamValidation, updateServicioValidation, servicioController.updateServicio);

module.exports = router;