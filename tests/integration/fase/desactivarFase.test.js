const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const jwt = require('jsonwebtoken'); // Importamos la librería para generar tokens

const { login } = require('../../helpers/auth');
const { crearFaseTemporal, eliminarFaseTemporal } = require('../../helpers/fase.helper');
const { crearProyectoTemporal, eliminarProyectoTemporal } = require('../../helpers/proyecto.helper');
const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE } = require('../../../src/config/env');
const { ACCESS_TOKEN_COOKIE } = require('../../../src/config/authCookie');

jest.setTimeout(20000);

describe('HU38 - Eliminar fase', () => {

    let fase;
    let auth;

    beforeEach(async () => {
        fase = await crearFaseTemporal();
        auth = await login('qa_propietario@test.com', 'Qa123456*');
    });

    afterEach(async () => {
        if (fase?.id_fase) {
            // In case the test fails before cleanup, ensure it's removed.
            // For logical deletion, we might not always delete, but for a clean state in tests, it's good to ensure actual removal.
            // Depending on the implementation of 'eliminarFaseTemporal', it might be a hard delete.
            await eliminarFaseTemporal(fase.id_fase);
        }
    });

    test('CP-HU38-1-BE - Eliminación lógica fase', async () => {

        const response = await request(app)
            .put(`/api/fases/${fase.id_fase}/desactivar`)
            .set('Cookie', auth.cookies);

        expect(response.status).toBe(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message', 'Fase eliminada correctamente'); // Updated message to match controller
    });

    test('CP-HU38-1-BD - Persistencia eliminación lógica fase', async () => {

        // Perform the logical deletion
        await request(app)
            .put(`/api/fases/${fase.id_fase}/desactivar`)
            .set('Cookie', auth.cookies);

        // Verify directly from the database that the phase is inactive
        const dbResult = await pool.query(
            `
            SELECT is_active
            FROM fase
            WHERE id_fase = $1
            `,
            [fase.id_fase]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].is_active).toBe(false);

    });

    test('CP-HU38-4-BE - Eliminación inexistente API', async () => {

        const nonExistentFaseId = 99999; // An ID that is highly unlikely to exist

        const response = await request(app)
            .put(`/api/fases/${nonExistentFaseId}/desactivar`)
            .set('Cookie', auth.cookies);

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message', 'Fase no encontrada');
    });

    test('CP-HU38-5-BE - Restricción eliminación proyecto finalizado', async () => {
        // 1. Crear proyecto finalizado
        const proyecto = await crearProyectoTemporal({
            fecha_fin_real: '2025-06-01'
        });

        // 2. Asociar la fase al proyecto finalizado
        await pool.query(
            'UPDATE fase SET id_proyecto = $1 WHERE id_fase = $2',
            [proyecto.id_proyecto, fase.id_fase]
        );

        // 3. Intentar desactivar la fase
        const response = await request(app)
            .put(`/api/fases/${fase.id_fase}/desactivar`)
            .set('Cookie', auth.cookies);

        expect(response.status).toBe(400); // O el código de error correspondiente
        expect(response.body).toHaveProperty('success', false);
        // Ajusta el mensaje esperado según la implementación real de la API
        expect(response.body.message).toMatch(/proyecto finalizado/i);

        // Limpieza
        await eliminarProyectoTemporal(proyecto.id_proyecto);
    });

    test('CP-HU38-6-BE - Restricción por permisos: usuario sin privilegios', async () => {
        // Usamos un usuario con un rol diferente a propietario (ej. 'qa_empleado1@test.com')
        const authNoPermisos = await login('qa_empleado1@test.com', 'Qa123456*');

        const response = await request(app)
            .put(`/api/fases/${fase.id_fase}/desactivar`)
            .set('Cookie', authNoPermisos.cookies);

        // El sistema debe denegar la acción (403 Forbidden)
        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
    });

    test('CP-HU38-7-BE - Exclusión registros eliminados', async () => {
        // 1. Desactivar la fase
        await request(app)
            .put(`/api/fases/${fase.id_fase}/desactivar`)
            .set('Cookie', auth.cookies);

        // 2. Consultar el listado de fases del proyecto
        const response = await request(app)
            .get(`/api/proyectos/${fase.id_proyecto}/fases`)
            .set('Cookie', auth.cookies);

        expect(response.status).toBe(200);

        // 3. Verificar que la fase desactivada no está en el listado
        const faseEncontrada = response.body.data.find(f => f.id_fase === fase.id_fase);
        expect(faseEncontrada).toBeUndefined();
    });

    test('CP-HU38-8-BE - Token expirado eliminación fase', async () => {
        // 1. Generar un token firmado con el secreto real, pero con fecha de expiración pasada
        const expiredToken = jwt.sign(
            { id_usuario: auth.id_usuario }, // Payload (el id_usuario es necesario para tu authMiddleware)
            JWT_SECRET,
            {
                expiresIn: '-1h', // Expirado hace una hora
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
                subject: '3'
            }
        );

        // 2. Intentar consumir el endpoint con ese token en la cookie
        const response = await request(app)
            .put(`/api/fases/${fase.id_fase}/desactivar`)
            .set('Cookie', [`${ACCESS_TOKEN_COOKIE}=${expiredToken}`]);

        // 3. Verificar que el servidor responde 401
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toBe('Token inválido o expirado');
    });

});