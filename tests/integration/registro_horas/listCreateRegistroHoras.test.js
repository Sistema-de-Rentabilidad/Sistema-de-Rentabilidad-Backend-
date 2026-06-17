const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const horasService = require('../../../src/modules/registro_horas/horas.service');
const { getFechaActual } = require('../../../src/utils/dateTime');
const {
  cleanupContext,
  createContext,
  createFase,
  createMarcaje,
  createRegistroHoras,
  tokenCookieForUser,
  uniqueText
} = require('../../helpers/integration.helper');

jest.setTimeout(40000);

const authFor = (user) => ({ cookies: tokenCookieForUser(user) });

const ayer = () => {
  const [year, month, day] = getFechaActual().split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};

describe('HU27, HU29 - Gestión y creación de registro de horas', () => {
  const casosUsuario = [
    { rol: 'empleado', tipoPago: 'por_hora' },
    { rol: 'empleado', tipoPago: 'mensual' },
    { rol: 'lider', tipoPago: 'por_hora' },
    { rol: 'lider', tipoPago: 'mensual' }
  ];

  casosUsuario.forEach(({ rol, tipoPago }) => {
    describe(`Escenario: ${rol} con pago ${tipoPago}`, () => {
      let ctx;
      let auth;

      beforeEach(async () => {
        ctx = await createContext({
          empleadoTipoPago: tipoPago,
          empleadoRol: rol
        });
        auth = authFor(rol === 'empleado' ? ctx.empleado : ctx.lider);
      });

      afterEach(async () => {
        await cleanupContext(ctx);
      });

      test(`CP-HU27-1-BE - Obtención de registros de horas (${rol})`, async () => {
        const registro = await createRegistroHoras(ctx, {
          idProyecto: ctx.proyecto.id_proyecto,
          idFase: ctx.fase.id_fase,
          idEmpleado: rol === 'empleado' ? ctx.empleado.id_usuario : ctx.lider.id_usuario
        });
        const response = await request(app)
          .get('/api/horas')
          .set('Cookie', auth.cookies);
        expect(response.status).toBe(200);
        expect(response.body.data.some((item) => item.id_registro === registro.id_registro)).toBe(true);
      });

      test(`CP-HU29-1-BE - Registro API horas exitoso (${rol})`, async () => {
        const response = await request(app)
          .post('/api/horas')
          .set('Cookie', auth.cookies)
          .send({
            id_proyecto: ctx.proyecto.id_proyecto,
            id_fase: ctx.fase.id_fase,
            horas: 1,
            descripcion: 'Registro horas'
          });

        expect(response.status).toBe(201);
        expect(response.body.data).toMatchObject({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          id_empleado: rol === 'empleado' ? ctx.empleado.id_usuario : ctx.lider.id_usuario
        });
      });
    });
  });

  test("CP-HU27-2-BE - Respuesta vacía registros horas", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      const auth = authFor(ctx.empleado);
      const response = await request(app).get('/api/horas').set('Cookie', auth.cookies);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ success: true, data: [] });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU27-5-BE - Validación JWT expirado horas", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      const response = await request(app)
        .get('/api/horas')
        .set('Cookie', tokenCookieForUser(ctx.empleado, '-1h'));
      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU27-6-BE - Restricción edición registros antiguos", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      const registro = await createRegistroHoras(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idFase: ctx.fase.id_fase,
        idEmpleado: ctx.empleado.id_usuario,
        fecha: ayer()
      });
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .put(`/api/horas/${registro.id_registro}`)
        .set('Cookie', auth.cookies)
        .send({ horas: 2, descripcion: 'Horas antiguas' });
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
      expect(response.body.message).toMatch(/mismo d/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-1-BD - Persistencia registro horas", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1.5,
          descripcion: 'Persistencia horas'
        });

      expect(response.status).toBe(201);
      ctx.ids.registros.push(response.body.data.id_registro);

      const dbResult = await pool.query(
        'SELECT id_registro, horas FROM registro_horas WHERE id_registro = $1',
        [response.body.data.id_registro]
      );

      expect(dbResult.rowCount).toBe(1);
      expect(Number(dbResult.rows[0].horas)).toBe(1.5);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-4-BE - Restricción duplicidad fase", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      await createRegistroHoras(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idFase: ctx.fase.id_fase,
        idEmpleado: ctx.empleado.id_usuario
      });
      const auth = authFor(ctx.empleado);
      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1,
          descripcion: 'Duplicidad fase'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/registraste horas|fase/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-4-BD - Validación unicidad fase por fecha", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      await createRegistroHoras(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idFase: ctx.fase.id_fase,
        idEmpleado: ctx.empleado.id_usuario
      });

      await expect(createRegistroHoras(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idFase: ctx.fase.id_fase,
        idEmpleado: ctx.empleado.id_usuario
      })).rejects.toMatchObject({ code: '23505' });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-5-BE - Restricción proyecto finalizado", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora', proyectoFinalizado: true });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1,
          descripcion: 'Proyecto finalizado'
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/proyecto finalizado/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-7-BE - Validación token expirado registro", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', tokenCookieForUser(ctx.empleado, '-1h'))
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1,
          descripcion: 'Token expirado'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-8-BE - Validación horas inválidas", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 0.1,
          descripcion: 'Horas invalidas'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors.some((error) => /0.5 y 24/.test(error.msg))).toBe(true);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-9-BE - Restricción fase inactiva", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora', faseActiva: false });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1,
          descripcion: 'Fase inactiva'
        });

      expect(response.status).toBe(404);
      expect(response.body.message).toMatch(/fase no encontrada/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-10-BE - Restricción proyecto no asignado", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora', asignarEmpleado: false });

    try {
      const auth = authFor(ctx.empleado);

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1,
          descripcion: 'No asignado'
        });

      expect(response.status).toBe(403);
      expect(response.body.message).toMatch(/asignado/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-11-BE - Restricción fecha distinta", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      const auth = authFor(ctx.empleado);
      const fechaCliente = '2000-01-01';

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1,
          fecha: fechaCliente,
          descripcion: 'Fecha cliente ignorada'
        });

      expect(response.status).toBe(201);
      ctx.ids.registros.push(response.body.data.id_registro);
      expect(response.body.data.fecha.split('T')[0]).toBe(getFechaActual());
      expect(response.body.data.fecha.split('T')[0]).not.toBe(fechaCliente);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("CP-HU29-12-BE - Error interno API registro horas", async () => {
    const ctx = await createContext({ empleadoTipoPago: 'por_hora' });

    try {
      const auth = authFor(ctx.empleado);
      jest.spyOn(horasService, 'createRegistroHoras').mockRejectedValueOnce(new Error('Error simulado'));

      const response = await request(app)
        .post('/api/horas')
        .set('Cookie', auth.cookies)
        .send({
          id_proyecto: ctx.proyecto.id_proyecto,
          id_fase: ctx.fase.id_fase,
          horas: 1,
          descripcion: 'Error interno'
        });

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

