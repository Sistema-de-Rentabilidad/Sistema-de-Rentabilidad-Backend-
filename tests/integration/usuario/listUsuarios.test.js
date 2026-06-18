const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const { ACCESS_TOKEN_COOKIE } = require('../../../src/config/authCookie');
const { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, JWT_REQUIRE_CLAIMS } = require('../../../src/config/env');
const { login } = require('../../helpers/auth.helper');
const { crearUsuarioTemporal, eliminarUsuarioTemporal } = require('../../helpers/usuario.helper');
const { crearEmpresaTemporal, eliminarEmpresaTemporal } = require('../../helpers/empresa.helper');

jest.setTimeout(20000);

describe('HU11 - Gestion de propietarios', () => {
    let authAdmin;

    beforeAll(async () => {
        authAdmin = await login('qa_admin@test.com', 'Qa123456*');
    });

    test('CP-HU11-1-BE - Obtención de propietarios filtrados por rol', async () => {
        const response = await request(app)
            .get('/api/usuarios')
            .set('Cookie', authAdmin.cookies);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.length).toBeGreaterThan(0);

        const propietarios = response.body.data;

        propietarios.forEach((usuario) => {
            expect(usuario).toHaveProperty('id_usuario');
            expect(usuario).toHaveProperty('nombre');
            expect(usuario).toHaveProperty('email');
            expect(usuario).toHaveProperty('id_empresa');
            expect(usuario).toHaveProperty('empresa_nombre');
            expect(usuario).toHaveProperty('is_active', true);
        });

        const ids = propietarios.map((usuario) => usuario.id_usuario);
        const dbResult = await pool.query(
            'SELECT rol FROM usuario WHERE id_usuario = ANY($1)',
            [ids]
        );

        expect(dbResult.rowCount).toBeGreaterThanOrEqual(0);
        expect(dbResult.rows.every((row) => row.rol === 'propietario')).toBe(true);
    });

    test('CP-HU11-1-BD - Validación de filtro por rol propietario en BD', async () => {
        const result = await pool.query(
            `SELECT id_usuario, rol
             FROM usuario
             WHERE rol = 'propietario'
             AND is_active = true
             ORDER BY id_usuario ASC`
        );

        expect(result.rowCount).toBeGreaterThan(0);
        expect(result.rows.every((row) => row.rol === 'propietario')).toBe(true);
    });

    test('CP-HU11-2-BE - Respuesta vacía propietarios', async () => {
        const updateResult = await pool.query(
            `UPDATE usuario
             SET is_active = false
             WHERE rol = 'propietario'
               AND is_active = true
             RETURNING id_usuario`
        );

        const propietariosIds = updateResult.rows.map((row) => row.id_usuario);

        try {
            const response = await request(app)
                .get('/api/usuarios')
                .set('Cookie', authAdmin.cookies);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBe(0);
        } finally {
            if (propietariosIds.length > 0) {
                await pool.query(
                    'UPDATE usuario SET is_active = true WHERE id_usuario = ANY($1)',
                    [propietariosIds]
                );
            }
        }
    });

    test('CP-HU11-3-BE - Restricción backend gestión propietarios', async () => {
        const auth = await login('qa_empleado1@test.com', 'Qa123456*');

        const response = await request(app)
            .get('/api/usuarios')
            .set('Cookie', auth.cookies);

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/permiso|autorizad|forbidden|denegad/i);
    });

    test('CP-HU11-7-BE - Validación JWT expirado', async () => {
        const expiredToken = jwt.sign(
            { id_usuario: authAdmin.user.id_usuario },
            JWT_SECRET,
            {
                expiresIn: -10,
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
                subject: String(authAdmin.user.id_usuario),
            }
        );

        const response = await request(app)
            .get('/api/usuarios')
            .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/token.*expir|token inválid|Token inválido o expirado/i);
    });
});

