const notasService = require("./notas.service");

const getNotasByProyecto = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const notas = await notasService.getNotasByProyecto(proyectoId, req.user);
    return res.status(200).json({ success: true, data: notas });
  } catch (err) {
    next(err);
  }
};

const createNota = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const nota = await notasService.createNota(proyectoId, req.body, req.user);
    return res.status(201).json({ success: true, data: nota });
  } catch (err) {
    next(err);
  }
};

const updateNota = async (req, res, next) => {
  try {
    const notaId = parseInt(req.params.id, 10);
    const nota = await notasService.updateNota(notaId, req.body, req.user);
    return res.status(200).json({ success: true, data: nota });
  } catch (err) {
    next(err);
  }
};

const desactivarNota = async (req, res, next) => {
  try {
    const notaId = parseInt(req.params.id, 10);
    const nota = await notasService.desactivarNota(notaId, req.user);
    return res.status(200).json({ success: true, data: nota });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getNotasByProyecto,
  createNota,
  updateNota,
  desactivarNota,
};
