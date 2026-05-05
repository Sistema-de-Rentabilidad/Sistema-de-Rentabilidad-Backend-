const express = require('express');
const router = express.Router();
const proyectoController = require('./proyecto.controller');
const { createProyectoValidation } = require('./proyecto.validation');

const auth = require('../middlewares/authMiddleware');
const role = require('../middlewares/roleMiddleware');
const empresa = require('../middlewares/empresaMiddleware');

// GET /proyectos/mis-proyectos — lider y empleado ven solo sus proyectos
// router.get("/mis-proyectos", auth, role("lider", "empleado"), proyectoController.getMisProyectos);

// GET /proyectos/disponibles — empleado ve todos los proyectos activos de su empresa (para registrar horas)
// router.get("/disponibles", auth, role("empleado", "lider"), proyectoController.getProyectosDisponibles);

// Rutas de propietario (CRUD completo) — lider tiene acceso de lectura a detalles
// GET /proyectos
router.get("/", auth, role("propietario"), empresa, proyectoController.getProyectos);

// POST /proyectos
router.post("/", auth, role("propietario"), empresa, createProyectoValidation, proyectoController.createProyecto);

router.get("/:id", auth, role("propietario", "lider"), proyectoController.getProyectoById);
router.get("/:id/empleados", auth, role("propietario", "lider"), proyectoController.getEmpleadosProyecto);
router.get("/:id/horas-resumen", auth, role("propietario", "lider"), proyectoController.getHorasResumenProyecto);
router.put("/:id/desactivar", auth, role("propietario"), proyectoController.desactivarProyecto);
router.put("/:id/activar", auth, role("propietario"), proyectoController.activarProyecto);
router.put("/:id", auth, role("propietario"), proyectoController.updateProyecto);
router.delete("/:id", auth, role("propietario"), proyectoController.eliminarProyecto);

module.exports = router;
