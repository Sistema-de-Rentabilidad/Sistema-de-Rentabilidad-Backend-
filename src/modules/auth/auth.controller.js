const { loginService } = require("../auth/auth.service");

const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        //Validación básica
        if (!email || !password) {
            return res.status(400).json({
                message: "Email y contraseña son obligatorios",
            });
        }

        const result = await loginService(email, password);

        return res.status(200).json({
            message: "Login exitoso",
            token: result.token,
            user: result.user,
        });
    } catch (error) {
        if (error.message === "CREDENCIALES_INVALIDAS") {
            return res.status(401).json({
                message: "Credenciales incorrectas",
                failedAttempts: error.failedAttempts,
                maxFailedAttempts: error.maxFailedAttempts,
                remainingAttempts: error.remainingAttempts,
            });
        }

        if (error.message === "USUARIO_INACTIVO") {
            return res.status(403).json({ message: "Usuario inactivo" });
        }

        if (error.message === "USUARIO_BLOQUEADO") {
            return res.status(423).json({
                message: "Demasiados intentos fallidos. Intenta nuevamente más tarde.",
                lockedUntil: error.lockedUntil,
                retryAfterSeconds: error.retryAfterSeconds,
            });
        }

        console.error(error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};

module.exports = {
    login
};
