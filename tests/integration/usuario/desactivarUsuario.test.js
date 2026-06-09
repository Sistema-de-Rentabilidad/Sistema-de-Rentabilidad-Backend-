const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');

const { crearUsuarioTemporal, eliminarUsuarioTemporal } = require('../../helpers/usuario.helper');
const { crearProyectoTemporal, eliminarProyectoTemporal } = require('../../helpers/proyecto.helper');

jest.setTimeout(20000);

describe('HU15 - Desactivacion de usuario', () => {

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
        if (usuario?.id_usuario) {
            await eliminarUsuarioTemporal(usuario.id_usuario);
        }
    });

    test('CP-HU15-1-BE - Eliminación lógica usuario', async () => {
        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}/desactivar`)
            .set('Cookie', authPropietario.cookies);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/eliminado|desactivado/i);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('is_active', false);

        const dbResult = await pool.query(
            `SELECT is_active FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('TC-428 - Validacion estado usuario', async () => {
        const authUsuario = await login(usuario.email, usuario.passwordPlano);

        const activeResponse = await request(app)
            .get('/api/auth/me')
            .set('Cookie', authUsuario.cookies);

        expect(activeResponse.status).toBe(200);
        expect(activeResponse.body).toHaveProperty('success', true);
        expect(activeResponse.body).toHaveProperty('user');
        expect(activeResponse.body.user).toMatchObject({
            id_usuario: usuario.id_usuario,
            email: usuario.email
        });

        const deactivateResponse = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}/desactivar`)
            .set('Cookie', authPropietario.cookies);

        expect(deactivateResponse.status).toBe(200);
        expect(deactivateResponse.body).toHaveProperty('success', true);
        expect(deactivateResponse.body).toHaveProperty('data');
        expect(deactivateResponse.body.data).toMatchObject({
            id_usuario: usuario.id_usuario,
            is_active: false
        });

        const staleSessionResponse = await request(app)
            .get('/api/auth/me')
            .set('Cookie', authUsuario.cookies);

        expect(staleSessionResponse.status).toBe(401);
        expect(staleSessionResponse.body).toHaveProperty('success', false);
        expect(staleSessionResponse.body.message).toMatch(/usuario|sesion|token/i);

        const getInactiveResponse = await request(app)
            .get(`/api/usuarios/${usuario.id_usuario}`)
            .set('Cookie', authPropietario.cookies);

        expect(getInactiveResponse.status).toBe(404);
        expect(getInactiveResponse.body).toHaveProperty('success', false);
        expect(getInactiveResponse.body.message).toMatch(/usuario.*no encontrado|no encontrado/i);

        const dbResult = await pool.query(
            `SELECT is_active FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].is_active).toBe(false);
    });

    test('CP-HU15-1-BD - Persistencia eliminación lógica', async () => {
        await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}/desactivar`)
            .set('Cookie', authPropietario.cookies);

        const dbResult = await pool.query(
            `SELECT id_usuario, nombre, email, is_active FROM usuario WHERE id_usuario = $1`,
            [usuario.id_usuario]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0]).toMatchObject({
            id_usuario: usuario.id_usuario,
            nombre: usuario.nombre,
            email: usuario.email,
            is_active: false
        });
    });

    test('CP-HU15-4-BE - Eliminación usuario inexistente', async () => {
        const invalidUsuarioId = 99999;

        const response = await request(app)
            .put(`/api/usuarios/${invalidUsuarioId}/desactivar`)
            .set('Cookie', authPropietario.cookies);

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/no encontrado|not found/i);
    });

    test('CP-HU15-5-BE - Restricción permisos eliminación', async () => {
        const authEmpleado = await login('qa_empleado1@test.com', 'Qa123456*');

        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}/desactivar`)
            .set('Cookie', authEmpleado.cookies);

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/permiso|autorizad|forbidden|denegad/i);
    });

    test('CP-HU15-6-BE - Restricción usuario con proyectos', async () => {
        // Crear un proyecto y asignar el usuario temporal como empleado
        const proyecto = await crearProyectoTemporal({ id_empresa: authPropietario.user.id_empresa, id_lider: authPropietario.user.id_usuario });

        await pool.query(
            `INSERT INTO proyecto_empleado (id_proyecto, id_empleado) VALUES ($1, $2)`,
            [proyecto.id_proyecto, usuario.id_usuario]
        );

        // Intentar desactivar el usuario que tiene proyectos activos
        const response = await request(app)
            .put(`/api/usuarios/${usuario.id_usuario}/desactivar`)
            .set('Cookie', authPropietario.cookies);

        // Esperamos que la API rechace la eliminación debido a proyectos activos
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(response.status).toBeLessThan(500);
        expect(response.body).toHaveProperty('success', false);

        // Limpieza: eliminar relación y proyecto
        await pool.query(
            `DELETE FROM proyecto_empleado WHERE id_proyecto = $1 AND id_empleado = $2`,
            [proyecto.id_proyecto, usuario.id_usuario]
        );

        await eliminarProyectoTemporal(proyecto.id_proyecto);
    });

    test('CP-HU15-7-BD - Restricción integridad referencial usuario', async () => {
        const proyecto = await crearProyectoTemporal({ id_empresa: authPropietario.user.id_empresa, id_lider: authPropietario.user.id_usuario });

        await pool.query(
            `INSERT INTO proyecto_empleado (id_proyecto, id_empleado) VALUES ($1, $2)`,
            [proyecto.id_proyecto, usuario.id_usuario]
        );

        const faseResult = await pool.query(
            `INSERT INTO fase (id_proyecto, nombre, horas_estimadas)
             VALUES ($1, $2, $3)
             RETURNING id_fase`,
            [proyecto.id_proyecto, 'Fase QA', 8]
        );

        const registro = await pool.query(
            `INSERT INTO registro_horas (
                id_proyecto,
                id_empleado,
                fecha,
                horas,
                descripcion,
                id_fase
             )
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id_registro`,
            [proyecto.id_proyecto, usuario.id_usuario, '2025-01-01', 1, 'QA_TEST', faseResult.rows[0].id_fase]
        );

        await expect(
            pool.query(
                `DELETE FROM usuario
                 WHERE id_usuario = $1`,
                [usuario.id_usuario]
            )
        ).rejects.toThrow();

        await pool.query(
            `DELETE FROM registro_horas WHERE id_registro = $1`,
            [registro.rows[0].id_registro]
        );

        await pool.query(
            `DELETE FROM fase WHERE id_fase = $1`,
            [faseResult.rows[0].id_fase]
        );

        await pool.query(
            `DELETE FROM proyecto_empleado WHERE id_proyecto = $1 AND id_empleado = $2`,
            [proyecto.id_proyecto, usuario.id_usuario]
        );

        await eliminarProyectoTemporal(proyecto.id_proyecto);
    });

    test('CP-HU15-7-BE - Restricción autoeliminación', async () => {
        // Intentar desactivar su propio usuario
        const response = await request(app)
            .put(`/api/usuarios/${authPropietario.user.id_usuario}/desactivar`)
            .set('Cookie', authPropietario.cookies);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/propio|No puedes eliminar tu propio usuario/i);
    });

});
