const { param, body } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validationMiddleware');

const proyectoIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de proyecto inválido'),

  handleValidationErrors,
];

const createNotaValidation = [
  body('descripcion')
    .notEmpty().withMessage('La descripción es obligatoria')
    .isLength({ min: 3, max: 1000 }).withMessage('La descripción debe tener entre 3 y 1000 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s.,()-]+$/)
    .withMessage('La descripción contiene caracteres inválidos')
    .trim(),

  handleValidationErrors,
];

const notaIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de nota inválido'),

  handleValidationErrors,
];

const updateNotaValidation = [
  body('descripcion')
    .notEmpty().withMessage('La descripción es obligatoria')
    .isLength({ min: 3, max: 1000 }).withMessage('La descripción debe tener entre 3 y 1000 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s.,()-]+$/)
    .withMessage('La descripción contiene caracteres inválidos')
    .trim(),
    
  handleValidationErrors,
];

module.exports = {
  proyectoIdValidation,
  notaIdValidation,
  createNotaValidation,
  updateNotaValidation,
};
