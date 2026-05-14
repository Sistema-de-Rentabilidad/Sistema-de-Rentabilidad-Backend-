const proyectoRepository = require("../modules/proyecto/proyecto.repository");

const verifyProyectoAccess = async (proyectoId, empresaId) => {
  const proyecto = await proyectoRepository.findBasicById(proyectoId);

  if (!proyecto) {
    throw Object.assign(
      new Error("Proyecto no encontrado"),
      { status: 404 }
    );
  }

  if (proyecto.id_empresa !== empresaId) {
    throw Object.assign(
      new Error("No tienes acceso a este proyecto"),
      { status: 403 }
    );
  }

  return proyecto;
};

module.exports = verifyProyectoAccess;