const request = require('supertest');
const app = require('../../../src/app');

const { ACCESS_TOKEN_COOKIE } = require('../../../src/config/authCookie');
const { login } = require('../../helpers/auth');

jest.setTimeout(15000);

describe('HU14 - Cierre de sesion', () => {
  test('CP-HU14-1-BE - API invalida sesión con JWT válido (Cerrar sesión)', async () => {
    const auth = await login('qa_propietario@test.com', 'Qa123456*');

    const response = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', auth.cookies);

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('message');
    expect(response.body.message).toMatch(/sesion cerrada/i);

    const setCookies = response.headers['set-cookie'] || [];
    const clearedAccessToken = setCookies.find((cookie) =>
      cookie.startsWith(`${ACCESS_TOKEN_COOKIE}=`)
    );

    expect(clearedAccessToken).toBeDefined();
    expect(clearedAccessToken).toMatch(new RegExp(`^${ACCESS_TOKEN_COOKIE}=;`));
    expect(clearedAccessToken).toMatch(/Expires=Thu, 01 Jan 1970/i);
  });

  test('CP-HU14-2-BE - API rechaza acceso con JWT eliminado después logout', async () => {
    const auth = await login('qa_propietario@test.com', 'Qa123456*');

    const activeTokenResponse = await request(app)
      .get('/api/auth/me')
      .set('Cookie', auth.cookies);

    expect(activeTokenResponse.status).toBe(200);
    expect(activeTokenResponse.body).toHaveProperty('success', true);

    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', auth.cookies);

    expect(logoutResponse.status).toBe(200);

    const setCookies = logoutResponse.headers['set-cookie'] || [];
    const clearedAccessToken = setCookies.find((cookie) =>
      cookie.startsWith(`${ACCESS_TOKEN_COOKIE}=`) // Estás enviando la cookie VACÍA
    );

    expect(clearedAccessToken).toBeDefined();
    expect(clearedAccessToken).toMatch(new RegExp(`^${ACCESS_TOKEN_COOKIE}=;`));

    const protectedResponse = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=`);

    expect(protectedResponse.status).toBe(401);
    expect(protectedResponse.body).toHaveProperty('success', false);
    expect(protectedResponse.body).toHaveProperty('message');
    expect(protectedResponse.body.message).toMatch(/token|proporcionado|inválid/i);
  });

  test('CP-HU14-3-BE - Rechazo Token Eliminado (usando token anterior tras logout)', async () => {
    // 1. Loguearse para obtener un token válido
    const auth = await login('qa_propietario@test.com', 'Qa123456*');
    const cookieString = auth.cookies[0]; // Extraer el string de la cookie de la cabecera
    const validToken = cookieString.split(`${ACCESS_TOKEN_COOKIE}=`)[1].split(';')[0];

    // 2. Cerrar sesión
    await request(app)
      .post('/api/auth/logout')
      .set('Cookie', auth.cookies);

    // 3. Intentar acceder SIN cookie, lo cual simulará el comportamiento de un logout real en el navegador
    const response = await request(app)
      .get('/api/auth/me');

    // 4. Verificar que sea rechazado
    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
  });
});

