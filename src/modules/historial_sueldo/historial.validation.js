const { body, validationResult } = require('express-validator');

const createHistorialValidation = [
    body('id_usuario')
        .isInt().withMessage('Usuario inválido'),

    body('tipo_pago')
        .notEmpty().withMessage('El tipo de pago es obligatorio')
        .isIn(['mensual', 'por_hora']).withMessage('Tipo de pago inválido'),

    body('monto')
        .notEmpty().withMessage('El monto es obligatorio')
        .isNumeric().withMessage('El monto debe ser numérico')
        .isFloat({ gt: 0 }).withMessage('Monto debe ser mayor a 0'),

    body('horas_mensuales')
        .optional()
        .isInt({ gt: 0 }).withMessage('Horas mensuales inválidas'),

    (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        next();
    }
];

module.exports = {
    createHistorialValidation
};