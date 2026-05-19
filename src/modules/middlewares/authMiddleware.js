const { verifyToken } = require("../../utils/jwt");
const { ACCESS_TOKEN_COOKIE } = require("../../config/authCookie");

const authMiddleware = (req, res, next) => {
    try {
        const token = req.cookies?.[ACCESS_TOKEN_COOKIE];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token no proporcionado",
            });
        }

        const decoded = verifyToken(token);

        req.user = decoded;

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
