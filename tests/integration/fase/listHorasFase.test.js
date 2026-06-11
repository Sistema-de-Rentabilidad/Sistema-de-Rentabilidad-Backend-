const request = require('supertest');
const app = require('../../../src/app');
const { login } = require('../../helpers/auth');
const { crearProyectoTemporal, eliminarProyectoTemporal } = require('../../helpers/proyecto.helper');

jest.setTimeout(20000);

describe('HU24 - Ver horas trabajadas (lider)', () => {
    let authLider;
    let proyecto;

    beforeAll(async () => {
        authLider = await login('qa_lider@test.com', 'Qa123456*');
    });

    test('CP-HU24-1-BE - Obtención horas por fase', async () => {
        // Usamos el id_proyecto: 1 que tiene fases y registros de horas en data.js
        const response = await request(app)
            .get('/api/proyectos/1/fases')
            .set('Cookie', authLider.cookies);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(Array.isArray(response.body.data)).toBe(true);

        // El Proyecto 1 en data.js tiene fases asociadas
        expect(response.body.data.length).toBeGreaterThan(0);

        // Verificamos que al menos una fase tenga horas_trabajadas > 0
        const fasesConHoras = response.body.data.filter(item => Number(item.horas_trabajadas) > 0);
        expect(fasesConHoras.length).toBeGreaterThan(0);

        response.body.data.forEach((item) => {
            expect(item).toHaveProperty('id_fase');
            expect(item).toHaveProperty('nombre');
            expect(item).toHaveProperty('horas_trabajadas');
        });
        
    });

    test('CP-HU24-3-BE - Acceso restringido cuando el usuario no está asignado al proyecto', async () => {
        // Necesitamos un usuario que no esté en el Proyecto 1. 
        // Según data.js, el usuario con id_usuario: 6 (demo_lider) no está en el proyecto 1.
        const authDemo = await login('demo_lider@test.com', 'Qa123456*');

        const response = await request(app)
            .get('/api/proyectos/1/fases')
            .set('Cookie', authDemo.cookies);

        // El resultado esperado según el caso de prueba es 403
        expect(response.status).toBe(403);

    });

});