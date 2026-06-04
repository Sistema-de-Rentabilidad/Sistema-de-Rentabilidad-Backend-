const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
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
});
