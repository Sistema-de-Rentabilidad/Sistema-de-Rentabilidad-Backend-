const request = require('supertest');
const app = require('../../../src/app');

const pool = require('../../../src/config/db');

const { login } = require('../../helpers/auth');

const {
    crearProyectoTemporal,
    eliminarProyectoTemporal
} = require('../../helpers/proyecto.helper');

jest.setTimeout(20000);

describe('Eliminación lógica proyecto', () => {

    let proyecto;

    beforeEach(async () => {

        // Crear proyecto temporal ACTIVO
        proyecto = await crearProyectoTemporal();

    });

    afterEach(async () => {

        // Eliminar proyecto temporal
        await eliminarProyectoTemporal(
            proyecto.id_proyecto
        );

    });
    test('CP-HU20-1-BE - API desactiva proyecto correctamente', async () => {

        // Login
        const auth = await login(
            'qa_propietario@test.com',
            'Qa123456*'
        );

        // Consumir endpoint
        const response = await request(app)
            .put(`/api/proyectos/${proyecto.id_proyecto}/desactivar`)
            .set('Cookie', auth.cookies);

        // Validar respuesta API
        expect(response.status).toBe(200);

        expect(response.body.success).toBe(true);

        // Opcional
        expect(response.body.message);

    }, 15000);

    test('CP-HU20-1-BD - Proyecto queda inactivo en BD', async () => {

        // Login
        const auth = await login(
            'qa_propietario@test.com',
            'Qa123456*'
        );

        // Consumir endpoint
        const response = await request(app)
            .put(`/api/proyectos/${proyecto.id_proyecto}/desactivar`)
            .set('Cookie', auth.cookies);

        // Verificar en BD
        const result = await pool.query(
            `
            SELECT is_active
            FROM proyecto
            WHERE id_proyecto = $1
            `,
            [proyecto.id_proyecto]
        );

        // Debe existir
        expect(result.rows.length).toBe(1);

        // Eliminación lógica aplicada
        expect(result.rows[0].is_active).toBe(false);

    });

    test('CP-HU20-4-BE - Proyecto inexistente desactivacion', async () => {
        const auth = await login(
            'qa_propietario@test.com',
            'Qa123456*'
        );

        const idResult = await pool.query(
            `SELECT COALESCE(MAX(id_proyecto), 0) + 100000 AS id_proyecto
             FROM proyecto`
        );
        const proyectoInexistenteId = idResult.rows[0].id_proyecto;

        const response = await request(app)
            .put(`/api/proyectos/${proyectoInexistenteId}/desactivar`)
            .set('Cookie', auth.cookies);

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toMatch(/proyecto.*no encontrado|no encontrado/i);
    });

    test('CP-HU20-6-BE - API responde 403 para empleado',
        async () => {

            // Proyecto existente en BD
            const idProyecto = 1;

            // Login usuario EMPLEADO
            const auth = await login(
                'qa_empleado1@test.com',
                'Qa123456*'
            );

            // Intentar eliminación lógica
            const response = await request(app)
                .put(
                    `/api/proyectos/${idProyecto}/desactivar`
                )
                .set('Cookie', auth.cookies);

            // Debe denegar acceso
            expect(response.status).toBe(403);

            // Validar estructura
            expect(response.body).toHaveProperty(
                'success',
                false
            );

            // Opcional
            expect(response.body.message);

        }

    );
});

describe('Eliminación lógica con registros asociados', () => {

    let proyecto;
    let fase;
    let empleado;

    beforeEach(async () => {

        // Proyecto temporal
        proyecto = await crearProyectoTemporal();

        // Empleado existente QA
        empleado = 4;

        // Crear fase asociada
        const faseResult = await pool.query(
            `
            INSERT INTO fase (
                id_proyecto,
                nombre,
                horas_estimadas
            )
            VALUES ($1, $2, $3)
            RETURNING id_fase
            `,
            [
                proyecto.id_proyecto,
                'Fase QA',
                20
            ]
        );

        fase = faseResult.rows[0];

        // Crear registro de horas
        await pool.query(
            `
            INSERT INTO registro_horas (
                id_empleado,
                id_proyecto,
                fecha,
                horas,
                descripcion,
                id_fase
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            `,
            [
                empleado,
                proyecto.id_proyecto,
                '2025-01-15',
                8,
                'Testing integración',
                fase.id_fase
            ]
        );

    });

    afterEach(async () => {

        // Eliminar registros hijos primero
        await pool.query(
            `
            DELETE FROM registro_horas
            WHERE id_proyecto = $1
            `,
            [proyecto.id_proyecto]
        );

        await pool.query(
            `
            DELETE FROM fase
            WHERE id_proyecto = $1
            `,
            [proyecto.id_proyecto]
        );

        // Eliminar proyecto temporal
        await eliminarProyectoTemporal(
            proyecto.id_proyecto
        );

    });

    test('CP-HU20-5-BE - API mantiene trazabilidad',
        async () => {

            // Login
            const auth = await login(
                'qa_propietario@test.com',
                'Qa123456*'
            );

            // Eliminación lógica
            const response = await request(app)
                .put(
                    `/api/proyectos/${proyecto.id_proyecto}/desactivar`
                )
                .set('Cookie', auth.cookies);

            // API OK
            expect(response.status).toBe(200);

            // Proyecto sigue existiendo
            const proyectoBD = await pool.query(
                `
                SELECT is_active
                FROM proyecto
                WHERE id_proyecto = $1
                `,
                [proyecto.id_proyecto]
            );

            expect(
                proyectoBD.rows.length
            ).toBe(1);

            // Proyecto inactivo
            expect(
                proyectoBD.rows[0].is_active
            ).toBe(false);

            // Fases siguen existiendo
            const fases = await pool.query(
                `
                SELECT *
                FROM fase
                WHERE id_proyecto = $1
                `,
                [proyecto.id_proyecto]
            );

            expect(
                fases.rows.length
            ).toBeGreaterThan(0);

            // Registros de horas siguen existiendo
            const registros = await pool.query(
                `
                SELECT *
                FROM registro_horas
                WHERE id_proyecto = $1
                `,
                [proyecto.id_proyecto]
            );

            expect(
                registros.rows.length
            ).toBeGreaterThan(0);

        }

    );

});

