const request = require('supertest');
const app = require('../../../src/app');

const pool = require('../../../src/config/db');

const proyectoService = require('../../../src/modules/proyecto/proyecto.service');

const { login } = require('../../helpers/auth');

const { crearProyectoTemporal } = require('../../helpers/proyecto.helper');

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

describe('Restricción UNIQUE nombre proyecto', () => {

    test('CP-HU18-8-BD - BD rechaza nombre duplicado', async () => {

        await expect(

            pool.query(
                `
                INSERT INTO proyecto (
                    id_empresa,
                    id_servicio,
                    id_lider,
                    nombre,
                    descripcion,
                    presupuesto,
                    fecha_inicio,
                    fecha_fin_estimada,
                    margen,
                    is_active
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true)
                `,
                [
                    1,
                    1,
                    3,
                    'Proyecto Alpha', // ya existe
                    'Duplicado',
                    1000,
                    '2025-01-01',
                    '2025-06-01',
                    20
                ]
            )

        ).rejects.toMatchObject({
            code: '23505'
        });

    });

});

describe('Registro de proyecto - manejo de errores internos', () => {

    let auth;

    beforeEach(async () => {

        /**
         * Login necesario (req.empresaId viene del auth)
         */
        auth = await login(
            'qa_propietario@test.com',
            'Qa123456*'
        );

    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test(
        'CP-HU18-15-BE - API retorna error controlado ante excepción interna',
        async () => {

            /**
             * Mock del service (fallo interno)
             */
            jest.spyOn(proyectoService, 'createProyecto')
                .mockRejectedValue(new Error('DB crash simulado'));

            /**
             * Consumir endpoint real
             */
            const response = await request(app)
                .post('/api/proyectos')
                .set('Cookie', auth.cookies)
                .send({
                    id_empresa: 1,
                    id_servicio: 1,
                    id_lider: 3,
                    nombre: `Proyecto QA ${Date.now()}`,
                    descripcion: 'Proyecto temporal testing',
                    presupuesto: 1000,
                    fecha_inicio: '2025-01-01',
                    fecha_fin_estimada: '2025-12-31',
                    margen: 20,
                });

            /**
             * Debe devolver error controlado
             */
            expect(
                [500, 503]
            ).toContain(response.status);

            expect(response.body)
                .toHaveProperty('message');

        }

    );

});