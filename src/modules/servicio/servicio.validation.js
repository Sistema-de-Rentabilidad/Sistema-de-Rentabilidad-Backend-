const { body, param, validationResult } = require('express-validator');
const { handleValidationErrors } = require('../../modules/middlewares/validationMiddleware');

const createServicioValidation = [
  body('nombre')
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  body('descripcion')
    .optional({ checkFalsy: true })
    .isLength({ min: 3, max: 500 }).withMessage('La descripción debe tener entre 3 y 500 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('La descripción solo debe contener letras y espacios')
    .trim(),

  handleValidationErrors
];

const servicioIdParamValidation = [
  param('id')
    .isInt({ min: 1 }).withMessage('ID de servicio inválido'),

  handleValidationErrors
];

const updateServicioValidation = [
  body('nombre')
    .optional()
    .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  body('descripcion')
    .optional()
    .isLength({ min: 3, max: 500 }).withMessage('La descripción debe tener entre 3 y 500 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('La descripción solo debe contener letras y espacios')
    .trim(),

  (req, res, next) => {
    const { nombre, descripcion } = req.body;
    if (!nombre && !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Debes enviar al menos nombre o descripción'
      });
    }
    next();
  },

  handleValidationErrors
];

module.exports = {
  createServicioValidation,
  servicioIdParamValidation,
  updateServicioValidation
};
