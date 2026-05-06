const proyectoRepository = require("./proyecto.repository");
const pool = require("../../config/db");

const getProyectos = async (empresaId) => {
  return await proyectoRepository.findByEmpresaId(empresaId);
};

const getMisProyectos = async (usuario) => {
  if (usuario.rol === "lider") {
    return await proyectoRepository.findByLider(usuario.id_usuario);
  }
  return await proyectoRepository.findAssignedByEmpleado(usuario.id_usuario);
};

const getProyectosDisponibles = async (usuario) => {
  if (!usuario.id_empresa) {
    const err = new Error("Usuario sin empresa asociada");
    err.status = 400;
    throw err;
  }
  if (usuario.rol === "empleado") {
    return await proyectoRepository.findAssignedByEmpleado(usuario.id_usuario);
  }
  return await proyectoRepository.findActiveByEmpresa(usuario.id_empresa);
};

const createProyecto = async (empresaId, data) => {
  const {
    nombre,
    descripcion,
    presupuesto,
    fecha_inicio,
    fecha_fin_estimada,
    id_servicio,
    id_lider,
    empleados = []
  } = data;

  const duplicado = await proyectoRepository.findByNombreAndEmpresa(
    nombre.trim(),
    empresaId
  );

  if (duplicado) {
    throw Object.assign(
      new Error('Ya existe un proyecto con ese nombre en tu empresa'),
      { status: 400 }
    );
  }

  // Validar servicio pertenece a empresa
  const servicio = await proyectoRepository.findServicioById(id_servicio);
  if (!servicio || servicio.id_empresa !== empresaId) {
    throw Object.assign(new Error('Servicio no válido'), { status: 400 });
  }

  // Validar líder pertenece a empresa
  const lider = await proyectoRepository.findUsuarioById(id_lider);
  if (!lider || lider.id_empresa !== empresaId || lider.rol !== 'lider') {
    throw Object.assign(new Error('Líder no válido'), { status: 400 });
  }

  // Validar empleados
  if (empleados.length > 0) {
    const unique = new Set(empleados);
    if (unique.size !== empleados.length) {
      throw Object.assign(new Error('Empleados duplicados'), { status: 400 });
    }

    const empleadosDB = await proyectoRepository.findUsuariosByIds(empleados);

    if (empleadosDB.length !== empleados.length) {
      throw Object.assign(new Error('Empleado no válido'), { status: 400 });
    }

    empleadosDB.forEach(e => {
      if (e.id_empresa !== empresaId || e.rol !== 'empleado') {
        throw Object.assign(new Error('Empleado no válido'), { status: 400 });
      }
    });

    // evitar que líder esté como empleado
    if (id_lider && empleados.includes(id_lider)) {
      throw Object.assign(new Error('El líder no puede ser empleado'), { status: 400 });
    }
  }

  // Crear proyecto + empleados
  return await proyectoRepository.create({
    nombre,
    descripcion,
    presupuesto,
    fecha_inicio,
    fecha_fin_estimada,
    id_servicio,
    id_lider,
    empresaId,
    empleados
  });
};

const getProyectoById = async (proyectoId, empresaId) => {
  const proyecto = await proyectoRepository.findById(proyectoId);

  if (!proyecto) {
    const err = new Error("Proyecto no encontrado");
    err.status = 404;
    throw err;
  }

  if (proyecto.id_empresa !== empresaId) {
    const err = new Error("No tienes permisos para acceder a este proyecto");
    err.status = 403;
    throw err;
  }

  return proyecto;
};

