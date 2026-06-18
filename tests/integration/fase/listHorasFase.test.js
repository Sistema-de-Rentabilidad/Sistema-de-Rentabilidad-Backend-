const request = require('supertest');
const app = require('../../../src/app');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createRegistroHoras,
    createFase,
    createUsuario
} = require('../../helpers/integration.helper');

jest.setTimeout(20000);

describe('HU24 - Ver horas trabajadas (lider)', () => {
    let ctx = null;

    beforeEach(async () => {
        ctx = await createContext();
    });

    afterEach(async () => {
        if (ctx) {
            await cleanupContext(ctx);
        }
    });

    test('CP-HU24-1-BE - Obtención horas por fase', async () => {
        // 1. Crear horas en la fase
        await createRegistroHoras(ctx, {
            idProyecto: ctx.proyecto.id_proyecto,
            idFase: ctx.fase.id_fase,
            idEmpleado: ctx.empleado.id_usuario,
            horas: 5
        });

        const cookies = tokenCookieForUser(ctx.lider);

        // 2. Consultar fases del proyecto
        const response = await request(app)
            .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
            .set('Cookie', cookies);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);

        const faseConHoras = response.body.data.find(f => f.id_fase === ctx.fase.id_fase);
        expect(Number(faseConHoras.horas_trabajadas)).toBe(5);
    });

    test('CP-HU24-3-BE - Restricción backend consulta horas por fase', async () => {
        // Creamos otro empleado que no está asignado al proyecto
        const otroEmpleado = await createUsuario(ctx, { idEmpresa: ctx.empresa.id_empresa, rol: 'empleado' });
        const response = await request(app)
            .get(`/api/proyectos/${ctx.proyecto.id_proyecto}/fases`)
            .set('Cookie', tokenCookieForUser(otroEmpleado));

        expect(response.status).toBe(403);
    });
});
