const { login, loginAttempt } = require('../../helpers/auth');
const { crearUsuarioTemporal, eliminarUsuarioTemporal } = require('../../helpers/usuario.helper');

describe('HU1 - Inicio de sesión', () => {
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

});
