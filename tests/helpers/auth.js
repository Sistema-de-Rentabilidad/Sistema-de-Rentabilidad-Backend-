const request = require('supertest');
const app = require('../../src/app');

async function login(email, password) {

  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email,
      password
    });

  if (response.status !== 200) {
    throw new Error(`No se pudo autenticar ${email}`);
  }

  return {
    cookies: response.headers['set-cookie'],
    user: response.body.data
  };
}

module.exports = {
  login
};