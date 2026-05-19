const { body, param, validationResult } = require('express-validator');
const empresaRepository = require('../empresa/empresa.repository');
const { handleValidationErrors } = require('../../modules/middlewares/validationMiddleware');

const createUsuarioValidation = [
    body('nombre')
        .notEmpty().withMessage('El nombre es obligatorio')
        .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
        .withMessage('El nombre solo debe contener letras y espacios')
        .trim(),

    body('email')
        .notEmpty().withMessage('El email es obligatorio')
        .isEmail().withMessage('Email inválido')
        .trim(),

    body('password')
        .notEmpty().withMessage('La contraseña es obligatoria')
        .isLength({ min: 8, max: 100 }).withMessage('El nombre debe tener entre 8 y 100 caracteres')
        .matches(/[A-Z]/).withMessage('Debe contener al menos una mayúscula')
        .matches(/[a-z]/).withMessage('Debe contener al menos una minúscula')
        .matches(/[0-9]/).withMessage('Debe contener al menos un número')
        .matches(/[^A-Za-z0-9]/).withMessage('Debe contener un carácter especial')
        .trim(),

    body('id_empresa')
        .optional({ checkFalsy: true })
        .isInt().withMessage('Empresa inválida')
        .custom(async (value, { req }) => {
            // solo validar si viene (caso admin)
            if (value) {
                const empresa = await empresaRepository.findById(value);
                if (!empresa) {
                    throw new Error('La empresa no existe');
                }
            }
            return true;
        }),

    body('rol')
        .custom((value, { req }) => {
            const user = req.user;

            if (user.rol === 'admin') {
                // admin NO necesita enviar rol
                if (value && value !== 'propietario') {
                    throw new Error('Admin solo puede crear propietario');
                }
            }

            if (user.rol === 'propietario') {
                // propietario SÍ debe enviar rol
                if (!value) {
                    throw new Error('Rol es obligatorio');
                }

                if (value === 'propietario') {
                    throw new Error('No puede crear otro propietario');
                }
            }

            return true;
        }),

    body('tipo_pago')
        .optional({ checkFalsy: true })
        .isIn(['mensual', 'por_hora'])
        .withMessage('Tipo de pago inválido o vacío'),

    body('monto')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('El monto debe ser un número')
        .isFloat({ min: 0.01, max: 999999.99 })
        .withMessage('El monto deben estar entre 0.01 y 999999.99'),

    body('horas_mensuales')
        .optional({ checkFalsy: true })
        .isNumeric().withMessage('Las horas mensuales deben ser números')
        .isFloat({ min: 1, max: 320 })
        .withMessage('Las horas mensuales deben estar entre 1 y 320'),

    handleValidationErrors
];

const usuarioIdParamValidation = [
    param('id')
        .isInt({ min: 1 }).withMessage('ID de usuario inválido'),

    handleValidationErrors
];

const updateUsuarioValidation = [
    body('nombre')
        .optional()
        .isLength({ min: 3, max: 100 }).withMessage('El nombre debe tener entre 3 y 100 caracteres')
        .matches(/^[A-Za-zÁÉÍÓÚáéíóúÑñ\s]+$/)
        .withMessage('El nombre solo debe contener letras y espacios')
        .trim(),

    body('email')
        .optional()
        .isEmail().withMessage('Email inválido')
        .trim(),

    body('password')
        .optional()
        .isLength({ min: 8, max: 100 }).withMessage('El nombre debe tener entre 8 y 100 caracteres')
        .matches(/[A-Z]/).withMessage('Debe contener al menos una mayúscula')
        .matches(/[a-z]/).withMessage('Debe contener al menos una minúscula')
        .matches(/[0-9]/).withMessage('Debe contener al menos un número')
        .matches(/[^A-Za-z0-9]/).withMessage('Debe contener un carácter especial')
        .trim(),

    body('tipo_pago')
        .optional()
        .isIn(['mensual', 'por_hora'])
        .withMessage('Tipo de pago inválido o vacío'),

    body('monto')
        .optional()
        .isNumeric().withMessage('El monto debe ser un número')
        .isFloat({ min: 0.01, max: 999999.99 })
        .withMessage('El monto deben estar entre 0.01 y 999999.99'),

    body('horas_mensuales')
        .optional()
        .isNumeric().withMessage('Las horas mensuales deben ser números')
        .isFloat({ min: 1, max: 320 })
        .withMessage('Las horas mensuales deben estar entre 1 y 320'),

    (req, res, next) => {
        const { nombre, email, password, tipo_pago, monto, horas_mensuales} = req.body;
        if (!nombre && !email && !password && !tipo_pago && !monto && !horas_mensuales) {
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
    createUsuarioValidation,
    usuarioIdParamValidation,
    updateUsuarioValidation
};
