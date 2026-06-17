const request = require('supertest');
const app = require('../../../src/app');

const pool = require('../../../src/config/db');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createUsuario,
    createRegistroHoras
} = require('../../helpers/integration.helper');

jest.setTimeout(90000);

describe('Eliminación lógica proyecto', () => {

    let ctx;

    beforeEach(async () => {
        // Crear contexto con un usuario propietario
        ctx = await createContext();
    });

    afterEach(async () => {
        // Eliminar contexto
        await cleanupContext(ctx);
    });

    test('CP-HU20-1-BE - API desactiva proyecto correctamente', async () => {

        // Consumir endpoint
        const response = await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/desactivar`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        // Validar respuesta API
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
    }, 15000);

    test('CP-HU20-1-BD - Proyecto queda inactivo en BD', async () => {

        // Consumir endpoint
        await request(app)
            .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/desactivar`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        // Verificar en BD
        const result = await pool.query(
            `
            SELECT is_active
            FROM proyecto
            WHERE id_proyecto = $1
            `,
            [ctx.proyecto.id_proyecto]
        );

        // Debe existir
        expect(result.rows.length).toBe(1);

        // Eliminación lógica aplicada
        expect(result.rows[0].is_active).toBe(false);

    });

    test('CP-HU20-4-BE - Proyecto inexistente desactivacion', async () => {
        const idResult = await pool.query(
            `SELECT COALESCE(MAX(id_proyecto), 0) + 100000 AS id_proyecto
             FROM proyecto`
        );
        const proyectoInexistenteId = idResult.rows[0].id_proyecto;

        const response = await request(app)
            .put(`/api/proyectos/${proyectoInexistenteId}/desactivar`)
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
    });

    test('CP-HU20-6-BE - API responde 403 para empleado',
        async () => {
            // Intentar eliminación lógica como empleado
            const response = await request(app)
                .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/desactivar`)
                .set('Cookie', tokenCookieForUser(ctx.empleado));

            // Debe denegar acceso
            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('success', false);
        }
    );
});

describe('Eliminación lógica con registros asociados', () => {

    let ctx;

    beforeEach(async () => {
        // Contexto con proyecto, fase y registro de horas ya creados
        ctx = await createContext();
        await createRegistroHoras(ctx, {
            idProyecto: ctx.proyecto.id_proyecto,
            idFase: ctx.fase.id_fase,
            idEmpleado: ctx.empleado.id_usuario,
            horas: 8,
            descripcion: 'Testing integración'
        });
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU20-5-BE - API mantiene trazabilidad',
        async () => {

            // Eliminación lógica
            const response = await request(app)
                .put(`/api/proyectos/${ctx.proyecto.id_proyecto}/desactivar`)
                .set('Cookie', tokenCookieForUser(ctx.propietario));
            // API OK
            expect(response.status).toBe(200);

            // Proyecto inactivo
            const proyectoBD = await pool.query(
                `SELECT is_active FROM proyecto WHERE id_proyecto = $1`,
                [ctx.proyecto.id_proyecto]
            );
            expect(proyectoBD.rows[0].is_active).toBe(false);

            // Fases siguen existiendo
            const fases = await pool.query(
                `SELECT * FROM fase WHERE id_proyecto = $1`,
                [ctx.proyecto.id_proyecto]
            );
            expect(fases.rows.length).toBeGreaterThan(0);

            // Registros de horas siguen existiendo
            const registros = await pool.query(
                `SELECT * FROM registro_horas WHERE id_proyecto = $1`,
                [ctx.proyecto.id_proyecto]
            );
            expect(registros.rows.length).toBeGreaterThan(0);
        }
    );
});
