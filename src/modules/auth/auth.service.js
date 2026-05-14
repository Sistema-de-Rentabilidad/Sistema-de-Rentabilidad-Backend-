const authRepository = require("../auth/auth.repository");
const { hashPassword, comparePassword } = require("../../utils/hash");
const { generateToken } = require("../../utils/jwt");

//LOGIN
const loginService = async (email, password) => {
    const user = await authRepository.findUserByEmail(email);

    if (!user) {
        throw new Error("CREDENCIALES_INVALIDAS");
    }

    if (user.is_active === false) {
        throw new Error("USUARIO_INACTIVO");
    }

    const validPassword = await comparePassword(password, user.password);

    if (!validPassword) {
        throw new Error("CREDENCIALES_INVALIDAS");
    }

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

//Registra Propietario
const registerOwnerService = async (id_empresa, nombre, email, password) => {
    // validar nombre
    if (!nombre || nombre.trim().length < 3) {
        throw new Error("NOMBRE_CORTO");
    }

    // validar email formato
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        throw new Error("EMAIL_INVALIDO");
    }

    // validar fortaleza de contraseña
    if (!password || password.length < 8) {
        throw new Error("PASSWORD_DEBIL_LONGITUD");
    }
    if (!/[A-Z]/.test(password)) {
        throw new Error("PASSWORD_DEBIL_MAYUSCULA");
    }
    if (!/[a-z]/.test(password)) {
        throw new Error("PASSWORD_DEBIL_MINUSCULA");
    }
    if (!/[0-9]/.test(password)) {
        throw new Error("PASSWORD_DEBIL_NUMERO");
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
        throw new Error("PASSWORD_DEBIL_ESPECIAL");
    }

    // validar email único
    const existingUser = await authRepository.findUserByEmail(email);
    if (existingUser) {
        throw new Error("EMAIL_YA_EXISTE");
    }

    // encriptar password
    const hashedPassword = await hashPassword(password);

    // rol fijo propietario
    const rol = "propietario";

    // guardar
    const newUser = await authRepository.createOwner(
        id_empresa,
        nombre,
        email,
        hashedPassword,
        rol,
    );

    return newUser;
};

module.exports = {
    loginService,
    registerOwnerService
};