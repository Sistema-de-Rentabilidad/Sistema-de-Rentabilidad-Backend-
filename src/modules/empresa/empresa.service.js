const empresaRepository = require('./empresa.repository');

const getEmpresas = async () => {
  const empresas = await empresaRepository.findAll();

  // aquí podrías aplicar reglas si quieres
  return empresas;
};

const createEmpresa = async ({ nombre }) => {
  // regla: no duplicados
  const existe = await empresaRepository.findByName(nombre);

  if (existe) {
    const error = new Error('Ya existe una empresa con ese nombre');
    error.status = 400;
    throw error;
  }

  const empresa = await empresaRepository.create({ nombre });

  return empresa;
};

const getEmpresaById = async ({ id, user }) => {
  const empresa = await empresaRepository.findById(id);

  if (!empresa) {
    const error = new Error('Empresa no encontrada');
    error.status = 404;
    throw error;
  }

  // REGLA: owner solo ve su empresa
  if (user.rol === 'propietario' && empresa.id_empresa !== user.id_empresa) {
    const error = new Error('No tienes acceso a esta empresa');
    error.status = 403;
    throw error;
  }

  return empresa;
};

const updateEmpresa = async ({ id, nombre, user }) => {
  // verificar si existe
  const empresa = await empresaRepository.findById(id);

  if (!empresa) {
    const error = new Error('Empresa no encontrada');
    error.status = 404;
    throw error;
  }

  // VALIDACIÓN DE PROPIEDAD
  if (user.rol === 'propietario' && empresa.id_empresa !== user.id_empresa) {
    const error = new Error('No puedes modificar esta empresa');
    error.status = 403;
    throw error;
  }

  // evitar duplicados (excepto sí misma)
  const empresaDuplicada = await empresaRepository.findByName(nombre);

  if (empresaDuplicada && empresaDuplicada.id_empresa !== parseInt(id)) {
    const error = new Error('Ya existe una empresa con ese nombre');
    error.status = 400;
    throw error;
  }

  const updated = await empresaRepository.update(id, nombre);

  return updated;
};

module.exports = {
  getEmpresas,
  createEmpresa,
  getEmpresaById,
  updateEmpresa
};