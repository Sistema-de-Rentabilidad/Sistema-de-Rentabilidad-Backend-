const servicioRepository = require('./servicio.repository');

const getServiciosByEmpresa = async (empresaId) => {
  return await servicioRepository.findByEmpresaId(empresaId);
};

const createServicio = async ({ nombre, descripcion, empresaId }) => {
  const nombreLimpio = nombre.trim();

  const duplicado = await servicioRepository.findByNombreAndEmpresa(
    nombreLimpio,
    empresaId
  );

  if (duplicado) {
    const error = new Error('Ya existe un servicio con este nombre en tu empresa');
    error.status = 400;
    throw error;
  }

  return await servicioRepository.create({
    nombre: nombreLimpio,
    descripcion,
    empresaId
  });
};

const getServicioById = async (servicioId, empresaId) => {
  const servicio = await servicioRepository.findById(servicioId);

  if (!servicio) {
    const error = new Error('Servicio no encontrado');
    error.status = 404;
    throw error;
  }

  if (servicio.id_empresa !== empresaId) {
    const error = new Error('No tienes permisos para acceder a este servicio');
    error.status = 403;
    throw error;
  }

  return servicio;
};

const updateServicio = async (servicioId, empresaId, { nombre, descripcion }) => {
  const servicio = await servicioRepository.findById(servicioId);

  if (!servicio) {
    const error = new Error('Servicio no encontrado');
    error.status = 404;
    throw error;
  }

  if (servicio.id_empresa !== empresaId) {
    const error = new Error('No tienes permisos para modificar este servicio');
    error.status = 403;
    throw error;
  }

  const nombreLimpio = nombre?.trim();

  if (nombreLimpio) {
    const duplicado = await servicioRepository.findByNombreAndEmpresa(
      nombreLimpio,
      empresaId
    );

    // ⚠️ evitar conflicto consigo mismo
    if (duplicado && duplicado.id_servicio !== servicioId) {
      const error = new Error('Ya existe un servicio con este nombre en tu empresa');
      error.status = 400;
      throw error;
    }
  }

  return await servicioRepository.update(servicioId, {
    nombre: nombreLimpio,
    descripcion
  });
};

const desactivarServicio = async (servicioId, empresaId) => {
  const servicio = await servicioRepository.findByIdFull(servicioId);

  if (!servicio) {
    const error = new Error('Servicio no encontrado');
    error.status = 404;
    throw error;
  }

  if (servicio.id_empresa !== empresaId) {
    const error = new Error('No tienes permisos para eliminar este servicio');
    error.status = 403;
    throw error;
  }

  if (!servicio.is_active) {
    const error = new Error('El servicio ya está inactivo');
    error.status = 400;
    throw error;
  }

  const result = await servicioRepository.desactivar(servicioId);
  return result;
};

module.exports = {
  getServiciosByEmpresa,
  createServicio,
  getServicioById,
  updateServicio,
  desactivarServicio
};
