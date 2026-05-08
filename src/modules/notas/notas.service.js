const notasRepository = require("./notas.repository");

const verifyProyectoAccess = async (proyectoId, empresaId) => {
  const proyecto = await notasRepository.findProyectoById(proyectoId);
  if (!proyecto) {
    throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
  }
  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error("No tienes permisos para acceder a este proyecto"),
      { status: 403 }
    );
  }
  return proyecto;
};

const getNotasByProyecto = async (proyectoId, user) => {
  await verifyProyectoAccess(proyectoId, user.id_empresa);
  return await notasRepository.findNotasByProyecto(proyectoId);
};

const createNota = async (proyectoId, data, user) => {
  const proyecto = await verifyProyectoAccess(proyectoId, user.id_empresa);

  if (proyecto.id_lider !== user.id_usuario) {
    throw Object.assign(
      new Error("Solo el líder asignado a este proyecto puede registrar notas"),
      { status: 403 }
    );
  }

  return await notasRepository.insertNota({
    id_proyecto: proyectoId,
    id_lider: user.id_usuario,
    descripcion: data.descripcion,
  });
};

const updateNota = async (notaId, data, user) => {
  const nota = await notasRepository.findNotaById(notaId);
  if (!nota) {
    throw Object.assign(new Error("Nota no encontrada"), { status: 404 });
  }
  if (nota.id_empresa !== user.id_empresa) {
    throw Object.assign(
      new Error("No tienes permisos para editar esta nota"),
      { status: 403 }
    );
  }
  if (nota.id_lider !== user.id_usuario) {
    throw Object.assign(
      new Error("Solo puedes editar tus propias notas"),
      { status: 403 }
    );
  }
  return await notasRepository.updateNota(notaId, data.descripcion);
};

const desactivarNota = async (notaId, user) => {
  const nota = await notasRepository.findNotaById(notaId);
  if (!nota) {
    throw Object.assign(new Error("Nota no encontrada"), { status: 404 });
  }
  if (nota.id_empresa !== user.id_empresa) {
    throw Object.assign(
      new Error("No tienes permisos para eliminar esta nota"),
      { status: 403 }
    );
  }
  if (nota.id_lider !== user.id_usuario) {
    throw Object.assign(
      new Error("Solo puedes eliminar tus propias notas"),
      { status: 403 }
    );
  }
  return await notasRepository.desactivarNota(notaId);
};

module.exports = {
  getNotasByProyecto,
  createNota,
  updateNota,
  desactivarNota,
};
