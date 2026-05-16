const marcajeRepository = require("./marcaje.repository");

const getFechaActual = () => new Date().toISOString().split("T")[0];

const validarEmpleadoActivo = async (user, empresaId) => {
  const empleado = await marcajeRepository.findEmpleadoActivo(user.id_usuario);

  if (!empleado) {
    const error = new Error("Empleado no encontrado o inactivo");
    error.status = 403;
    throw error;
  }

  if (empleado.id_empresa !== empresaId) {
    const error = new Error("No tienes permisos para registrar marcajes en esta empresa");
    error.status = 403;
    throw error;
  }

  return empleado;
};

const marcarEntrada = async ({ user, empresaId }) => {
  await validarEmpleadoActivo(user, empresaId);

  const fecha = getFechaActual();
  const result = await marcajeRepository.registrarEntrada({
    id_empleado: user.id_usuario,
    fecha
  });

  if (result.error === "ENTRADA_DUPLICADA") {
    const error = new Error("Ya registraste tu entrada del dia");
    error.status = 400;
    throw error;
  }

  return result.marcaje;
};

const marcarSalida = async ({ user, empresaId }) => {
  await validarEmpleadoActivo(user, empresaId);

  const fecha = getFechaActual();
  const result = await marcajeRepository.registrarSalida({
    id_empleado: user.id_usuario,
    fecha
  });

  if (result.error === "ENTRADA_NO_REGISTRADA") {
    const error = new Error("Debes registrar tu entrada antes de marcar salida");
    error.status = 400;
    throw error;
  }

  if (result.error === "SALIDA_DUPLICADA") {
    const error = new Error("Ya registraste tu salida del dia");
    error.status = 400;
    throw error;
  }

  if (result.error === "HORAS_EXCEDEN_MARCAJE") {
    const error = new Error("Las horas registradas exceden el tiempo trabajado del dia");
    error.status = 400;
    throw error;
  }

  return {
    ...result.marcaje,
    total_horas_registradas: result.total_horas,
    horas_trabajadas: result.horas_trabajadas
  };
};

const getMarcajes = async ({ user, empresaId }) => {
  await validarEmpleadoActivo(user, empresaId);

  return await marcajeRepository.findByEmpleado(user.id_usuario);
};

module.exports = {
  marcarEntrada,
  marcarSalida,
  getMarcajes
};
