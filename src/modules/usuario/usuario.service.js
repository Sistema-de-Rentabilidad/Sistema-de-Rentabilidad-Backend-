const { hashPassword } = require('../../utils/hash');
const usuarioRepository = require('./usuario.repository');
const historialRepository = require('../historial_sueldo/historial.repository');
const historialService = require('../historial_sueldo/historial.service');

const getUsuarios = async (user) => {
  // admin ve todo
  if (user.rol === 'admin') {
    return await usuarioRepository.findOnlypropietario(user.id_usuario);
  }
  // propietario solo su empresa
  if (user.rol === 'propietario') {
    return await usuarioRepository.findByEmpresa(user.id_empresa, user.id_usuario);
  }

  const error = new Error('No tienes permisos para ver usuarios');
  error.status = 403;
  throw error;
};

const createUsuario = async (data, currentUser) => {
  const { nombre, password, rol, monto, tipo_pago, horas_mensuales, id_empresa } = data;
  const email = data.email.trim().toLowerCase();

  // validar email único
  const existe = await usuarioRepository.findByEmail(email);
  if (existe) {
    const error = new Error('El email ya está registrado');
    error.status = 400;
    throw error;
  }

  let empresaFinal;

  let rolFinal;

  // rol por defecto si no viene (admin → propietario)
  if (currentUser.rol === 'admin') {
    rolFinal = 'propietario';
  } else {
    if (!rol) {
      throw new Error('Rol es obligatorio');
    }
    rolFinal = rol;
  }

  // lógica por rol
  if (currentUser.rol === 'admin') {
    // admin debe indicar empresa
    if (!id_empresa) {
      throw new Error('Admin debe especificar la empresa');
    }

    // admin SOLO crea propietario
    if (rol && rol !== 'propietario') {
      throw new Error('Admin solo puede crear usuarios propietario');
    }

    empresaFinal = id_empresa;
  }

  // validar único propietario por empresa
  if (rolFinal === 'propietario') {
    const existePropietario = await usuarioRepository.findPropietarioByEmpresa(empresaFinal);

    if (existePropietario) {
      const error = new Error('La empresa ya tiene un propietario');
      error.status = 400;
      throw error;
    }
  }

  if (currentUser.rol === 'propietario') {
    // propietario NO puede crear propietario
    if (!['empleado', 'lider'].includes(rol)) {
      throw Object.assign(
        new Error('Propietario solo puede crear empleado o lider'),
        { status: 400 }
      );
    }

    // empresa viene del token
    empresaFinal = currentUser.id_empresa;
  }

  // reglas de sueldo
  if (rolFinal === 'empleado') {
    if (!monto || !tipo_pago) {
      throw Object.assign(
        new Error('Empleado requiere monto y tipo de pago'),
        { status: 400 }
      );
    }

    if (tipo_pago === 'mensual' && (!horas_mensuales || horas_mensuales <= 0)) {
      throw Object.assign(
        new Error('Empleado mensual requiere horas mensuales'),
        { status: 400 }
      );
    }
  } else {
    if (monto || tipo_pago || horas_mensuales) {
      throw Object.assign(
        new Error('Solo empleados pueden tener información salarial'),
        { status: 400 }
      );
    }
  }

  // encriptar contraseña
  const hashedPassword = await hashPassword(password);

  // crear usuario
  const usuario = await usuarioRepository.create({
    nombre,
    email,
    password: hashedPassword,
    rol: rolFinal,
    id_empresa: empresaFinal
  });

  // historial si empleado
  if (rolFinal === 'empleado') {
    await historialService.createHistorial({
      id_usuario: usuario.id_usuario,
      tipo_pago,
      monto,
      horas_mensuales:
        tipo_pago === 'mensual'
          ? horas_mensuales
          : null
    }, empresaFinal);
  }

  return usuario;
};

const getUsuarioById = async (id, currentUser) => {
  const usuario = await usuarioRepository.findById(id);

  // validar existencia
  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  // admin puede ver todo
  if (currentUser.rol === 'admin') {
    return usuario;
  }

  // propietario solo ve usuarios de su empresa
  if (currentUser.rol === 'propietario' && currentUser.id_empresa !== usuario.id_empresa) {
    const error = new Error('No tienes permisos para acceder a este usuario');
    error.status = 403;
    throw error;
  }

  // empleado y lider solo a sí mismos
  if (['empleado', 'lider'].includes(currentUser.rol)) {
    if (currentUser.id_usuario !== usuario.id_usuario) {
      const error = new Error('No tienes permisos para acceder a este usuario');
      error.status = 403;
      throw error;
    }

    return usuario;
  }

  return usuario;
};

