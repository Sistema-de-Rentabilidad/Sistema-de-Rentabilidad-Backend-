const logger = require('../../utils/logger');

const roleMiddleware = (...rolesPermitidos) => {
    return (req, res, next) => {
        try {
            const user = req.user;

            // No hay usuario (no pasó authMiddleware)
            if (!user) {
                logger.warn('Acceso denegado: no autenticado', {
                    method: req.method,
                    url: req.originalUrl,
                });

                return res.status(401).json({
                    success: false,
                    message: 'No autenticado',
                });
            }

            // Rol no permitido
            if (!rolesPermitidos.includes(user.rol)) {
                logger.warn('Acceso denegado: rol no autorizado', {
                    userId: user.id_usuario,
                    userRole: user.rol,
                    requiredRoles: rolesPermitidos,
                    method: req.method,
                    url: req.originalUrl,
                });

                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para esta acción',
                });
            }

            next();
        } catch (error) {
            logger.error('❌ Error en roleMiddleware:', {
                message: error.message,
                stack: error.stack,
            });
            return res.status(500).json({
                success: false,
                message: 'Error en validación de rol',
            });
        }
    };
};

module.exports = roleMiddleware;