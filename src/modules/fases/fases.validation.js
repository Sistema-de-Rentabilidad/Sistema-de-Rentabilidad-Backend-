const { param, body, query } = require("express-validator");
const { handleValidationErrors } = require("../middlewares/validationMiddleware");

const proyectoIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID de proyecto inválido"),
  query("orderBy")
    .optional()
    .isIn(["nombre", "fecha"])
    .withMessage("orderBy debe ser 'nombre' o 'fecha'"),
  handleValidationErrors,
];

const faseIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("ID de fase inválido"),
  handleValidationErrors,
];

const createFaseValidation = [
  body("nombre")
    .notEmpty().withMessage("El nombre es obligatorio")
    .isLength({ min: 2, max: 100 }).withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .trim(),
  body("horas_estimadas")
    .optional()
    .isFloat({ min: 0 }).withMessage("Las horas estimadas deben ser un número >= 0"),
  handleValidationErrors,
];

const updateFaseValidation = [
  body("nombre")
    .optional()
    .isLength({ min: 2, max: 100 }).withMessage("El nombre debe tener entre 2 y 100 caracteres")
    .trim(),
  body("horas_estimadas")
    .optional()
    .isFloat({ min: 0 }).withMessage("Las horas estimadas deben ser un número >= 0"),
  (req, res, next) => {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Debes enviar al menos un campo para actualizar",
      });
    }
    next();
  },
  handleValidationErrors,
];

module.exports = {
  proyectoIdValidation,
  faseIdValidation,
  createFaseValidation,
  updateFaseValidation,
};
