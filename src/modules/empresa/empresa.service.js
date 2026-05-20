const empresaRepository = require('./empresa.repository');

const getEmpresas = async () => {
  return await empresaRepository.findAll();
};

const createEmpresa = async ({ nombre }) => {
  const duplicado = await empresaRepository.findByNombre(nombre);

  if (duplicado) {
    const error = new Error('Ya existe una empresa con ese nombre');
    error.status = 400;
    throw error;
  }

  return await empresaRepository.create({ nombre });
};

const getEmpresaById = async ({ id, user }) => {
  const empresa = await empresaRepository.findById(id);

  if (!empresa) {
    const error = new Error('Empresa no encontrada');
    error.status = 404;
    throw error;
  }

  // REGLA: owner solo ve su empresa
  if (user.rol !== 'admin' && empresa.id_empresa !== user.id_empresa) {
    const error = new Error('No tienes permisos para acceder a esta empresa');
    error.status = 403;
    throw error;
  }

  console.log('ROL:', user.rol);

  return empresa;
};

const updateEmpresa = async ({ id, nombre, user }) => {
  const empresa = await empresaRepository.findById(id);

  if (!empresa) {
    const error = new Error('Empresa no encontrada');
    error.status = 404;
    throw error;
  }

  if (user.rol === 'propietario' && empresa.id_empresa !== user.id_empresa) {
    const error = new Error('No tienes permisos para editar esta empresa');
    error.status = 403;
    throw error;
  }

  if (nombre !== undefined) {
    const duplicado = await empresaRepository.findByNombre(nombre);

    if (duplicado && duplicado.id_empresa !== parseInt(id)) {
      const error = new Error('Ya existe una empresa con ese nombre');
      error.status = 400;
      throw error;
    }
  }

  return await empresaRepository.update(id, nombre);
};

module.exports = {
  getEmpresas,
  createEmpresa,
  getEmpresaById,
  updateEmpresa
};