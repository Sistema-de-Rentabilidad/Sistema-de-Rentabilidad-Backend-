const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const proyectoService = require('../../../src/modules/proyecto/proyecto.service');
const { getFechaActual } = require('../../../src/utils/dateTime');
const {
  cleanupContext,
  createContext,
  createEmpresa,
  createServicio,
  createUsuario,
  createProyecto
} = require('../../helpers/integration.helper');
const {
  authCookie,
  createCotizadoApi,
  createProyectoApi,
  expectFailure,
  responseText,
  trackProyecto,
  unusedId
} = require('../../helpers/testinyTerciarias.helper');

jest.setTimeout(90000);

describe('Testiny terciarias - Proyecto registro', () => {
  test("TC-1099 - CP-HU18-1-BE - Registro API proyecto exitoso", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Proyecto API exitoso',
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio,
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id_proyecto');
      trackProyecto(ctx, response.body.data);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1100 - CP-HU18-1-BD - Persistencia proyecto registrado", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createProyectoApi(app, ctx, {
        nombre: 'Proyecto Persistencia API'
      });

      const dbResult = await pool.query(
        'SELECT nombre, id_empresa, id_servicio FROM proyecto WHERE id_proyecto = $1',
        [proyecto.id_proyecto]
      );

      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0]).toMatchObject({
        nombre: 'Proyecto Persistencia API',
        id_empresa: ctx.empresa.id_empresa,
        id_servicio: ctx.servicio.id_servicio
      });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1103 - CP-HU18-2-BE - Registro API sin líder", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createProyectoApi(app, ctx, {
        nombre: 'Proyecto Sin Lider Testiny',
        id_lider: undefined
      });

      expect(proyecto.id_lider).toBeNull();
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1105 - CP-HU18-3-BE - Registro API sin fechas", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createProyectoApi(app, ctx, {
        nombre: 'Proyecto Sin Fechas Testiny',
        fecha_inicio: undefined,
        fecha_fin_estimada: undefined
      });

      expect(proyecto.fecha_inicio).toBeNull();
      expect(proyecto.fecha_fin_estimada).toBeNull();
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1108 - CP-HU18-5-BE - Validación duplicidad empleados", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Proyecto Empleados Duplicados',
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio,
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31',
          empleados: [ctx.empleado.id_usuario, ctx.empleado.id_usuario]
        });

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/Empleados duplicados/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1111 - CP-HU18-7-BE - Validación fechas proyecto", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Proyecto Fechas Invalidas',
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio,
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-12-31',
          fecha_fin_estimada: '2025-01-01'
        });

      expectFailure(response, 400);
      expect(responseText(response)).toMatch(/fecha/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1114 - CP-HU18-10-BE - Restricción nombre duplicado", async () => {
    const ctx = await createContext();

    try {
      await createProyectoApi(app, ctx, { nombre: 'Proyecto Duplicado API' });

      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Proyecto Duplicado API',
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio
        });

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/Ya existe un proyecto/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1115 - CP-HU18-10-BD - Restricción UNIQUE nombre proyecto", async () => {
    const ctx = await createContext();

    try {
      const nombreDuplicado = 'Proyecto Unico BD Testiny';
      const first = await pool.query(
        `INSERT INTO proyecto (id_empresa, id_servicio, nombre, descripcion, presupuesto, margen, estado, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, 'Cotizado', true)
         RETURNING id_proyecto`,
        [ctx.empresa.id_empresa, ctx.servicio.id_servicio, nombreDuplicado, 'Proyecto temporal', 10000, 20]
      );
      ctx.ids.proyectos.push(first.rows[0].id_proyecto);

      await expect(pool.query(
        `INSERT INTO proyecto (id_empresa, id_servicio, nombre, descripcion, presupuesto, margen, estado, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, 'Cotizado', true)`,
        [ctx.empresa.id_empresa, ctx.servicio.id_servicio, nombreDuplicado, 'Proyecto temporal', 10000, 20]
      )).rejects.toMatchObject({ code: '23505' });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1117 - CP-HU18-12-BE - Líder no pertenece empresa", async () => {
    const ctx = await createContext();
    const ctxExterno = await createContext();

    try {
      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Proyecto Lider Externo',
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio,
          id_lider: ctxExterno.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31'
        });

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/L.der no v.lido/i);
    } finally {
      await cleanupContext(ctx);
      await cleanupContext(ctxExterno);
    }
  });

  test("TC-1118 - CP-HU18-13-BE - Empleado externo empresa", async () => {
    const ctx = await createContext();
    const ctxExterno = await createContext();

    try {
      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Proyecto Empleado Externo',
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio,
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31',
          empleados: [ctxExterno.empleado.id_usuario]
        });

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/Empleado no v.lido/i);
    } finally {
      await cleanupContext(ctx);
      await cleanupContext(ctxExterno);
    }
  });

  test("TC-1120 - CP-HU18-15-BE - Restricción registro proyectos", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', authCookie(ctx.lider))
        .send({
          nombre: 'Proyecto Sin Permiso',
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio
        });

      expectFailure(response, 403);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1121 - CP-HU18-16-BE - Error interno registro proyecto", async () => {
    const ctx = await createContext();

    try {
      jest.spyOn(proyectoService, 'createProyecto').mockRejectedValueOnce(new Error('Error simulado'));

      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Proyecto Error Interno',
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio
        });

      expectFailure(response, 500);
      expect(response.body.message).toBe('Error interno del servidor');
    } finally {
      jest.restoreAllMocks();
      await cleanupContext(ctx);
    }
  });

  test("TC-1122 - CP-HU18-17-BE - Estado inicial automático", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createProyectoApi(app, ctx, {
        nombre: 'Proyecto Estado Inicial'
      });

      expect(proyecto.estado).toBe('Cotizado');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1124 - CP-HU18-18-BE - Registro API sin líder ni fechas", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createCotizadoApi(app, ctx, {
        nombre: 'Proyecto Sin Lider Ni Fechas'
      });

      expect(proyecto.estado).toBe('Cotizado');
      expect(proyecto.id_lider).toBeNull();
      expect(proyecto.fecha_inicio).toBeNull();
      expect(proyecto.fecha_fin_estimada).toBeNull();
    } finally {
      await cleanupContext(ctx);
    }
  });
});

