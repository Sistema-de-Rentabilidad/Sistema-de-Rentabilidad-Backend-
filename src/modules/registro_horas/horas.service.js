const registroHorasRepository = require("./horas.repository");
const proyectoRepository = require("../proyecto/proyecto.repository");
const proyectoEmpleadoRepository = require("../proyecto_empleado/proyecto_empleado.repository")
const faseRepository = require("../fase/fase.repository");
const faseEmpleadoRepository = require("../fase_empleado/fase_empleado.repository")

const getHorasByLider = async (liderId) => {
  return await horasRepository.findByLider(liderId);
};

const getRegistrosHoras = async ({ user, empresaId }) => {
  return await registroHorasRepository.findByEmpleado(user.id_usuario, empresaId);
};

const createRegistroHoras = async ({ id_proyecto, id_fase, horas, descripcion, user, empresaId }) => {
  const fecha = new Date().toISOString().split('T')[0]; // FECHA AUTOMÁTICA

  const proyecto = await proyectoRepository.findById(id_proyecto);

  if (!proyecto) {
    throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
  }

  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error("No tienes permisos para acceder a esta proyecto"),
      { status: 403 }
    );
  }

  // PROYECTO FINALIZADO
  if (proyecto.fecha_fin_real) {
    const error = new Error('No se pueden registrar horas en un proyecto finalizado');
    error.status = 400;
    throw error;
  }

  // VALIDAR ASIGNACION EMPLEADO
  const perteneceProyecto = await proyectoEmpleadoRepository.exists(user.id_usuario, id_proyecto);

  if (!perteneceProyecto) {
    const error = new Error('No estás asignado a este proyecto');
    error.status = 403;
    throw error;
  }

  const fase = await faseRepository.findById(id_fase);

  if (!fase) {
    throw Object.assign(new Error("Fase no encontrada"), { status: 404 });
  }

  if (fase.id_empresa !== empresaId) {
    throw Object.assign(
      new Error("No tienes permisos para acceder a esta fase"),
      { status: 403 }
    );
  }

  const fases = await faseRepository.findByProyecto(id_proyecto);

  const faseValida = fases.some(fase => fase.id_fase === id_fase);

  if (!faseValida) {
    const error = new Error('La fase no pertenece al proyecto');
    error.status = 400;
    throw error;
  }

  // VALIDAR LIMITE DIARIO
  const horasActuales = await registroHorasRepository.getTotalHorasByEmpleadoYFecha(user.id_usuario, fecha);

  const total = Number(horasActuales) + Number(horas);

  if (total > 12) {
    const error = new Error('No puedes registrar más de 12 horas diarias');
    error.status = 400;
    throw error;
  }

  // CREAR FASE_EMPLEADO
  const existeFaseEmpleado = await faseEmpleadoRepository.exists(user.id_usuario, id_fase);

  if (!existeFaseEmpleado) {
    await faseEmpleadoRepository.create(user.id_usuario, id_fase);
  }

  // CREAR REGISTRO
  return await registroHorasRepository.create({
    id_empleado: user.id_usuario,
    id_proyecto,
    id_fase,
    fecha,
    horas,
    descripcion
  });
};

const getRegistroHorasById = async ({ id, user }) => {
  const registro = await registroHorasRepository.findById(id);

  if (!registro) {
    const error = new Error('Registro de horas no encontrado');
    error.status = 404;
    throw error;
  }

  // VALIDAR PROPIETARIO
  if (registro.id_empleado !== user.id_usuario) {
    const error = new Error('No tienes acceso a este registro');
    error.status = 403;
    throw error;
  }

  return registro;
};

const updateRegistroHoras = async ({ id, id_proyecto, id_fase, horas, descripcion, user, empresaId }) => {
  const registro = await registroHorasRepository.findById(id);

  if (!registro) {
    const error = new Error('Registro de horas no encontrado');
    error.status = 404;
    throw error;
  }

  // VALIDAR PROPIETARIO
  if (registro.id_empleado !== user.id_usuario) {
    const error = new Error('No puedes editar este registro');
    error.status = 403;
    throw error;
  }

  // SOLO EL MISMO DÍA
  const hoy = new Date().toISOString().split('T')[0];

  const fechaRegistro = new Date(registro.fecha).toISOString().split('T')[0];

  if (fechaRegistro !== hoy) {
    const error = new Error('Solo puedes editar registros del mismo día');
    error.status = 400;
    throw error;
  }

  // VALIDAR PROYECTO
  const proyecto = await proyectoRepository.findById(id_proyecto);

  if (!proyecto) {
    throw Object.assign(new Error("Proyecto no encontrado"), { status: 404 });
  }

  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error("No tienes permisos para escoger este proyecto"),
      { status: 403 }
    );
  }

  // PROYECTO FINALIZADO
  if (proyecto.fecha_fin_real) {
    const error = new Error('No puedes registrar horas en un proyecto finalizado');
    error.status = 400;
    throw error;
  }

  // VALIDAR ASIGNACION EMPLEADO
  const perteneceProyecto = await proyectoEmpleadoRepository.exists(user.id_usuario, id_proyecto);

  if (!perteneceProyecto) {
    const error = new Error('No estás asignado a este proyecto');
    error.status = 403;
    throw error;
  }

  // VALIDAR FASE
  const fase = await faseRepository.findById(id_fase);

  if (!fase) {
    throw Object.assign(new Error("Fase no encontrada"), { status: 404 });
  }

  if (fase.id_empresa !== empresaId) {
    throw Object.assign(
      new Error("No tienes permisos para escoger esta fase"),
      { status: 403 }
    );
  }

  const fases = await faseRepository.findByProyecto(id_proyecto);

  const faseValida = fases.some(fase => fase.id_fase === id_fase);

  if (!faseValida) {
    const error = new Error('La fase no pertenece al proyecto');
    error.status = 400;
    throw error;
  }

  // VALIDAR LIMITE DIARIO
  const horasActuales = await registroHorasRepository.getTotalHorasSinRegistro(user.id_usuario, registro.fecha, id);

  const total = Number(horasActuales) + Number(horas);

  if (total > 12) {
    const error = new Error('No puedes registrar más de 12 horas diarias');
    error.status = 400;
    throw error;
  }

  return await registroHorasRepository.update({ id, horas, descripcion });
};

module.exports = {
  getHorasByLider,
  getRegistrosHoras,
  createRegistroHoras,
  getRegistroHorasById,
  updateRegistroHoras
};
