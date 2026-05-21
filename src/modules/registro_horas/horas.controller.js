const registroHorasService = require('./horas.service');

const getHorasByLider = async (req, res, next) => {
  try {
    if (!req.user?.id_usuario) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    const horas = await registroHorasService.getHorasByLider(req.user.id_usuario);

    res.status(200).json({ success: true, data: horas });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ success: false, message: err.message });

    next(err);
  }
};

const getRegistrosHoras = async (req, res, next) => {
  try {
    const registros = await registroHorasService.getRegistrosHoras({ user: req.user, empresaId: req.empresaId });

    // no hay horas registradas
    if (registros.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay registros disponibles',
        data: [],
      });
    }

    // hay registros
    res.status(200).json({
      success: true,
      data: registros
    });

  } catch (error) {
    next(error);
  }
};

const createRegistroHoras = async (req, res, next) => {
  try {
    const registro = await registroHorasService.createRegistroHoras({ ...req.body, user: req.user, empresaId: req.empresaId });

    res.status(201).json({
      success: true,
      data: registro
    });

  } catch (error) {
    next(error);
  }
};

const getRegistroHorasById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const registro = await registroHorasService.getRegistroHorasById({ id: id, user: req.user });

    res.status(200).json({
      success: true,
      data: registro
    });

  } catch (error) {
    next(error);
  }
};

const updateRegistroHoras = async (req, res, next) => {
  try {
    const { id } = req.params;

    const registro = await registroHorasService.updateRegistroHoras({ id: id, ...req.body, user: req.user, empresaId: req.empresaId });

    res.status(200).json({
      success: true,
      data: registro
    });

  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHorasByLider,
  getRegistrosHoras,
  createRegistroHoras,
  getRegistroHorasById,
  updateRegistroHoras
};
