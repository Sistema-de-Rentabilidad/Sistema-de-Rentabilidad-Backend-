const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const {
  login,
  loginAttempt
} = require('../../helpers/auth.helper');
const {
  createContext,
  cleanupContext,
  tokenCookieForUser,
  createUsuario
} = require('../../helpers/integration.helper');

jest.setTimeout(15000);

describe('HU1 - Inicio de sesion', () => {
  let ctx = null;

  beforeEach(async () => {
    ctx = await createContext();
  });

  afterEach(async () => {
    if (ctx) {
      await cleanupContext(ctx);
    }
  });

  test('CP-HU1-1-BE - Validación API login exitoso', async () => {
    const auth = await login(ctx.propietario.email, ctx.propietario.passwordPlano);

    expect(auth.response.status).toBe(200);
    expect(auth.response.body).toHaveProperty('message', 'Login exitoso');
    expect(auth.response.body).toHaveProperty('user');
    expect(auth.user).toMatchObject({
      email: ctx.propietario.email,
      rol: 'propietario',
    });

    expect(auth.cookies).toBeDefined();
    expect(auth.cookies.some((cookie) => cookie.includes('access_token='))).toBe(true);
  });

  test('CP-HU1-2-BE - Rechazo credenciales incorrectas', async () => {
    const wrongPassword = `${ctx.propietario.passwordPlano}x`;
    const response = await loginAttempt(ctx.propietario.email, wrongPassword);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Credenciales incorrectas');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  test('CP-HU1-5-BE - Restricción login usuario inactivo', async () => {
    // Creamos un usuario manualmente inactivo en el contexto o usamos uno helper
    const usuarioInactivo = await createUsuario(ctx, { idEmpresa: ctx.empresa.id_empresa, isActive: false });

    const response = await loginAttempt(usuarioInactivo.email, usuarioInactivo.passwordPlano);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message', 'Usuario inactivo');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  test('CP-HU1-6-BE - Persistencia token JWT', async () => {
    const auth = await login(ctx.propietario.email, ctx.propietario.passwordPlano);
    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', auth.cookies);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toMatchObject({
      id_usuario: auth.user.id_usuario,
      email: auth.user.email,
      rol: auth.user.rol,
    });
  });

  test('CP-HU1-7-BE - Restriccion backend por intentos fallidos', async () => {
    const usuario = ctx.propietario;
    const wrongPassword = `${usuario.passwordPlano}x`;
    const clientIp = `203.0.113.${(Date.now() % 200) + 1}`;

    const attemptLogin = (password) => request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', clientIp)
      .send({
        email: usuario.email,
        password,
      });

    const firstResponse = await attemptLogin(wrongPassword);
    expect(firstResponse.status).toBe(401);
    expect(firstResponse.body).toHaveProperty('failedAttempts', 1);

    const secondResponse = await attemptLogin(wrongPassword);
    expect(secondResponse.status).toBe(401);
    expect(secondResponse.body).toHaveProperty('failedAttempts', 2);

    const blockedResponse = await attemptLogin(wrongPassword);
    expect(blockedResponse.status).toBe(423);
    expect(blockedResponse.body).toHaveProperty('lockedUntil');

    const blockedWithValidPassword = await attemptLogin(usuario.passwordPlano);
    expect(blockedWithValidPassword.status).toBe(423);
    expect(blockedWithValidPassword.headers['set-cookie']).toBeUndefined();
  });

  test('CP-HU1-9-BE - debe responder 401 sin JWT', async () => {
    const response = await request(app)
      .get('/api/proyectos'); // Ajustado a endpoint existente

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message');
  });

  test('CP-HU1-11-BE - Desbloqueo automático backend', async () => {
    const usuario = ctx.propietario;
    const expiredAt = new Date(Date.now() - 60 * 1000).toISOString();

    await pool.query(
      `UPDATE usuario
       SET failed_login_attempts = 3,
           locked_until = $1,
           last_failed_login_at = NOW()
             WHERE id_usuario = $2`,
      [expiredAt, usuario.id_usuario]
    );

    const response = await request(app)
      .post('/api/auth/login')
      .send({
        email: usuario.email,
        password: usuario.passwordPlano
      });
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Login exitoso');
    expect(response.body.user.email).toBe(usuario.email);
    expect(response.headers['set-cookie']).toBeDefined();

    const dbResult = await pool.query(
      `SELECT failed_login_attempts, locked_until
       FROM usuario
             WHERE id_usuario = $1`,
      [usuario.id_usuario]
    );

    expect(dbResult.rows[0].failed_login_attempts).toBe(0);
    expect(dbResult.rows[0].locked_until).toBeNull();
  });
});
