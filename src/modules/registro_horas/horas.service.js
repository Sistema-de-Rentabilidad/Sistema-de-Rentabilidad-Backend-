const registroHorasRepository = require('./horas.repository');
const proyectoRepository = require('../proyecto/proyecto.repository');
const proyectoEmpleadoRepository = require('../proyecto_empleado/proyecto_empleado.repository')
const faseRepository = require('../fase/fase.repository');
const faseEmpleadoRepository = require('../fase_empleado/fase_empleado.repository')
const { getFechaActual, toFechaString } = require('../../utils/dateTime');

const getHorasByLider = async (liderId) => {
  return await registroHorasRepository.findByLider(liderId);
};

const getRegistrosHoras = async ({ user, empresaId }) => {
  return await registroHorasRepository.findByEmpleado(user.id_usuario, empresaId);
};

const requiereMarcajeParaRegistrarHoras = (tipoPago) => {
  // Los usuarios por hora no usan el modulo de marcaje; cualquier otro tipo de pago requiere entrada diaria.
  return tipoPago !== 'por_hora';
};

const crearErrorMarcajeRequerido = () => {
  const error = new Error('Debes registrar tu entrada antes de registrar horas');
  error.status = 400;
  error.code = 'MARCAJE_REQUERIDO';
  return error;
};

const REGISTRO_HORAS_DUPLICADO_CONSTRAINTS = new Set([
  'unique_registro',
  'registro_horas_id_empleado_id_fase_fecha_key'
]);

const isRegistroHorasDuplicadoDbError = (error) => (
  error.code === '23505' &&
  REGISTRO_HORAS_DUPLICADO_CONSTRAINTS.has(error.constraint)
);

const validarHorasContraMarcaje = async ({ idEmpleado, fecha, horasARegistrar, tipoPago, idRegistroExcluir = null }) => {

  const horasActuales = idRegistroExcluir
    ? await registroHorasRepository.getTotalHorasSinRegistro(idEmpleado, fecha, idRegistroExcluir)
    : await registroHorasRepository.getTotalHorasByEmpleadoYFecha(idEmpleado, fecha);

  const total = Number(horasActuales) + Number(horasARegistrar);

  // APLICA PARA TODOS
  if (total > 12) {
    const error = new Error('No puedes registrar más de 12 horas diarias');
    error.status = 400;
    throw error;
  }

  if (!requiereMarcajeParaRegistrarHoras(tipoPago)) {
    return;
  }

  const horasTrabajadas = await registroHorasRepository.getHorasTrabajadasByEmpleadoYFecha(idEmpleado, fecha);

  if (horasTrabajadas === null) {
    throw crearErrorMarcajeRequerido();
  }
};

const createRegistroHoras = async ({ id_proyecto, id_fase, horas, descripcion, user, empresaId }) => {
  const fecha = getFechaActual(); // FECHA AUTOMÁTICA EN HORA DE PERÚ

  const proyecto = await proyectoRepository.findById(id_proyecto);

  if (!proyecto) {
    throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
  }

  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para acceder a esta proyecto'),
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
    throw Object.assign(new Error('Fase no encontrada'), { status: 404 });
  }

  if (fase.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para acceder a esta fase'),
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

  // VALIDAR LIMITE DIARIO Y TIEMPO TRABAJADO SEGUN MARCAJE
  await validarHorasContraMarcaje({
    idEmpleado: user.id_usuario,
    fecha,
    horasARegistrar: horas,
    tipoPago: user.tipo_pago
  });

  // CREAR FASE_EMPLEADO
  const existeFaseEmpleado = await faseEmpleadoRepository.exists(user.id_usuario, id_fase);

  if (!existeFaseEmpleado) {
    await faseEmpleadoRepository.create(user.id_usuario, id_fase);
  }

  // CREAR REGISTRO
  try {
    return await registroHorasRepository.create({
      id_empleado: user.id_usuario,
      id_proyecto,
      id_fase,
      fecha,
      horas,
      descripcion
    });
  } catch (error) {
    if (isRegistroHorasDuplicadoDbError(error)) {
      const customError = new Error(
        'Ya registraste horas para esta fase en esta fecha'
      );

      customError.status = 400;

      throw customError;
    }

    throw error;
  }
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
  const hoy = getFechaActual();

  const fechaRegistro = toFechaString(registro.fecha);

  if (fechaRegistro !== hoy) {
    const error = new Error('Solo puedes editar registros del mismo día');
    error.status = 400;
    throw error;
  }

  const proyectoId = id_proyecto ?? registro.id_proyecto;
  const faseId = id_fase ?? registro.id_fase;
  const horasRegistro = horas ?? registro.horas;
  const descripcionRegistro = descripcion ?? registro.descripcion;

  // VALIDAR PROYECTO
  const proyecto = await proyectoRepository.findById(proyectoId);

  if (!proyecto) {
    throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
  }

  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para escoger este proyecto'),
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
  const perteneceProyecto = await proyectoEmpleadoRepository.exists(user.id_usuario, proyectoId);

  if (!perteneceProyecto) {
    const error = new Error('No estás asignado a este proyecto');
    error.status = 403;
    throw error;
  }

  // VALIDAR FASE
  const fase = await faseRepository.findById(faseId);

  if (!fase) {
    throw Object.assign(new Error('Fase no encontrada'), { status: 404 });
  }

  if (fase.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para escoger esta fase'),
      { status: 403 }
    );
  }

  const fases = await faseRepository.findByProyecto(proyectoId);

  const faseValida = fases.some(fase => fase.id_fase === faseId);

  if (!faseValida) {
    const error = new Error('La fase no pertenece al proyecto');
    error.status = 400;
    throw error;
  }

  // VALIDAR LIMITE DIARIO Y TIEMPO TRABAJADO SEGUN MARCAJE
  await validarHorasContraMarcaje({
    idEmpleado: user.id_usuario,
    fecha: registro.fecha,
    horasARegistrar: horasRegistro,
    idRegistroExcluir: id,
    tipoPago: user.tipo_pago
  });

  try {
    return await registroHorasRepository.update({
      id,
      id_proyecto: proyectoId,
      id_fase: faseId,
      horas: horasRegistro,
      descripcion: descripcionRegistro
    });
  } catch (error) {
    if (isRegistroHorasDuplicadoDbError(error)) {
      const customError = new Error(
        'Ya existe un registro de horas para esta fase en esa fecha'
      );

      customError.status = 400;

      throw customError;
    }

    throw error;
  }
};

module.exports = {
  getHorasByLider,
  getRegistrosHoras,
  createRegistroHoras,
  getRegistroHorasById,
  updateRegistroHoras,
  requiereMarcajeParaRegistrarHoras
};

