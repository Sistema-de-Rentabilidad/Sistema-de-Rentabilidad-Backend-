const { loginService, getCurrentUserService } = require('../auth/auth.service');
const { ACCESS_TOKEN_COOKIE, accessTokenCookieOptions, clearAccessTokenCookieOptions } = require('../../config/authCookie');

const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await loginService(email, password);

        res.cookie(ACCESS_TOKEN_COOKIE, result.token, accessTokenCookieOptions);

        return res.status(200).json({
            message: 'Login exitoso',
            user: result.user,
        });
    } catch (error) {
        if (error.message === 'CREDENCIALES_INVALIDAS') {
            return res.status(401).json({
                message: 'Credenciales incorrectas',
                failedAttempts: error.failedAttempts,
                maxFailedAttempts: error.maxFailedAttempts,
                remainingAttempts: error.remainingAttempts,
            });
        }

        if (error.message === 'USUARIO_INACTIVO') {
            return res.status(403).json({ message: 'Usuario inactivo' });
        }

        if (error.message === 'USUARIO_BLOQUEADO') {
            return res.status(423).json({
                message: 'Demasiados intentos fallidos. Intenta nuevamente mas tarde.',
                lockedUntil: error.lockedUntil,
                retryAfterSeconds: error.retryAfterSeconds,
            });
        }

        console.error('Error en login:', error.message);
        return res.status(500).json({ message: 'Error interno del servidor' });
    }
};

const me = async (req, res) => {
    try {
        const user = await getCurrentUserService(req.user.id_usuario);

        return res.status(200).json({
            success: true,
            user,
        });
    } catch (error) {
        const status = error.status || 401;
        return res.status(status).json({
            success: false,
            message: 'Sesion invalida o expirada',
        });
    }
};

const logout = async (req, res) => {
    // Logout solo elimina la cookie del navegador; no revoca JWT ya emitidos.
    res.clearCookie(ACCESS_TOKEN_COOKIE, clearAccessTokenCookieOptions);

    return res.status(200).json({
        success: true,
        message: 'Sesion cerrada correctamente',
    });
};

module.exports = {
    login,
    me,
    logout
};
