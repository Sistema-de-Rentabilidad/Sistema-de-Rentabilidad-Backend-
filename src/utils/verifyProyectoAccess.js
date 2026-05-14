const verifyProyectoAccess = async ({
  proyectoId,
  empresaId,
  repository,
}) => {
  const proyecto = await repository.findProyectoById(proyectoId);

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