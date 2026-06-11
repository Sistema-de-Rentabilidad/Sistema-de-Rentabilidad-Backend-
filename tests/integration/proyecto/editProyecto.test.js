const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');
const {
    crearProyectoTemporal,
    eliminarProyectoTemporal
} = require('../../helpers/proyecto.helper');

jest.setTimeout(30000);

describe('Testiny - Edicion de proyecto', () => {
    let auth;
    let authLider;
    let proyecto;

    const getProyectoIdInexistente = async () => {
        const result = await pool.query(
            `SELECT COALESCE(MAX(id_proyecto), 0) + 100000 AS id_proyecto
             FROM proyecto`
        );

        return result.rows[0].id_proyecto;
    };

    beforeEach(async () => {
        auth = await login(
            'qa_propietario@test.com',
            'Qa123456*'
        );

        authLider = await login(
            'qa_lider@test.com',
            'Qa123456*'
        );

        proyecto = await crearProyectoTemporal({
            id_empresa: auth.user.id_empresa,
            id_servicio: 1,
            id_lider: authLider.user.id_usuario
        });
    });

    afterEach(async () => {
        if (proyecto?.id_proyecto) {
            await eliminarProyectoTemporal(proyecto.id_proyecto);
        }
    });

    test('CP-HU19-1-BE - Actualizacion API proyecto', async () => {
        const payload = {
            nombre: `Proyecto QA Editado ${Date.now()}`,
            descripcion: 'Proyecto editado testing',
            presupuesto: 2500,
            margen: 30
        };

        const response = await request(app)
            .put(`/api/proyectos/${proyecto.id_proyecto}`)
            .set('Cookie', auth.cookies)
            .send(payload);

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toMatchObject({
            id_proyecto: proyecto.id_proyecto,
            nombre: payload.nombre,
            descripcion: payload.descripcion,
            id_empresa: auth.user.id_empresa
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
            .put(`/api/proyectos/${proyecto.id_proyecto}`)
            .set('Cookie', auth.cookies)
            .send(payload);

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.body).toHaveProperty('success', true);

        const getResponse = await request(app)
            .get(`/api/proyectos/${proyecto.id_proyecto}`)
            .set('Cookie', auth.cookies);

        expect(getResponse.status).toBe(200);
        expect(getResponse.body).toHaveProperty('success', true);
        expect(getResponse.body).toHaveProperty('data');
        expect(getResponse.body.data).toMatchObject({
            id_proyecto: proyecto.id_proyecto,
            nombre: payload.nombre,
            id_empresa: auth.user.id_empresa
        });
        expect(Number(getResponse.body.data.presupuesto)).toBe(payload.presupuesto);
        expect(Number(getResponse.body.data.margen)).toBe(payload.margen);

        const dbResult = await pool.query(
            `SELECT nombre, presupuesto, margen
             FROM proyecto
             WHERE id_proyecto = $1`,
            [proyecto.id_proyecto]
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
            .set('Cookie', auth.cookies)
            .send({ nombre: 'Proyecto Inexistente' });

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/proyecto.*no encontrado|no encontrado/i);
    });

    test('CP-HU19-11-BE - Restriccion edicion proyecto finalizado', async () => {
        const finalizarResponse = await request(app)
            .put(`/api/proyectos/${proyecto.id_proyecto}/finalizar`)
            .set('Cookie', authLider.cookies);

        expect(finalizarResponse.status).toBe(200);
        expect(finalizarResponse.body).toHaveProperty('success', true);

        const payload = {
            nombre: `Proyecto QA Finalizado Editado ${Date.now()}`,
            descripcion: 'Proyecto finalizado no editable',
            presupuesto: 4500,
            margen: 45
        };

        const response = await request(app)
            .put(`/api/proyectos/${proyecto.id_proyecto}`)
            .set('Cookie', auth.cookies)
            .send(payload);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/proyecto.*finalizado|finalizado.*proyecto|cerrado/i);

        const dbResult = await pool.query(
            `SELECT nombre, descripcion, presupuesto, margen, fecha_fin_real
             FROM proyecto
             WHERE id_proyecto = $1`,
            [proyecto.id_proyecto]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].nombre).toBe(proyecto.nombre);
        expect(dbResult.rows[0].descripcion).toBe(proyecto.descripcion);
        expect(Number(dbResult.rows[0].presupuesto)).toBe(Number(proyecto.presupuesto));
        expect(Number(dbResult.rows[0].margen)).toBe(Number(proyecto.margen));
        expect(dbResult.rows[0].fecha_fin_real).not.toBeNull();
    });

    test('CP-HU19-12-BE - Lider invalido edicion', async () => {
        const liderExternoResult = await pool.query(
            `SELECT id_usuario, id_empresa
             FROM usuario
             WHERE id_empresa <> $1
               AND rol = 'lider'
               AND is_active = true
             LIMIT 1`,
            [auth.user.id_empresa]
        );

        expect(liderExternoResult.rowCount).toBeGreaterThan(0);

        const liderExterno = liderExternoResult.rows[0];
        expect(liderExterno.id_empresa).not.toBe(auth.user.id_empresa);

        const response = await request(app)
            .put(`/api/proyectos/${proyecto.id_proyecto}`)
            .set('Cookie', auth.cookies)
            .send({ id_lider: liderExterno.id_usuario });

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/l.*der no.*v.*lido/i);

        const dbResult = await pool.query(
            `SELECT id_lider
             FROM proyecto
             WHERE id_proyecto = $1`,
            [proyecto.id_proyecto]
        );

        expect(dbResult.rowCount).toBe(1);
        expect(dbResult.rows[0].id_lider).toBe(proyecto.id_lider);
    });
});
