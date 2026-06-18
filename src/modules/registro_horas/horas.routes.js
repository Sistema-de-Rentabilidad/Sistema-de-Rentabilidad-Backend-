const express = require('express');
const router = express.Router();

const registroHorasController = require('./horas.controller');
const { createHorasValidation, registroHorasIdParamValidation, updateHorasValidation } = require('./horas.validation')

const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');
const empresa = require('../middlewares/empresaMiddleware');

// GET /horas
router.get('/', auth, role('empleado', 'lider'), empresa, registroHorasController.getRegistrosHoras);

// GET /horas/empresa
router.get('/empresa', auth, role('lider', 'propietario'), empresa, registroHorasController.getRegistrosHorasEmpresa);

// POST /horas
router.post('/', auth, role('empleado', 'lider'), empresa, createHorasValidation, registroHorasController.createRegistroHoras);

// GET /horas/:id
router.get('/:id', auth, role('empleado', 'lider'), empresa, registroHorasIdParamValidation, registroHorasController.getRegistroHorasById);

// PUT /horas/:id
router.put('/:id', auth, role('empleado', 'lider'), empresa, registroHorasIdParamValidation, updateHorasValidation, registroHorasController.updateRegistroHoras);

module.exports = router;

