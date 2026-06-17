const request = require('supertest');
const app = require('../../../src/app');

const {
  cleanupContext,
  createContext,
  tokenCookieForUser,
  uniqueText
} = require('../../helpers/integration.helper');

jest.setTimeout(90000);

describe('HU18 - Creacion de proyecto con estado inicial', () => {
  test('CP-HU18-1-BE - API crea proyecto en estado Cotizado', async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', tokenCookieForUser(ctx.propietario))
        .send({
          nombre: uniqueText('Proyecto Cotizado'),
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio,
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31'
        });

      expect(response.status).toBe(201);
      expect(response.body.data).toMatchObject({
        estado: 'Cotizado',
        id_lider: ctx.lider.id_usuario
      });
      ctx.ids.proyectos.push(response.body.data.id_proyecto);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test('CP-HU18-17-BE - API crea proyecto Cotizado sin lider ni fechas', async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/proyectos')
        .set('Cookie', tokenCookieForUser(ctx.propietario))
        .send({
          nombre: uniqueText('Proyecto Sin Lider'),
          descripcion: 'Proyecto temporal',
          presupuesto: 10000,
          margen: 20,
          id_servicio: ctx.servicio.id_servicio
        });

      expect(response.status).toBe(201);
      expect(response.body.data.estado).toBe('Cotizado');
      expect(response.body.data.id_lider).toBeNull();
      expect(response.body.data.fecha_inicio).toBeNull();
      expect(response.body.data.fecha_fin_estimada).toBeNull();
      ctx.ids.proyectos.push(response.body.data.id_proyecto);
    } finally {
      await cleanupContext(ctx);
    }
  });
});

describe('HU46 - Gestion de estados del proyecto', () => {
  const crearCotizado = async (ctx) => {
    const response = await request(app)
      .post('/api/proyectos')
      .set('Cookie', tokenCookieForUser(ctx.propietario))
      .send({
        nombre: uniqueText('Proyecto Estado'),
        descripcion: 'Proyecto temporal',
        presupuesto: 10000,
        margen: 20,
        id_servicio: ctx.servicio.id_servicio
      });

    expect(response.status).toBe(201);
    ctx.ids.proyectos.push(response.body.data.id_proyecto);
    return response.body.data;
  };

  test('CP-HU46-2-BE - API rechaza aprobar sin lider', async () => {
    const ctx = await createContext();

    try {
      const proyecto = await crearCotizado(ctx);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', tokenCookieForUser(ctx.propietario))
        .send({ estado: 'Aprobado' });

      expect(response.status).toBe(400);
      expect(response.body.message).toMatch(/lider/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test('CP-HU46-1-BE - API cambia a Aprobado con datos completos', async () => {
    const ctx = await createContext();

    try {
      const proyecto = await crearCotizado(ctx);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', tokenCookieForUser(ctx.propietario))
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

  test('CP-HU46-4-BE - API cambia de Aprobado a Ejecucion', async () => {
    const ctx = await createContext();

    try {
      const proyecto = await crearCotizado(ctx);
      await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', tokenCookieForUser(ctx.propietario))
        .send({
          estado: 'Aprobado',
          id_lider: ctx.lider.id_usuario,
          fecha_inicio: '2025-01-01',
          fecha_fin_estimada: '2025-12-31'
        })
        .expect(200);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', tokenCookieForUser(ctx.propietario))
        .send({ estado: 'Ejecución' });

      expect(response.status).toBe(200);
      expect(response.body.data.estado).toBe('Ejecución');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test('CP-HU46-5-BE - API desestima proyecto cotizado', async () => {
    const ctx = await createContext();

    try {
      const proyecto = await crearCotizado(ctx);

      const response = await request(app)
        .put(`/api/proyectos/${proyecto.id_proyecto}`)
        .set('Cookie', tokenCookieForUser(ctx.propietario))
        .send({ estado: 'Desestimado' });

      expect(response.status).toBe(200);
      expect(response.body.data.estado).toBe('Desestimado');
    } finally {
      await cleanupContext(ctx);
    }
  });
});
