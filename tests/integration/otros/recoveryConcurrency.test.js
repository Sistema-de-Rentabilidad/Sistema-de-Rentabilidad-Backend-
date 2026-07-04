const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const jwt = require('jsonwebtoken');

const { JWT_SECRET } = require('../../../src/config/env');
const {
  cleanupContext,
  createContext,
  createMarcaje,
  tokenCookieForUser
} = require('../../helpers/integration.helper');

jest.setTimeout(40000);

const authFor = (user) => ({ cookies: tokenCookieForUser(user) });

describe('Recovery y Concurrency', () => {

  // test("CP-NF10 - Recuperación ante caída del backend", async () => {
  //   const response = await request(app).get('/health');
  //   const serializedBody = JSON.stringify(response.body);

  //   expect(response.status).toBe(200);
  //   expect(response.body).toMatchObject({
  //     success: true,
  //     status: 'ok',
  //     database: 'ok'
  //   });
  //   expect(serializedBody).not.toMatch(/DATABASE_URL|password|postgres:\/\/|supabase\.co|pooler/i);
  // });

  test("CP-NF11 - Edición simultánea de proyectos", async () => {
    // 1. Crear un proyecto temporal para la prueba
    const ctx = await createContext();
    const proyectoId = ctx.proyecto.id_proyecto;
    const auth = authFor(ctx.propietario);

    try {
      // 2. Ejecutar múltiples peticiones de actualización simultáneamente
      const updateData1 = { nombre: 'Nombre Simultáneo 1' };
      const updateData2 = { nombre: 'Nombre Simultáneo 2' };

      const [res1, res2] = await Promise.all([
        request(app).put(`/api/proyectos/${proyectoId}`).set('Cookie', auth.cookies).send(updateData1),
        request(app).put(`/api/proyectos/${proyectoId}`).set('Cookie', auth.cookies).send(updateData2)
      ]);

      // 3. Verificar que ambas peticiones se procesaron sin errores (aunque una sobrescriba a la otra)
      expect([200]).toContain(res1.status);
      expect([200]).toContain(res2.status);

      // 4. Verificar consistencia: La base de datos debe reflejar uno de los dos nombres
      const result = await pool.query('SELECT nombre FROM proyecto WHERE id_proyecto = $1', [proyectoId]);
      const nombreFinal = result.rows[0].nombre;

      expect(['Nombre Simultáneo 1', 'Nombre Simultáneo 2']).toContain(nombreFinal);
    } finally {
      await cleanupContext(ctx);
    }
  });
});
