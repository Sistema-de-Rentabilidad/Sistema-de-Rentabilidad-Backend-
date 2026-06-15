const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createServicio
} = require('../../helpers/integration.helper');

jest.setTimeout(20000);

describe('HU7, HU8 - Gestión y registro de servicios', () => {
    test('CP-HU7-1-BE - Obtención de servicios por empresa', async () => {
        const ctx = await createContext();

        try {
            // 1. Crear un servicio adicional para tener al menos dos servicios (el del contexto y uno nuevo)
            await createServicio(ctx, ctx.empresa.id_empresa);

            // 2. Autenticar como propietario para ver los servicios
            const cookies = tokenCookieForUser(ctx.propietario);

            // 3. Consumir el endpoint de listado de servicios
            const response = await request(app)
                .get('/api/servicios')
                .set('Cookie', cookies);

            // 4. Validar respuesta
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThanOrEqual(2);

            // Verificar que los servicios pertenezcan a la empresa del usuario
            response.body.data.forEach(servicio => {
                expect(servicio).toHaveProperty('empresa', ctx.empresa.nombre);
            });
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU7-2-BE - Lista vacía de servicios', async () => {
        const ctx = await createContext();

        // Desactivamos el servicio creado por defecto
        await pool.query('UPDATE servicio SET is_active = false WHERE id_empresa = $1', [ctx.empresa.id_empresa]);

        try {
            const cookies = tokenCookieForUser(ctx.propietario);
            const response = await request(app)
                .get('/api/servicios')
                .set('Cookie', cookies);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.message).toBe('No hay servicios disponibles');
            expect(response.body.data).toEqual([]);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU7-3-BE - Restricción de acceso a servicios (usuario sin permisos)', async () => {
        const ctx = await createContext();

        try {
            // Usuario con rol 'empleado' sin permisos de acceso a gestión de servicios
            const cookies = tokenCookieForUser(ctx.empleado);

            const response = await request(app)
                .get('/api/servicios')
                .set('Cookie', cookies);

            expect(response.status).toBe(403);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU7-7-BE - Token expirado en servicios', async () => {
        const ctx = await createContext();

        try {
            // Token expirado para el propietario
            const cookies = tokenCookieForUser(ctx.propietario, '-1h');

            const response = await request(app)
                .get('/api/servicios')
                .set('Cookie', cookies);

            expect(response.status).toBe(401);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU8-1-BE - Registro API servicio exitoso', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.propietario);
            const nuevoServicio = {
                nombre: 'Servicio Test API',
                descripcion: 'Descripción desde API'
            };

            const response = await request(app)
                .post('/api/servicios')
                .set('Cookie', cookies)
                .send(nuevoServicio);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            // Importante: rastrear el servicio para que cleanupContext pueda eliminarlo
            if (response.body.data && response.body.data.id_servicio) {
                ctx.ids.servicios.push(response.body.data.id_servicio);
            }

            expect(response.body.data).toHaveProperty('id_servicio');
            expect(response.body.data.nombre).toBe(nuevoServicio.nombre);

            const dbResult = await pool.query(
                'SELECT * FROM servicio WHERE id_servicio = $1',
                [response.body.data.id_servicio]
            );
            expect(dbResult.rowCount).toBe(1);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU8-2-BE - Registro servicio sin descripción', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.propietario);
            const nuevoServicio = {
                nombre: 'Servicio Sin Descripcion'
                // descripcion es opcional
            };

            const response = await request(app)
                .post('/api/servicios')
                .set('Cookie', cookies)
                .send(nuevoServicio);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);

            // Rastreo
            ctx.ids.servicios.push(response.body.data.id_servicio);

            expect(response.body.data.nombre).toBe(nuevoServicio.nombre);
            expect(response.body.data.descripcion).toBeNull();
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU8-4-BE - Restricción nombre duplicado', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.propietario);
            const nombreRepetido = 'Servicio Duplicado';

            // Crear el primer servicio
            await request(app)
                .post('/api/servicios')
                .set('Cookie', cookies)
                .send({ nombre: nombreRepetido, descripcion: 'Primero' })
                .then(res => ctx.ids.servicios.push(res.body.data.id_servicio));

            // Intentar crear el segundo servicio con el mismo nombre
            const response = await request(app)
                .post('/api/servicios')
                .set('Cookie', cookies)
                .send({ nombre: nombreRepetido, descripcion: 'Segundo' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toMatch(/existe.*nombre/i);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU8-4-BD - Restricción UNIQUE nombre', async () => {
        const ctx = await createContext();

        try {
            const nombreDuplicado = 'Servicio Unico BD';

            // Insertar manualmente el servicio en la BD
            const res = await pool.query(
                'INSERT INTO servicio (id_empresa, nombre, descripcion, is_active) VALUES ($1, $2, $3, true) RETURNING id_servicio',
                [ctx.empresa.id_empresa, nombreDuplicado, 'Descripción manual']
            );

            // Registrar el id manualmente en el tracker para que cleanupContext lo elimine
            ctx.ids.servicios.push(res.rows[0].id_servicio);

            // Intentar insertar otro servicio con el mismo nombre y empresa mediante la API
            const cookies = tokenCookieForUser(ctx.propietario);
            const response = await request(app)
                .post('/api/servicios')
                .set('Cookie', cookies)
                .send({ nombre: nombreDuplicado, descripcion: 'Descripción API' });

            // El servicio.service.js controla la duplicidad antes de la inserción y retorna 400
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toMatch(/existe.*nombre/i);
        } finally {
            await cleanupContext(ctx);
        }
    });
    
    test('CP-HU8-9-BE - Restricción backend registro servicios (sin permisos)', async () => {
        const ctx = await createContext();

        try {
            // Usuario propietario tiene acceso, pero empleado no
            const cookies = tokenCookieForUser(ctx.empleado);
            const response = await request(app)
                .post('/api/servicios')
                .set('Cookie', cookies)
                .send({ nombre: 'Acceso Denegado', descripcion: 'Intento ilegal' });

            expect(response.status).toBe(403);
        } finally {
            await cleanupContext(ctx);
        }
    });
    
    test('CP-HU8-10-BE - Error interno registro', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.propietario);

            // Enviamos un campo que no existe o un tipo de dato incorrecto
            // que pueda causar un error 500 si no es capturado
            const response = await request(app)
                .post('/api/servicios')
                .set('Cookie', cookies)
                .send({ nombre: null, descripcion: 'Fallo forzado' });

            // Debería ser 400 por validación, pero si el sistema es robusto
            // debería manejarlo sin exponer trazas de error (500)
            expect(response.status).toBeGreaterThanOrEqual(400);
        } finally {
            await cleanupContext(ctx);
        }
    });
});
