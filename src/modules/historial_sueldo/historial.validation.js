const { body, validationResult } = require('express-validator');

const createHistorialValidation = [
    body('id_usuario')
        .notEmpty().withMessage('El usuario es obligatorio')
        .isInt().withMessage('Usuario inválido'),

    body('tipo_pago')
        .notEmpty().withMessage('El tipo de pago es obligatorio')
        .isIn(['mensual', 'por_hora']).withMessage('Tipo de pago inválido'),

    body('monto')
        .notEmpty().withMessage('El monto es obligatorio')
        .isNumeric().withMessage('El monto debe ser numérico')
        .isFloat({ min: 0.5 }).withMessage('El monto debe ser mayor a 0.5'),

    body('horas_mensuales')
        .if(body('tipo_pago').equals('mensual'))
        .notEmpty()
        .withMessage(
            'Las horas mensuales son obligatorias'
        )
        .isNumeric().withMessage('Las horas mensuales deben ser números')
        .isInt({ min: 1 }).withMessage('Las horas mensuales deben ser mayor a 0'),

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