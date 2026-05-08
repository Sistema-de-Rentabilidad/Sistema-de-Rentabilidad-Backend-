const { param, body } = require("express-validator");
const { handleValidationErrors } = require("../middlewares/validationMiddleware");

const proyectoIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID de proyecto inválido"),
  handleValidationErrors,
];

const notaIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID de nota inválido"),
  handleValidationErrors,
];

const createNotaValidation = [
  body("descripcion")
    .notEmpty().withMessage("La descripción es obligatoria")
    .isLength({ min: 1, max: 1000 }).withMessage("La descripción debe tener entre 1 y 1000 caracteres")
    .trim(),
  handleValidationErrors,
];

const updateNotaValidation = [
  body("descripcion")
    .notEmpty().withMessage("La descripción es obligatoria")
    .isLength({ min: 1, max: 1000 }).withMessage("La descripción debe tener entre 1 y 1000 caracteres")
    .trim(),
  handleValidationErrors,
];

module.exports = {
  proyectoIdValidation,
  notaIdValidation,
  createNotaValidation,
  updateNotaValidation,
};
