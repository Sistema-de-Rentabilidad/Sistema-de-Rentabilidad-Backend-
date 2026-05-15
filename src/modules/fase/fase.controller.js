const faseService = require("./fase.service");

const getFasesByProyecto = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const fases = await faseService.getFasesByProyecto(proyectoId, empresaId);

    // no hay fases registradas
    if (fases.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No hay fases disponibles",
        data: [],
      });
    }

    return res.status(200).json({ success: true, data: fases });
  } catch (err) {
    next(err);
  }
};

const createFase = async (req, res, next) => {
  try {
    const proyectoId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const nuevaFase = await faseService.createFase(proyectoId, req.body, empresaId);
    
    return res.status(201).json({ success: true, data: nuevaFase });
  } catch (err) {
    next(err);
  }
};

const getFaseById = async (req, res, next) => {
  try {
    const faseId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const fase = await faseService.getFaseById(faseId, empresaId);
    
    return res.status(200).json({ success: true, data: fase });
  } catch (err) {
    next(err);
  }
};

const updateFase = async (req, res, next) => {
  try {
    const faseId = parseInt(req.params.id, 10);
    const empresaId = req.empresaId; // viene del middleware

    const faseActualizada = await faseService.updateFase(faseId, req.body, empresaId);

    return res.status(200).json({ success: true, data: faseActualizada });
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
