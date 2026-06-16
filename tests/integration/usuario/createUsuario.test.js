const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const usuarioRepository = require('../../../src/modules/usuario/usuario.repository');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createUsuario
} = require('../../helpers/integration.helper');

jest.setTimeout(30000);

describe('HU12 - Creacion de propietario', () => {
    let ctx;
    let authCookies;

    beforeEach(async () => {
        // Al crear contexto, se crea automáticamente un propietario.
        // Si queremos probar la creación de un propietario,
        // necesitamos una empresa sin propietario.
        ctx = await createContext({ incluirAdmin: true });

        // Eliminamos el propietario creado por el contexto para que
        // la empresa quede libre para el registro de un nuevo propietario.
        await pool.query('DELETE FROM usuario WHERE id_usuario = $1', [ctx.propietario.id_usuario]);
        ctx.ids.usuarios = ctx.ids.usuarios.filter(id => id !== ctx.propietario.id_usuario);

        authCookies = tokenCookieForUser(ctx.admin);
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU12-1-BE - Registro API propietario exitoso', async () => {
        const payload = {
            nombre: `Propietario QA Test`,
            email: `qa_propietario_${Date.now()}@test.com`,
            password: 'Password123*',
            id_empresa: ctx.empresa.id_empresa
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', authCookies)
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/usuario creado/i);

        expect(response.body).toHaveProperty('user');
        const user = response.body.user;

        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('nombre', payload.nombre);
        expect(user).toHaveProperty('email', payload.email.toLowerCase());
        expect(user).toHaveProperty('rol', 'propietario');
        expect(user).toHaveProperty('id_empresa', ctx.empresa.id_empresa);

        // Track the user for cleanup
        if (response.body.user?.id) {
            ctx.ids.usuarios.push(response.body.user.id);
        }
    });

    test('CP-HU12-1-BD - Persistencia propietario registrado', async () => {
        const timestamp = Date.now();
        const payload = {
            nombre: `Propietario BD Test`,
            email: `qa_propietario_bd_${timestamp}@test.com`,
            password: 'Password123*',
            id_empresa: ctx.empresa.id_empresa
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', authCookies)
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('user');

        const userId = response.body.user.id;
        ctx.ids.usuarios.push(userId);
        const dbResult = await pool.query(
            `SELECT id_usuario, nombre, email, rol, id_empresa, is_active
             FROM usuario
             WHERE id_usuario = $1`,
            [userId]
        );

        expect(dbResult.rowCount).toBe(1);
        const persistedUser = dbResult.rows[0];

        expect(persistedUser).toMatchObject({
            id_usuario: userId,
            nombre: payload.nombre,
            email: payload.email.toLowerCase(),
            rol: 'propietario',
            id_empresa: ctx.empresa.id_empresa,
            is_active: true
        });
    });

    test('CP-HU12-2-BE - Restricción correo duplicado', async () => {
        // Usar email de un usuario ya existente para generar conflicto.
        const usuarioExistente = await createUsuario(ctx, { idEmpresa: ctx.empresa.id_empresa, rol: 'empleado' });

        const payload = {
            nombre: 'Propietario Intento',
            email: usuarioExistente.email, // Email duplicado
            password: 'Password123*',
            id_empresa: ctx.empresa.id_empresa
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', authCookies)
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/email.*registrado|ya.*existe|duplicad/i);
    });

    test('CP-HU12-2-BD - Restricción UNIQUE correo (BD rechaza inserción)', async () => {
        const usuarioExistente = await createUsuario(ctx, { idEmpresa: ctx.empresa.id_empresa, rol: 'empleado' });

        await expect(
            pool.query(
                `INSERT INTO usuario (id_empresa, nombre, email, password, rol) VALUES ($1, $2, $3, $4, $5)`,
                [ctx.empresa.id_empresa, 'Insert Duplicate', usuarioExistente.email, 'x', 'propietario']
            )
        ).rejects.toMatchObject({ code: '23505' }); // Postgres unique_violation
    });

    test('CP-HU12-10-BE - Error interno registro propietario', async () => {
        const payload = {
            nombre: `Propietario Error Test`,
            email: `qa_propietario_error_${Date.now()}@test.com`,
            password: 'Password123*',
            id_empresa: ctx.empresa.id_empresa
        };

        // Simular error interno en la creación (BD/Repo)
        const spy = jest.spyOn(usuarioRepository, 'create').mockImplementation(() => {
            throw new Error('Simulated DB failure');
        });

        try {
            const response = await request(app)
                .post('/api/usuarios')
                .set('Cookie', authCookies)
                .send(payload);

            expect(response.status).toBe(500);
            expect(response.body).toHaveProperty('success', false);
            expect(response.body).toHaveProperty('message');
            expect(response.body.message).toMatch(/error interno del servidor/i);
        } finally {
            spy.mockRestore();
        }
    });

});

describe('HU13 - Creacion de empleado/lider', () => {
    let ctx;
    let authCookies;

    beforeEach(async () => {
        ctx = await createContext();
        // El propietario crea empleados/lideres
        authCookies = tokenCookieForUser(ctx.propietario);
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU13-1-BE - Registro API empleado exitoso', async () => {
        const timestamp = Date.now();

        const payload = {
            nombre: 'Empleado Test', // no usar fechas en el nombre
            email: `qa_empleado_test_${timestamp}@test.com`,
            password: 'Password123*',
            rol: 'empleado',
            tipo_pago: 'mensual',
            monto: 1200.5,
            horas_mensuales: 40
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', authCookies)
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('user');

        const user = response.body.user;

        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('nombre', payload.nombre);
        expect(user).toHaveProperty('email', payload.email.toLowerCase());
        expect(user).toHaveProperty('rol', 'empleado');
        // Debe asignarse a la misma empresa del propietario
        expect(user).toHaveProperty('id_empresa', ctx.propietario.id_empresa);

        ctx.ids.usuarios.push(response.body.user.id);
    });

    test('CP-HU13-1-BD - Persistencia empleado registrado', async () => {
        const timestamp = Date.now();

        const payload = {
            nombre: 'Empleado BD Test',
            email: `qa_empleado_bd_${timestamp}@test.com`,
            password: 'Password123*',
            rol: 'empleado',
            tipo_pago: 'mensual',
            monto: 1200.5,
            horas_mensuales: 40
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', authCookies)
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('user');

        const userId = response.body.user.id;
        ctx.ids.usuarios.push(userId);
        const dbResult = await pool.query(
            `SELECT id_usuario, nombre, email, rol, id_empresa, is_active
             FROM usuario
             WHERE id_usuario = $1`,
            [userId]
        );

        expect(dbResult.rowCount).toBe(1);
        const persistedUser = dbResult.rows[0];

        expect(persistedUser).toMatchObject({
            id_usuario: userId,
            nombre: payload.nombre,
            email: payload.email.toLowerCase(),
            rol: 'empleado',
            id_empresa: ctx.propietario.id_empresa,
            is_active: true
        });
    });

    test('CP-HU13-4-BE - Restricción correo duplicado empleado', async () => {
        // Intentar registrar un empleado usando un email que ya existe en seed
        const payload = {
            nombre: 'Empleado Duplicado',
            email: ctx.empleado.email, // email existente
            password: 'Password123*',
            rol: 'empleado',
            tipo_pago: 'mensual',
            monto: 1000,
            horas_mensuales: 40
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', authCookies)
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/email.*registrado|ya.*existe|duplicad/i);
    });

    test('CP-HU13-11-BE - Restricción registro usuarios por empleado', async () => {
        // Login con empleado del seed
        const authEmpleado = tokenCookieForUser(ctx.empleado);
        const payload = {
            nombre: 'Intento por empleado',
            email: `qa_emp_intento_${Date.now()}@test.com`,
            password: 'Password123*',
            rol: 'empleado',
            tipo_pago: 'mensual',
            monto: 1000,
            horas_mensuales: 40
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', authEmpleado)
            .send(payload);

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/permiso|autorizad|forbidden|denegad/i);
    });

});