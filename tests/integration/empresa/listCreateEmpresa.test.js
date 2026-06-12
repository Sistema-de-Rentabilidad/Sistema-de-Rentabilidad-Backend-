const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const empresaService = require('../../../src/modules/empresa/empresa.service');
const empresaRepository = require('../../../src/modules/empresa/empresa.repository');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createEmpresa,
    createUsuario,
    resetDatabase,
    createTracker
} = require('../../helpers/integration.helper');

jest.setTimeout(20000);

describe('HU3 - Gestión de empresas', () => {
    test('CP-HU3-1-BE - API retorna empresas registradas correctamente', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            await createEmpresa(ctx, 'Empresa Extra Test');

            const authCookies = tokenCookieForUser(ctx.admin);

            const response = await request(app)
                .get('/api/empresas')
                .set('Cookie', authCookies);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThanOrEqual(2);

            const empresa = response.body.data[0];
            expect(empresa).toHaveProperty('id_empresa');
            expect(empresa).toHaveProperty('empresa_nombre');
            expect(empresa).toHaveProperty('propietario_nombre');
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU3-3-BE - Acceso denegado a no administradores', async () => {
        const ctx = await createContext();

        try {
            const cookies = tokenCookieForUser(ctx.empleado);

            const response = await request(app)
                .get('/api/empresas')
                .set('Cookie', cookies);

            expect(response.status).toBe(403);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU3-7-BE - API responde 401 con token expirado', async () => {
        // 1. Crear un contexto (solo para obtener un usuario válido)
        const ctx = await createContext({ incluirAdmin: true });

        try {
            // 2. Generar un token que expire hace 1 hora
            const cookies = tokenCookieForUser(ctx.admin, '-1h');

            // 3. Consumir el endpoint
            const response = await request(app)
                .get('/api/empresas')
                .set('Cookie', cookies);

            // 4. Validar que el sistema rechaza el acceso por token expirado
            expect(response.status).toBe(401);

            // Opcional: Validar que el cuerpo de la respuesta indica fallo de autenticación
            expect(response.body).toHaveProperty('success', false);
            // El mensaje dependerá de cómo tu middleware de error maneje JWT expirados
            expect(response.body).toHaveProperty('message');
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU4-1-BE - API registra empresa exitosamente', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            const cookies = tokenCookieForUser(ctx.admin);
            const nuevaEmpresa = { nombre: 'Nueva Empresa Integración' };

            const response = await request(app)
                .post('/api/empresas')
                .set('Cookie', cookies)
                .send(nuevaEmpresa);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id_empresa');
            expect(response.body.data.nombre).toBe(nuevaEmpresa.nombre);

            // Registrar ID para limpieza automática
            ctx.ids.empresas.push(response.body.data.id_empresa);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU4-1-BD - Persistencia nueva empresa registrada', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            const cookies = tokenCookieForUser(ctx.admin);
            const nombre = 'Empresa Persistencia BD';

            const response = await request(app)
                .post('/api/empresas')
                .set('Cookie', cookies)
                .send({ nombre });

            expect(response.status).toBe(201);
            const idEmpresa = response.body.data.id_empresa;
            ctx.ids.empresas.push(idEmpresa);

            // Verificación en BD
            const dbResult = await pool.query(
                'SELECT nombre FROM empresa WHERE id_empresa = $1',
                [idEmpresa]
            );

            expect(dbResult.rowCount).toBe(1);
            expect(dbResult.rows[0].nombre).toBe(nombre);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU4-2-BE - Restricción nombre duplicado', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            const cookies = tokenCookieForUser(ctx.admin);
            const nombre = 'Empresa Duplicada Test';

            // Primero registramos la empresa
            await request(app)
                .post('/api/empresas')
                .set('Cookie', cookies)
                .send({ nombre });

            // Intentamos registrar el mismo nombre nuevamente
            const response = await request(app)
                .post('/api/empresas')
                .set('Cookie', cookies)
                .send({ nombre });

            expect(response.status).toBe(400);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body.message).toMatch(/existe.*empresa|nombre.*duplicado/i);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU4-2-BD - Restricción UNIQUE nombre BD', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            const nombre = 'Empresa Unique BD';
            await createEmpresa(ctx, nombre);

            // Intentamos insertar directamente en BD usando pool.query
            await expect(pool.query(
                'INSERT INTO empresa (nombre) VALUES ($1)',
                [nombre]
            )).rejects.toMatchObject({ code: '23505' }); // Código de error de restricción UNIQUE en Postgres
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU4-8-BE - API responde error 500 ante fallo interno', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            const cookies = tokenCookieForUser(ctx.admin);

            // Forzamos el fallo en la base de datos (repositorio)
            jest.spyOn(empresaRepository, 'create').mockRejectedValueOnce(new Error('Database explosion'));

            const response = await request(app)
                .post('/api/empresas')
                .set('Cookie', cookies)
                .send({ nombre: 'EmpresaFallo' });

            expect(response.status).toBe(500);
            expect(response.body.message).toBe('Error interno del servidor');
        } finally {
            jest.restoreAllMocks();
            await cleanupContext(ctx);
        }
    });

    test('CP-HU5-1-BE - API actualiza empresa exitosamente', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            // 1. Creamos una empresa inicial para actualizar
            const empresa = await createEmpresa(ctx, 'Empresa Original');
            const cookies = tokenCookieForUser(ctx.admin);
            
            const datosActualizados = { nombre: 'Empresa Actualizada' };

            // 2. Realizamos el PUT al endpoint
            const response = await request(app)
                .put(`/api/empresas/${empresa.id_empresa}`)
                .set('Cookie', cookies)
                .send(datosActualizados);

            // 3. Validaciones de respuesta
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.nombre).toBe(datosActualizados.nombre);

            // 4. Verificación en BD (CP-HU5-1-BD)
            const dbResult = await pool.query(
                'SELECT nombre FROM empresa WHERE id_empresa = $1',
                [empresa.id_empresa]
            );
            expect(dbResult.rows[0].nombre).toBe(datosActualizados.nombre);

        } finally {
            await cleanupContext(ctx);
        }
    });
});

