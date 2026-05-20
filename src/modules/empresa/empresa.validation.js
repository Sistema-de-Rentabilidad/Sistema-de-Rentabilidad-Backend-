const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../../modules/middlewares/validationMiddleware');

const createEmpresaValidation = [
  body('nombre')
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 3, max: 100 }).withMessage("El nombre debe tener entre 3 y 100 caracteres")
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  handleValidationErrors
];

const empresaIdValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de empresa inválido'),

  handleValidationErrors
];

const updateEmpresaValidation = [
  body('nombre')
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 3, max: 100 }).withMessage("El nombre debe tener entre 3 y 100 caracteres")
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  handleValidationErrors
];

module.exports = {
  createEmpresaValidation,
  empresaIdValidation,
  updateEmpresaValidation
};