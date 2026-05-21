const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validationMiddleware');

const createProyectoValidation = [
  // nombre
  body('nombre')
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  // descripción (opcional)
  body('descripcion')
    .optional({ checkFalsy: true })
    .isLength({ min: 3, max: 500 })
    .withMessage('La descripción debe tener entre 3 y 500 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('La descripción solo debe contener letras y espacios')
    .trim(),

  // presupuesto
  body('presupuesto')
    .notEmpty().withMessage('El presupuesto es obligatorio')
    .isFloat({ min: 1 })
    .withMessage('El presupuesto debe ser un número positivo mayor o igual a 1'),

  body('margen')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('El margen debe ser un porcentaje entre 0 y 100'),

  // fechas
  body('fecha_inicio')
    .notEmpty().withMessage('La fecha de inicio es obligatoria')
    .isISO8601().withMessage('Fecha de inicio inválida'),

  body('fecha_fin_estimada')
    .notEmpty().withMessage('La fecha fin estimada es obligatoria')
    .isISO8601().withMessage('Fecha fin estimada inválida')
    .custom((value, { req }) => {
      if (new Date(value) < new Date(req.body.fecha_inicio)) {
        throw new Error('La fecha fin no puede ser menor a la fecha de inicio');
      }
      return true;
    }),

  // servicio
  body('id_servicio')
    .notEmpty().withMessage('El servicio es obligatorio')
    .isInt({ min: 1 }).withMessage('ID de servicio inválido'),

  // líder
  body('id_lider')
    .notEmpty().withMessage('El líder es obligatorio')
    .isInt({ min: 1 }).withMessage('ID de líder inválido'),

  // empleados (opcional)
  body('empleados')
    .optional()
    .isArray().withMessage('Empleados debe ser un arreglo'),

  body('empleados.*')
    .optional()
    .isInt({ min: 1 }).withMessage('ID de empleado inválido'),

  // al menos un campo clave presente
  (req, res, next) => {
    const { nombre, id_servicio, id_lider, fecha_inicio, fecha_fin_estimada, presupuesto } = req.body;

    if (!nombre || !id_servicio || !id_lider || !fecha_inicio || !fecha_fin_estimada || !presupuesto) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios'
      });
    }

    next();
  },

  handleValidationErrors
];

const proyectoIdParamValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de proyecto inválido'),

  handleValidationErrors
];

const updateProyectoValidation = [
  // nombre (obligatorio en create, pero opcional en update)
  body('nombre')
    .optional()
    .isLength({ min: 3, max: 100 })
    .withMessage('El nombre debe tener entre 3 y 100 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  // descripción
  body('descripcion')
    .optional()
    .isLength({ min: 3, max: 500 })
    .withMessage('La descripción debe tener entre 3 y 500 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  // presupuesto (obligatorio en create, pero opcional en update)
  body('presupuesto')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('El presupuesto debe ser mayor o igual a 0'),

  body('margen')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('El margen debe ser un porcentaje entre 0 y 100'),

  // fechas (obligatorias en create, pero opcional en update)
  body('fecha_inicio')
    .optional()
    .isISO8601()
    .withMessage('Fecha de inicio inválida'),

  body('fecha_fin_estimada')
    .optional()
    .isISO8601()
    .withMessage('Fecha fin estimada inválida'),

  // validación cruzada de fechas (solo si ambas vienen)
  (req, res, next) => {
    const { fecha_inicio, fecha_fin_estimada } = req.body;

    if (fecha_inicio && fecha_fin_estimada) {
      if (new Date(fecha_fin_estimada) < new Date(fecha_inicio)) {
        return res.status(400).json({
          success: false,
          message: 'La fecha fin no puede ser menor a la fecha de inicio'
        });
      }
    }

    next();
  },

  // servicio
  body('id_servicio')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID de servicio inválido'),

  // líder
  body('id_lider')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID de líder inválido'),

  // empleados
  body('empleados')
    .optional()
    .isArray()
    .withMessage('Empleados debe ser un arreglo'),

  body('empleados.*')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ID de empleado inválido'),

  // evitar body vacío (importante)
  (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar al menos un campo para actualizar'
      });
    }
    next();
  },

  handleValidationErrors
];

module.exports = {
  createProyectoValidation,
  proyectoIdParamValidation,
  updateProyectoValidation
};
