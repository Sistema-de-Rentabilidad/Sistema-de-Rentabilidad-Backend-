const express = require('express');
const router = express.Router();

const registroHorasController = require('./horas.controller');
const { listHorasValidation, createHorasValidation, registroHorasIdParamValidation, updateHorasValidation } = require('./horas.validation')

const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');
const empresa = require('../middlewares/empresaMiddleware');

// GET /horas
router.get('/', auth, role('empleado', 'lider', 'propietario'), empresa, listHorasValidation, registroHorasController.getRegistrosHoras);

// POST /horas
router.post('/', auth, role('empleado', 'lider'), empresa, createHorasValidation, registroHorasController.createRegistroHoras);

// GET /horas/:id
router.get('/:id', auth, role('empleado', 'lider'), empresa, registroHorasIdParamValidation, registroHorasController.getRegistroHorasById);

// PUT /horas/:id
router.put('/:id', auth, role('empleado', 'lider'), empresa, registroHorasIdParamValidation, updateHorasValidation, registroHorasController.updateRegistroHoras);

module.exports = router;
