const request = require('supertest');
const app = require('../../../src/app');
const {
  cleanupContext,
  createContext,
  createMarcaje
} = require('../../helpers/integration.helper');
const { authCookie, expectFailure } = require('../../helpers/testinyTerciarias.helper');

jest.setTimeout(60000);

describe('Testiny terciarias - Marcaje lider', () => {
  test("TC-1216 - CP-HU42-5-BE - Validación backend horas inexistentes (lider)", async () => {
    const ctx = await createContext();

    try {
      await createMarcaje(ctx, { idUsuario: ctx.lider.id_usuario, entradaHaceHoras: 4 });

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', authCookie(ctx.lider))
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Salida registrada correctamente'
      });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1217 - CP-HU42-6-BE - Validación backend hora inválida (lider)", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', authCookie(ctx.lider))
        .send({ hora_salida: '00:00' });

      expectFailure(response, 400);
      expect(response.body.errors.some((error) => /No debes enviar datos/.test(error.msg))).toBe(true);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-752 - CP-HU41-1-BE - Registro API entrada líder", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', authCookie(ctx.lider))
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

  test("TC-761 - CP-HU42-3-BE - Registro duplicado salida líder", async () => {
    const ctx = await createContext();

    try {
      await createMarcaje(ctx, {
        idUsuario: ctx.lider.id_usuario,
        entradaHaceHoras: 4,
        salidaHaceHoras: 2
      });

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', authCookie(ctx.lider))
        .send();

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/salida del dia/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-769 - CP-HU43-1-BE - Obtención API marcajes líder", async () => {
    const ctx = await createContext();

    try {
      const marcaje = await createMarcaje(ctx, { idUsuario: ctx.lider.id_usuario, entradaHaceHoras: 4 });

      const response = await request(app)
        .get('/api/marcajes')
        .set('Cookie', authCookie(ctx.lider))
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.some((item) => item.id_marcaje === marcaje.id_marcaje)).toBe(true);
    } finally {
      await cleanupContext(ctx);
    }
  });
});
