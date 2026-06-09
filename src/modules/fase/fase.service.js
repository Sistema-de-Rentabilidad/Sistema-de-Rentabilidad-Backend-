const faseRepository = require('./fase.repository');
const verifyProyectoAccess = require('../../utils/verifyProyectoAccess')
const proyectoEmpleadoRepository = require('../proyecto_empleado/proyecto_empleado.repository');
const proyectoRepository = require('../proyecto/proyecto.repository');

const faseDuplicadaError = () => Object.assign(
  new Error('Ya existe una fase con ese nombre en este proyecto'),
  { status: 400 }
);

const isFaseDuplicadaDbError = (error) => (
  error.code === '23505' &&
  error.constraint === 'unique_fase_proyecto_nombre_activo'
);

const getFasesByProyecto = async (proyectoId, empresaId, user) => {
  await verifyProyectoAccess(proyectoId, empresaId);

  if (user?.rol === 'empleado') {
    const asignado = await proyectoEmpleadoRepository.exists(user.id_usuario, proyectoId);

    if (!asignado) {
      throw Object.assign(
        new Error('No tienes permisos para acceder a las fases de este proyecto'),
        { status: 403 }
      );
    }
  }

  return await faseRepository.findByProyecto(proyectoId);
};

const createFase = async (proyectoId, data, empresaId) => {
  const proyecto = await verifyProyectoAccess(proyectoId, empresaId);

  if (proyecto.fecha_fin_real) {
    throw Object.assign(
      new Error('No se pueden crear fases en un proyecto finalizado'),
      { status: 400 }
    );
  }

  const duplicado = await faseRepository.findByNombreAndProyecto(data.nombre, proyectoId);

  if (duplicado) {
    throw faseDuplicadaError();
  }

  try {
    return await faseRepository.create({
      id_proyecto: proyectoId,
      nombre: data.nombre,
      horas_estimadas: data.horas_estimadas,
    });
  } catch (error) {
    if (isFaseDuplicadaDbError(error)) {
      throw faseDuplicadaError();
    }

    throw error;
  }
};

const getFaseById = async (id, empresaId) => {
  const fase = await faseRepository.findById(id);

  if (!fase) {
    throw Object.assign(new Error('Fase no encontrada'), { status: 404 });
  }

  if (fase.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para acceder a esta fase'),
      { status: 403 }
    );
  }
  return fase;
};

const updateFase = async (id, data, empresaId) => {
  const fase = await faseRepository.findById(id);

  if (!fase) {
    throw Object.assign(new Error('Fase no encontrada'), { status: 404 });
  }

  const proyecto = await proyectoRepository.findBasicById(fase.id_proyecto);

  if (proyecto && proyecto.fecha_fin_real) {
    throw Object.assign(
      new Error('No se pueden editar fases en un proyecto finalizado'),
      { status: 400 }
    );
  }

  if (fase.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para editar esta fase'),
      { status: 403 }
    );
  }

  if (data.nombre !== undefined) {
    const duplicado = await faseRepository.findByNombreAndProyecto(data.nombre, fase.id_proyecto);

    if (duplicado && duplicado.id_fase !== parseInt(id)) {
      throw faseDuplicadaError();
    }
  }

  try {
    return await faseRepository.update(id, data);
  } catch (error) {
    if (isFaseDuplicadaDbError(error)) {
      throw faseDuplicadaError();
    }

    throw error;
  }
};

const desactivarFase = async (id, empresaId) => {
  const fase = await faseRepository.findByIdFull(id);

  if (!fase) {
    throw Object.assign(new Error('Fase no encontrada'), { status: 404 });
  }

  const proyecto = await proyectoRepository.findBasicById(fase.id_proyecto);

  if (proyecto && proyecto.fecha_fin_real) {
    throw Object.assign(
      new Error('No se pueden eliminar fases en un proyecto finalizado'),
      { status: 400 }
    );
  }

  await verifyProyectoAccess(fase.id_proyecto, empresaId);

  if (!fase.is_active) {
    throw Object.assign(
      new Error('La fase ya fue eliminada'),
      { status: 400 }
    );
  }

  return await faseRepository.desactivar(id);
};

module.exports = {
  getFasesByProyecto,
  createFase,
  getFaseById,
  updateFase,
  desactivarFase,
};

