const proyectoRepository = require('./proyecto.repository');
const servicioRepository = require('../servicio/servicio.repository');
const usuarioRepository = require('../usuario/usuario.repository');
const pool = require('../../config/db');

const getProyectos = async (empresaId) => {
  return await proyectoRepository.findAll(empresaId);
};

const getProyectosLider = async ({ empresaId, liderId }) => {
  if (!empresaId || !liderId) {
    throw Object.assign(
      new Error('Empresa y líder son requeridos'),
      { status: 400 }
    );
  }

  return await proyectoRepository.findAllByLider({ empresaId, liderId });
};

const getProyectosEmpleado = async ({ empresaId, empleadoId }) => {
  if (!empresaId || !empleadoId) {
    throw Object.assign(
      new Error('Empresa y empleado son requeridos'),
      { status: 400 }
    );
  }

  return await proyectoRepository.findAllByEmpleado({ empresaId, empleadoId });
};

const createProyecto = async (empresaId, data) => {
  const { nombre, descripcion, presupuesto, margen, fecha_inicio, fecha_fin_estimada, id_servicio, id_lider, empleados = [] } = data;

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
  const servicio = await servicioRepository.findById(id_servicio);
  if (!servicio || servicio.id_empresa !== empresaId) {
    throw Object.assign(new Error('Servicio no válido'), { status: 400 });
  }

  // Validar líder pertenece a empresa
  const lider = await usuarioRepository.findById(id_lider);
  if (!lider || lider.id_empresa !== empresaId || lider.rol !== 'lider') {
    throw Object.assign(new Error('Líder no válido'), { status: 400 });
  }

  // Validar empleados
  if (empleados.length > 0) {
    const unique = new Set(empleados);
    if (unique.size !== empleados.length) {
      throw Object.assign(new Error('Empleados duplicados'), { status: 400 });
    }

    const empleadosDB = await usuarioRepository.findByIds(empleados);

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
    margen,
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
    const err = new Error('Proyecto no encontrado');
    err.status = 404;
    throw err;
  }

  if (proyecto.id_empresa !== empresaId) {
    const err = new Error('No tienes permisos para acceder a este proyecto');
    err.status = 403;
    throw err;
  }

  return proyecto;
};

const updateProyecto = async (proyectoId, empresaId, data) => {
  const proyecto = await proyectoRepository.findById(proyectoId);

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
    const servicio = await servicioRepository.findById(id_servicio);
    if (!servicio || servicio.id_empresa !== empresaId) {
      throw Object.assign(new Error('Servicio no válido'), { status: 400 });
    }
  }

  // validar líder
  if (id_lider) {
    const lider = await usuarioRepository.findById(id_lider);

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

    const empleadosDB = await usuarioRepository.findByIds(empleados);

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
  const proyecto = await proyectoRepository.findBasicById(proyectoId);

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
      new Error('El proyecto ya está eliminado'),
      { status: 400 }
    );
  }

  return await proyectoRepository.desactivar(proyectoId);
};

const finalizarProyecto = async ({ proyectoId, empresaId, liderId }) => {
  // validar existencia
  const proyecto = await proyectoRepository.findById(proyectoId);

  if (!proyecto) {
    throw Object.assign(
      new Error('Proyecto no encontrado'),
      { status: 404 }
    );
  }

  // validar empresa
  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error('No pertenece a tu empresa'),
      { status: 403 }
    );
  }

  // validar líder responsable
  if (proyecto.id_lider !== liderId) {
    throw Object.assign(
      new Error('No eres líder de este proyecto'),
      { status: 403 }
    );
  }

  // evitar doble finalización
  if (proyecto.fecha_fin_real) {
    throw Object.assign(
      new Error('El proyecto ya fue finalizado'),
      { status: 400 }
    );
  }

  return await proyectoRepository.finalizar(proyectoId);
};

const getHorasResumenByProyecto = async (proyectoId, empresaId) => {
  const { rows } = await pool.query(
    'SELECT id_proyecto, id_empresa FROM proyecto WHERE id_proyecto = $1',
    [proyectoId]
  );
  if (!rows[0]) { const e = new Error('Proyecto no encontrado'); e.status = 404; throw e; }
  if (rows[0].id_empresa !== empresaId) { const e = new Error('No autorizado'); e.status = 403; throw e; }
  return await proyectoRepository.findHorasResumenByProyecto(proyectoId);
};

module.exports = {
  getProyectos,
  getProyectosLider,
  getProyectosEmpleado,
  createProyecto,
  getProyectoById,
  updateProyecto,
  desactivarProyecto,
  finalizarProyecto,
  getHorasResumenByProyecto,
};
