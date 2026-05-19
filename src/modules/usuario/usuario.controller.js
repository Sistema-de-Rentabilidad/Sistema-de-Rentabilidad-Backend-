const usuarioService = require("./usuario.service");

const getUsuarios = async (req, res, next) => {
  try {
    const usuarios = await usuarioService.getUsuarios(req.user);

    res.status(200).json({ success: true, data: usuarios });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const createUsuario = async (req, res, next) => {
  try {
    const nuevoUsuario = await usuarioService.createUsuario(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Usuario creado correctamente",
      user: {
        id: nuevoUsuario.id_usuario,
        nombre: nuevoUsuario.nombre,
        email: nuevoUsuario.email,
        rol: nuevoUsuario.rol,
        id_empresa: nuevoUsuario.id_empresa,
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const getUsuarioById = async (req, res, next) => {
  try {
    const usuario = await usuarioService.getUsuarioById(req.params.id, req.user);

    return res.status(200).json({ success: true, data: usuario });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const updateUsuario = async (req, res, next) => {
  try {
    const usuarioActualizado = await usuarioService.updateUsuario(parseInt(req.params.id, 10), req.body, req.user);

    res.status(200).json({ success: true, data: usuarioActualizado });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const desactivarUsuario = async (req, res, next) => {
  try {
    const usuarioDesactivado = await usuarioService.desactivarUsuario(parseInt(req.params.id, 10), req.user);

    res.status(200).json({
      success: true,
      message: "Usuario desactivado correctamente",
      data: usuarioDesactivado
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const revocarEmpresaPropietario = async (req, res, next) => {
  try {
    const propietario = await usuarioService.revocarEmpresaPropietario(parseInt(req.params.id, 10), req.user);

    res.status(200).json({
      success: true,
      message: "Propietario revocado correctamente",
      data: propietario
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = {
  getUsuarios,
  createUsuario,
  getUsuarioById,
  updateUsuario,
  desactivarUsuario,
  revocarEmpresaPropietario
};
