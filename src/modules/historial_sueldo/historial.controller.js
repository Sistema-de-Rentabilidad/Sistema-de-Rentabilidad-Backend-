const historialService = require('./historial.service');

const createHistorial = async (req, res, next) => {
    try {
        const data = req.body;
        const empresaId = req.empresaId;

        const historial = await historialService.createHistorial(data, empresaId);

        res.status(201).json({ success: true, data: historial });
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createHistorial
};