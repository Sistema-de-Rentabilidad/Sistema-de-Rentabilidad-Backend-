const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createUsuario
} = require('../../helpers/integration.helper');

jest.setTimeout(90000);

describe('Testiny - Edicion de proyecto', () => {
    let ctx;

    const getProyectoIdInexistente = async () => {
        const result = await pool.query(
            `SELECT COALESCE(MAX(id_proyecto), 0) + 100000 AS id_proyecto
             FROM proyecto`
        );

        return result.rows[0].id_proyecto;
    };

    beforeEach(async () => {
        ctx = await createContext();
    });
    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU19-1-BE - Actualizacion API proyecto', async () => {
        const payload = {
            nombre: `Proyecto QA Editado ${Date.now()}`,
            descripcion: 'Proyecto editado testing',
            presupuesto: 2500,
            margen: 30
        };

        const response = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send(payload);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toMatchObject({
            id_proyecto: ctx.proyecto.id_proyecto,
            nombre: payload.nombre,
            descripcion: payload.descripcion,
            id_empresa: ctx.empresa.id_empresa
        });
        expect(Number(response.body.data.presupuesto)).toBe(payload.presupuesto);
        expect(Number(response.body.data.margen)).toBe(payload.margen);
    });

    test('CP-HU19-1-BD - Persistencia edicion proyecto', async () => {
        const payload = {
            nombre: `Proyecto QA Persistido ${Date.now()}`,
            presupuesto: 3000,
            margen: 35
        };

        const updateResponse = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send(payload);

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body).toHaveProperty('success', true);

        const getResponse = await request(app)
            .get(`/api/proyectos/${ctx.proyecto.id_proyecto}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        expect(getResponse.status).toBe(200);
        expect(getResponse.body).toHaveProperty('success', true);
        expect(getResponse.body).toHaveProperty('data');
        expect(getResponse.body.data).toMatchObject({
            id_proyecto: ctx.proyecto.id_proyecto,
            nombre: payload.nombre,
            id_empresa: ctx.empresa.id_empresa
        });
        expect(Number(getResponse.body.data.presupuesto)).toBe(payload.presupuesto);
        expect(Number(getResponse.body.data.margen)).toBe(payload.margen);

        const dbResult = await pool.query(
            `SELECT nombre, presupuesto, margen
             FROM proyecto
             WHERE id_proyecto = $1`,
            [ctx.proyecto.id_proyecto]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].nombre).toBe(payload.nombre);
        expect(Number(dbResult.rows[0].presupuesto)).toBe(payload.presupuesto);
        expect(Number(dbResult.rows[0].margen)).toBe(payload.margen);
    });

    test('CP-HU19-10-BE - Proyecto inexistente edicion', async () => {
        const proyectoInexistenteId = await getProyectoIdInexistente();

        const response = await request(app)
            .put(`/api/proyectos/${proyectoInexistenteId}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send({ nombre: 'Proyecto Inexistente' });

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/proyecto.*no encontrado|no encontrado/i);
    });

    test('CP-HU19-11-BE - Restriccion edicion proyecto finalizado', async () => {
        // Finalizar el proyecto
        await pool.query(
            'UPDATE proyecto SET fecha_fin_real = CURRENT_DATE WHERE id_proyecto = $1',
            [ctx.proyecto.id_proyecto]
        );

        const payload = {
            nombre: `Proyecto QA Finalizado Editado ${Date.now()}`,
            descripcion: 'Proyecto finalizado no editable',
            presupuesto: 4500,
            margen: 45
        };
        const response = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send(payload);
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/proyecto.*finalizado|finalizado.*proyecto|cerrado/i);
    });

    test('CP-HU19-12-BE - Lider invalido edicion', async () => {
        // Crear un lider externo (sin empresa para simular error o distinta empresa)
        // Usamos una nueva empresa para garantizar que sea diferente
        const empresaExterna = await createUsuario(ctx, { idEmpresa: null, rol: 'lider' }); // Ajustar helper si es necesario
        const response = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}`)
            .set('Cookie', tokenCookieForUser(ctx.propietario))
            .send({ id_lider: empresaExterna.id_usuario });

        expect(response.status).toBe(400); // O 403 dependiendo de la validación
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toMatch(/l.*der no.*v.*lido/i);
    });
});
