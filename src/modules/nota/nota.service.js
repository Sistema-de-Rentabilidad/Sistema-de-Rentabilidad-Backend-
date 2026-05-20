const notaRepository = require('./nota.repository');
const verifyProyectoAccess = require('../../utils/verifyProyectoAccess')

const getNotasByProyecto = async (proyectoId, empresaId) => {
  await verifyProyectoAccess(proyectoId, empresaId);

  return await notaRepository.findByProyecto(proyectoId);
};

const createNota = async (proyectoId, data, user, empresaId) => {
  const proyecto = await verifyProyectoAccess(proyectoId, empresaId);;

  if (proyecto.id_lider !== user.id_usuario) {
    throw Object.assign(
      new Error('Solo el líder asignado a este proyecto puede registrar notas'),
      { status: 403 }
    );
  }

  return await notaRepository.create({
    id_proyecto: proyectoId,
    id_lider: user.id_usuario,
    descripcion: data.descripcion,
  });
};

const getNotaById = async (id, empresaId) => {
  const nota = await notaRepository.findById(id);

  if (!nota) {
    throw Object.assign(new Error('Nota no encontrada'), { status: 404 });
  }

  if (nota.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para acceder a esta nota'),
      { status: 403 }
    );
  }
  
  return nota;
};

const updateNota = async (id, data, user, empresaId) => {
  const nota = await notaRepository.findById(id);

  if (!nota) {
    throw Object.assign(new Error('Nota no encontrada'), { status: 404 });
  }

  if (nota.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para editar esta nota'),
      { status: 403 }
    );
  }

  if (nota.id_lider !== user.id_usuario) {
    throw Object.assign(
      new Error('Solo puedes editar tus propias notas'),
      { status: 403 }
    );
  }

  return await notaRepository.update(id, data.descripcion);
};

const desactivarNota = async (id, user, empresaId) => {
  const nota = await notaRepository.findByIdFull(id);

  if (!nota) {
    throw Object.assign(new Error('Nota no encontrada'), { status: 404 });
  }

  if (nota.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para eliminar esta nota'),
      { status: 403 }
    );
  }

  if (nota.id_lider !== user.id_usuario) {
    throw Object.assign(
      new Error('Solo puedes eliminar tus propias notas'),
      { status: 403 }
    );
  }

  if (!nota.is_active) {
    throw Object.assign(
      new Error('La nota ya está desactivada'),
      { status: 400 }
    );
  }

  return await notaRepository.desactivar(id);
};

module.exports = {
  getNotasByProyecto,
  createNota,
  getNotaById,
  updateNota,
  desactivarNota,
};
