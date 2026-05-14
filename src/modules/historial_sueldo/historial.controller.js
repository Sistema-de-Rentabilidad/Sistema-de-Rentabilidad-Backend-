const historialService = require('./historial.service');

const createHistorial = async (req, res, next) => {
    try {
        const data = req.body;
        const user = req.user;

        const historial = await historialService.createHistorial(data, user);

        res.status(201).json({
            success: true,
            data: historial
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createHistorial
};