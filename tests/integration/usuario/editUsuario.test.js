const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');

const {
    crearUsuarioTemporal,
    eliminarUsuarioTemporal
} = require('../../helpers/usuario.helper');

describe('Restricción correo duplicado', () => {

    test('CP-HU2-5-BE - debe responder 409 cuando el email ya existe', async () => {

        const auth = await login(
            'qa_admin@test.com',
            'Qa123456*'
        );

        // Intentar actualizar con email ya existente
        const response = await request(app)
            .put('/api/usuarios/1')
            .set('Cookie', auth.cookies)
            .send({
                email: 'qa_empleado1@test.com'
            });

        expect(response.status).toBe(400);

        expect(response.body.message)
            .toMatch(/email.*registrado/i);
    });

});

describe('Actualización API perfil', () => {

    let usuario;

    beforeEach(async () => {
        usuario = await crearUsuarioTemporal();
    });

    afterEach(async () => {
        await eliminarUsuarioTemporal(usuario.id_usuario);
    });

    test('CP-HU2-1-BE - Actualización API perfil con datos válidos', async () => {
        const auth = await login(
            usuario.email,
            usuario.passwordPlano
        );

        const nuevoNombre = 'Perfil Actualizado';

        const response = await request(app)
            .put(`/api/usuarios/${auth.user.id_usuario}`)
            .set('Cookie', auth.cookies)
            .send({
                nombre: nuevoNombre
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('nombre', nuevoNombre);

        const dbResult = await pool.query(
            `SELECT nombre FROM usuario WHERE id_usuario = $1`,
            [auth.user.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].nombre).toBe(nuevoNombre);
    });

});

describe('Actualización usuario empleado por propietario', () => {

    let authPropietario;
    let usuario;

    beforeEach(async () => {
        // Login con propietario del seed
        authPropietario = await login('qa_propietario@test.com', 'Qa123456*');

        // Crear empleado temporal asociado a la empresa del propietario
        usuario = await crearUsuarioTemporal({
            rol: 'empleado',
            idEmpresa: authPropietario.user.id_empresa
        });
    });

    afterEach(async () => {
        await eliminarUsuarioTemporal(usuario.id_usuario);
    });

    test('CP-HU16-1-BE - Actualización API empleado', async () => {
        const nuevoNombre = 'Empleado Actualizado';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authPropietario.cookies)
            .send({
                nombre: nuevoNombre
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('nombre', nuevoNombre);

        const dbResult = await pool.query(
            `SELECT nombre FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].nombre).toBe(nuevoNombre);
    });

    test('CP-HU16-1-BD - Persistencia edición empleado', async () => {
        const nuevoNombre = 'Empleado Persistido';
        const nuevoEmail = `qa_empleado_persist_${Date.now()}@test.com`;

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authPropietario.cookies)
            .send({
                nombre: nuevoNombre,
                email: nuevoEmail
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');

        const dbResult = await pool.query(
            `SELECT nombre, email FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0]).toMatchObject({
            nombre: nuevoNombre,
            email: nuevoEmail.toLowerCase()
        });
    });

    test('CP-HU16-5-BE - Restricción correo duplicado edición empleado', async () => {
        // Intentar actualizar el email del empleado a uno ya existente en seed
        const duplicateEmail = 'qa_admin@test.com';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authPropietario.cookies)
            .send({ email: duplicateEmail });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/email.*registrado|ya.*existe|duplicad/i);

        // Verificar que el email no cambió en BD
        const dbResult = await pool.query(
            `SELECT email FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].email).not.toBe(duplicateEmail);
    });

    test('CP-HU16-10-BE - Restricción edición empresa ajena', async () => {
        // Usar empleado existente en seed de otra empresa
        const seedEmail = 'demo_empleado1@test.com';

        const res = await pool.query(
            `SELECT id_usuario, nombre, id_empresa FROM usuario WHERE email = $1`,
            [seedEmail]
        );

        expect(res.rowCount).toBeGreaterThan(0);

        const empleadoOtraEmpresa = res.rows[0];

        // Verificar pertenece a otra empresa
        expect(empleadoOtraEmpresa.id_empresa).not.toBe(authPropietario.user.id_empresa);

        const nuevoNombre = 'Intento Edicion';

        const response = await request(app)
            .put(`/api/usuarios/${empleadoOtraEmpresa.id_usuario}`)
            .set('Cookie', authPropietario.cookies)
            .send({ nombre: nuevoNombre });

        // API debe rechazar con 403 Forbidden
        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/permisos|acceso|autorizado/i);

        // Verificar que el nombre NO cambió en BD
        const dbResult = await pool.query(
            `SELECT nombre FROM usuario WHERE id_usuario = $1`,
            [empleadoOtraEmpresa.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].nombre).toBe(empleadoOtraEmpresa.nombre);
    });

    test('CP-HU16-9-BE - Usuario inexistente edición', async () => {
        const invalidUsuarioId = 999999;

        const exists = await pool.query(
            `SELECT id_usuario FROM usuario WHERE id_usuario = $1`,
            [invalidUsuarioId]
        );

        expect(exists.rowCount).toBe(0);

        const response = await request(app)
            .put(`/api/usuarios/${invalidUsuarioId}`)
            .set('Cookie', authPropietario.cookies)
            .send({ nombre: 'NombreInexistente' });

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/no encontrado|not found/i);
    });

});

describe('Actualización usuario propietario por admin', () => {

    let usuario;
    let authPropietario;

    beforeEach(async () => {
        usuario = await crearUsuarioTemporal({ rol: 'propietario' });

        authPropietario = await login(
            usuario.email,
            usuario.passwordPlano
        );
    });

    afterEach(async () => {
        await eliminarUsuarioTemporal(usuario.id_usuario);
    });

    test('CP-HU44-1-BE - Actualización API propietario', async () => {
        const nuevoNombre = 'Propietario Actualizado';
        const nuevoEmail = `qa_propietario_actualizado_${Date.now()}@test.com`;

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authPropietario.cookies)
            .send({
                nombre: nuevoNombre,
                email: nuevoEmail
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toMatchObject({
            nombre: nuevoNombre,
            email: nuevoEmail.toLowerCase()
        });

        const dbResult = await pool.query(
            `SELECT nombre, email FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0]).toMatchObject({
            nombre: nuevoNombre,
            email: nuevoEmail.toLowerCase()
        });
    });

    test('CP-HU44-3-BE - Actualización parcial propietario por admin', async () => {
        // Login como admin
        const authAdmin = await login('qa_admin@test.com', 'Qa123456*');

        const nuevoNombre = 'Propietario Editado Por Admin';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authAdmin.cookies)
            .send({ nombre: nuevoNombre });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('nombre', nuevoNombre);

        // Verificar persistencia en BD y que el email no cambió
        const dbResult = await pool.query(
            `SELECT nombre, email FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0]).toMatchObject({
            nombre: nuevoNombre,
            email: usuario.email.toLowerCase()
        });
    });

    test('CP-HU44-5-BE - Restricción correo duplicado propietario', async () => {
        const duplicateEmail = 'qa_admin@test.com';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authPropietario.cookies)
            .send({
                email: duplicateEmail
            });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/email.*registrado/i);
    });

    test('CP-HU44-8-BE - Propietario inexistente edición', async () => {
        const invalidUsuarioId = 99999;
        const nuevoNombre = 'Intento Edicion';

        const response = await request(app)
            .put(`/api/usuarios/${invalidUsuarioId}`)
            .set('Cookie', authPropietario.cookies)
            .send({
                nombre: nuevoNombre
            });

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/no encontrado|not found/i);
    });

});

describe('Actualización password API', () => {

    let usuario;

    beforeEach(async () => {

        // Crear usuario temporal
        usuario = await crearUsuarioTemporal();

    });

    afterEach(async () => {

        // Eliminar usuario temporal
        await eliminarUsuarioTemporal(
            usuario.id_usuario
        );

    });

    test('CP-HU2-7-BE - API actualiza password', async () => {

        // Login con usuario temporal
        const auth = await login(
            usuario.email,
            usuario.passwordPlano
        );

        // Nueva contraseña
        const nuevaPassword = 'NuevaPassword123*';

        // Actualizar contraseña
        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', auth.cookies)
            .send({
                password: nuevaPassword
            });

        // API OK
        expect(response.status).toBe(200);

        expect(response.body).toHaveProperty(
            'success',
            true
        );

        expect(response.body).toHaveProperty('data');

        // Verificar login con nueva password
        const nuevoLogin = await login(
            usuario.email,
            nuevaPassword
        );

        expect(nuevoLogin).toHaveProperty('cookies');

    });

    test('CP-HU2-7-BD - Persistencia password cifrada', async () => {
        const oldPassword = usuario.passwordPlano;

        const auth = await login(
            usuario.email,
            oldPassword
        );

        const nuevaPassword = 'NuevaPassword123*';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', auth.cookies)
            .send({
                password: nuevaPassword
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).not.toHaveProperty('password');

        const dbResult = await pool.query(
            `SELECT password FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        const storedPassword = dbResult.rows[0].password;

        expect(storedPassword).not.toBe(nuevaPassword);
        expect(storedPassword).not.toBe(oldPassword);
        expect(await bcrypt.compare(nuevaPassword, storedPassword)).toBe(true);
    });

});
