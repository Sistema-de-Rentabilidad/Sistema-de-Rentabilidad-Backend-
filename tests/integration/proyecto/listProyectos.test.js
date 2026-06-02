const request = require('supertest');
const app = require('../../../src/app');

const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');
const {
    crearUsuarioTemporal,
    eliminarUsuarioTemporal
} = require('../../helpers/usuario.helper');

jest.setTimeout(20000);

describe('Obtención proyectos por empresa', () => {

    let auth;
    let usuarioTemporal;

    beforeEach(async () => {
        auth = await login(
            'qa_propietario@test.com',
            'Qa123456*'
        );
    });

    afterEach(async () => {
        if (usuarioTemporal) {
            await eliminarUsuarioTemporal(usuarioTemporal.id_usuario);
            usuarioTemporal = null;
        }
    });

    test(
        'CP-HU17-1-BE - API retorna proyectos de la empresa',
        async () => {

            /**
             * Proyectos activos de la empresa del propietario
             */
            const bdResult = await pool.query(
                `
                SELECT id_proyecto
                FROM proyecto
                WHERE id_empresa = $1
                    AND is_active = true
                ORDER BY fecha_inicio DESC
                `,
                [auth.user.id_empresa]
            );

            expect(bdResult.rows.length)
                .toBeGreaterThan(0);

            /**
             * Consumir endpoint
             */
            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(response.status)
                .toBe(200);

            expect(response.body)
                .toHaveProperty('success', true);

            expect(response.body)
                .toHaveProperty('data');

            expect(Array.isArray(response.body.data))
                .toBe(true);

            expect(response.body.data.length)
                .toBeGreaterThan(0);

            const idsBD = bdResult.rows.map(
                proyecto => proyecto.id_proyecto
            );

            const idsAPI = response.body.data.map(
                proyecto => proyecto.id_proyecto
            );

            idsAPI.forEach(id => {
                expect(idsBD).toContain(id);
            });

            expect(idsAPI.length)
                .toBe(idsBD.length);

        }
    );

    test(
        'CP-HU17-3-BE - API retorna arreglo vacío cuando no existen proyectos',
        async () => {

            usuarioTemporal = await crearUsuarioTemporal({
                rol: 'propietario'
            });

            const proyectosEmpresa = await pool.query(
                `
                SELECT id_proyecto
                FROM proyecto
                WHERE id_empresa = $1
                    AND is_active = true
                `,
                [usuarioTemporal.id_empresa]
            );

            expect(proyectosEmpresa.rowCount)
                .toBe(0);

            const authTemporal = await login(
                usuarioTemporal.email,
                usuarioTemporal.passwordPlano
            );

            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', authTemporal.cookies);

            expect(response.status)
                .toBe(200);

            expect(response.body)
                .toHaveProperty('success', true);

            expect(response.body)
                .toHaveProperty('message');

            expect(response.body.message)
                .toMatch(/no hay proyectos disponibles/i);

            expect(response.body)
                .toHaveProperty('data');

            expect(response.body.data)
                .toEqual([]);

        }
    );

    test(
        'CP-HU17-5-BE - API no retorna proyectos externos de otra empresa',
        async () => {

            const proyectosExternos = await pool.query(
                `
                SELECT id_proyecto
                FROM proyecto
                WHERE id_empresa <> $1
                    AND is_active = true
                `,
                [auth.user.id_empresa]
            );

            expect(proyectosExternos.rowCount)
                .toBeGreaterThan(0);

            const proyectosEmpresa = await pool.query(
                `
                SELECT id_proyecto
                FROM proyecto
                WHERE id_empresa = $1
                    AND is_active = true
                `,
                [auth.user.id_empresa]
            );

            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(response.status)
                .toBe(200);

            expect(response.body)
                .toHaveProperty('success', true);

            expect(response.body)
                .toHaveProperty('data');

            expect(Array.isArray(response.body.data))
                .toBe(true);

            const idsExternos = proyectosExternos.rows.map(
                proyecto => proyecto.id_proyecto
            );

            const idsEmpresa = proyectosEmpresa.rows.map(
                proyecto => proyecto.id_proyecto
            );

            const idsAPI = response.body.data.map(
                proyecto => proyecto.id_proyecto
            );

            idsExternos.forEach(id => {
                expect(idsAPI).not.toContain(id);
            });

            idsAPI.forEach(id => {
                expect(idsEmpresa).toContain(id);
            });

        }
    );

});

describe('Restricción backend módulo proyectos', () => {

    test(
        'CP-HU17-2-BE - API responde 403 para usuario sin permiso en proyectos',
        async () => {

            const auth = await login(
                'qa_admin@test.com',
                'Qa123456*'
            );

            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', auth.cookies);

            expect(response.status)
                .toBe(403);

            expect(response.body)
                .toHaveProperty('success', false);

            expect(response.body)
                .toHaveProperty('message');

            expect(response.body.message)
                .toMatch(/permisos|acción/i);

        }
    );

});

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
