const { loginService, registerOwnerService, getOwnerContactService } = require("../auth/auth.service");

const registerOwner = async (req, res) => {
    try {
        const { id_empresa, nombre, email, password } = req.body;

        if (!id_empresa || !nombre || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Todos los campos son obligatorios",
            });
        }

        const newUser = await registerOwnerService(
            id_empresa,
            nombre,
            email,
            password,
        );

        return res.status(201).json({
            success: true,
            message: "Usuario propietario creado correctamente",
            user: newUser,
        });
    } catch (error) {
        const validationErrors = {
            NOMBRE_CORTO:           [422, "El nombre debe tener al menos 3 caracteres."],
            EMAIL_INVALIDO:         [400, "El correo electrónico no es válido."],
            EMAIL_YA_EXISTE:        [409, "Este correo ya está registrado."],
            PASSWORD_DEBIL_LONGITUD:[422, "La contraseña debe tener al menos 8 caracteres."],
            PASSWORD_DEBIL_MAYUSCULA:[422, "La contraseña debe contener al menos una letra mayúscula."],
            PASSWORD_DEBIL_MINUSCULA:[422, "La contraseña debe contener al menos una letra minúscula."],
            PASSWORD_DEBIL_NUMERO:  [422, "La contraseña debe contener al menos un número."],
            PASSWORD_DEBIL_ESPECIAL:[422, "La contraseña debe contener al menos un carácter especial (ej: !@#$%)."],
        };

        if (validationErrors[error.message]) {
            const [status, message] = validationErrors[error.message];
            return res.status(status).json({ success: false, message });
        }

        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Error interno del servidor",
        });
    }
};

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
            return res.status(401).json({ message: "Credenciales incorrectas" });
        }

        if (error.message === "USUARIO_INACTIVO") {
            return res.status(403).json({ message: "Usuario inactivo" });
        }

        console.error(error);
        return res.status(500).json({ message: "Error interno del servidor" });
    }
};

module.exports = {
    login,
    registerOwner
};