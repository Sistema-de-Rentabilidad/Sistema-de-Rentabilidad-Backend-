const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('../../../src/config/env');
const {
  cleanupContext,
  createContext,
  createMarcaje,
  tokenCookieForUser
} = require('../../helpers/testinySecundarias.helper');

jest.setTimeout(30000);

const authFor = (user) => ({ cookies: tokenCookieForUser(user) });

describe('Pruebas secundarias Testiny - Seguridad y no funcionales', () => {
  test("TC-1076 - NF-07 - Restricción de acceso por roles", async () => {
    const ctx = await createContext();

    try {
      const authEmpleado = authFor(ctx.empleado);

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
        .set('Cookie', authEmpleado.cookies)
        .send({ nombre: 'Fase Rol Test', horas_estimadas: 4 });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1077 - NF-08 - Prevención SQL Injection", async () => {
    const ctx = await createContext();

    try {
      const auth = authFor(ctx.propietario);
      const before = await pool.query('SELECT COUNT(*)::int AS total FROM usuario');

      const response = await request(app)
        .get('/api/proyectos/1%20OR%201=1/fases')
        .set('Cookie', auth.cookies);

      const after = await pool.query('SELECT COUNT(*)::int AS total FROM usuario');

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(after.rows[0].total).toBe(before.rows[0].total);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1083 - NF-14 - Recuperación ante caída del backend", async () => {
    const response = await request(app).get('/health');
    const serializedBody = JSON.stringify(response.body);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      status: 'ok',
      database: 'ok'
    });
    expect(serializedBody).not.toMatch(/DATABASE_URL|password|postgres:\/\/|supabase\.co|pooler/i);
  });

  test("TC-1084 - NF-15 - Consistencia de horas trabajadas", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      await createMarcaje(ctx, {
        idUsuario: ctx.empleado.id_usuario,
        entradaHaceHoras: 3,
        salidaHaceHoras: 2
      });
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 2,
          descripcion: 'Horas exceden marcaje'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/exceden el tiempo trabajado/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("NF-01 - Tiempo de respuesta del login", async () => {
    const startTime = Date.now();

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'qa_propietario@test.com',
        password: 'Qa123456*'
      });

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(response.status).toBe(200);
    // Umbral de aceptación: ≤ 2 segundos
    expect(duration).toBeLessThan(2000);
  });

  test("NF-03 - Tiempo de registro de horas", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      // Para que el registro sea exitoso y no devuelva 400,
      // el empleado debe tener un marcaje de entrada activo.
      await createMarcaje(ctx, { idUsuario: ctx.empleado.id_usuario, entradaHaceHoras: 1 });

      const auth = authFor(ctx.empleado);

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1,
          descripcion: 'Registro rendimiento test'
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(201);
      // Umbral de aceptación: ≤ 2 segundos
      expect(duration).toBeLessThan(2000);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("NF-05 - Acceso sin autenticación a endpoints protegidos", async () => {
    // Listado de endpoints protegidos representativos
    const endpoints = [
      { method: 'get', url: '/api/proyectos' },
      { method: 'post', url: '/api/horas' },
      { method: 'get', url: '/api/marcajes' }
    ];

    for (const ep of endpoints) {
      const response = await request(app)[ep.method](ep.url).send();

      // En este sistema, authMiddleware suele lanzar 401 si no hay token/cookie.
      expect([401, 403]).toContain(response.status);
      expect(response.body).toHaveProperty('success', false);
    }
  });

  test("NF-06 - Validación JWT expirado", async () => {
    // Generar un token expirado
    const expiredToken = jwt.sign(
      { id: 1, rol: 'empleado' },
      JWT_SECRET,
      { expiresIn: '-1h' }
    );

    // Intentar acceder a un endpoint protegido con el token expirado
    const response = await request(app)
      .get('/api/proyectos')
      .set('Cookie', [`token=${expiredToken}`])
      .send();

    // Resultado esperado: 401 Unauthorized
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
  });

  test("NF-16 - Edición simultánea de proyectos", async () => {
    // 1. Crear un proyecto temporal para la prueba
    const ctx = await createContext();
    const proyectoId = ctx.proyecto.id_proyecto;
    const auth = authFor(ctx.propietario);

    try {
      // 2. Ejecutar múltiples peticiones de actualización simultáneamente
      const updateData1 = { nombre: 'Nombre Simultáneo 1' };
      const updateData2 = { nombre: 'Nombre Simultáneo 2' };

      const [res1, res2] = await Promise.all([
        request(app).put(`/api/proyectos/${proyectoId}`).set('Cookie', auth.cookies).send(updateData1),
        request(app).put(`/api/proyectos/${proyectoId}`).set('Cookie', auth.cookies).send(updateData2)
      ]);

      // 3. Verificar que ambas peticiones se procesaron sin errores (aunque una sobrescriba a la otra)
      expect([200]).toContain(res1.status);
      expect([200]).toContain(res2.status);

      // 4. Verificar consistencia: La base de datos debe reflejar uno de los dos nombres
      const result = await pool.query('SELECT nombre FROM proyecto WHERE id_proyecto = $1', [proyectoId]);
      const nombreFinal = result.rows[0].nombre;

      expect(['Nombre Simultáneo 1', 'Nombre Simultáneo 2']).toContain(nombreFinal);
    } finally {
      await cleanupContext(ctx);
    }
  });
});
