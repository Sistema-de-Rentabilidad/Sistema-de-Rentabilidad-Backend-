const { loginService, getCurrentUserService } = require('../auth/auth.service');
const { ACCESS_TOKEN_COOKIE, accessTokenCookieOptions, clearAccessTokenCookieOptions } = require('../../config/authCookie');
const logger = require('../../utils/logger');

const login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await loginService(email, password);

        res.cookie(ACCESS_TOKEN_COOKIE, result.token, accessTokenCookieOptions);
        logger.info('Login exitoso', { email });

        return res.status(200).json({
            message: 'Login exitoso',
            user: result.user,
        });
    } catch (error) {
        if (error.message === 'CREDENCIALES_INVALIDAS') {
            logger.warn('Login fallido por credenciales invalidas', {
                email: email || req.body?.email,
                failedAttempts: error.failedAttempts,
                remainingAttempts: error.remainingAttempts,
            });

            return res.status(401).json({
                message: 'Credenciales incorrectas',
                failedAttempts: error.failedAttempts,
                maxFailedAttempts: error.maxFailedAttempts,
                remainingAttempts: error.remainingAttempts,
            });
        }

        if (error.message === 'USUARIO_INACTIVO') {
            logger.warn('Login fallido: usuario inactivo', { email: email || req.body?.email });
            return res.status(403).json({ message: 'Usuario inactivo' });
        }

        if (error.message === 'USUARIO_BLOQUEADO') {
            logger.warn('Login bloqueado', {
                email: email || req.body?.email,
                lockedUntil: error.lockedUntil,
                retryAfterSeconds: error.retryAfterSeconds,
            });

            return res.status(423).json({
                message: 'Demasiados intentos fallidos. Intenta nuevamente mas tarde.',
                lockedUntil: error.lockedUntil,
                retryAfterSeconds: error.retryAfterSeconds,
            });
        }

        logger.error('Error en login:', { message: error.message });
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
