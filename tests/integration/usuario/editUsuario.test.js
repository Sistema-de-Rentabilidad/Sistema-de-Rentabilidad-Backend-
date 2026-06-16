const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth.helper');

const { crearUsuarioTemporal, eliminarUsuarioTemporal } = require('../../helpers/usuario.helper');

jest.setTimeout(20000);

describe('HU2 - Edicion de mi usuario', () => {

    let usuario;
    let authUsuario;

    beforeEach(async () => {
        usuario = await crearUsuarioTemporal();
        authUsuario = await login(usuario.email, usuario.passwordPlano);
    });

    afterEach(async () => {
        await eliminarUsuarioTemporal(usuario.id_usuario);
    });

    test('CP-HU2-1-BE - Actualización API perfil con datos válidos', async () => {
        const nuevoNombre = 'Perfil Actualizado';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authUsuario.cookies)
            .send({ nombre: nuevoNombre });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);

        // Verificación de seguridad para evitar "null nor undefined"
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).not.toBeNull();
        expect(response.body.data).toHaveProperty('nombre', nuevoNombre);

        const dbResult = await pool.query(
            `SELECT nombre FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].nombre).toBe(nuevoNombre);
    });

    test('CP-HU2-1-BD - Persistencia cambios perfil', async () => {
        const nuevoNombre = 'Perfil Persistido';

        const updateResponse = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authUsuario.cookies)
            .send({ nombre: nuevoNombre });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body).toHaveProperty('success', true);
        expect(updateResponse.body).toHaveProperty('data');
        expect(updateResponse.body.data).toHaveProperty('nombre', nuevoNombre);

        const getResponse = await request(app)
            .get(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authUsuario.cookies);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body).toHaveProperty('success', true);
        expect(getResponse.body).toHaveProperty('data');
        expect(getResponse.body.data).toHaveProperty('nombre', nuevoNombre);

        const dbResult = await pool.query(
            `SELECT nombre FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].nombre).toBe(nuevoNombre);
    });

    test('CP-HU2-5-BE - Restricción correo duplicado', async () => {
        const duplicateEmail = 'qa_empleado1@test.com';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authUsuario.cookies)
            .send({ email: duplicateEmail });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/email.*registrado/i);
    });

    test('CP-HU2-7-BE - API actualiza password', async () => {
        const nuevaPassword = 'NuevaPassword123*';

        // Ensure authentication is still valid before the request
        expect(authUsuario).toHaveProperty('cookies');

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authUsuario.cookies)
            .send({ password: nuevaPassword });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).not.toHaveProperty('password');

        const nuevoLogin = await login(usuario.email, nuevaPassword);
        expect(nuevoLogin).toHaveProperty('cookies');
    });

    test('CP-HU2-7-BD - Persistencia password cifrada', async () => {
        const oldPassword = usuario.passwordPlano;
        const nuevaPassword = 'NuevaPassword123*';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authUsuario.cookies)
            .send({ password: nuevaPassword });

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

describe('HU16 - Edicion de empleado/lider', () => {

    let authPropietario;
    let usuario;

    beforeAll(async () => {
        authPropietario = await login('qa_propietario@test.com', 'Qa123456*');
    });

    beforeEach(async () => {
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
            .send({ nombre: nuevoNombre });

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
            .send({ nombre: nuevoNombre, email: nuevoEmail });

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

    test('CP-HU16-3-BE - Error al editar sueldo con valor negativo (empleado/lider)', async () => {
        const roles = ['empleado', 'lider'];

        for (const rol of roles) {
            const user = await crearUsuarioTemporal({
                rol: rol,
                idEmpresa: authPropietario.user.id_empresa
            });

            // Creamos un historial salarial inicial para poder actualizarlo
            await pool.query(
                `INSERT INTO historial_sueldo (id_usuario, tipo_pago, monto, horas_mensuales, fecha_inicio) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
                [user.id_usuario, 'mensual', 1000, 40]
            );

            const response = await request(app)
                .put(`/api/usuarios/${user.id_usuario}`)
                .set('Cookie', authPropietario.cookies)
                .send({ monto: -500 });

            expect(response.status).toBe(400); // O el status que aplique en la validación
            expect(response.body).toHaveProperty('success', false);
            // El mensaje de error dependerá de tu lógica de validación

            await eliminarUsuarioTemporal(user.id_usuario);
        }
    });

    test('CP-HU16-5-BE - Restricción correo duplicado edición empleado', async () => {
        const duplicateEmail = 'qa_admin@test.com';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authPropietario.cookies)
            .send({ email: duplicateEmail });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/email.*registrado|ya.*existe|duplicad/i);

        const dbResult = await pool.query(
            `SELECT email FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].email).not.toBe(duplicateEmail);
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

    test('CP-HU16-10-BE - Restricción edición empresa ajena', async () => {
        const seedEmail = 'demo_empleado1@test.com';

        const res = await pool.query(
            `SELECT id_usuario, nombre, id_empresa FROM usuario WHERE email = $1`,
            [seedEmail]
        );

        expect(res.rowCount).toBeGreaterThan(0);

        const empleadoOtraEmpresa = res.rows[0];
        expect(empleadoOtraEmpresa.id_empresa).not.toBe(authPropietario.user.id_empresa);

        const nuevoNombre = 'Intento Edicion';

        const response = await request(app)
            .put(`/api/usuarios/${empleadoOtraEmpresa.id_usuario}`)
            .set('Cookie', authPropietario.cookies)
            .send({ nombre: nuevoNombre });

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/permisos|acceso|autorizado/i);

        const dbResult = await pool.query(
            `SELECT nombre FROM usuario WHERE id_usuario = $1`,
            [empleadoOtraEmpresa.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].nombre).toBe(empleadoOtraEmpresa.nombre);
    });

    test('CP-HU16-12-BE - Actualización API de sueldo exitosa (empleado/lider)', async () => {
        const roles = ['empleado', 'lider'];
        const nuevoMonto = 3500;

        for (const rol of roles) {
            const user = await crearUsuarioTemporal({
                rol: rol,
                idEmpresa: authPropietario.user.id_empresa
            });

            // Creamos un historial salarial inicial (hace un día para evitar conflicto de "hoy")
            await pool.query(
                `INSERT INTO historial_sueldo (id_usuario, tipo_pago, monto, horas_mensuales, fecha_inicio) 
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP - INTERVAL '1 day')`,
                [user.id_usuario, 'mensual', 1000, 40]
            );

            const response = await request(app)
                .put(`/api/usuarios/${user.id_usuario}`)
                .set('Cookie', authPropietario.cookies)
                .send({ monto: nuevoMonto });

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);

            // Verificar en BD que se creó un nuevo historial con el monto actualizado
            const dbResult = await pool.query(
                `SELECT monto FROM historial_sueldo WHERE id_usuario = $1 ORDER BY id_historial DESC LIMIT 1`,
                [user.id_usuario]
            );

            // Comparar convirtiendo a número para evitar problemas de formato de decimales (ej: "3500" vs "3500.00")
            expect(parseFloat(dbResult.rows[0].monto)).toBe(parseFloat(nuevoMonto));

            await eliminarUsuarioTemporal(user.id_usuario);
        }
    });

});

describe('HU44 - Edicion de propietario', () => {

    let usuario;
    let authAdmin;

    beforeAll(async () => {
        authAdmin = await login('qa_admin@test.com', 'Qa123456*');
    });

    beforeEach(async () => {
        usuario = await crearUsuarioTemporal({ rol: 'propietario' });
    });

    afterEach(async () => {
        await eliminarUsuarioTemporal(usuario.id_usuario);
    });

    test('CP-HU44-1-BE - Actualización API propietario', async () => {
        const nuevoNombre = 'Propietario Actualizado';
        const nuevoEmail = `qa_propietario_actualizado_${Date.now()}@test.com`;

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authAdmin.cookies)
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
        const nuevoNombre = 'Propietario Editado Por Admin';

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authAdmin.cookies)
            .send({ nombre: nuevoNombre });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('nombre', nuevoNombre);

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
            .set('Cookie', authAdmin.cookies)
            .send({ email: duplicateEmail });

        expect(response.status).toBe(409);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/email.*registrado/i);
    });

    test('CP-HU44-8-BE - Propietario inexistente edición', async () => {
        const invalidUsuarioId = 99999;
        const nuevoNombre = 'Intento Edicion';

        const response = await request(app)
            .put(`/api/usuarios/${invalidUsuarioId}`)
            .set('Cookie', authAdmin.cookies)
            .send({ nombre: nuevoNombre });

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/no encontrado|not found/i);
    });

});

