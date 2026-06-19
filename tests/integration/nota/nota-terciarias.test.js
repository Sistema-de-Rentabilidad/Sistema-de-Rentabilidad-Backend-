const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const notaService = require('../../../src/modules/nota/nota.service');
const {
  cleanupContext,
  createContext,
  createNota,
  createUsuario
} = require('../../helpers/integration.helper');
const {
  authCookie,
  expectFailure,
  responseText,
  unusedId
} = require('../../helpers/testinyTerciarias.helper');

jest.setTimeout(60000);

describe('Testiny terciarias - Notas', () => {
  test("TC-1033 - CP-HU26-7-BE - Manejo error interno registro nota", async () => {
    const ctx = await createContext();

    try {
      jest.spyOn(notaService, 'createNota').mockRejectedValueOnce(new Error('Error simulado'));

      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
        .set('Cookie', authCookie(ctx.lider))
        .send({ descripcion: 'Nota con error interno' });

      expectFailure(response, 500);
      expect(response.body.message).toBe('Error interno del servidor');
    } finally {
      jest.restoreAllMocks();
      await cleanupContext(ctx);
    }
  });

  test("TC-1035 - CP-HU26-8-BE - Validación token expirado registro nota", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
        .set('Cookie', authCookie(ctx.lider, '-1h'))
        .send({ descripcion: 'Nota token expirado' });

      expectFailure(response, 401);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1037 - CP-HU26-9-BE - Validación trim descripción", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
        .set('Cookie', authCookie(ctx.lider))
        .send({ descripcion: '  Nota trim descripcion  ' });

      expect(response.status).toBe(201);
      ctx.ids.notas.push(response.body.data.id_nota);
      expect(response.body.data.descripcion).toBe('Nota trim descripcion');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1039 - CP-HU32-1-BE - Actualización API nota", async () => {
    const ctx = await createContext();

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario,
        descripcion: 'Nota original'
      });

      const response = await request(app)
        .put(`/api/notas/${nota.id_nota}`)
        .set('Cookie', authCookie(ctx.lider))
        .send({ descripcion: 'Nota actualizada API' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data.descripcion).toBe('Nota actualizada API');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1040 - CP-HU32-1-BD - Persistencia edición nota", async () => {
    const ctx = await createContext();

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario,
        descripcion: 'Nota persistencia original'
      });

      await request(app)
        .put(`/api/notas/${nota.id_nota}`)
        .set('Cookie', authCookie(ctx.lider))
        .send({ descripcion: 'Nota persistencia editada' })
        .expect(200);

      const dbResult = await pool.query('SELECT descripcion FROM nota WHERE id_nota = $1', [nota.id_nota]);
      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0].descripcion).toBe('Nota persistencia editada');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1046 - CP-HU32-5-BE - Validación nota inexistente", async () => {
    const ctx = await createContext();

    try {
      const idInexistente = await unusedId('nota', 'id_nota');

      const response = await request(app)
        .put(`/api/notas/${idInexistente}`)
        .set('Cookie', authCookie(ctx.lider))
        .send({ descripcion: 'Nota inexistente' });

      expectFailure(response, 404);
      expect(response.body.message).toMatch(/Nota no encontrada/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1049 - CP-HU32-7-BE - Restricción edición proyecto finalizado", async () => {
    const ctx = await createContext({ proyectoFinalizado: true });

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario,
        descripcion: 'Nota proyecto finalizado'
      });

      const response = await request(app)
        .put(`/api/notas/${nota.id_nota}`)
        .set('Cookie', authCookie(ctx.lider))
        .send({ descripcion: 'Intento editar finalizado' });

      expectFailure(response, 400);
      expect(response.body.message).toBe('No se pueden editar notas de un proyecto finalizado');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1051 - CP-HU32-8-BE - Token expirado edición nota", async () => {
    const ctx = await createContext();

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario
      });

      const response = await request(app)
        .put(`/api/notas/${nota.id_nota}`)
        .set('Cookie', authCookie(ctx.lider, '-1h'))
        .send({ descripcion: 'Nota token expirado' });

      expectFailure(response, 401);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1053 - CP-HU32-9-BE - Validación trim edición nota", async () => {
    const ctx = await createContext();

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario,
        descripcion: 'Nota trim original'
      });

      const response = await request(app)
        .put(`/api/notas/${nota.id_nota}`)
        .set('Cookie', authCookie(ctx.lider))
        .send({ descripcion: '  Nota trim editada  ' });

      expect(response.status).toBe(200);
      expect(response.body.data.descripcion).toBe('Nota trim editada');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1055 - CP-HU40-1-BE - Eliminación lógica API nota", async () => {
    const ctx = await createContext();

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario
      });

      const response = await request(app)
        .put(`/api/notas/${nota.id_nota}/desactivar`)
        .set('Cookie', authCookie(ctx.lider))
        .send();

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        message: 'Nota eliminada correctamente'
      });
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1056 - CP-HU40-1-BD - Persistencia eliminación lógica nota", async () => {
    const ctx = await createContext();

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario
      });

      await request(app)
        .put(`/api/notas/${nota.id_nota}/desactivar`)
        .set('Cookie', authCookie(ctx.lider))
        .send()
        .expect(200);

      const dbResult = await pool.query('SELECT is_active FROM nota WHERE id_nota = $1', [nota.id_nota]);
      expect(dbResult.rowCount).toBe(1);
      expect(dbResult.rows[0].is_active).toBe(false);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1061 - CP-HU40-4-BE - Validación backend nota inexistente", async () => {
    const ctx = await createContext();

    try {
      const idInexistente = await unusedId('nota', 'id_nota');

      const response = await request(app)
        .put(`/api/notas/${idInexistente}/desactivar`)
        .set('Cookie', authCookie(ctx.lider))
        .send();

      expectFailure(response, 404);
      expect(response.body.message).toMatch(/Nota no encontrada/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1063 - CP-HU40-5-BE - Restricción backend eliminación notas", async () => {
    const ctx = await createContext();

    try {
      const otroLider = await createUsuario(ctx, {
        idEmpresa: ctx.empresa.id_empresa,
        rol: 'lider'
      });
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario
      });

      const response = await request(app)
        .put(`/api/notas/${nota.id_nota}/desactivar`)
        .set('Cookie', authCookie(otroLider))
        .send();

      expectFailure(response, 403);
      expect(response.body.message).toMatch(/propias/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1065 - CP-HU40-6-BE - Restricción eliminación proyecto finalizado", async () => {
    const ctx = await createContext({ proyectoFinalizado: true });

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario,
        descripcion: 'Nota finalizada eliminar'
      });

      const response = await request(app)
        .put(`/api/notas/${nota.id_nota}/desactivar`)
        .set('Cookie', authCookie(ctx.lider))
        .send();

      expectFailure(response, 400);
      expect(response.body.message).toBe('No se pueden eliminar notas de un proyecto finalizado');
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1069 - CP-HU40-7-BE - Token expirado eliminación nota", async () => {
    const ctx = await createContext();

    try {
      const nota = await createNota(ctx, {
        idProyecto: ctx.proyecto.id_proyecto,
        idLider: ctx.lider.id_usuario
      });

      const response = await request(app)
        .put(`/api/notas/${nota.id_nota}/desactivar`)
        .set('Cookie', authCookie(ctx.lider, '-1h'))
        .send();

      expectFailure(response, 401);
      expect(responseText(response)).toMatch(/expirada|jwt expired|token/i);
    } finally {
      await cleanupContext(ctx);
    }
  });
});
