const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');
const { crearFaseTemporal, eliminarFaseTemporal } = require('../../helpers/fase.helper');

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

        // Verify in the database that the phase is logically deactivated
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

});