const updateUsuario = async (id, data, currentUser) => {
  const usuario = await usuarioRepository.findById(id);

  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  // admin solo propietarios
  if (currentUser.rol === 'admin') {
    const puedeEditar = usuario.rol === 'propietario' || currentUser.id_usuario === usuario.id_usuario;

    if (!puedeEditar) {
      throw Object.assign(
        new Error('No tienes permisos para editar a este usuario'),
        { status: 403 }
      );
    }
  }

  // propietario
  if (currentUser.rol === 'propietario') {
    const esMismoUsuario = currentUser.id_usuario === usuario.id_usuario;

    const esDeSuEmpresa = usuario.id_empresa === currentUser.id_empresa;

    const esRolEditable = ['empleado', 'lider'].includes(usuario.rol);

    if (!esMismoUsuario && (!esDeSuEmpresa || !esRolEditable)) {
      throw Object.assign(
        new Error('No tienes permisos para editar a este usuario'),
        { status: 403 }
      );
    }
  }

  // empleado/lider
  if (['empleado', 'lider'].includes(currentUser.rol)) {
    if (currentUser.id_usuario !== usuario.id_usuario) {
      throw Object.assign(
        new Error('No tienes permisos para editar a este usuario'),
        { status: 403 }
      );
    }

    // no pueden cambiar sueldo
    if (data.monto || data.tipo_pago || data.horas_mensuales) {
      throw Object.assign(
        new Error('No tienes permisos para editar sueldo'),
        { status: 403 }
      );
    }
  }

  // validar email único
  const emailNormalizado = data.email?.trim().toLowerCase();
  const quiereCambiarEmail = emailNormalizado && emailNormalizado !== usuario.email.toLowerCase();

  if (quiereCambiarEmail) {
    const esMismoUsuario = currentUser.id_usuario === usuario.id_usuario;
    const usuarioObjetivoEsEmpleadoOLider = ['empleado', 'lider'].includes(usuario.rol);

    if (esMismoUsuario && ['empleado', 'lider'].includes(currentUser.rol)) {
      throw Object.assign(
        new Error('No tienes permisos para cambiar tu correo electronico'),
        { status: 403 }
      );
    }

    if (!esMismoUsuario && usuarioObjetivoEsEmpleadoOLider && currentUser.rol !== 'propietario') {
      throw Object.assign(
        new Error('Solo un propietario puede cambiar el correo de empleados o lideres'),
        { status: 403 }
      );
    }
  }

  if (emailNormalizado) {
    data.email = emailNormalizado;
    const existente =
      await usuarioRepository.findByEmail(data.email);

    if (existente && existente.id_usuario !== usuario.id_usuario) {
      const error = new Error('El email ya está registrado');
      error.status = 400;
      throw error;
    }
  }

  // hash password
  if (data.password) {
    data.password = await hashPassword(data.password);
  }

  // update usuario
  await usuarioRepository.update(id, {
    nombre: data.nombre,
    email: data.email,
    password: data.password
  });

  const quiereActualizarSueldo = usuario.rol === 'empleado' && (data.monto || data.tipo_pago || data.horas_mensuales);

  if (quiereActualizarSueldo) {
    const sueldoActual = await historialRepository.findActivo(usuario.id_usuario);

    if (!sueldoActual) {
      throw Object.assign(
        new Error('No existe historial salarial activo'),
        { status: 400 }
      );
    }

    await historialService.createHistorial({
      id_usuario: usuario.id_usuario,
      tipo_pago: data.tipo_pago ?? sueldoActual.tipo_pago,
      monto: data.monto ?? sueldoActual.monto,
      fecha_inicio: new Date(),
      horas_mensuales: data.horas_mensuales ?? sueldoActual.horas_mensuales
    }, currentUser.id_empresa);
  }

  return await usuarioRepository.findById(id);
};

const desactivarUsuario = async (id, currentUser) => {
  const usuario = await usuarioRepository.findByIdFull(id);

  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  if (currentUser.id_usuario === usuario.id_usuario) {
    const error = new Error('No puedes eliminar tu propio usuario');
    error.status = 400;
    throw error;
  }

  if (currentUser.rol === 'admin') {
    if (usuario.rol !== 'propietario') {
      const error = new Error('No tienes permisos para eliminar a este usuario');
      error.status = 403;
      throw error;
    }
  }

  if (currentUser.rol === 'propietario') {
    const esDeSuEmpresa = usuario.id_empresa === currentUser.id_empresa;
    const esRolEditable = ['empleado', 'lider'].includes(usuario.rol);

    if (!esDeSuEmpresa || !esRolEditable) {
      const error = new Error('No tienes permisos para eliminar a este usuario');
      error.status = 403;
      throw error;
    }
  }

  if (!usuario.is_active) {
    const error = new Error('El usuario ya fue eliminado');
    error.status = 400;
    throw error;
  }

  return await usuarioRepository.desactivar(id);
};

module.exports = {
  getUsuarios,
  createUsuario,
  getUsuarioById,
  updateUsuario,
  desactivarUsuario
};
