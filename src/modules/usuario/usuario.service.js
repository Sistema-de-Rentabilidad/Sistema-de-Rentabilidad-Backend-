const bcrypt = require("bcrypt");
const usuarioRepository = require("./usuario.repository");
const historialRepository = require('../historial_sueldo/historial.repository');

const getUsuarios = async (user) => {
  // admin ve todo
  if (user.rol === 'admin') {
    return await usuarioRepository.findOnlypropietario(user.id_usuario);
  }
  // propietario solo su empresa
  if (user.rol === "propietario") {
    return await usuarioRepository.findByEmpresa(user.id_empresa, user.id_usuario);
  }

  const error = new Error("No autorizado");
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
      throw new Error('propietario no puede crear otro propietario');
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
    await historialRepository.create({
      id_usuario: usuario.id_usuario,
      tipo_pago,
      monto,
      fecha_inicio: new Date(),
      horas_mensuales:
        tipo_pago === 'mensual'
          ? horas_mensuales
          : null
    });
  }

  return usuario;
};

const updateUsuario = async (id, data, currentUser) => {
  const target = await usuarioRepository.findById(id);
  if (!target) {
    const error = new Error("Usuario no encontrado");
    error.status = 404;
    throw error;
  }

  // Un usuario puede actualizar su propio perfil (solo nombre, email, password)
  if (currentUser.id_usuario === id) {
    // self-update allowed for any role
  } else if (currentUser.rol === "admin") {
    if (target.rol !== "propietario") {
      const error = new Error("El admin solo puede editar propietarios");
      error.status = 403;
      throw error;
    }
  } else if (currentUser.rol === "propietario") {
    if (target.id_empresa !== currentUser.id_empresa) {
      const error = new Error("No autorizado");
      error.status = 403;
      throw error;
    }
    if (target.rol === "propietario") {
      const error = new Error("No puedes editar propietarios");
      error.status = 403;
      throw error;
    }
  } else {
    const error = new Error("No autorizado");
    error.status = 403;
    throw error;
  }

  const { nombre, email, password, id_empresa, is_active, rol } = data;

  if (email && email !== target.email) {
    const existe = await usuarioRepository.findByEmail(email);
    if (existe) {
      const error = new Error("El email ya está en uso");
      error.status = 409;
      throw error;
    }
  }

  // Validar cambio de rol: propietario solo puede cambiar lider <-> empleado
  if (rol !== undefined && currentUser.rol === "propietario") {
    if (!["lider", "empleado"].includes(rol)) {
      const error = new Error("Rol inválido");
      error.status = 400;
      throw error;
    }
  }

  // Solo admin puede cambiar id_empresa e is_active de propietarios
  const updateData = {
    nombre: nombre || null,
    email: email || null,
    password: password ? await bcrypt.hash(password, 10) : null,
  };

  if (currentUser.rol === "admin") {
    if (id_empresa !== undefined) updateData.id_empresa = Number(id_empresa) || null;
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);
  }
  if (currentUser.rol === "propietario" && rol !== undefined) {
    updateData.rol = rol;
  }

  return await usuarioRepository.update(id, updateData);
};

const deleteUsuario = async (id, currentUser) => {
  const target = await usuarioRepository.findById(id);
  if (!target) {
    const error = new Error("Usuario no encontrado");
    error.status = 404;
    throw error;
  }

  if (currentUser.rol === "admin") {
    if (target.rol !== "propietario") {
      const error = new Error("El admin solo puede eliminar propietarios");
      error.status = 403;
      throw error;
    }
  } else if (currentUser.rol === "propietario") {
    if (target.id_empresa !== currentUser.id_empresa) {
      const error = new Error("No autorizado");
      error.status = 403;
      throw error;
    }
    if (target.rol === "propietario") {
      const error = new Error("No puedes eliminar propietarios");
      error.status = 403;
      throw error;
    }
  } else {
    const error = new Error("No autorizado");
    error.status = 403;
    throw error;
  }

  return await usuarioRepository.deactivate(id);
};

module.exports = {
  getUsuarios,
  createUsuario,
  updateUsuario,
  deleteUsuario
};
