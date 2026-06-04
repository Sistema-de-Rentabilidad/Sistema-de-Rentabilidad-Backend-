const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const {
  cleanupContext,
  createContext,
  createMarcaje,
  createRegistroHoras,
  tokenCookieForUser
} = require('../../helpers/testinySecundarias.helper');

jest.setTimeout(30000);

const authFor = (user) => ({ cookies: tokenCookieForUser(user) });

describe('Pruebas secundarias Testiny - Marcaje salida y líder', () => {
  test("TC-720 - CP-HU25-1-BE - Registro API salida exitoso", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      await createMarcaje(ctx, { idUsuario: ctx.empleado.id_usuario, entradaHaceHoras: 4 });
      await createRegistroHoras(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idFase: ctx.fase.id_fase,
        idEmpleado: ctx.empleado.id_usuario,
        horas: 1
      });
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Salida registrada correctamente'
      });
      expect(response.body.data.hora_salida).toBeTruthy();
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-721 - CP-HU25-1-BD - Persistencia hora de salida", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const marcaje = await createMarcaje(ctx, { idUsuario: ctx.empleado.id_usuario, entradaHaceHoras: 4 });
      await createRegistroHoras(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idFase: ctx.fase.id_fase,
        idEmpleado: ctx.empleado.id_usuario,
        horas: 1
      });
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(200);

      const dbResult = await pool.query(
        'SELECT hora_salida FROM marcaje WHERE id_marcaje = $1',
        [marcaje.id_marcaje]
      );

      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0].hora_salida).toBeTruthy();
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-724 - CP-HU25-2-BE - Validación backend salida sin entrada", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/registrar tu entrada/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-726 - CP-HU25-3-BE - Restricción backend salida duplicada", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      await createMarcaje(ctx, {
        idUsuario: ctx.empleado.id_usuario,
        entradaHaceHoras: 4,
        salidaHaceHoras: 2
      });
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/salida del dia/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-728 - CP-HU25-4-BE - Validación backend horas excedidas", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      await createMarcaje(ctx, { idUsuario: ctx.empleado.id_usuario, entradaHaceHoras: 0.01 });
      await createRegistroHoras(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idFase: ctx.fase.id_fase,
        idEmpleado: ctx.empleado.id_usuario,
        horas: 2
      });
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/exceden el tiempo trabajado/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-730 - CP-HU25-5-BE - Validación backend horas inexistentes", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      await createMarcaje(ctx, { idUsuario: ctx.empleado.id_usuario, entradaHaceHoras: 4 });
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/registrar horas/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-732 - CP-HU25-6-BE - Validación backend hora inválida", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send({ hora_salida: '00:00' });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.errors.some((error) => /No debes enviar datos/.test(error.msg))).toBe(true);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-756 - CP-HU41-5-BE - Usuario líder inactivo", async () => {
    const ctx = await createContext({ liderActivo: false });

    try {
      const response = await request(app)
        .post('/api/marcajes/entrada')
        .set('Cookie', tokenCookieForUser(ctx.lider))
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-759 - CP-HU42-1-BE - Registro API salida líder", async () => {
    const ctx = await createContext();

    try {
      await createMarcaje(ctx, { idUsuario: ctx.lider.id_usuario, entradaHaceHoras: 4 });
      const auth = authFor(ctx.lider);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('hora_salida');
      expect(response.body.data).not.toHaveProperty('total_horas_registradas');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-766 - CP-HU42-8-BE - Usuario líder inactivo salida", async () => {
    const ctx = await createContext({ liderActivo: false });

    try {
      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', tokenCookieForUser(ctx.lider))
        .send();

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });
});
