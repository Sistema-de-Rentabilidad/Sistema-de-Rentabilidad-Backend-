const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const faseService = require('../../../src/modules/fase/fase.service');

const { login } = require('../../helpers/auth');
const { crearFaseTemporal, eliminarFaseTemporal } = require('../../helpers/fase.helper');

jest.setTimeout(20000);

describe('HU37 - Editar fase', () => {

    let fase;
    let auth;

    beforeEach(async () => {
        fase = await crearFaseTemporal();
        auth = await login('qa_propietario@test.com', 'Qa123456*');
    });

    afterEach(async () => {
        if (fase?.id_fase) {
            await eliminarFaseTemporal(fase.id_fase);
        }
    });

    test('CP-HU37-1-BE - Actualización API fase', async () => {

        const datosActualizados = {
            nombre: 'Fase Actualizada',
            horas_estimadas: 120
        };

        const response = await request(app)
            .put(`/api/fases/${fase.id_fase}`)
            .set('Cookie', auth.cookies)
            .send(datosActualizados);

        console.log(response.status);
        console.log(response.body);

        expect(response.status).toBe(200);

        expect(response.body).toHaveProperty('success', true);

        expect(response.body.data).toMatchObject({
            id_fase: fase.id_fase,
            nombre: 'Fase Actualizada'
        });

        const dbResult = await pool.query(
            `
            SELECT nombre, horas_estimadas
            FROM fase
            WHERE id_fase = $1
            `,
            [fase.id_fase]
        );

        expect(dbResult.rowCount).toBe(1);

        expect(dbResult.rows[0]).toMatchObject({
            nombre: 'Fase Actualizada',
            horas_estimadas: '120.00'
        });
    });

    test('CP-HU37-1-BD - Persistencia actualización fase', async () => {

        await request(app)
            .put(`/api/fases/${fase.id_fase}`)
            .set('Cookie', auth.cookies)
            .send({
                nombre: 'Fase Persistida',
                horas_estimadas: 80
            });

        const dbResult = await pool.query(
            `
        SELECT nombre, horas_estimadas
        FROM fase
        WHERE id_fase = $1
        `,
            [fase.id_fase]
        );

        expect(dbResult.rowCount).toBe(1);

        expect(dbResult.rows[0].nombre)
            .toBe('Fase Persistida');

    });

    test('CP-HU37-4-BE - Restricción duplicidad edición', async () => {

        const faseDuplicada = await crearFaseTemporal({
            id_proyecto: fase.id_proyecto,
            nombre: 'Fase Duplicada QA'
        });

        try {

            const response = await request(app)
                .put(`/api/fases/${fase.id_fase}`)
                .set('Cookie', auth.cookies)
                .send({
                    nombre: 'Fase Duplicada QA'
                });

            expect(response.status).toBe(400);

            expect(response.body).toHaveProperty('success', false);

            const dbResult = await pool.query(
                `
            SELECT nombre
            FROM fase
            WHERE id_fase = $1
            `,
                [fase.id_fase]
            );

            expect(dbResult.rows[0].nombre)
                .toBe(fase.nombre);

        } finally {

            await eliminarFaseTemporal(faseDuplicada.id_fase);

        }

    });

    test('CP-HU37-6-BE - Restricción backend edición fases', async () => {

        const authEmpleado = await login(
            'qa_empleado1@test.com',
            'Qa123456*'
        );

        const nombreOriginal = fase.nombre;

        const response = await request(app)
            .put(`/api/fases/${fase.id_fase}`)
            .set('Cookie', authEmpleado.cookies)
            .send({
                nombre: 'Fase Editada Sin Permiso'
            });

        expect(response.status).toBe(403);

        expect(response.body).toHaveProperty('success', false);

        const dbResult = await pool.query(
            `
        SELECT nombre
        FROM fase
        WHERE id_fase = $1
        `,
            [fase.id_fase]
        );

        expect(dbResult.rows[0].nombre)
            .toBe(nombreOriginal);

    });

    test('CP-HU37-7-BE - Restricción edición proyecto finalizado', async () => {

        const proyectoFinalizado = await pool.query(
            `
            SELECT p2.id_proyecto
            FROM proyecto p1
            INNER JOIN proyecto p2
                ON p1.id_empresa = p2.id_empresa
            WHERE p1.id_proyecto = $1
            AND p2.fecha_fin_real IS NOT NULL
            AND p2.id_proyecto <> p1.id_proyecto
            LIMIT 1
            `,
            [fase.id_proyecto]
        );

        expect(proyectoFinalizado.rowCount).toBe(1);

        const faseProyectoFinalizado = await crearFaseTemporal({
            id_proyecto: proyectoFinalizado.rows[0].id_proyecto
        });

        try {

            const response = await request(app)
                .put(`/api/fases/${faseProyectoFinalizado.id_fase}`)
                .set('Cookie', auth.cookies)
                .send({
                    nombre: 'Fase Editada'
                });

            expect(response.status).toBe(400);

            expect(response.body).toHaveProperty('success', false);

            expect(response.body.message)
                .toMatch(/proyecto.*finalizado|cerrado/i);

            const dbResult = await pool.query(
                `
                SELECT nombre
                FROM fase
                WHERE id_fase = $1
                `,
                [faseProyectoFinalizado.id_fase]
            );

            expect(dbResult.rows[0].nombre)
                .toBe(faseProyectoFinalizado.nombre);

        } finally {

            await eliminarFaseTemporal(
                faseProyectoFinalizado.id_fase
            );

        }

    });

    test('CP-HU37-8-BE - Error interno actualización fase', async () => {

        jest.spyOn(faseService, 'updateFase')
            .mockRejectedValueOnce(
                new Error('Error simulado')
            );

        const response = await request(app)
            .put(`/api/fases/${fase.id_fase}`)
            .set('Cookie', auth.cookies)
            .send({
                nombre: 'Fase Actualizada'
            });

        expect(response.status).toBe(500);

        expect(response.body).toHaveProperty('success', false);

        jest.restoreAllMocks();

    });

    test('CP-HU37-9-BE - Token expirado edición fase', async () => {

        const nombreOriginal = fase.nombre;

        const response = await request(app)
            .put(`/api/fases/${fase.id_fase}`)
            .send({
                nombre: 'Fase Editada Con Token Expirado'
            });

        expect(response.status).toBe(401);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message'); // Expect a message related to authentication

        // Verify that the phase was not updated in the database
        const dbResult = await pool.query(
            `
            SELECT nombre
            FROM fase
            WHERE id_fase = $1
            `,
            [fase.id_fase]
        );

        expect(dbResult.rows[0].nombre)
            .toBe(nombreOriginal);

    });
});
