const { body, query } = require('express-validator');
const { handleValidationErrors } = require('../middlewares/validationMiddleware');

const marcajeBodyValidation = [
  body().custom((value, { req }) => {
    if (req.body && Object.keys(req.body).length > 0) {
      throw new Error('No debes enviar datos en el cuerpo de esta solicitud');
    }

    return true;
  }),

  handleValidationErrors
];

module.exports = {
  marcajeBodyValidation
};
