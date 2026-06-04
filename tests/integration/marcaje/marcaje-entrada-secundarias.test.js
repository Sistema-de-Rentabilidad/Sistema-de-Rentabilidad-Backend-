process.env.MARCAJE_ENTRADA_HORA_INICIO = '00:00';
process.env.MARCAJE_ENTRADA_HORA_FIN = '23:59';

const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const marcajeService = require('../../../src/modules/marcaje/marcaje.service');
const { getFechaActual } = require('../../../src/utils/dateTime');
const {
  cleanupContext,
  createContext,
  createMarcaje,
  tokenCookieForUser
} = require('../../helpers/testinySecundarias.helper');

jest.setTimeout(30000);

const authFor = (user) => ({ cookies: tokenCookieForUser(user) });

describe('Pruebas secundarias Testiny - Marcaje entrada', () => {
  test("TC-705 - CP-HU21-1-BE - Registro API entrada exitoso", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Entrada registrada correctamente'
      });
      expect(response.body.data).toHaveProperty('id_marcaje');
      ctx.ids.marcajes.push(response.body.data.id_marcaje);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-706 - CP-HU21-1-BD - Persistencia de hora de entrada", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(200);
      ctx.ids.marcajes.push(response.body.data.id_marcaje);

      const dbResult = await pool.query(
        'SELECT hora_entrada, hora_salida FROM marcaje WHERE id_marcaje = $1',
        [response.body.data.id_marcaje]
      );

      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0].hora_entrada).toBeTruthy();
      expect(dbResult.rows[0].hora_salida).toBeNull();
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-709 - CP-HU21-2-BE - Restricción backend entrada duplicada", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const auth = authFor(ctx.empleado);

      const first = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', auth.cookies)
        .send();

      expect(first.status).toBe(200);
      ctx.ids.marcajes.push(first.body.data.id_marcaje);

      const response = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/ya registraste tu entrada/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-710 - CP-HU21-2-BD - Validación unicidad marcaje entrada", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      await createMarcaje(ctx, {
        idUsuario: ctx.empleado.id_usuario,
        fecha: getFechaActual()
      });

      await expect(createMarcaje(ctx, {
        idUsuario: ctx.empleado.id_usuario,
        fecha: getFechaActual()
      })).rejects.toMatchObject({ code: '23505' });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-712 - CP-HU21-3-BE - Validación token expirado entrada", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const response = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', tokenCookieForUser(ctx.empleado, '-1h'))
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-715 - CP-HU21-5-BE - Restricción usuario inactivo entrada", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual', empleadoActivo: false });

    try {
      const response = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', tokenCookieForUser(ctx.empleado))
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-717 - CP-HU21-6-BE - Error interno registro entrada", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const auth = authFor(ctx.empleado);
      jest.spyOn(marcajeService, 'marcarEntrada').mockRejectedValueOnce(new Error('Error simulado'));

      const response = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', auth.cookies)
        .send();

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
});
