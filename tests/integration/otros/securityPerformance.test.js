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
} = require('../../helpers/integration.helper');

jest.setTimeout(40000);

const authFor = (user) => ({ cookies: tokenCookieForUser(user) });

describe('Performance y Seguridad', () => {
  test("CP-NF1 - Tiempo de respuesta del login", async () => {
    const ctx = await createContext();
    try {
      const startTime = Date.now();
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: ctx.propietario.email,
          password: ctx.propietario.passwordPlano
        });
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      // Umbral de aceptación: ≤ 2 segundos
      expect(duration).toBeLessThan(2000);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-NF3 - Tiempo de registro de horas", async () => {
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

  test("CP-NF5 - Acceso sin autenticación a endpoints protegidos", async () => {
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

  test("CP-NF6 - Prevención SQL Injection", async () => {
    const ctx = await createContext();

    try {
      const auth = authFor(ctx.propietario);
      const before = await pool.query('SELECT COUNT(*)::int AS total FROM usuario');

      const response = await request(app)
        .get('/api/proyectos/1%20OR%201=1/fases')
        .set('Cookie', auth.cookies);

      const after = await pool.query('SELECT COUNT(*)::int AS total FROM usuario');

      console.log('Registros encontrados:', after.rows);
      expect(after.rows[0].total).toBe(before.rows[0].total);
    } finally {
      await cleanupContext(ctx);
    }
  });
});