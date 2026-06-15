const request = require('supertest');
const app = require('../../../src/app');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createRegistroHoras
} = require('../../helpers/integration.helper');

jest.setTimeout(30000);

describe('Rentabilidad proyecto', () => {
    let ctx;

    beforeEach(async () => {
        ctx = await createContext();
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU23-1-BE - API retorna métricas financieras', async () => {
        const response = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);

        const proyecto = response.body.data.find(p => p.id_proyecto === ctx.proyecto.id_proyecto);
        expect(proyecto).toBeDefined();
        expect(proyecto).toHaveProperty('rentabilidad');
        expect(proyecto).toHaveProperty('costo_real');
        expect(Number(proyecto.rentabilidad)).not.toBeNaN();

        const presupuesto = Number(proyecto.presupuesto);
        const costoReal = Number(proyecto.costo_real);
        const rentabilidad = Number(proyecto.rentabilidad);

        expect(rentabilidad).toBe(presupuesto - costoReal);
    });

    test('CP-HU23-3-BE - empleado no visualiza rentabilidad', async () => {
        const response = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.empleado));

        expect(response.status).toBe(200);
        response.body.data.forEach(proyecto => {
            expect(proyecto).not.toHaveProperty('rentabilidad');
        });
    });

    test('CP-HU23-4-BE - rentabilidad se recalcula automáticamente', async () => {
        // 1. Obtener rentabilidad inicial
        const responseInicial = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        const proyectoInicial = responseInicial.body.data.find(p => p.id_proyecto === ctx.proyecto.id_proyecto);
        const rentabilidadInicial = Number(proyectoInicial.rentabilidad);

        // 2. Insertar nuevo costo mediante registro de horas
        await createRegistroHoras(ctx, {
            idProyecto: ctx.proyecto.id_proyecto,
            idFase: ctx.fase.id_fase,
            idEmpleado: ctx.empleado.id_usuario,
            horas: 4,
            descripcion: 'QA_TEST_RENTABILIDAD'
        });

        // 3. Consultar nuevamente
        const responseFinal = await request(app)
            .get('/api/proyectos')
            .set('Cookie', tokenCookieForUser(ctx.propietario));

        const proyectoFinal = responseFinal.body.data.find(p => p.id_proyecto === ctx.proyecto.id_proyecto);
        const rentabilidadFinal = Number(proyectoFinal.rentabilidad);

        // 4. Validar recalculo
        expect(rentabilidadFinal).toBeLessThan(rentabilidadInicial);
    });
});
