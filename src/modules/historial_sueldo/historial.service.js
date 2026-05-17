const historialRepository = require('./historial.repository.js');
const usuarioRepository = require('../usuario/usuario.repository.js');

const createHistorial = async (data, empresaId) => {
    const { id_usuario, tipo_pago, monto, horas_mensuales } = data;

    // fecha automática
    const fecha_inicio = new Date();

    // validar usuario
    const usuario = await usuarioRepository.findById(id_usuario);
    if (!usuario) {
        const error = new Error('Usuario no existe');
        error.status = 404;
        throw error;
    }

    // validar que pertenezca a la empresa
    if (usuario.id_empresa !== empresaId) {
        const error = new Error('No autorizado');
        error.status = 403;
        throw error;
    }

    // buscar sueldo activo
    const activo = await historialRepository.findActivo(id_usuario);

    // cerrar anterior si existe
    if (activo) {
        const fecha_fin = new Date(fecha_inicio);

        // restar 1 día
        fecha_fin.setDate(fecha_fin.getDate() - 1);

        await historialRepository.cerrarHistorial(
            activo.id_historial,
            fecha_fin
        );
    }

    const hoy = new Date().toISOString().split('T')[0];

    const cambioHoy =
        await historialRepository.findCambioHoy(
            id_usuario,
            hoy
        );

    if (cambioHoy) {
        throw Object.assign(
            new Error('Ya existe un cambio de sueldo para este empleado hoy'),
            { status: 400 }
        );
    }

    // validar horas mensuales
    if (tipo_pago === "mensual" && (!horas_mensuales || horas_mensuales <= 0)) {
        throw Object.assign(new Error("Las horas mensuales son obligatorias para sueldo mensual"), { status: 400 });
    }

    // crear nuevo historial
    const nuevo = await historialRepository.create({
        id_usuario,
        tipo_pago,
        monto,
        fecha_inicio,
        horas_mensuales
    });

    return nuevo;
};

module.exports = {
    createHistorial
};