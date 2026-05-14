const { body, param } = require('express-validator');
const { handleValidationErrors } = require('../../modules/middlewares/validationMiddleware');

const createEmpresaValidation = [
  body('nombre')
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 3 }).withMessage('Mínimo 3 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios'),

  handleValidationErrors
];

const empresaIdParamValidation = [
  param('id').isInt({ min: 1 }).withMessage('ID de empresa inválido'),

  handleValidationErrors
];

const updateEmpresaValidation = [
  param('id')
    .isInt().withMessage('ID de empresa inválido'),

  body('nombre')
    .notEmpty().withMessage('El nombre es obligatorio')
    .isLength({ min: 3 }).withMessage('Mínimo 3 caracteres')
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios'),

  handleValidationErrors
];

module.exports = {
  createEmpresaValidation,
  empresaIdParamValidation,
  updateEmpresaValidation
};