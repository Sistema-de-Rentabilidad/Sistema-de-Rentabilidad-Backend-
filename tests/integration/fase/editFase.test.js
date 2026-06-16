const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const faseService = require('../../../src/modules/fase/fase.service');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createFase,
    createProyecto
} = require('../../helpers/integration.helper');

jest.setTimeout(20000);

describe('HU37 - Editar fase', () => {
    let ctx = null;

    beforeEach(async () => {
        ctx = await createContext();
    });

    afterEach(async () => {
        if (ctx) {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU37-1-BE - Actualización API fase', async () => {
        const response = await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send({ nombre: 'Fase Actualizada', horas_estimadas: 120 });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.nombre).toBe('Fase Actualizada');
    });

    test('CP-HU37-1-BD - Persistencia actualización fase', async () => {
        await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send({ nombre: 'Fase Persistida', horas_estimadas: 80 });

        const dbResult = await pool.query('SELECT nombre FROM fase WHERE id_fase = $1', [ctx.fase.id_fase]);
        expect(dbResult.rows[0].nombre).toBe('Fase Persistida');
    });

    test('CP-HU37-4-BE - Restricción duplicidad edición', async () => {
        const nombreDuplicado = 'Fase Duplicada QA';
        await createFase(ctx, { idProyecto: ctx.proyecto.id_proyecto, nombre: nombreDuplicado });

        const response = await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send({ nombre: nombreDuplicado });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
    });

    test('CP-HU37-6-BE - Restricción backend edición fases (sin permisos)', async () => {
        const response = await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({ nombre: 'Fase Editada Sin Permiso' });

        expect(response.status).toBe(403);
    });

    test('CP-HU37-7-BE - Restricción edición proyecto finalizado', async () => {
        const proyectoFinalizado = await createProyecto(ctx, { 
            idEmpresa: ctx.empresa.id_empresa, 
            idServicio: ctx.servicio.id_servicio, 
            finalizado: true 
        });
        const faseFinalizada = await createFase(ctx, { idProyecto: proyectoFinalizado.id_proyecto });

        const response = await request(app)
            .put(`/api/fases/${faseFinalizada.id_fase}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send({ nombre: 'Fase Editada' });

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/proyecto.*finalizado|cerrado/i);
    });

    test('CP-HU37-8-BE - Error interno actualización fase', async () => {
        jest.spyOn(faseService, 'updateFase').mockRejectedValueOnce(new Error('Error simulado'));

        const response = await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send({ nombre: 'Fase Actualizada' });

        expect(response.status).toBe(500);
        jest.restoreAllMocks();
    });

    test('CP-HU37-9-BE - Token expirado edición fase', async () => {
        const cookies = tokenCookieForUser(ctx.propietario, '-1h');
        
        const response = await request(app)
            .put(`/api/fases/${ctx.fase.id_fase}`)
            .set('Cookie', cookies)
            .send({ nombre: 'Fase Editada Con Token Expirado' });

        expect(response.status).toBe(401);
    });
});
