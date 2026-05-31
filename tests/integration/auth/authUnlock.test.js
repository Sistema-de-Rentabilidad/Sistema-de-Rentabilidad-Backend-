const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

describe('Auth unlock', () => {
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
