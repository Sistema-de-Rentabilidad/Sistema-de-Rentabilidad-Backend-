const fasesRepository = require("./fases.repository");

const verifyProyectoAccess = async (proyectoId, empresaId) => {
  const proyecto = await fasesRepository.findProyectoById(proyectoId);
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

const getFasesByProyecto = async (proyectoId, orderBy, user) => {
  await verifyProyectoAccess(proyectoId, user.id_empresa);
  return await fasesRepository.findFasesByProyecto(proyectoId, orderBy);
};

const createFase = async (proyectoId, data, user) => {
  await verifyProyectoAccess(proyectoId, user.id_empresa);

  const duplicado = await fasesRepository.findFaseByNombreAndProyecto(
    data.nombre.trim(),
    proyectoId
  );
  if (duplicado) {
    throw Object.assign(
      new Error("Ya existe una fase con ese nombre en este proyecto"),
      { status: 400 }
    );
  }

  return await fasesRepository.insertFase({
    id_proyecto: proyectoId,
    nombre: data.nombre.trim(),
    horas_estimadas: data.horas_estimadas,
  });
};

const getFaseById = async (faseId, user) => {
  const fase = await fasesRepository.findFaseById(faseId);
  if (!fase) {
    throw Object.assign(new Error("Fase no encontrada"), { status: 404 });
  }
  if (fase.id_empresa !== user.id_empresa) {
    throw Object.assign(
      new Error("No tienes permisos para acceder a esta fase"),
      { status: 403 }
    );
  }
  return fase;
};

const updateFase = async (faseId, data, user) => {
  const fase = await fasesRepository.findFaseById(faseId);
  if (!fase) {
    throw Object.assign(new Error("Fase no encontrada"), { status: 404 });
  }
  if (fase.id_empresa !== user.id_empresa) {
    throw Object.assign(
      new Error("No tienes permisos para editar esta fase"),
      { status: 403 }
    );
  }

  if (data.nombre) {
    const nombreLimpio = data.nombre.trim();
    const duplicado = await fasesRepository.findFaseByNombreAndProyecto(
      nombreLimpio,
      fase.id_proyecto
    );
    if (duplicado && duplicado.id_fase !== faseId) {
      throw Object.assign(
        new Error("Ya existe una fase con ese nombre en este proyecto"),
        { status: 400 }
      );
    }
    data.nombre = nombreLimpio;
  }

  return await fasesRepository.updateFase(faseId, data);
};

module.exports = {
  getFasesByProyecto,
  createFase,
  getFaseById,
  updateFase,
};
