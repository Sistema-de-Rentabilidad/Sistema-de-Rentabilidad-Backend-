const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createFase,
    createProyecto,
    createUsuario
} = require('../../helpers/integration.helper');

jest.setTimeout(20000);

describe('HU38 - Eliminar fase', () => {
    let ctx = null;

    beforeEach(async () => {
        ctx = await createContext();
    });

    afterEach(async () => {
        if (ctx) {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU38-1-BE - Eliminación lógica fase', async () => {
        const response = await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}/desactivar`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Fase eliminada correctamente');
    });

    test('CP-HU38-1-BD - Persistencia eliminación lógica fase', async () => {
        await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}/desactivar`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        const dbResult = await pool.query('SELECT is_active FROM fase WHERE id_fase = $1', [ctx.fase.id_fase]);

        expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('CP-HU38-4-BE - Eliminación inexistente API', async () => {
        const nonExistentFaseId = 99999;
        const response = await request(app)
            .put(`/api/fases/${nonExistentFaseId}/desactivar`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Fase no encontrada');
    });

    test('CP-HU38-5-BE - Restricción eliminación proyecto finalizado', async () => {
        // Creamos proyecto finalizado usando el contexto (o helper)
        const proyectoFinalizado = await createProyecto(ctx, {
            idEmpresa: ctx.empresa.id_empresa,
            idServicio: ctx.servicio.id_servicio,
            finalizado: true
        });
        const faseTest = await createFase(ctx, { idProyecto: proyectoFinalizado.id_proyecto });

        const response = await request(app)
            .put(`/api/fases/${faseTest.id_fase}/desactivar`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/proyecto.*finalizado|cerrado/i);
    });

    test('CP-HU38-6-BE - Restricción por permisos: usuario sin privilegios', async () => {
        // Creamos usuario empleado (sin rol de líder/propietario)
        const empleado = await createUsuario(ctx, { idEmpresa: ctx.empresa.id_empresa, rol: 'empleado' });
        const response = await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}/desactivar`)
            .set('Cookie', tokenCookieForUser(empleado));

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
    });

    test('CP-HU38-7-BE - Exclusión registros eliminados', async () => {
        // Desactivar la fase actual del contexto
        await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}/desactivar`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        const response = await request(app)
            .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        expect(response.status).toBe(200);
        const faseEncontrada = response.body.data.find(f => f.id_fase === ctx.fase.id_fase);
        expect(faseEncontrada).toBeUndefined();
    });

    test('CP-HU38-8-BE - Token expirado eliminación fase', async () => {
        // Token expirado
        const cookies = tokenCookieForUser(ctx.propietario, '-1h');
        const response = await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}/desactivar`)
            .set('Cookie', cookies);
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
    });
});

