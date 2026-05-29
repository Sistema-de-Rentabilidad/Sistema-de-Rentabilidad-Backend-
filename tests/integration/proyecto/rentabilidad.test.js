const request = require('supertest');
const app = require('../../../src/app');

const { login } = require('../../helpers/auth');

const {
    getRelacionValidaProyecto,
    createRegistroHoras,
    deleteRegistroHorasByDescripcion
} = require('../../helpers/registroHoras.helper');

describe('Rentabilidad proyecto', () => {

    test(
        'CP-HU23-1-BE - API retorna métricas financieras',
        async () => {

            // Login propietario
            const auth = await login(
                'qa_propietario@test.com',
                'Qa123456*'
            );

            // Consumir endpoint
            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            // API OK
            expect(response.status).toBe(200);

            expect(response.body).toHaveProperty(
                'success',
                true
            );

            expect(Array.isArray(response.body.data))
                .toBe(true);

            // Buscar proyecto existente
            const proyecto = response.body.data.find(
                p => p.id_proyecto === 1
            );

            expect(proyecto).toBeDefined();

            // Validar métricas
            expect(proyecto)
                .toHaveProperty('rentabilidad');

            expect(proyecto)
                .toHaveProperty('costo_real');

            expect(
                Number(proyecto.rentabilidad)
            ).not.toBeNaN();

            // Convertir strings NUMERIC
            const presupuesto = Number(
                proyecto.presupuesto
            );

            const costoReal = Number(
                proyecto.costo_real
            );

            const rentabilidad = Number(
                proyecto.rentabilidad
            );

            // Fórmula esperada
            const rentabilidadEsperada =
                presupuesto - costoReal;

            expect(rentabilidad)
                .toBe(rentabilidadEsperada);

        }

    );

    test(
        'CP-HU23-3-BE - empleado no visualiza rentabilidad',
        async () => {

            const auth = await login(
                'qa_empleado1@test.com',
                'Qa123456*'
            );

            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(response.status).toBe(200);

            response.body.data.forEach(proyecto => {

                expect(proyecto)
                    .not
                    .toHaveProperty('rentabilidad');

            });

        }
    );

});

describe('Recalculo automático rentabilidad', () => {

    // Proyecto ACTIVO existente
    const idProyecto = 1;

    beforeEach(async () => {

        // Limpiar registros temporales previos
        await deleteRegistroHorasByDescripcion(
            'QA_TEST_RENTABILIDAD'
        );

    });

    afterEach(async () => {

        // Limpiar registros temporales creados
        await deleteRegistroHorasByDescripcion(
            'QA_TEST_RENTABILIDAD'
        );

    });

    test(
        'CP-HU23-4-BE - rentabilidad se recalcula automáticamente',
        async () => {

            // Login propietario
            const auth = await login(
                'qa_propietario@test.com',
                'Qa123456*'
            );

            /**
             * Obtener:
             * - empleado válido
             * - fase válida
             * para el proyecto
             */
            const relacion =
                await getRelacionValidaProyecto(
                    idProyecto
                );

            /**
             * 1. Obtener rentabilidad inicial
             */
            const responseInicial = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(responseInicial.status)
                .toBe(200);

            const proyectoInicial =
                responseInicial.body.data.find(
                    p => p.id_proyecto === idProyecto
                );

            expect(proyectoInicial)
                .toBeDefined();

            const rentabilidadInicial = Number(
                proyectoInicial.rentabilidad
            );

            /**
             * 2. Insertar nuevo costo
             * mediante registro de horas
             */
            await createRegistroHoras({
                idProyecto,
                idFase: relacion.id_fase,
                idEmpleado: relacion.id_empleado,
                horas: 4,
                descripcion:
                    'QA_TEST_RENTABILIDAD'
            });

            /**
             * 3. Consultar nuevamente
             */
            const responseFinal = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(responseFinal.status)
                .toBe(200);

            const proyectoFinal =
                responseFinal.body.data.find(
                    p => p.id_proyecto === idProyecto
                );

            expect(proyectoFinal)
                .toBeDefined();

            const rentabilidadFinal = Number(
                proyectoFinal.rentabilidad
            );

            /**
             * 4. Validar recalculo
             *
             * Al aumentar costos,
             * la rentabilidad debe disminuir
             */
            expect(rentabilidadFinal)
                .toBeLessThan(
                    rentabilidadInicial
                );

        }

    );

});