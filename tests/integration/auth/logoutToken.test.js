const request = require('supertest');
const app = require('../../../src/app');
const { ACCESS_TOKEN_COOKIE } = require('../../../src/config/authCookie');

describe('Logout Token', () => {
  test('CP-HU14-3-BE - Rechazo Token Eliminado (solo token inválido)', async () => {
    const invalidJwt = 'jwt_invalido';

    const response = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${invalidJwt}`);

    expect(response.status).toBe(401);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body).toHaveProperty('message');
    expect(String(response.body.message).toLowerCase()).toMatch(/invalid|expir|token|inválid/i);
  });
});
