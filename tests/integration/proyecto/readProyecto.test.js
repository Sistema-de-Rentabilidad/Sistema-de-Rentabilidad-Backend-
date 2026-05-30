const request = require('supertest');
const app = require('../../../src/app');

const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');

describe('Obtención proyectos asignados líder', () => {

    let auth;
    let idLeader;

    beforeEach(async () => {

        /**
         * Obtener líder QA existente
         */
        const result = await pool.query(
            `
            SELECT id_usuario
            FROM usuario
            WHERE email = $1
            LIMIT 1
            `,
            ['qa_lider@test.com']
        );

        expect(result.rows.length)
            .toBeGreaterThan(0);

        idLeader =
            result.rows[0].id_usuario;

        /**
         * Login líder
         */
        auth = await login(
            'qa_lider@test.com',
            'Qa123456*'
        );

    });

    test(
        'CP-HU34-1-BE - API retorna proyectos asignados al líder',
        async () => {

            /**
             * Consumir endpoint
             */
            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            /**
             * Validar respuesta
             */
            expect(response.status)
                .toBe(200);

            /**
             * Validar estructura
             */
            expect(response.body)
                .toHaveProperty('data');

            expect(
                Array.isArray(
                    response.body.data
                )
            ).toBe(true);

            /**
             * Debe retornar proyectos
             */
            expect(
                response.body.data.length
            ).toBeGreaterThan(0);

            /**
             * Validar proyectos del líder
             */
            response.body.data.forEach(
                proyecto => {

                    expect(proyecto)
                        .toHaveProperty(
                            'id_proyecto'
                        );

                    expect(proyecto)
                        .toHaveProperty(
                            'id_lider'
                        );

                    expect(
                        proyecto.id_lider
                    ).toBe(idLeader);

                }
            );

        }

    );

});

describe('Restricción proyectos otros líderes', () => {

    let auth;
    let idLeader;
    let proyectoExterno;

    beforeEach(async () => {

        /**
         * Obtener líder QA autenticado
         */
        const leaderResult = await pool.query(
            `
            SELECT id_usuario
            FROM usuario
            WHERE email = $1
            LIMIT 1
            `,
            ['qa_lider@test.com']
        );

        expect(
            leaderResult.rows.length
        ).toBeGreaterThan(0);

        idLeader =
            leaderResult.rows[0].id_usuario;

        /**
         * Obtener proyecto de OTRO líder
         */
        const proyectoResult = await pool.query(
            `
            SELECT
                id_proyecto,
                id_lider
            FROM proyecto
            WHERE id_lider <> $1
                AND is_active = true
            LIMIT 1
            `,
            [idLeader]
        );

        expect(
            proyectoResult.rows.length
        ).toBeGreaterThan(0);

        proyectoExterno =
            proyectoResult.rows[0];

        /**
         * Login líder QA
         */
        auth = await login(
            'qa_lider@test.com',
            'Qa123456*'
        );

    }, 15000);

    test(
        'CP-HU34-4-BE - API no retorna proyectos externos',
        async () => {

            /**
             * Consumir endpoint
             */
            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(response.status)
                .toBe(200);

            expect(
                Array.isArray(
                    response.body.data
                )
            ).toBe(true);

            /**
             * Validar que NO exista
             * proyecto de otro líder
             */
            const existeProyectoExterno =
                response.body.data.some(
                    proyecto =>
                        proyecto.id_proyecto ===
                        proyectoExterno.id_proyecto
                );

            expect(
                existeProyectoExterno
            ).toBe(false);

        }

    );

});

describe('Obtención proyectos empleado', () => {

    let auth;

    beforeEach(async () => {

        /**
         * Login empleado (común para todos los tests)
         */
        auth = await login(
            'qa_empleado1@test.com',
            'Qa123456*'
        );

    });

    test(
        'CP-HU28-1-BE - API retorna proyectos asignados al empleado',
        async () => {

            /**
             * Obtener un proyecto asignado al empleado
             */
            const result = await pool.query(
                `
                SELECT p.id_proyecto, p.nombre
                FROM proyecto p
                INNER JOIN proyecto_empleado pe
                    ON pe.id_proyecto = p.id_proyecto
                WHERE pe.id_empleado = $1
                LIMIT 1
                `,
                [auth.user.id_usuario]
            );

            expect(result.rows.length)
                .toBeGreaterThan(0);

            const proyectoBD = result.rows[0];

            /**
             * Consumir endpoint
             */
            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(response.status)
                .toBe(200);

            const proyectosAPI =
                response.body.data || response.body.proyectos || response.body;

            const existe = proyectosAPI.some(
                p => p.id_proyecto === proyectoBD.id_proyecto
            );

            expect(existe)
                .toBe(true);

        }
    );

    test(
        'CP-HU28-5-BE - API retorna solo proyectos asignados al empleado (seguridad)',
        async () => {

            /**
             * Proyectos reales asignados en BD
             */
            const bdResult = await pool.query(
                `
                SELECT p.id_proyecto
                FROM proyecto p
                INNER JOIN proyecto_empleado pe
                    ON pe.id_proyecto = p.id_proyecto
                WHERE pe.id_empleado = $1
                `,
                [auth.user.id_usuario]
            );

            const proyectosBD = bdResult.rows;

            /**
             * Consumir endpoint
             */
            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(response.status)
                .toBe(200);

            const proyectosAPI =
                response.body.data || response.body.proyectos || response.body;

            expect(Array.isArray(proyectosAPI))
                .toBe(true);

            const idsBD = proyectosBD.map(p => p.id_proyecto);
            const idsAPI = proyectosAPI.map(p => p.id_proyecto);

            /**
             * Solo debe contener proyectos asignados
             */
            idsAPI.forEach(id => {
                expect(idsBD).toContain(id);
            });

            /**
             * No debe haber extras
             */
            expect(idsAPI.length)
                .toBe(idsBD.length);

        }
    );

});
