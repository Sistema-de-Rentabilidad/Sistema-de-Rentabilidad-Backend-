const bcrypt = require("bcrypt");
const usuarioRepository = require("./usuario.repository");
const historialRepository = require('../historial_sueldo/historial.repository');
const historialService = require('../historial_sueldo/historial.service');

const getUsuarios = async (user) => {
  // admin ve todo
  if (user.rol === 'admin') {
    return await usuarioRepository.findOnlypropietario(user.id_usuario);
  }
  // propietario solo su empresa
  if (user.rol === "propietario") {
    return await usuarioRepository.findByEmpresa(user.id_empresa, user.id_usuario);
  }

  const error = new Error("No tienes permisos para ver usuarios");
  error.status = 403;
  throw error;
};

const createUsuario = async (data, currentUser) => {
  const { nombre, email, password, rol, monto, tipo_pago, horas_mensuales, id_empresa } = data;

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
    if (rol === 'propietario') {
      throw new Error('Propietario no puede crear otro propietario');
    }

    // empresa viene del token
    empresaFinal = currentUser.id_empresa;
  }

  // reglas de sueldo
  if (rolFinal === 'empleado') {
    if (!monto || !tipo_pago) {
      throw new Error('Empleado requiere monto y tipo de pago');
    }

    if (tipo_pago === 'mensual' && (!horas_mensuales || horas_mensuales <= 0)) {
      throw new Error('Empleado mensual requiere horas mensuales');
    }
  } else {
    if (monto || tipo_pago || horas_mensuales) {
      throw new Error('Solo empleados pueden tener información salarial');
    }
  }

  // encriptar contraseña
  const hashedPassword = await bcrypt.hash(password, 10);

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
  if (data.email) {
    const existente =
      await usuarioRepository.findByEmail(data.email);

    if (existente && existente.id_usuario !== usuario.id_usuario) {
      const error = new Error('El email ya está registrado');
      error.status = 400;
      throw error;
    }
  }

  const nuevoIdEmpresa = data.id_empresa ? parseInt(data.id_empresa, 10) : null;

  if (currentUser.rol === 'admin' && nuevoIdEmpresa && usuario.rol === 'propietario') {

    if (nuevoIdEmpresa !== usuario.id_empresa) {
      const propietarioActual = await usuarioRepository.findPropietarioByEmpresa(nuevoIdEmpresa);

      if (propietarioActual && propietarioActual.id_usuario !== usuario.id_usuario) {
        const error = new Error('La empresa ya tiene un propietario');
        error.status = 400;
        throw error;
      }
    }
  } else if (nuevoIdEmpresa && nuevoIdEmpresa !== usuario.id_empresa) {
    throw Object.assign(
      new Error('No tienes permisos para cambiar la empresa del usuario'),
      { status: 403 }
    );
  }

  // hash password
  if (data.password) {
    data.password = await bcrypt.hash(data.password, 10);
  }

  // update usuario
  await usuarioRepository.update(id, {
    nombre: data.nombre,
    email: data.email,
    password: data.password,
    id_empresa: currentUser.rol === 'admin' && usuario.rol === 'propietario' ? nuevoIdEmpresa : undefined
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
    const error = new Error('No puedes desactivar tu propio usuario');
    error.status = 400;
    throw error;
  }

  if (currentUser.rol === 'admin') {
    if (usuario.rol !== 'propietario') {
      const error = new Error('No tienes permisos para desactivar a este usuario');
      error.status = 403;
      throw error;
    }
  }

  if (currentUser.rol === 'propietario') {
    const esDeSuEmpresa = usuario.id_empresa === currentUser.id_empresa;
    const esRolEditable = ['empleado', 'lider'].includes(usuario.rol);

    if (!esDeSuEmpresa || !esRolEditable) {
      const error = new Error('No tienes permisos para desactivar a este usuario');
      error.status = 403;
      throw error;
    }
  }

  if (!usuario.is_active) {
    const error = new Error('El usuario ya esta desactivado');
    error.status = 400;
    throw error;
  }

  return await usuarioRepository.desactivar(id);
};

const revocarEmpresaPropietario = async (id, currentUser) => {
  if (currentUser.rol !== 'admin') {
    const error = new Error('No tienes permisos para revocar propietario');
    error.status = 403;
    throw error;
  }

  const usuario = await usuarioRepository.findByIdFull(id);

  if (!usuario) {
    const error = new Error('Usuario no encontrado');
    error.status = 404;
    throw error;
  }

  if (usuario.rol !== 'propietario') {
    const error = new Error('Solo se puede revocar la empresa de un propietario');
    error.status = 400;
    throw error;
  }

  if (!usuario.is_active) {
    const error = new Error('El propietario está inactivo');
    error.status = 400;
    throw error;
  }

  if (!usuario.id_empresa) {
    const error = new Error('El propietario no tiene empresa asignada');
    error.status = 400;
    throw error;
  }

  return await usuarioRepository.revocarEmpresa(id);
};

module.exports = {
  getUsuarios,
  createUsuario,
  getUsuarioById,
  updateUsuario,
  desactivarUsuario,
  revocarEmpresaPropietario
};