const updateProyecto = async (proyectoId, empresaId, data) => {
  const proyecto = await proyectoRepository.findBasicById(proyectoId);

  if (!proyecto) {
    throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
  }

  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para editar este proyecto'),
      { status: 403 }
    );
  }

  const {
    nombre,
    id_servicio,
    id_lider,
    empleados
  } = data;

  if (nombre) {
    const nombreLimpio = nombre.trim();

    const duplicado = await proyectoRepository.findByNombreAndEmpresa(
      nombreLimpio,
      empresaId
    );

    if (duplicado && duplicado.id_proyecto !== proyectoId) {
      throw Object.assign(
        new Error('Ya existe un proyecto con ese nombre en tu empresa'),
        { status: 400 }
      );
    }

    data.nombre = nombreLimpio;
  }

  // validar servicio
  if (id_servicio) {
    const servicio = await proyectoRepository.findServicioById(id_servicio);
    if (!servicio || servicio.id_empresa !== empresaId) {
      throw Object.assign(new Error('Servicio no válido'), { status: 400 });
    }
  }

  // validar líder
  if (id_lider) {
    const lider = await proyectoRepository.findUsuarioById(id_lider);

    if (!lider || lider.id_empresa !== empresaId || lider.rol !== 'lider') {
      throw Object.assign(new Error('Líder no válido'), { status: 400 });
    }
  }

  // validar empleados
  if (empleados) {
    const unique = new Set(empleados);
    if (unique.size !== empleados.length) {
      throw Object.assign(new Error('Empleados duplicados'), { status: 400 });
    }

    const empleadosDB = await proyectoRepository.findUsuariosByIds(empleados);

    if (empleadosDB.length !== empleados.length) {
      throw Object.assign(new Error('Empleado no válido'), { status: 400 });
    }

    empleadosDB.forEach(e => {
      if (e.id_empresa !== empresaId || e.rol !== 'empleado') {
        throw Object.assign(new Error('Empleado no válido'), { status: 400 });
      }
    });

    // evitar que líder esté como empleado
    if (id_lider && empleados.includes(id_lider)) {
      throw Object.assign(new Error('El líder no puede ser empleado'), { status: 400 });
    }
  }

  return await proyectoRepository.update(proyectoId, data);
};

const desactivarProyecto = async (proyectoId, empresaId) => {
  const proyecto = await proyectoRepository.findById(proyectoId);

  if (!proyecto) {
    throw Object.assign(new Error('Proyecto no encontrado'), { status: 404 });
  }

  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No tienes permisos para desactivar este proyecto'),
      { status: 403 }
    );
  }

  if (!proyecto.is_active) {
    throw Object.assign(
      new Error('El proyecto ya está desactivado'),
      { status: 400 }
    );
  }

  return await proyectoRepository.desactivar(proyectoId);
};

const getEmpleadosProyecto = async (proyectoId, empresaId) => {
  const proyecto = await proyectoRepository.findById(proyectoId);
  if (!proyecto) {
    const err = new Error("Proyecto no encontrado");
    err.status = 404;
    throw err;
  }
  if (proyecto.id_empresa !== empresaId) {
    const err = new Error("No autorizado");
    err.status = 403;
    throw err;
  }
  return await proyectoRepository.findEmpleadosByProyecto(proyectoId);
};

const activarProyecto = async (proyectoId, empresaId) => {
  const { rows } = await pool.query(
    "SELECT id_proyecto, id_empresa FROM proyecto WHERE id_proyecto = $1",
    [proyectoId]
  );
  if (!rows[0]) { const e = new Error("Proyecto no encontrado"); e.status = 404; throw e; }
  if (rows[0].id_empresa !== empresaId) { const e = new Error("No autorizado"); e.status = 403; throw e; }
  return await proyectoRepository.activate(proyectoId);
};

const eliminarProyecto = async (proyectoId, empresaId) => {
  const { rows } = await pool.query(
    "SELECT id_proyecto, id_empresa FROM proyecto WHERE id_proyecto = $1",
    [proyectoId]
  );
  if (!rows[0]) { const e = new Error("Proyecto no encontrado"); e.status = 404; throw e; }
  if (rows[0].id_empresa !== empresaId) { const e = new Error("No autorizado"); e.status = 403; throw e; }
  return await proyectoRepository.hardDelete(proyectoId);
};

const getHorasResumenByProyecto = async (proyectoId, empresaId) => {
  const { rows } = await pool.query(
    "SELECT id_proyecto, id_empresa FROM proyecto WHERE id_proyecto = $1",
    [proyectoId]
  );
  if (!rows[0]) { const e = new Error("Proyecto no encontrado"); e.status = 404; throw e; }
  if (rows[0].id_empresa !== empresaId) { const e = new Error("No autorizado"); e.status = 403; throw e; }
  return await proyectoRepository.findHorasResumenByProyecto(proyectoId);
};

module.exports = {
  getProyectos,
  getMisProyectos,
  getProyectosDisponibles,
  getProyectoById,
  createProyecto,
  updateProyecto,
  desactivarProyecto,
  activarProyecto,
  eliminarProyecto,
  getHorasResumenByProyecto,
  getEmpleadosProyecto,
};
