const request = require('supertest');
const app = require('../../../src/app');

const { login } = require('../../helpers/auth');

describe('Restricción nombre duplicado', () => {

    test('CP-HU18-8-BE - API rechaza proyecto duplicado', async () => {

        const auth = await login(
            'qa_propietario@test.com',
            'Qa123456*'
        );

        // Intentar crear proyecto con nombre YA existente
        const response = await request(app)
            .post('/api/proyectos')
            .set('Cookie', auth.cookies)
            .send({
                id_empresa: 1,
                id_servicio: 1,
                id_lider: 3,
                nombre: 'Proyecto Alpha', // <- ya existe en BD
                descripcion: 'Sistema de control de rentabilidad',
                presupuesto: 12000,
                fecha_inicio: '2025-04-01',
                fecha_fin_estimada: '2025-07-01',
                margen: 18
            });

        // Validar rechazo
        expect(response.status).toBe(400);

        expect(response.body).toHaveProperty('success', false);

        // mensaje opcional
        expect(response.body.message);
    });

});