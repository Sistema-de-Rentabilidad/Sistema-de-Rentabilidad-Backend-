const servicioService = require("./servicio.service");
const usuarioRepository = require("../usuario/usuario.repository");

const getServicios = async (req, res, next) => {
    try {
        const empresaId = req.user.id_empresa;

        const servicios = await servicioService.getServiciosByEmpresa(empresaId);

        if (servicios.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No hay servicios disponibles",
                data: [],
            });
        }

        return res.status(200).json({
            success: true,
            data: servicios,
        });
    } catch (error) {
        next(error);
    }
};

const createServicio = async (req, res, next) => {
    try {
        const { nombre, descripcion } = req.body;
        const empresaId = req.empresaId;

        const nuevoServicio = await servicioService.createServicio({ nombre, descripcion, empresaId: empresaId });

        return res.status(201).json({
            success: true,
            data: nuevoServicio,
        });
    } catch (error) {
        next(error);
    }
};

const getServicioById = async (req, res, next) => {
    try {
        const servicioId = parseInt(req.params.id, 10);
        const empresaId = req.user.id_empresa;

        const servicio = await servicioService.getServicioById(servicioId, empresaId);

        return res.status(200).json({
            success: true,
            data: servicio
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const updateServicio = async (req, res, next) => {
    try {
        const servicioId = parseInt(req.params.id, 10);
        const { nombre, descripcion } = req.body;
        const empresaId = req.empresaId;

        const servicioActualizado = await servicioService.updateServicio(servicioId, empresaId, { nombre, descripcion });

        return res.status(200).json({
            success: true,
            data: servicioActualizado
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

const desactivarServicio = async (req, res, next) => {
    try {
        const servicioId = parseInt(req.params.id, 10);
        const empresaId = req.empresaId;

        const result = await servicioService.desactivarServicio(servicioId, empresaId);

        return res.status(200).json({
            success: true,
            message: 'Servicio desactivado correctamente',
            data: result,
        });
    } catch (error) {
        if (error.status) return res.status(error.status).json({ success: false, message: error.message });
        next(error);
    }
};

module.exports = {
    getServicios,
    createServicio,
    getServicioById,
    updateServicio,
    desactivarServicio
};