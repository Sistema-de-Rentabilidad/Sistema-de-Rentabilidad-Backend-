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
    throw new Error(`No se pudo autenticar ${email} - status ${response.status}`);
  }

  return {
    cookies: response.headers['set-cookie'],
    user: response.body.user,
    response,
  };
}

async function loginAttempt(email, password) {
  return request(app)
    .post('/api/auth/login')
    .send({
      email,
      password
    });
}

module.exports = {
  login,
  loginAttempt,
};