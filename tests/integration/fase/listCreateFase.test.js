const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const faseService = require('../../../src/modules/fase/fase.service');
const {
  cleanupContext,
  createContext,
  createFase,
  tokenCookieForUser,
  uniquePhaseName
} = require('../../helpers/testinySecundarias.helper');

jest.setTimeout(30000);

describe('Pruebas secundarias Testiny - Fase', () => {
  test("TC-923 - CP-HU35-1-BE - Obtención de fases por proyecto", async () => {
    const ctx = await createContext();

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);

      const response = await request(app)
        .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some((fase) => fase.id_fase === ctx.fase.id_fase)).toBe(true);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-924 - CP-HU35-1-BD - Validación integridad de fases", async () => {
    const ctx = await createContext();

    try {
      const result = await pool.query(
        `SELECT f.id_fase, f.id_proyecto, p.id_empresa
         FROM fase f
         INNER JOIN proyecto p ON p.id_proyecto = f.id_proyecto
         WHERE f.id_fase = $1`,
        [ctx.fase.id_fase]
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0]).toMatchObject({
        id_fase: ctx.fase.id_fase,
        id_proyecto: ctx.proyecto.id_proyecto,
        id_empresa: ctx.empresa.id_empresa
      });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-927 - CP-HU35-2-BE - Lista vacía de fases", async () => {
    const ctx = await createContext({ crearFase: false });

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);

      const response = await request(app)
        .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: []
      });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-930 - CP-HU35-4-BE - Filtrado seguro por empresa", async () => {
    const ctxA = await createContext();
    const ctxB = await createContext();

    try {
      const authCookies = tokenCookieForUser(ctxA.propietario);

      const response = await request(app)
        .get(`/api/proyectos/${ctxB.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctxA);
      await cleanupContext(ctxB);
    }
  });

  test("TC-931 - CP-HU35-4-BD - Validación id_empresa fases", async () => {
    const ctx = await createContext();

    try {
      const result = await pool.query(
        `SELECT f.id_fase, p.id_empresa
         FROM fase f
         INNER JOIN proyecto p ON p.id_proyecto = f.id_proyecto
         WHERE f.id_fase = $1`,
        [ctx.fase.id_fase]
      );

      expect(result.rowCount).toBe(1);
      expect(result.rows[0].id_empresa).toBe(ctx.empresa.id_empresa);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-933 - CP-HU35-5-BE - Proyecto inexistente API", async () => {
    const ctx = await createContext();

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);

      const response = await request(app)
        .get('/api/proyectos/99999999/fases')
        .set('Cookie', authCookies);

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-935 - CP-HU35-6-BE - Token expirado en fases", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', tokenCookieForUser(ctx.propietario, '-1h'));

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-937 - CP-HU36-1-BE - Registro API exitoso fase", async () => {
    const ctx = await createContext({ crearFase: false });

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);
      const nombre = uniquePhaseName('Fase Registro');

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies)
        .send({ nombre, horas_estimadas: 8 });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toMatchObject({
        id_proyecto: ctx.proyecto.id_proyecto,
        nombre
      });

      ctx.ids.fases.push(response.body.data.id_fase);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-938 - CP-HU36-1-BD - Persistencia fase registrada", async () => {
    const ctx = await createContext({ crearFase: false });

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);
      const nombre = uniquePhaseName('Fase Persistencia');

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies)
        .send({ nombre, horas_estimadas: 10 });

      expect(response.status).toBe(201);
      ctx.ids.fases.push(response.body.data.id_fase);

      const dbResult = await pool.query(
        'SELECT id_fase, nombre, horas_estimadas FROM fase WHERE id_fase = $1',
        [response.body.data.id_fase]
      );

      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0].nombre).toBe(nombre);
      expect(Number(dbResult.rows[0].horas_estimadas)).toBe(10);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-941 - CP-HU36-2-BE - Validación backend campos obligatorios", async () => {
    const ctx = await createContext({ crearFase: false });

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(Array.isArray(response.body.errors)).toBe(true);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-943 - CP-HU36-3-BE - Restricción nombre duplicado", async () => {
    const ctx = await createContext();

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies)
        .send({ nombre: ctx.fase.nombre, horas_estimadas: 5 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/existe.*fase/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-944 - CP-HU36-3-BD - Restricción UNIQUE fase proyecto", async () => {
    const ctx = await createContext();

    try {
      await expect(createFase(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        nombre: ` ${ctx.fase.nombre.toUpperCase()} `,
        horasEstimadas: 4
      })).rejects.toMatchObject({ code: '23505' });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-946 - CP-HU36-4-BE - Validación backend horas", async () => {
    const ctx = await createContext({ crearFase: false });

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies)
        .send({ nombre: uniquePhaseName('Fase Horas'), horas_estimadas: 0 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errors.some((error) => /mayor a 0/.test(error.msg))).toBe(true);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-949 - CP-HU36-6-BE - Restricción backend registro fases", async () => {
    const ctx = await createContext({ crearFase: false });

    try {
      const authCookies = tokenCookieForUser(ctx.empleado);

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies)
        .send({ nombre: uniquePhaseName('Fase Sin Permiso'), horas_estimadas: 4 });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-951 - CP-HU36-7-BE - Restricción creación proyecto finalizado", async () => {
    const ctx = await createContext({ proyectoFinalizado: true, crearFase: false });

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies)
        .send({ nombre: uniquePhaseName('Fase Finalizado'), horas_estimadas: 4 });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/proyecto finalizado/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-953 - CP-HU36-8-BE - Error interno registro fase", async () => {
    const ctx = await createContext({ crearFase: false });

    try {
      const authCookies = tokenCookieForUser(ctx.propietario);
      jest.spyOn(faseService, 'createFase').mockRejectedValueOnce(new Error('Error simulado'));

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authCookies)
        .send({ nombre: uniquePhaseName('Fase Error'), horas_estimadas: 4 });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        message: 'Error interno del servidor'
      });
    } finally {
      jest.restoreAllMocks();
      await cleanupContext(ctx);
    }
  });

  test("TC-955 - CP-HU36-9-BE - Token expirado creación fase", async () => {
    const ctx = await createContext({ crearFase: false });

    try {
      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', tokenCookieForUser(ctx.propietario, '-1h'))
        .send({ nombre: uniquePhaseName('Fase Token'), horas_estimadas: 4 });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });
});
