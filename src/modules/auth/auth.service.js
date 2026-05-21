const authRepository = require('../auth/auth.repository');
const { comparePassword } = require('../../utils/hash');
const { generateToken } = require('../../utils/jwt');
const usuarioRepository = require('../usuario/usuario.repository');

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_MS = 5 * 60 * 1000;
const FAILED_ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

const normalizeEmail = (email) => email.trim().toLowerCase();

const getRetryAfterSeconds = (lockedUntil) => {
    return Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
};

const createLockedError = (lockedUntil) => {
    const error = new Error('USUARIO_BLOQUEADO');
    error.lockedUntil = new Date(lockedUntil).toISOString();
    error.retryAfterSeconds = getRetryAfterSeconds(lockedUntil);
    return error;
};

const createInvalidCredentialsError = (failedAttempts = 0) => {
    const error = new Error('CREDENCIALES_INVALIDAS');
    error.failedAttempts = failedAttempts;
    error.maxFailedAttempts = MAX_FAILED_ATTEMPTS;
    error.remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - failedAttempts);
    return error;
};

const loginService = async (email, password) => {
    const normalizedEmail = normalizeEmail(email);
    const user = await usuarioRepository.findByEmail(normalizedEmail);

    if (!user) {
        throw createInvalidCredentialsError();
    }

    if (user.is_active === false) {
        throw new Error('USUARIO_INACTIVO');
    }

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
        throw createLockedError(user.locked_until);
    }

    const validPassword = await comparePassword(password, user.password);

    if (!validPassword) {
        const lockExpired = user.locked_until && new Date(user.locked_until).getTime() <= Date.now();
        const lastFailedAt = user.last_failed_login_at ? new Date(user.last_failed_login_at).getTime() : 0;
        const attemptsExpired = !lastFailedAt || Date.now() - lastFailedAt >= FAILED_ATTEMPT_WINDOW_MS;
        const currentAttempts = lockExpired || attemptsExpired ? 0 : Number(user.failed_login_attempts || 0);
        const nextAttempts = currentAttempts + 1;
        const lockedUntil = nextAttempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;

        await authRepository.setFailedLoginState(user.id_usuario, nextAttempts, lockedUntil);

        if (lockedUntil) {
            throw createLockedError(lockedUntil);
        }

        throw createInvalidCredentialsError(nextAttempts);
    }

    await authRepository.clearFailedLoginState(user.id_usuario);

    const token = generateToken({
        id_usuario: user.id_usuario,
        email: user.email,
        rol: user.rol,
        id_empresa: user.id_empresa
    });

    return {
        token,
        user: {
            id_usuario: user.id_usuario,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol,
            id_empresa: user.id_empresa,
        },
    };
};

const getCurrentUserService = async (idUsuario) => {
    const user = await authRepository.findActiveUserById(idUsuario);

    if (!user) {
        const error = new Error('USUARIO_NO_ENCONTRADO');
        error.status = 401;
        throw error;
    }

    return {
        id_usuario: user.id_usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol,
        id_empresa: user.id_empresa,
    };
};

module.exports = {
    loginService,
    getCurrentUserService
};
