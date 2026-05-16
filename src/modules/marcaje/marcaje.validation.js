const { body, query } = require("express-validator");
const { handleValidationErrors } = require("../middlewares/validationMiddleware");

const marcajeBodyValidation = [
  body().custom((value, { req }) => {
    if (req.body && Object.keys(req.body).length > 0) {
      throw new Error("No debes enviar datos en el cuerpo de esta solicitud");
    }

    return true;
  }),

  handleValidationErrors
];

const getMarcajesValidation = [
  query().custom((value, { req }) => {
    if (req.query && Object.keys(req.query).length > 0) {
      throw new Error("No debes enviar filtros en esta consulta");
    }

    return true;
  }),

  handleValidationErrors
];

module.exports = {
  marcajeBodyValidation,
  getMarcajesValidation
};
