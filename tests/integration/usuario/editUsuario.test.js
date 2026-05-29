const request = require('supertest');
const app = require('../../../src/app');

const { login } = require('../../helpers/auth');

const {
    crearUsuarioTemporal,
    eliminarUsuarioTemporal
} = require('../../helpers/usuario.helper');

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

    let usuario;

    beforeEach(async () => {

        // Crear usuario temporal
        usuario = await crearUsuarioTemporal();

    });

    afterEach(async () => {

        // Eliminar usuario temporal
        await eliminarUsuarioTemporal(
            usuario.id_usuario
        );

    });

    test('CP-HU2-7-BE - API actualiza password', async () => {

        // Login con usuario temporal
        const auth = await login(
            usuario.email,
            usuario.passwordPlano
        );

        // Nueva contraseña
        const nuevaPassword = 'NuevaPassword123*';

        // Actualizar contraseña
        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', auth.cookies)
            .send({
                password: nuevaPassword
            });

        // API OK
        expect(response.status).toBe(200);

        expect(response.body).toHaveProperty(
            'success',
            true
        );

        expect(response.body).toHaveProperty('data');

        // Verificar login con nueva password
        const nuevoLogin = await login(
            usuario.email,
            nuevaPassword
        );

        expect(nuevoLogin).toHaveProperty('cookies');

    });

});