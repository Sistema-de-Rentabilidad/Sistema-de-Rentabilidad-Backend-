const request = require('supertest');
const app = require('../../../src/app');

const { login } = require('../../helpers/auth');

describe('Restricción correo duplicado', () => {

    test('CP-HU2-5-BE - debe responder 409 cuando el email ya existe', async () => {

        const auth = await login(
            'qa_admin@test.com',
            'Qa123456*'
        );

        // Intentar actualizar con email ya existente
        const response = await request(app)
            .put('/api/usuarios/1')
            .set('Cookie', auth.cookies)
            .send({
                email: 'qa_empleado1@test.com'
            });

        expect(response.status).toBe(409);

        expect(response.body.message)
            .toMatch(/email.*registrado/i);
    });

});

describe('Actualización password API', () => {

    test('CP-HU2-7-BE - API actualiza password', async () => {

        const auth = await login(
            'demo_propietario@test.com',
            'Qa123456*'
        );

        // Actualizar contraseña
        const response = await request(app)
            .put('/api/usuarios/6')
            .set('Cookie', auth.cookies)
            .send({
                password: 'NuevaPassword123*'
            });

        expect(response.status).toBe(200);

        expect(response.body).toHaveProperty('success', true);

        expect(response.body).toHaveProperty('data');

    });

});