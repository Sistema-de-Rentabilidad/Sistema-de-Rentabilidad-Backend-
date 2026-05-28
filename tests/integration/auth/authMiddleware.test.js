const request = require('supertest');
const app = require('../../../src/app');

describe('Auth middleware', () => {
  test('CP-HU1-9-BE - debe responder 401 sin JWT', async () => {
    const response = await request(app)
      .get('/api/horas');

    expect(response.status).toBe(401);

    expect(response.body).toHaveProperty('message');
  });
});