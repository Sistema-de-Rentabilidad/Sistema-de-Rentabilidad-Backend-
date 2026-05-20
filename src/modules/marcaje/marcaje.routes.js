const express = require('express');
const router = express.Router();

const marcajeController = require('./marcaje.controller');
const { marcajeBodyValidation } = require('./marcaje.validation');

const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');
const empresa = require('../middlewares/empresaMiddleware');

const bloquearEmpleadoPorHora = (req, res, next) => {
  if (req.user?.rol === 'empleado' && req.user?.tipo_pago === 'por_hora') {
    return res.status(403).json({
      success: false,
      message: 'Los empleados por hora no tienen acceso al modulo de marcaje'
    });
  }

  next();
};

// GET /marcajes
router.get('/', auth, role('empleado', 'lider'), empresa, bloquearEmpleadoPorHora, marcajeController.getMarcajes);

// POST /marcajes/entrada
router.post('/entrada', auth, role('empleado', 'lider'), empresa, bloquearEmpleadoPorHora, marcajeBodyValidation, marcajeController.marcarEntrada);

// POST /marcajes/salida
router.post('/salida', auth, role('empleado', 'lider'), empresa, bloquearEmpleadoPorHora, marcajeBodyValidation, marcajeController.marcarSalida);

module.exports = router;
