const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const { getFechaActual } = require('../../../src/utils/dateTime');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createUsuario
} = require('../../helpers/integration.helper');

jest.setTimeout(90000);

describe('Actualización fecha finalización', () => {

    let ctx;
    beforeEach(async () => {
        // Crear contexto, por defecto crea un lider y un proyecto activo
        ctx = await createContext();
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU33-1-BE - API registra fecha actual', async () => {
        const response = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/finalizar`)
            .set('Cookie', tokenCookieForUser(ctx.lider));

        expect(response.status).toBe(200);
        const result = await pool.query(
            `SELECT fecha_fin_real, estado FROM proyecto WHERE id_proyecto = $1`,
            [ctx.proyecto.id_proyecto]
        );

        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows[0].fecha_fin_real).not.toBeNull();
        expect(result.rows[0].estado).toBe('Finalizado');

        const fechaFinalizacion = new Date(result.rows[0].fecha_fin_real);
        const fechaEsperada = getFechaActual();
        const fechaRegistrada = fechaFinalizacion.toISOString().slice(0, 10);

        expect(fechaRegistrada).toBe(fechaEsperada);
    });
});

describe('Validacion estado para finalizar proyecto', () => {
    let ctx;

    beforeEach(async () => {
        ctx = await createContext({ proyectoEstado: 'Cotizado' });
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU33-7-BE - API rechaza finalizar si no esta en ejecucion', async () => {
        const response = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/finalizar`)
            .set('Cookie', tokenCookieForUser(ctx.lider));

        expect(response.status).toBe(400);
        expect(response.body.message).toMatch(/ejecucion/i);

        const check = await pool.query(
            `SELECT fecha_fin_real, estado FROM proyecto WHERE id_proyecto = $1`,
            [ctx.proyecto.id_proyecto]
        );

        expect(check.rows[0].fecha_fin_real).toBeNull();
        expect(check.rows[0].estado).toBe('Cotizado');
    });
});

describe('Validación: proyecto ya finalizado/proyecto inexistente al finalizar', () => {

    let ctx;

    beforeEach(async () => {
        ctx = await createContext({ proyectoFinalizado: true });
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU33-3-BE - API rechaza finalizar proyecto ya cerrado', async () => {
        const response = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/finalizar`)
            .set('Cookie', tokenCookieForUser(ctx.lider));

        expect([400, 409]).toContain(response.status);
        const check = await pool.query(
            `SELECT fecha_fin_real FROM proyecto WHERE id_proyecto = $1`,
            [ctx.proyecto.id_proyecto]
        );

        expect(check.rows[0].fecha_fin_real).not.toBeNull();
    }, 10000);

    test('CP-HU33-5-BE - API retorna 404 si el proyecto no existe', async () => {
        const idInexistente = 999999;

        const response = await request(app)
            .put(`/api/proyectos/${idInexistente}/finalizar`)
            .set('Cookie', tokenCookieForUser(ctx.lider));

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('message');
    });
});

describe('Seguridad: líder no asignado', () => {
    let ctx;
    let otroLider;

    beforeEach(async () => {
        ctx = await createContext();
        // Crear un segundo líder que no es el del proyecto
        otroLider = await createUsuario(ctx, {
            idEmpresa: ctx.empresa.id_empresa,
            rol: 'lider'
        });
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU33-6-BE - API rechaza finalizar si no es líder del proyecto', async () => {
        const response = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/finalizar`)
            .set('Cookie', tokenCookieForUser(otroLider));

        expect(response.status).toBe(403);
        const check = await pool.query(
            `SELECT fecha_fin_real FROM proyecto WHERE id_proyecto = $1`,
            [ctx.proyecto.id_proyecto]
        );

        expect(check.rows[0].fecha_fin_real).toBe(ctx.proyecto.fecha_fin_real);
    });
});
