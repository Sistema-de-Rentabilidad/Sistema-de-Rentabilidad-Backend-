const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');
const {
    crearEmpresaTemporal,
    eliminarEmpresaTemporal
} = require('../../helpers/empresa.helper');
const {
    eliminarUsuarioTemporal
} = require('../../helpers/usuario.helper');

describe('Registro API propietario', () => {

    let auth;
    let empresa;
    let createdUserId;

    beforeEach(async () => {
        auth = await login('qa_admin@test.com', 'Qa123456*');
        empresa = await crearEmpresaTemporal();
        createdUserId = null;
    });

    afterEach(async () => {
        if (createdUserId) {
            await eliminarUsuarioTemporal(createdUserId);
        } else if (empresa?.id_empresa) {
            await eliminarEmpresaTemporal(empresa.id_empresa);
        }
    });

    test('CP-HU12-1-BE - Registro API propietario exitoso', async () => {
        const payload = {
            nombre: `Propietario QA Test`,
            email: `qa_propietario_${Date.now()}@test.com`,
            password: 'Password123*',
            id_empresa: empresa.id_empresa
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', auth.cookies)
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
        expect(user).toHaveProperty('id_empresa', empresa.id_empresa);

        createdUserId = user.id;
    });

    test('CP-HU12-1-BD - Persistencia propietario registrado', async () => {
        const timestamp = Date.now();
        const payload = {
            nombre: `Propietario BD Test`,
            email: `qa_propietario_bd_${timestamp}@test.com`,
            password: 'Password123*',
            id_empresa: empresa.id_empresa
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', auth.cookies)
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('user');

        const user = response.body.user;
        createdUserId = user.id;

        const dbResult = await pool.query(
            `SELECT id_usuario, nombre, email, rol, id_empresa, is_active
             FROM usuario
             WHERE id_usuario = $1`,
            [createdUserId]
        );

        expect(dbResult.rowCount).toBe(1);
        const persistedUser = dbResult.rows[0];

        expect(persistedUser).toMatchObject({
            id_usuario: createdUserId,
            nombre: payload.nombre,
            email: payload.email.toLowerCase(),
            rol: 'propietario',
            id_empresa: empresa.id_empresa,
            is_active: true
        });
    });

    test('CP-HU12-2-BE - Restricción correo duplicado', async () => {
        // Usar email que ya existe en el seed (qa_empleado1@test.com)
        const payload = {
            nombre: 'Propietario Intento',
            email: 'qa_empleado1@test.com', // Email que ya existe
            password: 'Password123*',
            id_empresa: empresa.id_empresa
        };

        const response = await request(app)
            .post('/api/usuarios')
            .set('Cookie', auth.cookies)
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/email.*registrado|ya.*existe|duplicad/i);
    });

    test('CP-HU12-2-BD - Restricción UNIQUE correo (BD rechaza inserción)', async () => {
        // Intentar insertar directamente en la BD un usuario con email que ya existe en seed
        const duplicateEmail = 'qa_empleado1@test.com';

        await expect(
            pool.query(
                `INSERT INTO usuario (id_empresa, nombre, email, password, rol) VALUES ($1, $2, $3, $4, $5)`,
                [empresa.id_empresa || 1, 'Insert Duplicate', duplicateEmail, 'x', 'propietario']
            )
        ).rejects.toMatchObject({ code: '23505' }); // Postgres unique_violation
    });

});

describe('Registro API empleado', () => {

    let authPropietario;
    let createdEmpleadoId;

    beforeEach(async () => {
        // Login con propietario existente en seed
        authPropietario = await login('qa_propietario@test.com', 'Qa123456*');
        createdEmpleadoId = null;
    });

    afterEach(async () => {
        if (createdEmpleadoId) {
            await eliminarUsuarioTemporal(createdEmpleadoId);
        }
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
            .set('Cookie', authPropietario.cookies)
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
        expect(user).toHaveProperty('id_empresa', authPropietario.user.id_empresa);

        createdEmpleadoId = user.id;
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
            .set('Cookie', authPropietario.cookies)
            .send(payload);

        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('user');

        const user = response.body.user;
        createdEmpleadoId = user.id;

        const dbResult = await pool.query(
            `SELECT id_usuario, nombre, email, rol, id_empresa, is_active
             FROM usuario
             WHERE id_usuario = $1`,
            [createdEmpleadoId]
        );

        expect(dbResult.rowCount).toBe(1);
        const persistedUser = dbResult.rows[0];

        expect(persistedUser).toMatchObject({
            id_usuario: createdEmpleadoId,
            nombre: payload.nombre,
            email: payload.email.toLowerCase(),
            rol: 'empleado',
            id_empresa: authPropietario.user.id_empresa,
            is_active: true
        });
    });

});
