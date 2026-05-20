const { verifyToken } = require("../../utils/jwt");
const { ACCESS_TOKEN_COOKIE } = require("../../config/authCookie");
const authRepository = require("../auth/auth.repository");

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token no proporcionado",
            });
        }

        const decoded = verifyToken(token);

        const user = await authRepository.findActiveUserById(decoded.id_usuario);

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Usuario no encontrado",
            });
        }

        req.user = user;

        next();
    } catch (error) {
        console.error("❌ Error en authMiddleware:", error.message);
        return res.status(401).json({
            success: false,
            message: "Token inválido o expirado",
        });
    }
};

module.exports = authMiddleware;
