const { body } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validationMiddleware');

const loginValidation = [
  body('email')
    .exists({ checkFalsy: true }).withMessage('El email es obligatorio')
    .bail()
    .isEmail().withMessage('Email invalido')
    .normalizeEmail()
    .trim(),

  body('password')
    .exists({ checkFalsy: true }).withMessage('La contrasena es obligatoria')
    .bail()
    .isString().withMessage('La contrasena debe ser texto')
    .isLength({ min: 8, max: 100 }).withMessage('La contrasena debe tener entre 8 y 100 caracteres'),

  handleValidationErrors,
];

module.exports = {
  loginValidation,
};
