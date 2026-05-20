const marcajeRepository = require('./marcaje.repository');
const { getFechaActual } = require('../../utils/dateTime');
const usuarioRepository = require('../usuario/usuario.repository');

const getMarcajes = async ({ user }) => {
  return await marcajeRepository.findByUsuario(user.id_usuario);
};

const marcarEntrada = async ({ user }) => {
  const fecha = getFechaActual();
  const result = await marcajeRepository.registrarEntrada({
    id_usuario: user.id_usuario,
    fecha
  });

  if (result.error === 'ENTRADA_DUPLICADA') {
    const error = new Error('Ya registraste tu entrada del dia');
    error.status = 400;
    throw error;
  }

  return result.marcaje;
};

const marcarSalida = async ({ user }) => {
  const fecha = getFechaActual();
  const result = await marcajeRepository.registrarSalida({
    id_usuario: user.id_usuario,
    fecha
  });

  if (result.error === 'ENTRADA_NO_REGISTRADA') {
    const error = new Error('Debes registrar tu entrada antes de marcar salida');
    error.status = 400;
    throw error;
  }

  if (result.error === 'SALIDA_DUPLICADA') {
    const error = new Error('Ya registraste tu salida del dia');
    error.status = 400;
    throw error;
  }

  if (result.error === 'HORAS_EXCEDEN_MARCAJE' && user.rol !== 'lider') {
    const error = new Error('Las horas registradas exceden el tiempo trabajado del dia');
    error.status = 400;
    throw error;
  }

  const response = {
    ...result.marcaje
  };

  // SOLO empleados reciben estos campos
  if (user.rol !== 'lider') {
    response.total_horas_registradas = result.total_horas;
    response.horas_trabajadas = result.horas_trabajadas;
  }

  return response;
};

module.exports = {
  getMarcajes,
  marcarEntrada,
  marcarSalida
};
