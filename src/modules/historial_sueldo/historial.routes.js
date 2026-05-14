const express = require('express');
const router = express.Router();

const historialController = require('./historial.controller');
const { createHistorialValidation } = require('./historial.validation');

const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');
const empresa = require('../middlewares/empresaMiddleware');

// POST /historiales
router.post('/', auth, role('propietario'), empresa, createHistorialValidation, historialController.createHistorial);

module.exports = router;