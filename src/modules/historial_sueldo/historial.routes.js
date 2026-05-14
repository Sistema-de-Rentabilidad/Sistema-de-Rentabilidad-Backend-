const express = require('express');
const router = express.Router();

const historialController = require('./historial.controller');
const { createHistorialValidation } = require('./historial.validation');

const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');

// POST /historiales
router.post(
    '/',
    auth,
    role('propietario'),
    createHistorialValidation,
    historialController.createHistorial
);

module.exports = router;