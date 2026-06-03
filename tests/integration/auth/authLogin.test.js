const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const { login, loginAttempt } = require('../../helpers/auth');
const { crearUsuarioTemporal, eliminarUsuarioTemporal } = require('../../helpers/usuario.helper');

jest.setTimeout(15000);

describe('HU1 - Inicio de sesion', () => {
  let usuarioTemporal = null;

  afterEach(async () => {
    if (usuarioTemporal && usuarioTemporal.id_usuario) {
      await eliminarUsuarioTemporal(usuarioTemporal.id_usuario);
      usuarioTemporal = null;
    }
  });

  test('CP-HU1-1-BE - Validación API login exitoso', async () => {
    const auth = await login('qa_propietario@test.com', 'Qa123456*');

    expect(auth.response.status).toBe(200);
    expect(auth.response.body).toHaveProperty('message', 'Login exitoso');
    expect(auth.response.body).toHaveProperty('user');
    expect(auth.user).toMatchObject({
      email: 'qa_propietario@test.com',
      rol: expect.any(String),
    });

    expect(auth.cookies).toBeDefined();
    expect(auth.cookies.some((cookie) => cookie.includes('access_token='))).toBe(true);
  });

  test('CP-HU1-2-BE - Rechazo credenciales incorrectas', async () => {
    usuarioTemporal = await crearUsuarioTemporal({ rol: 'propietario' });
    const wrongPassword = `${usuarioTemporal.passwordPlano}x`;

    const response = await loginAttempt(usuarioTemporal.email, wrongPassword);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('message', 'Credenciales incorrectas');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  test('CP-HU1-5-BE - Restricción login usuario inactivo', async () => {
    usuarioTemporal = await crearUsuarioTemporal({ rol: 'propietario', isActive: false });

    const response = await loginAttempt(usuarioTemporal.email, usuarioTemporal.passwordPlano);

    expect(response.status).toBe(403);
    expect(response.body).toHaveProperty('message', 'Usuario inactivo');
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  test('CP-HU1-6-BE - Persistencia token JWT', async () => {
    const auth = await login('qa_propietario@test.com', 'Qa123456*');

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

  test('CP-HU1-9-BE - debe responder 401 sin JWT', async () => {
    const response = await request(app)
      .get('/api/horas');

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
  });
});

describe('HU1 - Inicio de sesion', () => {
  const email = 'qa_propietario@test.com';
  const password = 'Qa123456*';

  afterEach(async () => {
    await pool.query(
      `UPDATE usuario
       SET failed_login_attempts = 0,
           locked_until = NULL,
           last_failed_login_at = NULL
       WHERE email = $1`,
      [email]
    );
  });

  test('CP-HU1-11-BE - Desbloqueo automático backend', async () => {
    const expiredAt = new Date(Date.now() - 60 * 1000).toISOString();

    await pool.query(
      `UPDATE usuario
       SET failed_login_attempts = 3,
           locked_until = $1,
           last_failed_login_at = NOW()
       WHERE email = $2`,
      [expiredAt, email]
    );

    const response = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message', 'Login exitoso');
    expect(response.body).toHaveProperty('user');
    expect(response.body.user).toMatchObject({
      email,
      rol: expect.any(String),
    });
    expect(response.headers['set-cookie']).toBeDefined();

    const dbResult = await pool.query(
      `SELECT failed_login_attempts, locked_until
       FROM usuario
       WHERE email = $1`,
      [email]
    );

    expect(dbResult.rowCount).toBe(1);
    expect(dbResult.rows[0].failed_login_attempts).toBe(0);
    expect(dbResult.rows[0].locked_until).toBeNull();
  });
});

describe('Testiny - Restriccion backend por intentos fallidos', () => {
  let usuarioTemporal = null;

  afterEach(async () => {
    if (usuarioTemporal?.id_usuario) {
      await pool.query(
        `UPDATE usuario
         SET failed_login_attempts = 0,
             locked_until = NULL,
             last_failed_login_at = NULL
         WHERE id_usuario = $1`,
        [usuarioTemporal.id_usuario]
      );

      await eliminarUsuarioTemporal(usuarioTemporal.id_usuario);
      usuarioTemporal = null;
    }
  });

  test('TC-432 - Restriccion backend por intentos fallidos', async () => {
    usuarioTemporal = await crearUsuarioTemporal({ rol: 'propietario' });

    const wrongPassword = `${usuarioTemporal.passwordPlano}x`;
    const clientIp = `203.0.113.${(Date.now() % 200) + 1}`;

    const attemptLogin = (password) => request(app)
      .post('/api/auth/login')
      .set('X-Forwarded-For', clientIp)
      .send({
        email: usuarioTemporal.email,
        password,
      });

    const firstResponse = await attemptLogin(wrongPassword);
    expect(firstResponse.status).toBe(401);
    expect(firstResponse.body).toHaveProperty('message', 'Credenciales incorrectas');
    expect(firstResponse.body).toHaveProperty('failedAttempts', 1);
    expect(firstResponse.body).toHaveProperty('remainingAttempts', 2);

    const secondResponse = await attemptLogin(wrongPassword);
    expect(secondResponse.status).toBe(401);
    expect(secondResponse.body).toHaveProperty('message', 'Credenciales incorrectas');
    expect(secondResponse.body).toHaveProperty('failedAttempts', 2);
    expect(secondResponse.body).toHaveProperty('remainingAttempts', 1);

    const blockedResponse = await attemptLogin(wrongPassword);
    expect(blockedResponse.status).toBe(423);
    expect(blockedResponse.body).toHaveProperty(
      'message',
      'Demasiados intentos fallidos. Intenta nuevamente mas tarde.'
    );
    expect(blockedResponse.body).toHaveProperty('lockedUntil');
    expect(blockedResponse.body).toHaveProperty('retryAfterSeconds');

    const blockedWithValidPassword = await attemptLogin(usuarioTemporal.passwordPlano);
    expect(blockedWithValidPassword.status).toBe(423);
    expect(blockedWithValidPassword.body).toHaveProperty('lockedUntil');
    expect(blockedWithValidPassword.headers['set-cookie']).toBeUndefined();

    const dbResult = await pool.query(
      `SELECT failed_login_attempts, locked_until
       FROM usuario
       WHERE id_usuario = $1`,
      [usuarioTemporal.id_usuario]
    );

    expect(dbResult.rowCount).toBe(1);
    expect(dbResult.rows[0].failed_login_attempts).toBe(3);
    expect(dbResult.rows[0].locked_until).not.toBeNull();
  });
});
