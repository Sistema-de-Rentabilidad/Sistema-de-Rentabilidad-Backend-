const usuarioService = require("./usuario.service");

const getUsuarios = async (req, res, next) => {
  try {
    if (!req.user?.id_usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado" });
    }
    const usuarios = await usuarioService.getUsuarios(req.user);
    res.status(200).json({ success: true, data: usuarios });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const createUsuario = async (req, res, next) => {
  try {
    if (!req.user?.id_usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado" });
    }
    const usuario = await usuarioService.createUsuario(req.body, req.user);
    res.status(201).json({
      success: true,
      message: "Usuario creado correctamente",
      user: {
        id: usuario.id_usuario,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        id_empresa: usuario.id_empresa,
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const updateUsuario = async (req, res, next) => {
  try {
    if (!req.user?.id_usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado" });
    }
    const usuario = await usuarioService.updateUsuario(
      parseInt(req.params.id, 10),
      req.body,
      req.user
    );
    res.status(200).json({ success: true, data: usuario });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

const deleteUsuario = async (req, res, next) => {
  try {
    if (!req.user?.id_usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado" });
    }
    const result = await usuarioService.deleteUsuario(
      parseInt(req.params.id, 10),
      req.user
    );
    res.status(200).json({ success: true, message: "Usuario desactivado correctamente", data: result });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ success: false, message: error.message });
    next(error);
  }
};

module.exports = {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario
};
