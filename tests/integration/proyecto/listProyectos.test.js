const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser
} = require('../../helpers/integration.helper');

jest.setTimeout(90000);

describe('Obtención proyectos por empresa', () => {
    let ctx;
    
    beforeEach(async () => {
        ctx = await createContext();
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU17-1-BE - API retorna proyectos de la empresa', async () => {
        const response = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.propietario));
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
        expect(response.body.data.some(p => p.id_proyecto === ctx.proyecto.id_proyecto)).toBe(true);
    });

    test('CP-HU17-2-BE - API responde 403 para usuario sin permiso en proyectos', async () => {
        const adminCtx = await createContext({ incluirAdmin: true });
        try {
            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', tokenCookieForUser(adminCtx.admin));
            expect(response.status).toBe(403);
        } finally {
            await cleanupContext(adminCtx);
        }
    });

    test('CP-HU17-3-BE - API retorna arreglo vacío cuando no existen proyectos', async () => {
        const emptyCtx = await createContext({ crearFase: false, asignarEmpleado: false });
        await pool.query('DELETE FROM proyecto WHERE id_proyecto = $1', [emptyCtx.proyecto.id_proyecto]);

        try {
            const response = await request(app)
                .get('/api/proyectos')
                .set('Cookie', tokenCookieForUser(emptyCtx.propietario));

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual([]);
        } finally {
            await cleanupContext(emptyCtx);
        }
    });

    test('CP-HU17-5-BE - API no retorna proyectos externos de otra empresa', async () => {
        const otherCtx = await createContext();
        const response = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.propietario));
        expect(response.status).toBe(200);
        const idsAPI = response.body.data.map(p => p.id_proyecto);
        expect(idsAPI).toContain(ctx.proyecto.id_proyecto);
        expect(idsAPI).not.toContain(otherCtx.proyecto.id_proyecto);
        await cleanupContext(otherCtx);
    });
});

describe('Obtención proyectos asignados líder', () => {
    let ctx;

    beforeEach(async () => {
        ctx = await createContext();
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU34-1-BE - API retorna proyectos asignados al líder', async () => {
        const response = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.lider));

        expect(response.status).toBe(200);
        expect(response.body.data.length).toBeGreaterThan(0);
        response.body.data.forEach(p => expect(p.id_lider).toBe(ctx.lider.id_usuario));
    });
});

describe('Restricción proyectos otros líderes', () => {
    let ctx;
    let otherCtx;

    beforeEach(async () => {
        ctx = await createContext();
        otherCtx = await createContext();
    });

    afterEach(async () => {
        await cleanupContext(ctx);
        await cleanupContext(otherCtx);
    });

    test('CP-HU34-4-BE - API no retorna proyectos externos', async () => {
        const response = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.lider));

        const idsAPI = response.body.data.map(p => p.id_proyecto);
        expect(idsAPI).not.toContain(otherCtx.proyecto.id_proyecto);
    });
});

describe('Obtención proyectos empleado', () => {
    let ctx;

    beforeEach(async () => {
        ctx = await createContext();
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU28-1-BE - API retorna proyectos asignados al empleado', async () => {
        const response = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.empleado));
        expect(response.status).toBe(200);
        expect(response.body.data.some(p => p.id_proyecto === ctx.proyecto.id_proyecto)).toBe(true);
    });

    test('CP-HU28-5-BE - API retorna solo proyectos asignados al empleado', async () => {
        const response = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.empleado));
        expect(response.status).toBe(200);
        response.body.data.forEach(p => expect(p.id_proyecto).toBe(ctx.proyecto.id_proyecto));
    });
});
