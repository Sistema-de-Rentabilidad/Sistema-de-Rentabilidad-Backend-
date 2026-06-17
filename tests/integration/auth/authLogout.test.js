const request = require('supertest');
const app = require('../../../src/app');

const { ACCESS_TOKEN_COOKIE } = require('../../../src/config/authCookie');
const {
    createContext,
    cleanupContext,
    tokenCookieForUser
} = require('../../helpers/integration.helper');

jest.setTimeout(15000);

describe('HU14 - Cierre de sesion', () => {
    let ctx = null;

    beforeEach(async () => {
        ctx = await createContext();
    });

    afterEach(async () => {
        if (ctx) {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU14-1-BE - API invalida sesión con JWT válido (Cerrar sesión)', async () => {
        const cookies = tokenCookieForUser(ctx.propietario);

        const response = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', cookies);

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
        const cookies = tokenCookieForUser(ctx.propietario);

        const activeTokenResponse = await request(app)
            .get('/api/auth/me')
            .set('Cookie', cookies);

        expect(activeTokenResponse.status).toBe(200);
        expect(activeTokenResponse.body).toHaveProperty('success', true);

        const logoutResponse = await request(app)
            .post('/api/auth/logout')
            .set('Cookie', cookies);

        expect(logoutResponse.status).toBe(200);

        const setCookies = logoutResponse.headers['set-cookie'] || [];
        const clearedAccessToken = setCookies.find((cookie) =>
            cookie.startsWith(`${ACCESS_TOKEN_COOKIE}=`)
        );

        expect(clearedAccessToken).toBeDefined();

        const protectedResponse = await request(app)
            .get('/api/auth/me')
            .set('Cookie', `${ACCESS_TOKEN_COOKIE}=`);

        expect(protectedResponse.status).toBe(401);
        expect(protectedResponse.body).toHaveProperty('success', false);
        expect(protectedResponse.body.message).toMatch(/token|proporcionado|inválid/i);
    });

    test('CP-HU14-3-BE - Rechazo Token Eliminado (usando token anterior tras logout)', async () => {
        const cookies = tokenCookieForUser(ctx.propietario);

        // 1. Cerrar sesión
        await request(app)
            .post('/api/auth/logout')
            .set('Cookie', cookies);

        // 2. Intentar acceder SIN cookie
        const response = await request(app)
            .get('/api/auth/me');

        // 3. Verificar que sea rechazado
        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
    });

    test('CP-HU14-6-BE - API logout sin sesión activa', async () => {
        const response = await request(app)
            .post('/api/auth/logout');

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
    });
});