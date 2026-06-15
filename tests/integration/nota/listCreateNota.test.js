const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createEmpresa,
    createUsuario,
    createProyecto,
    createTracker,
    createNota
} = require('../../helpers/integration.helper');

jest.setTimeout(20000);

describe('HU39 - Gestión de notas', () => {
    test('CP-HU39-1-BE - Obtención de notas por proyecto', async () => {
        const ctx = await createContext();

        try {
            // 1. Crear una nota asociada al proyecto del contexto
            await createNota(ctx, {
                idProyecto: ctx.proyecto.id_proyecto,
                idLider: ctx.lider.id_usuario,
                descripcion: 'Nota de integración'
            });

            const cookies = tokenCookieForUser(ctx.lider);

            // 2. Consumir el endpoint de notas por proyecto
            const response = await request(app)
                .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies);

            // 3. Validar respuesta
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.data[0]).toHaveProperty('descripcion', 'Nota de integración');
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU39-2-BE - Obtención de notas vacía (sin registros)', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.propietario);

            // Consultar notas de un proyecto nuevo que no tiene ninguna nota registrada
            const response = await request(app)
                .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('No hay notas disponibles');
            expect(response.body.data).toEqual([]);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU39-3-BE - Restricción de acceso a notas (usuario sin permisos)', async () => {
        const ctx = await createContext();

        try {
            // Usuario con rol 'empleado' (sin permisos para ver notas)
            const cookies = tokenCookieForUser(ctx.empleado);

            const response = await request(app)
                .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies);

            expect(response.status).toBe(403);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU39-5-BE - Validación proyecto inexistente al consultar notas', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.propietario);
            const idInvalido = 999999;

            const response = await request(app)
                .get(`/api/proyectos/${idInvalido}/notas`)
                .set('Cookie', cookies);

            // Generalmente los sistemas devuelven 404 para recursos inexistentes
            // o 403 si el middleware de verificación de empresa/acceso no encuentra el proyecto.
            expect([403, 404]).toContain(response.status);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU39-6-BE - Filtrado seguro de notas (Acceso denegado a proyecto de otra empresa)', async () => {
        const ctx = await createContext();
        const ctx2 = await createContext();

        try {
            // Intentar acceder a notas de un proyecto de la segunda empresa (ctx2)
            // usando el token de propietario de la primera empresa (ctx)
            const cookies = tokenCookieForUser(ctx.propietario);

            const response = await request(app)
                .get(`/api/proyectos/${ctx2.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies);

            // Debe denegar el acceso porque pertenece a otra empresa
            expect(response.status).toBe(403);
        } finally {
            await cleanupContext(ctx);
            await cleanupContext(ctx2);
        }
    });

    test('CP-HU39-7-BE - Validación token expirado al consultar notas', async () => {
        const ctx = await createContext();

        try {
            // Token expirado para el propietario
            const cookies = tokenCookieForUser(ctx.propietario, '-1h');

            const response = await request(app)
                .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies);

            expect(response.status).toBe(401);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU26-1-BE - Registro API nota exitoso', async () => {
        const ctx = await createContext();

        try {
            // Usuario con rol 'lider' para crear notas
            const cookies = tokenCookieForUser(ctx.lider);
            const nuevaNota = { descripcion: 'Nueva nota de prueba desde API' };

            const response = await request(app)
                .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies)
                .send(nuevaNota);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id_nota');
            expect(response.body.data.descripcion).toBe(nuevaNota.descripcion);

            // Verificación en BD (opcional)
            const dbResult = await pool.query(
                'SELECT * FROM nota WHERE id_nota = $1',
                [response.body.data.id_nota]
            );
            expect(dbResult.rowCount).toBe(1);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU26-2-BE - Validación backend descripción vacía', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.lider);
            const response = await request(app)
                .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies)
                .send({ descripcion: '' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU26-3-BE - Validación longitud máxima descripción', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.lider);
            const descripcionLarga = 'A'.repeat(1001);

            const response = await request(app)
                .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies)
                .send({ descripcion: descripcionLarga });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU26-5-BE - Restricción backend registro notas (sin permisos)', async () => {
        const ctx = await createContext();

        try {
            // Usuario propietario no tiene permiso POST (solo líder)
            const cookies = tokenCookieForUser(ctx.propietario);
            const response = await request(app)
                .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
                .set('Cookie', cookies)
                .send({ descripcion: 'Intento ilegal' });

            expect(response.status).toBe(403);
        } finally {
            await cleanupContext(ctx);
        }
    });

    // test('CP-HU26-6-BE - Restricción registro notas proyecto finalizado', async () => {
    //     const ctx = await createContext({ proyectoFinalizado: true });

    //     try {
    //         const cookies = tokenCookieForUser(ctx.lider);
    //         const response = await request(app)
    //             .post(`/api/proyectos/${ctx.proyecto.id_proyecto}/notas`)
    //             .set('Cookie', cookies)
    //             .send({ descripcion: 'Nota en proyecto finalizado' });

    //         expect(response.status).toBe(403);
    //         expect(response.body.success).toBe(false);
    //         expect(response.body.message).toMatch(/proyecto finalizado|cerrado/i);
    //     } finally {
    //         await cleanupContext(ctx);
    //     }
    // });
});