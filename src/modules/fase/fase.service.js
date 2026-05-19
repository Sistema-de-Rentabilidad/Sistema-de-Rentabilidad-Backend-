const faseRepository = require("./fase.repository");
const verifyProyectoAccess = require("../../utils/verifyProyectoAccess")
const proyectoEmpleadoRepository = require("../proyecto_empleado/proyecto_empleado.repository");

const getFasesByProyecto = async (proyectoId, empresaId, user) => {
  await verifyProyectoAccess(proyectoId, empresaId);

  if (user?.rol === "empleado") {
    const asignado = await proyectoEmpleadoRepository.exists(user.id_usuario, proyectoId);

    if (!asignado) {
      throw Object.assign(
        new Error("No tienes permisos para acceder a las fases de este proyecto"),
        { status: 403 }
      );
    }
  }

  return await faseRepository.findByProyecto(proyectoId);
};

const createFase = async (proyectoId, data, empresaId) => {
  await verifyProyectoAccess(proyectoId, empresaId);

  const nombreLimpio = data.nombre.trim();

  const duplicado = await faseRepository.findByNombreAndProyecto(
    nombreLimpio,
    proyectoId
  );

  if (duplicado) {
    throw Object.assign(
      new Error("Ya existe una fase con ese nombre en este proyecto"),
      { status: 400 }
    );
  }

  return await faseRepository.create({
    id_proyecto: proyectoId,
    nombre: nombreLimpio,
    horas_estimadas: data.horas_estimadas,
  });
};

const getFaseById = async (faseId, empresaId) => {
  const fase = await faseRepository.findById(faseId);

  if (!fase) {
    throw Object.assign(new Error("Fase no encontrada"), { status: 404 });
  }

  if (fase.id_empresa !== empresaId) {
    throw Object.assign(
      new Error("No tienes permisos para acceder a esta fase"),
      { status: 403 }
    );
  }
  return fase;
};

const updateFase = async (faseId, data, empresaId) => {
  const fase = await faseRepository.findById(faseId);

  if (!fase) {
    throw Object.assign(new Error("Fase no encontrada"), { status: 404 });
  }

  if (fase.id_empresa !== empresaId) {
    throw Object.assign(
      new Error("No tienes permisos para editar esta fase"),
      { status: 403 }
    );
  }

  if (data.nombre) {
    const nombreLimpio = data.nombre.trim();
    const duplicado = await faseRepository.findByNombreAndProyecto(
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

  return await faseRepository.update(faseId, data);
};

const desactivarFase = async (faseId, empresaId) => {
  const fase = await faseRepository.findByIdFull(faseId);

  if (!fase) {
    throw Object.assign(new Error("Fase no encontrada"), { status: 404 });
  }

  await verifyProyectoAccess(fase.id_proyecto, empresaId);

  if (!fase.is_active) {
    throw Object.assign(
      new Error("La fase ya esta desactivada"),
      { status: 400 }
    );
  }

  return await faseRepository.desactivar(faseId);
};

module.exports = {
  getFasesByProyecto,
  createFase,
  getFaseById,
  updateFase,
  desactivarFase,
};
