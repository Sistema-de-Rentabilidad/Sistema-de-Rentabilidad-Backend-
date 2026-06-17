const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const registroHorasRepository = require('../../../src/modules/registro_horas/horas.repository');

const {
    createContext,
    cleanupContext,
    tokenCookieForUser,
    createRegistroHoras,
    createMarcaje,
    createFase
} = require('../../helpers/integration.helper');

jest.setTimeout(30000);

describe('HU30 - Actualización de registro de horas', () => {
    let ctx;
    let registroTemporal;

    beforeEach(async () => {
        ctx = await createContext();
        // Necesitamos que el empleado tenga un marcaje activo para poder editar horas
        await createMarcaje(ctx, { idUsuario: ctx.empleado.id_usuario, entradaHaceHoras: 1 });
        
        registroTemporal = await createRegistroHoras(ctx, {
            idProyecto: ctx.proyecto.id_proyecto,
            idFase: ctx.fase.id_fase,
            idEmpleado: ctx.empleado.id_usuario,
            horas: 1,
            descripcion: 'Registro temporal para edición'
        });
    });

    afterEach(async () => {
        await cleanupContext(ctx);
    });

    test('CP-HU30-1-BE - Actualización exitosa de registro de horas', async () => {
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({
                horas: 2.5,
                descripcion: 'Actualización exitosa de prueba'
            });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(Number(response.body.data.horas)).toBe(2.5);
        expect(response.body.data.descripcion).toBe('Actualización exitosa de prueba');
    });

    test('CP-HU30-1-BD - Persistencia de edición de horas en BD', async () => {
        await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({
                horas: 4,
                descripcion: 'Persistencia BD confirmada'
            });

        const result = await pool.query(
            'SELECT horas, descripcion FROM registro_horas WHERE id_registro = $1',
            [registroTemporal.id_registro]
        );

        expect(result.rows.length).toBe(1);
        expect(Number(result.rows[0].horas)).toBe(4);
        expect(result.rows[0].descripcion).toBe('Persistencia BD confirmada');
    });

    test('CP-HU30-3-BE - Restricción edición proyecto finalizado', async () => {
        await pool.query('UPDATE proyecto SET fecha_fin_real = NOW() WHERE id_proyecto = $1', [ctx.proyecto.id_proyecto]);

        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({
                horas: 2,
                descripcion: 'Edición en proyecto cerrado'
            });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('No puedes registrar horas en un proyecto finalizado');
    });

    test('CP-HU30-4-BE - Restricción duplicidad edición fase', async () => {
        const otraFase = await createFase(ctx, { idProyecto: ctx.proyecto.id_proyecto });
        
        await createRegistroHoras(ctx, {
            idProyecto: ctx.proyecto.id_proyecto,
            idFase: otraFase.id_fase,
            idEmpleado: ctx.empleado.id_usuario,
            descripcion: 'Conflicto hoy'
        });

        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({
                id_fase: otraFase.id_fase
            });

        expect(response.status).toBe(400);
        // Ajustado al mensaje real recibido en los logs
        expect(response.body.message).toBe('Ya existe un registro de horas para esta fase en esa fecha');
    });

    test('CP-HU30-5-BE - Validación payload vacío edición', async () => {
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({});

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Debes enviar al menos un campo para actualizar');
    });

    test('CP-HU30-6-BE - Validación token expirado edición', async () => {
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', ['token=token_invalido'])
            .send({ horas: 2 });

        expect(response.status).toBe(401);
    });

    test('CP-HU30-7-BE - Restricción backend edición antigua', async () => {
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 2);

        const registroAntiguo = await createRegistroHoras(ctx, {
            idProyecto: ctx.proyecto.id_proyecto,
            idFase: ctx.fase.id_fase,
            idEmpleado: ctx.empleado.id_usuario,
            fecha: ayer,
            descripcion: 'Registro de hace 2 días'
        });

        const response = await request(app)
            .put(`/api/horas/${registroAntiguo.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({ horas: 2 });

        expect(response.status).toBe(400);
        expect(response.body.message).toBe('Solo puedes editar registros del mismo día');
    });

    test('CP-HU30-8-BE - Restricción edición fase inactiva', async () => {
        const faseInactiva = await createFase(ctx, { idProyecto: ctx.proyecto.id_proyecto, isActive: false });
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({
                id_fase: faseInactiva.id_fase
            });

        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Fase no encontrada');
    });

    test('CP-HU30-10-BE - Validación horas negativas edición', async () => {
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({ horas: -1 });
        expect(response.status).toBe(400);
        expect(response.body.errors[0].msg).toBe('Las horas deben estar entre 0.5 y 24');
    });

    test('CP-HU30-11-BE - Error interno API edición horas', async () => {
        const spy = jest.spyOn(registroHorasRepository, 'update').mockRejectedValue(new Error('Error de BD simulado'));

        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({ horas: 3, descripcion: 'Test error 500' });
        expect(response.status).toBe(500);
        spy.mockRestore();
    });

    test('CP-HU30-12-BE - Registro inexistente API edición', async () => {
        const response = await request(app)
            .put(`/api/horas/99999999`)
            .set('Cookie', tokenCookieForUser(ctx.empleado))
            .send({ horas: 2 });
        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Registro de horas no encontrado');
    });
});