const { body, param, query } = require('express-validator');
const { handleValidationErrors } = require('../../modules/middlewares/validationMiddleware');

const listHorasValidation = [
    query('fecha_desde')
        .optional()
        .isISO8601().withMessage('Fecha desde invalida'),

    query('fecha_hasta')
        .optional()
        .isISO8601().withMessage('Fecha hasta invalida'),

    (req, res, next) => {
        const { fecha_desde, fecha_hasta } = req.query;

        if (fecha_desde && fecha_hasta && new Date(fecha_desde) > new Date(fecha_hasta)) {
            return res.status(400).json({
                success: false,
                message: 'El rango de fechas es invalido'
            });
        }

        next();
    },

    handleValidationErrors
];

const createHorasValidation = [
    body('id_proyecto')
        .notEmpty().withMessage('El proyecto es obligatorio')
        .isInt({ min: 1 }).withMessage('ID de proyecto inválido'),

    body('id_fase')
        .notEmpty().withMessage('La fase es obligatoria')
        .isInt({ min: 1 }).withMessage('ID de fase inválido'),

    body('horas')
        .notEmpty().withMessage('Las horas son obligatorias')
        .isNumeric().withMessage('Las horas deben ser números')
        .isFloat({ min: 0.5, max: 24 }).withMessage('Las horas deben estar entre 0.5 y 24'),

    body('descripcion')
        .optional({ checkFalsy: true })
        .trim()
        .isLength({ min: 3, max: 100 }).withMessage('La descripción debe tener entre 3 y 100 caracteres')
        .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s.,()-]+$/)
        .withMessage('La descripción contiene caracteres inválidos')
        .trim(),

    handleValidationErrors
];

const registroHorasIdParamValidation = [
    param('id').isInt({ min: 1 }).withMessage('ID de registro inválido'),

    handleValidationErrors
];

const updateHorasValidation = [
    body('id_proyecto')
        .optional()
        .isInt({ min: 1 }).withMessage('ID de proyecto inválido'),

    body('id_fase')
        .optional()
        .isInt({ min: 1 }).withMessage('ID de fase inválido'),

    body('horas')
        .optional()
        .isNumeric().withMessage('Las horas deben ser números')
        .isFloat({ min: 0.5, max: 24 })
        .withMessage('Las horas deben estar entre 0.5 y 24'),

    body('descripcion')
        .optional()
        .trim()
        .isLength({ min: 3, max: 100 }).withMessage('La descripción debe tener entre 3 y 100 caracteres')
        .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s.,()-]+$/)
        .withMessage('La descripción contiene caracteres inválidos'),

    (req, res, next) => {
        const { id_proyecto, id_fase, horas, descripcion } = req.body;
        if (!id_proyecto && !id_fase && !horas && !descripcion) {
            return res.status(400).json({
                success: false,
                message: 'Debes enviar al menos un campo para actualizar'
            });
        }
        next();
    },

    handleValidationErrors
];

module.exports = {
    listHorasValidation,
    createHorasValidation,
    registroHorasIdParamValidation,
    updateHorasValidation
};
