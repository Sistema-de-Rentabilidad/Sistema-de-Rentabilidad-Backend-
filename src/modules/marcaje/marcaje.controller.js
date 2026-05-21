const marcajeService = require('./marcaje.service');

const getMarcajes = async (req, res, next) => {
  try {
    const marcajes = await marcajeService.getMarcajes({ user: req.user });

    if (marcajes.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No hay marcajes disponibles',
        data: []
      });
    }

    return res.status(200).json({
      success: true,
      data: marcajes
    });
  } catch (err) {
    next(err);
  }
};

const marcarEntrada = async (req, res, next) => {
  try {
    const marcaje = await marcajeService.marcarEntrada({ user: req.user });

    return res.status(200).json({
      success: true,
      message: 'Entrada registrada correctamente',
      data: marcaje
    });
  } catch (err) {
    next(err);
  }
};

const marcarSalida = async (req, res, next) => {
  try {
    const marcaje = await marcajeService.marcarSalida({ user: req.user });

    return res.status(200).json({
      success: true,
      message: 'Salida registrada correctamente',
      data: marcaje
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getMarcajes,
  marcarEntrada,
  marcarSalida
};
