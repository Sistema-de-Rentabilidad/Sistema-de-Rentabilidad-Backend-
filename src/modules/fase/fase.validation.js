const { param, body } = require("express-validator");
const { handleValidationErrors } = require("../middlewares/validationMiddleware");

const proyectoIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID de proyecto inválido"),

  handleValidationErrors,
];

const createFaseValidation = [
  body("nombre")
    .notEmpty().withMessage("El nombre es obligatorio")
    .isLength({ min: 3, max: 100 }).withMessage("El nombre debe tener entre 3 y 100 caracteres")
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  body("horas_estimadas")
    .notEmpty().withMessage("Las horas estimadas son obligatorias")
    .isNumeric().withMessage('Las horas estimadas deben ser números')
    .isFloat({ min: 1 }).withMessage("Las horas estimadas deben ser mayor a 0"),

  handleValidationErrors
];

const faseIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID de fase inválido"),

  handleValidationErrors,
];

const updateFaseValidation = [
  body("nombre")
    .optional()
    .isLength({ min: 3, max: 100 }).withMessage("El nombre debe tener entre 3 y 100 caracteres")
    .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
    .withMessage('El nombre solo debe contener letras y espacios')
    .trim(),

  body("horas_estimadas")
    .optional()
    .isNumeric().withMessage('Las horas estimadas deben ser números')
    .isFloat({ min: 1 }).withMessage("Las horas estimadas deben ser mayor a 0"),

  (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Debes enviar al menos un campo para actualizar",
      });
    }
    next();
  },

  handleValidationErrors
];

module.exports = {
  proyectoIdValidation,
  faseIdValidation,
  createFaseValidation,
  updateFaseValidation,
};
