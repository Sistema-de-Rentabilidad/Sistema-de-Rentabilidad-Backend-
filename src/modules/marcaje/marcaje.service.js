const marcajeRepository = require('./marcaje.repository');
const { getFechaActual } = require('../../utils/dateTime');

const BUSINESS_TIME_ZONE = 'America/Lima';

const parseHoraMinutos = (hora) => {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
};

const getHoraActualEnMinutos = (fechaHora = new Date(), timeZone = BUSINESS_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    hourCycle: 'h23'
  }).formatToParts(fechaHora);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return Number(values.hour) * 60 + Number(values.minute);
};

const validarHorarioEntrada = ({ fechaHora = new Date() } = {}) => {
};

const getMarcajes = async ({ user }) => {
  return await marcajeRepository.findByUsuario(user.id_usuario);
};

const marcarEntrada = async ({ user, enforceHorario = false, fechaHora = new Date() }) => {
  if (enforceHorario) {
    validarHorarioEntrada({ fechaHora });
  }

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
    fecha,
    validarRegistroHoras: user.rol !== 'lider'
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

  if (result.error === 'REGISTRO_HORAS_NO_REGISTRADO') {
    const error = new Error('Debes registrar horas del dia antes de marcar salida');
    error.status = 400;
    throw error;
  }

  if (result.error === 'HORA_SALIDA_INVALIDA') {
    const error = new Error('La hora de salida debe ser posterior a la hora de entrada');
    error.status = 400;
    error.code = 'HORA_SALIDA_INVALIDA';
    throw error;
  }

  const response = {
    ...result.marcaje
  };

  response.total_horas_registradas = result.resumenHoras?.total;
  response.horas_trabajadas = result.resumenHoras?.trabajadas;

  return response;
};

module.exports = {
  getMarcajes,
  marcarEntrada,
  marcarSalida,
  validarHorarioEntrada
};
