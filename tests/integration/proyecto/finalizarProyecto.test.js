const request = require('supertest');
const app = require('../../../src/app');

const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');

const {
    crearProyectoTemporal,
    eliminarProyectoTemporal
} = require('../../helpers/proyecto.helper');

describe('Actualización fecha finalización', () => {

    let auth;
    let proyecto;

    beforeEach(async () => {

        /**
         * Login lider
         */
        auth = await login(
            'qa_lider@test.com',
            'Qa123456*'
        );

        // Crear proyecto temporal ACTIVO
        proyecto = await crearProyectoTemporal();

    });

    afterEach(async () => {

        // Eliminar proyecto temporal
        await eliminarProyectoTemporal(
            proyecto.id_proyecto
        );

    });

    test(
        'CP-HU33-1-BE - API registra fecha actual',
        async () => {

            /**
             * Fecha previa
             */
            const fechaAntes =
                new Date();

            /**
             * Consumir endpoint finalizar
             */
            const response = await request(app)
                .patch(
                    `/api/proyectos/${proyecto.id_proyecto}/finalizar`
                )
                .set('Cookie', auth.cookies);

            /**
             * Validar respuesta
             */
            expect(response.status)
                .toBe(200);

            /**
             * Consultar proyecto actualizado
             */
            const result = await pool.query(
                `
                SELECT fecha_fin_real
                FROM proyecto
                WHERE id_proyecto = $1
                `,
                [proyecto.id_proyecto]
            );

            expect(
                result.rows.length
            ).toBeGreaterThan(0);

            /**
             * Validar fecha registrada
             */
            const fechaFinalizacion =
                new Date(
                    result.rows[0]
                        .fecha_fin_real
                );

            expect(
                result.rows[0]
                    .fecha_fin_real
            ).not.toBeNull();

            /**
             * Debe ser fecha actual
             * (tolerancia 5 segundos)
             */
            const diferenciaMs =
                Math.abs(
                    fechaFinalizacion -
                    fechaAntes
                );

            expect(diferenciaMs)
                .toBeLessThan(5000);

        }

    );

});

describe('Validación: proyecto ya finalizado/proyecto inexistente al finalizar', () => {

    let auth;

    beforeEach(async () => {

        /**
         * Login lider
         */
        auth = await login(
            'qa_lider@test.com',
            'Qa123456*'
        );

    });

    test(
        'CP-HU33-3-BE - API rechaza finalizar proyecto ya cerrado',
        async () => {

            /**
             * Buscar proyecto FINALIZADO del líder logueado
             */
            const result = await pool.query(
                `
            SELECT id_proyecto, fecha_fin_real
            FROM proyecto
            WHERE id_lider = $1
              AND fecha_fin_real IS NOT NULL
            LIMIT 1
            `,
                [auth.user.id_usuario]
            );

            expect(result.rows.length)
                .toBeGreaterThan(0);

            const proyecto = result.rows[0];

            /**
             * Intentar finalizar nuevamente
             */
            const response = await request(app)
                .put(`/api/proyectos/${proyecto.id_proyecto}/finalizar`)
                .set('Cookie', auth.cookies);

            /**
             * Debe rechazar la operación
             */
            expect(
                [400, 409]
            ).toContain(response.status);

            /**
             * Validar que NO se modificó la fecha_fin_real
             */
            const check = await pool.query(
                `
            SELECT fecha_fin_real
            FROM proyecto
            WHERE id_proyecto = $1
            `,
                [proyecto.id_proyecto]
            );

            expect(check.rows.length)
                .toBe(1);

            /**
             * Debe seguir finalizado (no debe cambiar)
             */
            expect(
                new Date(check.rows[0].fecha_fin_real).getTime()
            ).toBe(
                new Date(proyecto.fecha_fin_real).getTime()
            );

        },
        10000
    );

    test(
        'CP-HU33-5-BE - API retorna 404 si el proyecto no existe',
        async () => {

            /**
             * ID inexistente
             */
            const idInexistente = 999999;

            /**
             * Consumir endpoint finalizar
             */
            const response = await request(app)
                .put(`/api/proyectos/${idInexistente}/finalizar`)
                .set('Cookie', auth.cookies);

            /**
             * Validar respuesta
             * (recurso no existe)
             */
            expect(response.status)
                .toBe(404);

            /**
             * Opcional: validar mensaje de error
             */
            expect(response.body)
                .toHaveProperty('message');

        }

    );

});

describe('Seguridad: líder no asignado', () => {

    let auth;
    let proyecto;

    beforeEach(async () => {

        auth = await login(
            'demo_lider@test.com',
            'Qa123456*'
        );

        /**
         * Buscar proyecto que NO pertenezca al usuario
         */
        const result = await pool.query(
            `
            SELECT id_proyecto, fecha_fin_real
            FROM proyecto
            WHERE id_lider IS DISTINCT FROM $1
            LIMIT 1
            `,
            [auth.user.id]
        );

        proyecto = result.rows[0];

    });

    test(
        'CP-HU33-6-BE - API rechaza finalizar si no es líder del proyecto',
        async () => {

            const response = await request(app)
                .put(`/api/proyectos/${proyecto.id_proyecto}/finalizar`)
                .set('Cookie', auth.cookies);

            /**
             * Seguridad: debe rechazar acceso
             */
            expect(response.status)
                .toBe(403);

            /**
             * Validar que no se modificó el proyecto
             */
            const check = await pool.query(
                `
                SELECT fecha_fin_real
                FROM proyecto
                WHERE id_proyecto = $1
                `,
                [proyecto.id_proyecto]
            );

            expect(check.rows.length)
                .toBe(1);

            /**
             * No debe haberse alterado la fecha de cierre
             */
            expect(check.rows[0].fecha_fin_real)
                .toBe(proyecto.fecha_fin_real);

        }

    );

});