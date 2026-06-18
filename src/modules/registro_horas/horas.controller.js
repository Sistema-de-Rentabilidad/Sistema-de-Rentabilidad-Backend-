const registroHorasService = require('./horas.service');

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

const getRegistrosHorasEmpresa = async (req, res, next) => {
  try {
    const registros = await registroHorasService.getRegistrosHorasEmpresa({ user: req.user, empresaId: req.empresaId });
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
  getRegistrosHoras,
  getRegistrosHorasEmpresa,
  createRegistroHoras,
  getRegistroHorasById,
  updateRegistroHoras
};