const proyectoService = require('./proyecto.service');

const getProyectos = async (req, res, next) => {
  try {
    const empresaId = req.empresaId;
    const usuario = req.user;

    let proyectos = [];

    // líder
    if (usuario.rol === 'lider') {
      proyectos = await proyectoService.getProyectosLider({ empresaId, liderId: usuario.id_usuario });
    }

    // empleado
    else if (usuario.rol === 'empleado') {
      proyectos = await proyectoService.getProyectosEmpleado({ empresaId, empleadoId: usuario.id_usuario });
    }

    // propietario
    else {
      proyectos = await proyectoService.getProyectos(empresaId);
    }

    if (proyectos.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay proyectos disponibles',
        data: []
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
      message: 'Proyecto eliminado correctamente',
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
    const resumen = await proyectoService.getHorasResumenByProyecto(parseInt(req.params.id, 10), req.empresaId);
    return res.status(200).json({ 
      success: true, 
      message: 'Proyecto finalizado correctamente',
      data: resumen });
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