describe('Testiny terciarias - Cambio de estado de proyecto', () => {
  test("TC-1125 - CP-HU46-1-BE - Cambio a Aprobado exitoso", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createCotizadoApi(app, ctx);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          estado: 'Aprobado',
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.data.estado).toBe('Aprobado');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1126 - CP-HU46-2-BE - Cambio a Aprobado sin líder", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createCotizadoApi(app, ctx);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          estado: 'Aprobado',
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31'
        });

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/lider/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1127 - CP-HU46-3-BE - Cambio a Aprobado sin fechas", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createCotizadoApi(app, ctx);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          estado: 'Aprobado',
          id_lider: ctx.lider.id_usuario
        });

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/fechas/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1128 - CP-HU46-4-BE - Cambio a Ejecución", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createCotizadoApi(app, ctx);

      await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          estado: 'Aprobado',
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31'
        })
        .expect(200);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ estado: 'Ejecución' });

      expect(response.status).toBe(200);
      expect(response.body.data.estado).toBe('Ejecución');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1129 - CP-HU46-5-BE - Desestimar proyecto Cotizado", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createCotizadoApi(app, ctx);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ estado: 'Desestimado' });

      expect(response.status).toBe(200);
      expect(response.body.data.estado).toBe('Desestimado');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1130 - CP-HU46-6-BE - Desestimar proyecto Aprobado", async () => {
    const ctx = await createContext();

    try {
      const proyecto = await createCotizadoApi(app, ctx);

      await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          estado: 'Aprobado',
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31'
        })
        .expect(200);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ estado: 'Desestimado' });

      expect(response.status).toBe(200);
      expect(response.body.data.estado).toBe('Desestimado');
    } finally {
      await cleanupContext(ctx);
    }
  });
});

describe('Testiny terciarias - Finalizacion, edicion y listado proyecto', () => {
  test("TC-1132 - CP-HU33-1-BE - Finalización exitosa proyecto", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/finalizar`)
        .set('Cookie', authCookie(ctx.lider))
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.estado).toBe('Finalizado');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1133 - CP-HU33-7-BE - Estado inválido para finalizar", async () => {
    const ctx = await createContext({ proyectoEstado: 'Cotizado' });

    try {
      const response = await request(app)
        .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/finalizar`)
        .set('Cookie', authCookie(ctx.lider))
        .send();

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/ejecucion/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1134 - CP-HU33-8-BE - Registro automático fecha finalización", async () => {
    const ctx = await createContext();

    try {
      await request(app)
        .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/finalizar`)
        .set('Cookie', authCookie(ctx.lider))
        .send()
        .expect(200);

      const dbResult = await pool.query(
        'SELECT fecha_fin_real FROM proyecto WHERE id_proyecto = $1',
        [ctx.proyecto.id_proyecto]
      );

      expect(dbResult.rowCount).toBe(1);
      const fechaFinReal = dbResult.rows[0].fecha_fin_real;
      const fechaNormalizada = fechaFinReal instanceof Date
        ? fechaFinReal.toISOString().slice(0, 10)
        : String(fechaFinReal).slice(0, 10);
      expect(fechaNormalizada).toBe(getFechaActual());
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1092 - CP-HU19-5-BE - Fechas inválidas edición", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .put(`/api/proyectos/${ctx.proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ fecha_fin_estimada: '2024-12-31' });

      expectFailure(response, 400);
      expect(response.body.message).toBe('La fecha de fin estimada no puede ser anterior a la fecha de inicio');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1093 - CP-HU19-6-BE - Presupuesto inválido en edición", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .put(`/api/proyectos/${ctx.proyecto.id_proyecto}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ presupuesto: 0 });

      expectFailure(response, 400);
      expect(responseText(response)).toMatch(/presupuesto/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1096 - CP-HU34-2-BE - Líder sin proyectos asignados", async () => {
    const ctx = await createContext();

    try {
      const liderSinProyecto = await createUsuario(ctx, {
        idEmpresa: ctx.empresa.id_empresa,
        rol: 'lider'
      });

      const response = await request(app)
        .get('/api/proyectos')
        .set('Cookie', authCookie(liderSinProyecto))
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'No hay proyectos disponibles',
        data: []
      });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1097 - CP-HU28-2-BE - Empleado sin proyectos asignados", async () => {
    const ctx = await createContext({ asignarEmpleado: false });

    try {
      const response = await request(app)
        .get('/api/proyectos')
        .set('Cookie', authCookie(ctx.empleado))
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'No hay proyectos disponibles',
        data: []
      });
    } finally {
      await cleanupContext(ctx);
    }
  });
});
