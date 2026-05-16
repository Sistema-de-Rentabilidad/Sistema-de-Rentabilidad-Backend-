const proyectoService = require("./proyecto.service");
const usuarioRepository = require("../usuario/usuario.repository");

const getProyectos = async (req, res, next) => {
  try {
    const empresaId = req.empresaId; // viene del middleware

    const usuario = req.user;

    let filtros = {
      empresaId
    };

    // si es líder → filtrar sus proyectos
    if (usuario.rol === 'lider') {
      filtros.liderId = usuario.id_usuario;
    }

    const proyectos = await proyectoService.getProyectos(filtros);

    if (proyectos.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No hay proyectos disponibles",
        data: [],
      });
    }

    return res.status(200).json({
      success: true,
      data: proyectos
    });
  } catch (error) {
    next(error);
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
    const proyectoId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId;

    const proyecto = await proyectoService.desactivarProyecto(
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

const finalizarProyecto = async (req, res, next) => {
  try {

    const proyectoId = parseInt(req.params.id, 10);

    const proyecto = await proyectoService.finalizarProyecto({
      proyectoId,
      empresaId: req.empresaId,
      liderId: req.user.id_usuario
    });

    return res.status(200).json({
      success: true,
      data: proyecto
    });

  } catch (error) {
    next(error);
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
  createProyecto,
  getProyectoById,
  updateProyecto,
  desactivarProyecto,
  finalizarProyecto,
  getHorasResumenProyecto,
};
