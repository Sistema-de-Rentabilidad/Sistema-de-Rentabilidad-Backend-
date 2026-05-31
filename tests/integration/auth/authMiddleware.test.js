const request = require('supertest');
const app = require('../../../src/app');
const { login } = require('../../helpers/auth');

describe('Auth middleware', () => {
  test('CP-HU1-9-BE - debe responder 401 sin JWT', async () => {
    const response = await request(app)
      .get('/api/horas');

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
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
});