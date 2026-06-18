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

describe('HU3, HU4, HU5, HU6 - Gestión, creación y edición de empresas', () => {
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

    test('CP-HU5-2-BE - API retorna datos de empresa para edición', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            // 1. Creamos una empresa para consultar
            const empresa = await createEmpresa(ctx, 'Empresa para Edición');
            const cookies = tokenCookieForUser(ctx.admin);

            // 2. Realizamos el GET al endpoint de edición
            const response = await request(app)
                .get(`/api/empresas/${empresa.id_empresa}`)
                .set('Cookie', cookies);

            // 3. Validaciones
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toHaveProperty('id_empresa', empresa.id_empresa);
            expect(response.body.data).toHaveProperty('empresa_nombre', 'Empresa para Edición');
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU5-3-BE - Restricción nombre duplicado al editar', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            const cookies = tokenCookieForUser(ctx.admin);

            // 1. Creamos dos empresas
            const empresa1 = await createEmpresa(ctx, 'Empresa Original');
            const empresa2 = await createEmpresa(ctx, 'Empresa A Renombrar');

            // 2. Intentamos renombrar la segunda empresa con el nombre de la primera
            const response = await request(app)
                .put(`/api/empresas/${empresa2.id_empresa}`)
                .set('Cookie', cookies)
                .send({ nombre: empresa1.nombre });

            // 3. Validamos que el sistema responde un error de conflicto (400)
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.message).toMatch(/existe|duplicado/i);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU5-3-BD - Restricción UNIQUE nombre BD al actualizar', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            // 1. Creamos dos empresas
            const empresa1 = await createEmpresa(ctx, 'Empresa A');
            const empresa2 = await createEmpresa(ctx, 'Empresa B');

            // 2. Intentamos actualizar el nombre de la empresa 2 al de la empresa 1 usando SQL directo
            // Esto debería lanzar un error de violación de restricción UNIQUE (código 23505)
            await expect(pool.query(
                'UPDATE empresa SET nombre = $1 WHERE id_empresa = $2',
                [empresa1.nombre, empresa2.id_empresa]
            )).rejects.toMatchObject({ code: '23505' });
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU5-7-BE - API informa sin cambios al actualizar con mismo nombre', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            // 1. Creamos una empresa
            const nombre = 'Empresa Fija';
            const empresa = await createEmpresa(ctx, nombre);
            const cookies = tokenCookieForUser(ctx.admin);

            // 2. Realizamos el PUT con el mismo nombre
            const response = await request(app)
                .put(`/api/empresas/${empresa.id_empresa}`)
                .set('Cookie', cookies)
                .send({ nombre: nombre });

            // 3. Validamos (puede ser un 200 con éxito o un mensaje indicando que no hubo cambios)
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            // Si la API tiene un mensaje específico para "sin cambios", se puede validar aquí
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU5-8-BE - Empresa no encontrada (ID inválido)', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            const cookies = tokenCookieForUser(ctx.admin);
            const idInvalido = 999999;

            // 1. Test GET con ID inexistente
            const getResponse = await request(app)
                .get(`/api/empresas/${idInvalido}`)
                .set('Cookie', cookies);

            expect(getResponse.status).toBe(404);

            // 2. Test PUT con ID inexistente
            const putResponse = await request(app)
                .put(`/api/empresas/${idInvalido}`)
                .set('Cookie', cookies)
                .send({ nombre: 'Nombre nuevo' });

            expect(putResponse.status).toBe(404);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU5-9-BE - Restricción endpoint edición (Usuario sin permisos)', async () => {
        const ctx = await createContext({ incluirAdmin: true });

        try {
            // 1. Creamos una empresa
            const empresa = await createEmpresa(ctx, 'Empresa Restringida');

            // 2. Usamos el token de un empleado (sin permisos de admin)
            const cookies = tokenCookieForUser(ctx.empleado);

            // 3. Intentamos realizar el PUT al endpoint
            const response = await request(app)
                .put(`/api/empresas/${empresa.id_empresa}`)
                .set('Cookie', cookies)
                .send({ nombre: 'Intento Ilegal' });

            // 4. Validamos que el acceso sea denegado (403)
            expect(response.status).toBe(403);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU6-1-BE - API actualiza empresa exitosamente (propietario)', async () => {
        const ctx = await createContext();

        try {
            // El contexto 'createContext' ya crea una empresa y un propietario vinculado a ella.
            const empresa = ctx.empresa;
            const cookies = tokenCookieForUser(ctx.propietario);

            const nuevosDatos = { nombre: 'Empresa Propietario Actualizada' };

            // 2. Realizamos la actualización
            const response = await request(app)
                .put(`/api/empresas/${empresa.id_empresa}`)
                .set('Cookie', cookies)
                .send(nuevosDatos);

            // 3. Validaciones
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.nombre).toBe(nuevosDatos.nombre);

            // 4. Verificación en BD
            const dbResult = await pool.query(
                'SELECT nombre FROM empresa WHERE id_empresa = $1',
                [empresa.id_empresa]
            );
            expect(dbResult.rows[0].nombre).toBe(nuevosDatos.nombre);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU6-2-BE - Obtención datos empresa propia (propietario)', async () => {
        const ctx = await createContext();

        try {
            // 1. Utilizamos la empresa del contexto y el propietario del mismo
            const empresa = ctx.empresa;
            const cookies = tokenCookieForUser(ctx.propietario);

            // 2. Consultamos la empresa mediante el endpoint
            const response = await request(app)
                .get(`/api/empresas/${empresa.id_empresa}`)
                .set('Cookie', cookies);

            // 3. Validaciones
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id_empresa).toBe(empresa.id_empresa);
            expect(response.body.data.empresa_nombre).toBe(empresa.nombre);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU6-3-BE - Restricción duplicidad al actualizar (propietario)', async () => {
        const ctx = await createContext();

        try {
            // Creamos empresas con nombres válidos
            const nombreUnico1 = 'Empresa Alpha';
            const nombreUnico2 = 'Empresa Beta';
            const empresa1 = await createEmpresa(ctx, nombreUnico1);
            const empresa2 = await createEmpresa(ctx, nombreUnico2);
            // Creamos propietario vinculado explícitamente a la empresa 2
            const propietario2 = await createUsuario(ctx, {
                idEmpresa: empresa2.id_empresa,
                rol: 'propietario'
            });
            const cookies = tokenCookieForUser(propietario2);

            // 3. Intentamos actualizar el nombre de la empresa 2 al de la empresa 1
            const response = await request(app)
                .put(`/api/empresas/${empresa2.id_empresa}`)
                .set('Cookie', cookies)
                .send({ nombre: nombreUnico1 });

            // 4. Validamos que el sistema responde con conflicto (400) por duplicidad
            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);

            // Validamos que el mensaje es el esperado por la lógica de negocio
            // Si el error viene de la validación o del servicio, ajustamos el path
            const mensaje = response.body.errors ? response.body.errors[0].msg : response.body.message;
            expect(mensaje).toMatch(/existe|duplicado/i);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU6-9-BE - Restricción acceso a empresa ajena (propietario)', async () => {
        const ctx = await createContext(); // Crea Empresa1 y Propietario1

        try {
            // 1. Creamos una segunda empresa (Empresa2)
            const empresa2 = await createEmpresa(ctx, 'Empresa Ajena');

            // 2. Usamos el token del propietario de la Empresa1 para intentar acceder a Empresa2
            const cookies = tokenCookieForUser(ctx.propietario);

            // 3. GET a empresa ajena
            const getResponse = await request(app)
                .get(`/api/empresas/${empresa2.id_empresa}`)
                .set('Cookie', cookies);

            expect(getResponse.status).toBe(403);

            // 4. PUT a empresa ajena
            const putResponse = await request(app)
                .put(`/api/empresas/${empresa2.id_empresa}`)
                .set('Cookie', cookies)
                .send({ nombre: 'Intento de robo' });

            expect(putResponse.status).toBe(403);
        } finally {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU6-10-BE - Token expirado al intentar editar empresa', async () => {
        const ctx = await createContext();

        try {
            // 1. Creamos empresa y generamos un token expirado para su propietario
            const empresa = ctx.empresa;
            const cookies = tokenCookieForUser(ctx.propietario, '-1h');

            // 2. Intentamos editar la empresa con el token expirado
            const response = await request(app)
                .put(`/api/empresas/${empresa.id_empresa}`)
                .set('Cookie', cookies)
                .send({ nombre: 'Nombre expirado' });

            // 3. Validamos que el acceso es denegado (401)
            expect(response.status).toBe(401);
        } finally {
            await cleanupContext(ctx);
        }
    });
});
