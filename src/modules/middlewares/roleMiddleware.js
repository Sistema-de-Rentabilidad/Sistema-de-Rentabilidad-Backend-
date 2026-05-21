const roleMiddleware = (...rolesPermitidos) => {
    return (req, res, next) => {
        try {
            const user = req.user;

            // No hay usuario (no pasó authMiddleware)
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'No autenticado',
                });
            }

            // Rol no permitido
            if (!rolesPermitidos.includes(user.rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes permisos para esta acción',
                });
            }

            next();
        } catch (error) {
            console.error('❌ Error en roleMiddleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Error en validación de rol',
            });
        }
    };
};

module.exports = roleMiddleware;