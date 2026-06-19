const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const {
  cleanupContext,
  createContext,
  createServicio,
  uniquePhaseName
} = require('../../helpers/integration.helper');
const {
  authCookie,
  createServicioApi,
  expectFailure,
  responseText,
  unusedId
} = require('../../helpers/testinyTerciarias.helper');

jest.setTimeout(60000);

describe('Testiny terciarias - Servicio', () => {
  test("TC-886 - CP-HU9-1-BE - Actualización API servicio", async () => {
    const ctx = await createContext();

    try {
      const servicio = await createServicio(ctx, ctx.empresa.id_empresa);
      const nuevoNombre = uniquePhaseName('Servicio Editado');

      const response = await request(app)
        .put(`/api/servicios/${servicio.id_servicio}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ nombre: nuevoNombre, descripcion: 'Descripcion editada' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.nombre).toBe(nuevoNombre);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-887 - CP-HU9-1-BD - Persistencia edición", async () => {
    const ctx = await createContext();

    try {
      const servicio = await createServicio(ctx, ctx.empresa.id_empresa);
      const nuevoNombre = uniquePhaseName('Servicio Persistido');

      await request(app)
        .put(`/api/servicios/${servicio.id_servicio}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ nombre: nuevoNombre, descripcion: 'Descripcion persistida' })
        .expect(200);

      const dbResult = await pool.query(
        'SELECT nombre, descripcion FROM servicio WHERE id_servicio = $1',
        [servicio.id_servicio]
      );

      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0]).toMatchObject({
        nombre: nuevoNombre,
        descripcion: 'Descripcion persistida'
      });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-890 - CP-HU9-2-BE - Obtención datos edición", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .get(`/api/servicios/${ctx.servicio.id_servicio}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.id_servicio).toBe(ctx.servicio.id_servicio);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-893 - CP-HU9-4-BE - Restricción duplicidad edición", async () => {
    const ctx = await createContext();

    try {
      const servicioUno = await createServicioApi(app, ctx);
      const servicioDos = await createServicioApi(app, ctx);

      const response = await request(app)
        .put(`/api/servicios/${servicioDos.id_servicio}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ nombre: servicioUno.nombre, descripcion: 'Descripcion duplicada' });

      expectFailure(response, 400);
      expect(response.body.message).toMatch(/Ya existe un servicio/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-894 - CP-HU9-4-BD - Restricción UNIQUE actualización", async () => {
    const ctx = await createContext();

    try {
      const servicioUno = await createServicioApi(app, ctx);
      const servicioDos = await createServicioApi(app, ctx);

      await expect(pool.query(
        'UPDATE servicio SET nombre = $1 WHERE id_servicio = $2',
        [servicioUno.nombre, servicioDos.id_servicio]
      )).rejects.toMatchObject({ code: '23505' });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-900 - CP-HU9-8-BE - Servicio inexistente API", async () => {
    const ctx = await createContext();

    try {
      const idInexistente = await unusedId('servicio', 'id_servicio');

      const response = await request(app)
        .get(`/api/servicios/${idInexistente}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send();

      expectFailure(response, 404);
      expect(response.body.message).toMatch(/Servicio no encontrado/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-902 - CP-HU9-9-BE - Restricción edición externa", async () => {
    const ctx = await createContext();
    const ctxExterno = await createContext();

    try {
      const response = await request(app)
        .put(`/api/servicios/${ctxExterno.servicio.id_servicio}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ nombre: uniquePhaseName('Servicio Externo'), descripcion: 'Descripcion externa' });

      expectFailure(response, 403);
      expect(response.body.message).toMatch(/permisos/i);
    } finally {
      await cleanupContext(ctx);
      await cleanupContext(ctxExterno);
    }
  });

  test("TC-904 - CP-HU9-10-BE - Token expirado edición", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .put(`/api/servicios/${ctx.servicio.id_servicio}`)
        .set('Cookie', authCookie(ctx.propietario, '-1h'))
        .send({ nombre: uniquePhaseName('Servicio Token'), descripcion: 'Descripcion token' });

      expectFailure(response, 401);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-906 - CP-HU10-1-BE - Eliminación API exitosa", async () => {
    const ctx = await createContext();

    try {
      const servicio = await createServicio(ctx, ctx.empresa.id_empresa);

      const response = await request(app)
        .put(`/api/servicios/${servicio.id_servicio}/desactivar`)
        .set('Cookie', authCookie(ctx.propietario))
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Servicio eliminado correctamente'
      });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-907 - CP-HU10-1-BD - Validación eliminación", async () => {
    const ctx = await createContext();

    try {
      const servicio = await createServicio(ctx, ctx.empresa.id_empresa);

      await request(app)
        .put(`/api/servicios/${servicio.id_servicio}/desactivar`)
        .set('Cookie', authCookie(ctx.propietario))
        .send()
        .expect(200);

      const dbResult = await pool.query('SELECT is_active FROM servicio WHERE id_servicio = $1', [servicio.id_servicio]);
      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0].is_active).toBe(false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-912 - CP-HU10-4-BE - Eliminación inexistente API", async () => {
    const ctx = await createContext();

    try {
      const idInexistente = await unusedId('servicio', 'id_servicio');

      const response = await request(app)
        .put(`/api/servicios/${idInexistente}/desactivar`)
        .set('Cookie', authCookie(ctx.propietario))
        .send();

      expectFailure(response, 404);
      expect(response.body.message).toMatch(/Servicio no encontrado/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-914 - CP-HU10-5-BE - Restricción eliminación", async () => {
    const ctx = await createContext();

    try {
      const servicio = await createServicio(ctx, ctx.empresa.id_empresa);

      const response = await request(app)
        .put(`/api/servicios/${servicio.id_servicio}/desactivar`)
        .set('Cookie', authCookie(ctx.empleado))
        .send();

      expectFailure(response, 403);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-916 - CP-HU10-6-BE - Restricción eliminación servicio en uso", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .put(`/api/servicios/${ctx.servicio.id_servicio}/desactivar`)
        .set('Cookie', authCookie(ctx.propietario))
        .send();

      expectFailure(response, 400);
      expect(response.body.message).toBe('No se puede eliminar un servicio con proyectos asociados');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-917 - CP-HU10-6-BD - Restricción integridad referencial", async () => {
    const ctx = await createContext();

    try {
      await expect(pool.query(
        'DELETE FROM servicio WHERE id_servicio = $1',
        [ctx.servicio.id_servicio]
      )).rejects.toMatchObject({ code: '23503' });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-921 - CP-HU10-7-BE - Token expirado eliminación", async () => {
    const ctx = await createContext();

    try {
      const servicio = await createServicioApi(app, ctx);

      const response = await request(app)
        .put(`/api/servicios/${servicio.id_servicio}/desactivar`)
        .set('Cookie', authCookie(ctx.propietario, '-1h'))
        .send();

      expectFailure(response, 401);
      expect(responseText(response)).toMatch(/expirada|jwt expired|token/i);
    } finally {
      await cleanupContext(ctx);
    }
  });
});
