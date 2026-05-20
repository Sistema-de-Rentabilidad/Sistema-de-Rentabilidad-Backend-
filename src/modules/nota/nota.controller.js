const notaService = require("./nota.service");

const getNotasByProyecto = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const notas = await notaService.getNotasByProyecto(proyectoId, empresaId);

    // no hay notas registradas
    if (notas.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No hay notas disponibles",
        data: [],
      });
    }

    return res.status(200).json({ success: true, data: notas });
  } catch (err) {
    next(err);
  }
};

const createNota = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const nuevaNota = await notaService.createNota(proyectoId, req.body, req.user, empresaId);

    return res.status(201).json({ success: true, data: nuevaNota });
  } catch (err) {
    next(err);
  }
};

const getNotaById = async (req, res, next) => {
  try {
    const notaId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const nota = await notaService.getNotaById(notaId, empresaId);

    return res.status(200).json({ success: true, data: nota });
  } catch (err) {
    next(err);
  }
};

const updateNota = async (req, res, next) => {
  try {
    const notaId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const notaActualizada = await notaService.updateNota(notaId, req.body, req.user, empresaId);

    return res.status(200).json({ success: true, data: notaActualizada });
  } catch (err) {
    next(err);
  }
};

const desactivarNota = async (req, res, next) => {
  try {
    const notaId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const result = await notaService.desactivarNota(notaId, req.user, empresaId);

    return res.status(200).json({
      success: true,
      message: 'Nota desactivada correctamente',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getNotasByProyecto,
  createNota,
  getNotaById,
  updateNota,
  desactivarNota,
};