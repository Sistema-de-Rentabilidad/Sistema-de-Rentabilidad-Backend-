const request = require('supertest');
const pool = require('../../src/config/db');
const {
  tokenCookieForUser,
  uniquePhaseName,
  uniqueText
} = require('./integration.helper');

const authCookie = (user, expiresIn = '1h') => tokenCookieForUser(user, expiresIn);

const expectFailure = (response, status) => {
  expect(response.status).toBe(status);
  expect(response.body).toHaveProperty('success', false);
};

const responseText = (response) => JSON.stringify(response.body);

const unusedId = async (table, column) => {
  const result = await pool.query(`SELECT COALESCE(MAX(${column}), 0) + 100000 AS id FROM ${table}`);
  return Number(result.rows[0].id);
};

const trackProyecto = (ctx, proyecto) => {
  if (proyecto?.id_proyecto) {
    ctx.ids.proyectos.push(proyecto.id_proyecto);
  }
  return proyecto;
};

const trackServicio = (ctx, servicio) => {
  if (servicio?.id_servicio) {
    ctx.ids.servicios.push(servicio.id_servicio);
  }
  return servicio;
};

const createProyectoApi = async (app, ctx, overrides = {}) => {
  const body = {
    nombre: uniqueText('Proyecto Testiny'),
    descripcion: 'Proyecto temporal',
    presupuesto: 10000,
    margen: 20,
    id_servicio: ctx.servicio.id_servicio,
    id_lider: ctx.lider.id_usuario,
    fecha_inicio: '2025-01-01',
    fecha_fin_estimada: '2025-12-31',
    ...overrides
  };

  const response = await request(app)
    .post('/api/proyectos')
    .set('Cookie', authCookie(ctx.propietario))
    .send(body);

  expect(response.status).toBe(201);
  return trackProyecto(ctx, response.body.data);
};

const createCotizadoApi = async (app, ctx, overrides = {}) => {
  const body = {
    nombre: uniqueText('Proyecto Cotizado'),
    descripcion: 'Proyecto temporal',
    presupuesto: 10000,
    margen: 20,
    id_servicio: ctx.servicio.id_servicio,
    ...overrides
  };

  const response = await request(app)
    .post('/api/proyectos')
    .set('Cookie', authCookie(ctx.propietario))
    .send(body);

  expect(response.status).toBe(201);
  return trackProyecto(ctx, response.body.data);
};

const createServicioApi = async (app, ctx, overrides = {}) => {
  const body = {
    nombre: uniquePhaseName('Servicio Testiny'),
    descripcion: 'Servicio temporal',
    ...overrides
  };

  const response = await request(app)
    .post('/api/servicios')
    .set('Cookie', authCookie(ctx.propietario))
    .send(body);

  expect(response.status).toBe(201);
  return trackServicio(ctx, response.body.data);
};

module.exports = {
  authCookie,
  expectFailure,
  responseText,
  unusedId,
  createProyectoApi,
  createCotizadoApi,
  createServicioApi,
  trackProyecto,
  trackServicio
};
