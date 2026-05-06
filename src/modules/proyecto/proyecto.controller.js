const proyectoService = require("./proyecto.service");
const usuarioRepository = require("../usuario/usuario.repository");

const resolveEmpresa = async (req, res) => {
  if (!req.user?.id_usuario) {
    res.status(401).json({ success: false, message: "Usuario no autenticado" });
    return null;
  }
  const userDB = await usuarioRepository.findById(req.user.id_usuario);
  if (!userDB) {
    res.status(404).json({ success: false, message: "Usuario no encontrado" });
    return null;
  }
  if (!userDB.id_empresa) {
    res.status(400).json({ success: false, message: "El usuario no tiene una empresa asociada" });
    return null;
  }
  return userDB;
};

const getProyectos = async (req, res, next) => {
  try {
    const empresaId = req.empresaId; // viene del middleware

    const proyectos = await proyectoService.getProyectos(empresaId);

    // ✅ Caso: no hay proyectos registrados
    if (proyectos.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No hay proyectos disponibles",
        data: [],
      });
    }

    // ✅ Caso: hay proyectos
    return res.status(200).json({
      success: true,
      data: proyectos
    });
  } catch (error) {
    next(error);
  }
};

const getMisProyectos = async (req, res, next) => {
  try {
    if (!req.user?.id_usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado" });
    }
    const proyectos = await proyectoService.getMisProyectos(req.user);
    return res.status(200).json({ success: true, data: proyectos });
  } catch (err) {
    next(err);
  }
};

const getProyectosDisponibles = async (req, res, next) => {
  try {
    if (!req.user?.id_usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado" });
    }
    const userDB = await usuarioRepository.findById(req.user.id_usuario);
    if (!userDB) return res.status(404).json({ success: false, message: "Usuario no encontrado" });
    const proyectos = await proyectoService.getProyectosDisponibles(userDB);
    return res.status(200).json({ success: true, data: proyectos });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const createProyecto = async (req, res, next) => {
  try {
    const empresaId = req.empresaId;

    const proyecto = await proyectoService.createProyecto(
      empresaId,
      req.body
    );

    return res.status(201).json({
      success: true,
      data: proyecto
    });
  } catch (error) {
    next(error);
  }
};

const getProyectoById = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId;

    const proyecto = await proyectoService.getProyectoById(
      proyectoId,
      empresaId
    );

    return res.status(200).json({
      success: true,
      data: proyecto
    });
  } catch (error) {
    next(error);
  }
};

const updateProyecto = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId;

    const proyecto = await proyectoService.updateProyecto(
      proyectoId,
      empresaId,
      req.body
    );

    return res.status(200).json({
      success: true,
      data: proyecto
    });
  } catch (error) {
    next(error);
  }
};

const desactivarProyecto = async (req, res, next) => {
  try {
    const userDB = await resolveEmpresa(req, res);
    if (!userDB) return;
    const result = await proyectoService.desactivarProyecto(parseInt(req.params.id, 10), userDB.id_empresa);
    return res.status(200).json({ success: true, message: "Proyecto desactivado correctamente", data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const getEmpleadosProyecto = async (req, res, next) => {
  try {
    const userDB = await resolveEmpresa(req, res);
    if (!userDB) return;
    const empleados = await proyectoService.getEmpleadosProyecto(parseInt(req.params.id, 10), userDB.id_empresa);
    return res.status(200).json({ success: true, data: empleados });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const activarProyecto = async (req, res, next) => {
  try {
    const userDB = await resolveEmpresa(req, res);
    if (!userDB) return;
    const result = await proyectoService.activarProyecto(parseInt(req.params.id, 10), userDB.id_empresa);
    return res.status(200).json({ success: true, message: "Proyecto activado correctamente", data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const eliminarProyecto = async (req, res, next) => {
  try {
    const userDB = await resolveEmpresa(req, res);
    if (!userDB) return;
    const result = await proyectoService.eliminarProyecto(parseInt(req.params.id, 10), userDB.id_empresa);
    return res.status(200).json({ success: true, message: "Proyecto eliminado correctamente", data: result });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

const getHorasResumenProyecto = async (req, res, next) => {
  try {
    const userDB = await resolveEmpresa(req, res);
    if (!userDB) return;
    const resumen = await proyectoService.getHorasResumenByProyecto(parseInt(req.params.id, 10), userDB.id_empresa);
    return res.status(200).json({ success: true, data: resumen });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });
    next(err);
  }
};

module.exports = {
  getProyectos,
  getMisProyectos,
  getProyectosDisponibles,
  getProyectoById,
  createProyecto,
  updateProyecto,
  desactivarProyecto,
  activarProyecto,
  eliminarProyecto,
  getHorasResumenProyecto,
  getEmpleadosProyecto,
};
