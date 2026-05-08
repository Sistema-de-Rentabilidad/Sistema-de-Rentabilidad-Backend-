const fasesService = require("./fases.service");

const getFasesByProyecto = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const orderBy = req.query.orderBy || "fecha";
    const fases = await fasesService.getFasesByProyecto(proyectoId, orderBy, req.user);
    return res.status(200).json({ success: true, data: fases });
  } catch (err) {
    next(err);
  }
};

const createFase = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const fase = await fasesService.createFase(proyectoId, req.body, req.user);
    return res.status(201).json({ success: true, data: fase });
  } catch (err) {
    next(err);
  }
};

const getFaseById = async (req, res, next) => {
  try {
    const faseId = parseInt(req.params.id, 10);
    const fase = await fasesService.getFaseById(faseId, req.user);
    return res.status(200).json({ success: true, data: fase });
  } catch (err) {
    next(err);
  }
};

const updateFase = async (req, res, next) => {
  try {
    const faseId = parseInt(req.params.id, 10);
    const fase = await fasesService.updateFase(faseId, req.body, req.user);
    return res.status(200).json({ success: true, data: fase });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getFasesByProyecto,
  createFase,
  getFaseById,
  updateFase,
};
