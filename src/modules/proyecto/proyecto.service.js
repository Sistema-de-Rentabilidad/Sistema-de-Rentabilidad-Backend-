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
  const empleados = await proyectoRepository.findEmpleadosByProyecto(proyectoId);
  const lideres   = await proyectoRepository.findLideresByProyecto(proyectoId);
  return { ...proyecto, empleados, lideres };
};

const createProyecto = async (empresaId, data) => {
  if (!data.nombre || data.nombre.trim().length < 3) {
    const err = new Error("El nombre del proyecto debe tener al menos 3 caracteres");
    err.status = 422;
    throw err;
  }

  const { empleados_ids, lider_ids, id_lider: legacyLider, ...proyectoData } = data;
  const primaryLider  = lider_ids?.length > 0 ? lider_ids[0] : (legacyLider || null);
  const lidersToSync  = lider_ids?.length > 0 ? lider_ids : (primaryLider ? [primaryLider] : []);

  const nuevo = await proyectoRepository.create({
    ...proyectoData,
    id_empresa: empresaId,
    id_lider:   primaryLider,
  });

  if (empleados_ids?.length > 0) {
    try { await proyectoRepository.syncEmpleados(nuevo.id_proyecto, empleados_ids); } catch { /* tabla puede no existir aún */ }
  }
  if (lidersToSync.length > 0) {
    try { await proyectoRepository.syncLideres(nuevo.id_proyecto, lidersToSync); } catch { /* tabla puede no existir aún */ }
  }

  return nuevo;
};

const updateProyecto = async (proyectoId, empresaId, data) => {
  const proyecto = await proyectoRepository.findById(proyectoId);
  if (!proyecto) {
    const err = new Error("Proyecto no encontrado");
    err.status = 404;
    throw err;
  }
  if (proyecto.id_empresa !== empresaId) {
    const err = new Error("No tienes permisos para modificar este proyecto");
    err.status = 403;
    throw err;
  }

  const { empleados_ids, lider_ids, id_lider: legacyLider, ...proyectoData } = data;
  const primaryLider = lider_ids?.length > 0 ? lider_ids[0] : (legacyLider || null);

  const updated = await proyectoRepository.update(proyectoId, {
    ...proyectoData,
    id_lider: primaryLider !== undefined ? primaryLider : null,
  });

  if (empleados_ids !== undefined) {
    try { await proyectoRepository.syncEmpleados(proyectoId, empleados_ids); } catch { /* tabla puede no existir aún */ }
  }
  if (lider_ids !== undefined) {
    const lidersToSync = lider_ids.length > 0 ? lider_ids : (primaryLider ? [primaryLider] : []);
    try { await proyectoRepository.syncLideres(proyectoId, lidersToSync); } catch { /* tabla puede no existir aún */ }
  }

  return updated;
};

const desactivarProyecto = async (proyectoId, empresaId) => {
  const proyecto = await proyectoRepository.findById(proyectoId);
  if (!proyecto) {
    const err = new Error("Proyecto no encontrado");
    err.status = 404;
    throw err;
  }
  if (proyecto.id_empresa !== empresaId) {
    const err = new Error("No tienes permisos para desactivar este proyecto");
    err.status = 403;
    throw err;
  }
  return await proyectoRepository.deactivate(proyectoId);
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