describe('HU45 - Gestion de usuarios (empleados y lideres)', () => {
    let authPropietario = null;
    let usuarioMismaEmpresa = null;
    let usuarioOtraEmpresa = null;

    beforeAll(async () => {
        authPropietario = await login('qa_propietario@test.com', 'Qa123456*');
    });

    beforeEach(async () => {
        usuarioMismaEmpresa = await crearUsuarioTemporal({ rol: 'empleado', idEmpresa: authPropietario.user.id_empresa });
        usuarioOtraEmpresa = await crearUsuarioTemporal({ rol: 'empleado' });
    });

    afterEach(async () => {
        if (usuarioMismaEmpresa && usuarioMismaEmpresa.id_usuario) {
            await eliminarUsuarioTemporal(usuarioMismaEmpresa.id_usuario);
        }
        if (usuarioOtraEmpresa && usuarioOtraEmpresa.id_usuario) {
            await eliminarUsuarioTemporal(usuarioOtraEmpresa.id_usuario);
        }
        usuarioMismaEmpresa = null;
        usuarioOtraEmpresa = null;
    });

    afterAll(async () => {
        authPropietario = null;
    });

    test('CP-HU45-1-BE - Filtrado usuarios por empresa', async () => {
        try {
            const response = await request(app)
                .get('/api/usuarios')
                .set('Cookie', authPropietario.cookies);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('success', true);
            expect(Array.isArray(response.body.data)).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);

            const usuarios = response.body.data;

            const ids = usuarios.map((usuario) => usuario.id_usuario);

            if (ids.length > 0) {
                const dbResult = await pool.query(
                    `SELECT id_usuario, id_empresa FROM usuario WHERE id_usuario = ANY($1)`,
                    [ids]
                );

                expect(dbResult.rowCount).toBeGreaterThan(0);
                dbResult.rows.forEach((row) => {
                    expect(row.id_empresa).toBe(authPropietario.user.id_empresa);
                });
            }

            expect(ids).toContain(usuarioMismaEmpresa.id_usuario);
            expect(ids).not.toContain(usuarioOtraEmpresa.id_usuario);
        } finally {
            await eliminarUsuarioTemporal(usuarioMismaEmpresa.id_usuario);
            await eliminarUsuarioTemporal(usuarioOtraEmpresa.id_usuario);
        }
    });

    test('CP-HU45-1-BD - Validación id_empresa usuarios', async () => {
        // Crear dos empresas temporales y usuarios asociados
        const empresaA = await crearEmpresaTemporal();
        const empresaB = await crearEmpresaTemporal();

        const usuarioA = await crearUsuarioTemporal({ rol: 'empleado', idEmpresa: empresaA.id_empresa });
        const usuarioB = await crearUsuarioTemporal({ rol: 'empleado', idEmpresa: empresaB.id_empresa });

        try {
            const result = await pool.query(
                `SELECT id_usuario, id_empresa FROM usuario WHERE id_empresa = $1 AND is_active IS NOT FALSE`,
                [empresaA.id_empresa]
            );

            expect(result.rowCount).toBeGreaterThan(0);
            result.rows.forEach((r) => {
                expect(r.id_empresa).toBe(empresaA.id_empresa);
            });

            const ids = result.rows.map((r) => r.id_usuario);
            expect(ids).toContain(usuarioA.id_usuario);
            expect(ids).not.toContain(usuarioB.id_usuario);
        } finally {
            // limpieza
            await eliminarUsuarioTemporal(usuarioA.id_usuario);
            await eliminarUsuarioTemporal(usuarioB.id_usuario);
            await eliminarEmpresaTemporal(empresaA.id_empresa);
            await eliminarEmpresaTemporal(empresaB.id_empresa);
        }
    });

    test('CP-HU45-3-BE - Restricción backend usuarios empresa', async () => {
        // Usuario no propietario (empleado) intenta acceder al endpoint
        const authEmpleado = await login(usuarioOtraEmpresa.email, usuarioOtraEmpresa.passwordPlano);

        const response = await request(app)
            .get('/api/usuarios')
            .set('Cookie', authEmpleado.cookies);

        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/permiso|autorizad|forbidden|denegad/i);
    });

    test('CP-HU45-5-BE - Visualización limitada por empresa (propietario)', async () => {
        const response = await request(app)
            .get('/api/usuarios')
            .set('Cookie', authPropietario.cookies);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(Array.isArray(response.body.data)).toBe(true);

        const usuarios = response.body.data;
        const ids = usuarios.map((u) => u.id_usuario);

        expect(ids).toContain(usuarioMismaEmpresa.id_usuario);
        expect(ids).not.toContain(usuarioOtraEmpresa.id_usuario);

        if (ids.length > 0) {
            const dbResult = await pool.query(
                `SELECT id_usuario, id_empresa FROM usuario WHERE id_usuario = ANY($1)`,
                [ids]
            );

            expect(dbResult.rowCount).toBeGreaterThan(0);
            dbResult.rows.forEach((row) => {
                expect(row.id_empresa).toBe(authPropietario.user.id_empresa);
            });
        }
    });

    test('CP-HU45-8-BE - Validación JWT expirado usuarios empresa', async () => {
        const expiredToken = jwt.sign(
            { id_usuario: authPropietario.user.id_usuario },
            JWT_SECRET,
            {
                expiresIn: -10,
                issuer: JWT_ISSUER,
                audience: JWT_AUDIENCE,
                subject: String(authPropietario.user.id_usuario),
            }
        );

        const response = await request(app)
            .get('/api/usuarios')
            .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${expiredToken}`);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/token.*expir|token inválid|Token inválido o expirado/i);
    });
});
