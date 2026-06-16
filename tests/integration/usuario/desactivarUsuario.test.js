const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser
} = require('../../helpers/integration.helper');

jest.setTimeout(20000);

describe('HU15 - Desactivacion de usuario', () => {

    let ctx;
    let authCookies;

    beforeEach(async () => {
        // Creamos contexto sin asignar empleado a proyectos por defecto
        ctx = await createContext({ asignarEmpleado: false });
        authCookies = tokenCookieForUser(ctx.propietario);
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU15-1-BE - Eliminación lógica usuario', async () => {
        const response = await request(app)
            .put(`/api/usuarios/${ctx.empleado.id_usuario}/desactivar`)
            .set('Cookie', authCookies);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('is_active', false);

        const dbResult = await pool.query(
            `SELECT is_active FROM usuario WHERE id_usuario = $1`,
            [ctx.empleado.id_usuario]
        );

        expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('CP-HU15-1-BD - Persistencia eliminación lógica', async () => {
        await request(app)
            .put(`/api/usuarios/${ctx.empleado.id_usuario}/desactivar`)
            .set('Cookie', authCookies);

        const dbResult = await pool.query(
            `SELECT is_active FROM usuario WHERE id_usuario = $1`,
            [ctx.empleado.id_usuario]
        );

        expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('CP-HU15-4-BE - Eliminación usuario inexistente', async () => {
        const invalidUsuarioId = 99999;

        const response = await request(app)
            .put(`/api/usuarios/${invalidUsuarioId}/desactivar`)
            .set('Cookie', authCookies);

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
    });

    test('CP-HU15-5-BE - Restricción permisos eliminación', async () => {
        const authEmpleado = tokenCookieForUser(ctx.empleado);

        const response = await request(app)
            .put(`/api/usuarios/${ctx.empleado.id_usuario}/desactivar`)
            .set('Cookie', authEmpleado);

        expect(response.status).toBe(403);
    });

    test('CP-HU15-6-BE - Restricción usuario con proyectos', async () => {
        // Asignamos manualmente al empleado a un proyecto para tener proyectos activos
        const { assignEmpleado } = require('../../helpers/integration.helper');
        await assignEmpleado(ctx.proyecto.id_proyecto, ctx.empleado.id_usuario);

        const response = await request(app)
            .put(`/api/usuarios/${ctx.empleado.id_usuario}/desactivar`)
            .set('Cookie', authCookies);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
    });

    test('CP-HU15-6-BD - Restricción integridad referencial usuario', async () => {
        // Necesitamos crear un registro para impedir la eliminación física
        const { createRegistroHoras } = require('../../helpers/integration.helper');
        await createRegistroHoras(ctx, { 
            idProyecto: ctx.proyecto.id_proyecto, 
            idFase: ctx.fase.id_fase, 
            idEmpleado: ctx.empleado.id_usuario 
        });

        await expect(
            pool.query(
                `DELETE FROM usuario WHERE id_usuario = $1`,
                [ctx.empleado.id_usuario]
            )
        ).rejects.toThrow();
    });

    test('CP-HU15-7-BE - Restricción autoeliminación', async () => {
        const response = await request(app)
            .put(`/api/usuarios/${ctx.propietario.id_usuario}/desactivar`)
            .set('Cookie', authCookies);

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/propio|No puedes eliminar tu propio usuario/i);
    });

});

