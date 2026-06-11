const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const jwt = require('jsonwebtoken');
const marcajeRepository = require('../../../src/modules/marcaje/marcaje.repository');

const { JWT_SECRET } = require('../../../src/config/env');
const {
  cleanupContext,
  createContext,
  createMarcaje,
  createRegistroHoras,
  tokenCookieForUser
} = require('../../helpers/testinySecundarias.helper');

jest.setTimeout(30000);

const authFor = (user) => ({ cookies: tokenCookieForUser(user) });

describe('Marcaje salida - empleado y lider', () => {
  test("CP-HU25-1-BE - Registro API salida exitoso", async () => {
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

  test("CP-HU25-1-BD - Persistencia hora de salida", async () => {
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

  test("CP-HU25-2-BE - Validación backend salida sin entrada", async () => {
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

  test("CP-HU25-3-BE - Restricción backend salida duplicada", async () => {
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

  test("CP-HU25-5-BE - Validación backend horas inexistentes", async () => {
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

  test("CP-HU25-6-BE - Validación backend hora inválida", async () => {
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

  test("CP-HU25-7-BE - Validación token expirado salida", async () => {
    // Creamos un token que expiró hace 1 hora
    const expiredToken = jwt.sign(
      { id: 1, rol: 'empleado' },
      JWT_SECRET,
      { expiresIn: '-1h' }
    );
    const response = await request(app)
      .post('/api/marcajes/salida')
      .set('Cookie', [`token=${expiredToken}`])
      .send();

    // Resultado esperado: 401 (Unauthorized)
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
  });

  test("CP-HU25-8-BE - Restricción backend usuario inactivo salida", async () => {
    // 1. Crear un contexto con un empleado inactivo
    const ctx = await createContext({ empleadoActivo: false });

    try {
      // 2. Intentar marcar salida con el empleado inactivo
      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', tokenCookieForUser(ctx.empleado))
        .send();

      // 3. Resultado esperado: 401 (Unauthorized) ya que la sesión no es válida para un usuario inactivo
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU25-9-BE - Error interno registro salida", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      await createMarcaje(ctx, { idUsuario: ctx.empleado.id_usuario, entradaHaceHoras: 4 });
      await createRegistroHoras(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idFase: ctx.fase.id_fase,
        idEmpleado: ctx.empleado.id_usuario,
        horas: 1
      });

      // Espiar el repositorio de marcajes para simular una excepción interna
      const spy = jest.spyOn(marcajeRepository, 'registrarSalida').mockRejectedValue(new Error('Error inesperado en BD'));

      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/marcajes/salida')
        .set('Cookie', auth.cookies)
        .send();

      // Resultado esperado: 500 (Internal Server Error) por excepción no controlada
      expect(response.status).toBe(500);

      spy.mockRestore();
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU41-5-BE - Usuario líder inactivo", async () => {
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

  test("CP-HU42-1-BE - Registro API salida líder", async () => {
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

  test("CP-HU42-8-BE - Usuario líder inactivo salida", async () => {
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

describe('HU31 - Obtención de marcajes', () => {
  test("CP-HU31-1-BE - Obtención API marcajes diarios", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      // Creamos un marcaje previo para tener datos que obtener
      await createMarcaje(ctx, { idUsuario: ctx.empleado.id_usuario, entradaHaceHoras: 4 });

      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .get('/api/marcajes')
        .set('Cookie', auth.cookies)
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id_marcaje');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU31-2-BE - Respuesta vacía marcajes", async () => {
    // Creamos un usuario nuevo (sin marcajes) usando el contexto
    const ctx = await createContext({ empleadoTipoPago: 'mensual' });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .get('/api/marcajes')
        .set('Cookie', auth.cookies)
        .send();

      // Resultado esperado: 200 con data vacía
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(0);
      expect(response.body.message).toBe('No hay marcajes disponibles');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU31-3-BE - Validación token expirado marcajes", async () => {
    // Creamos un token que expiró hace 1 hora
    const expiredToken = jwt.sign(
      { id: 1, rol: 'empleado' },
      JWT_SECRET,
      { expiresIn: '-1h' }
    );

    const response = await request(app)
      .get('/api/marcajes')
      .set('Cookie', [`token=${expiredToken}`])
      .send();

    // Resultado esperado: 401 (Unauthorized)
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
  });
});


