const request = require('supertest');
const app = require('../../../src/app');
const pool = require('../../../src/config/db');
const registroHorasRepository = require('../../../src/modules/registro_horas/horas.repository');


const { login } = require('../../helpers/auth');
const {
    getRelacionValidaProyecto,
    getRegistroHorasEmpleadoColumn,
    createRegistroHoras,
    deleteRegistroHorasById
} = require('../../helpers/registroHoras.helper');

jest.setTimeout(30000); // Aumentar el tiempo de espera para pruebas que involucran base de datos

describe('HU30 - Actualización de registro de horas', () => {
    let authEmpleado;
    let registroTemporal;

    beforeAll(async () => {
        authEmpleado = await login('qa_empleado1@test.com', 'Qa123456*');

        // Crear un registro temporal para asegurar que siempre haya uno para editar
        const empleadoId = authEmpleado.user.id_usuario;
        const proyectoId = 1; // Proyecto base en las pruebas

        // Limpieza previa: eliminar cualquier registro previo de este empleado en este proyecto hoy
        // para evitar conflictos de unicidad antes de empezar
        const empleadoColumn = await getRegistroHorasEmpleadoColumn();
        await pool.query(`DELETE FROM registro_horas WHERE ${empleadoColumn} = $1 AND id_proyecto = $2`, [empleadoId, proyectoId]);

        const relacion = await getRelacionValidaProyecto(proyectoId);

        registroTemporal = await createRegistroHoras({
            idProyecto: relacion.id_proyecto,
            idFase: relacion.id_fase,
            idEmpleado: empleadoId,
            fecha: new Date(), // Hoy
            horas: 1,
            descripcion: 'Registro temporal para edición'
        });
    });

    afterAll(async () => {
        if (registroTemporal) {
            await deleteRegistroHorasById(registroTemporal.id_registro);
        }
    });

    test('CP-HU30-1-BE - Actualización exitosa de registro de horas', async () => {
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', authEmpleado.cookies)
            .send({
                horas: 2.5,
                descripcion: 'Actualización exitosa de prueba'
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(Number(response.body.data.horas)).toBe(2.5);
        expect(response.body.data.descripcion).toBe('Actualización exitosa de prueba');
    });

    test('CP-HU30-1-BD - Persistencia de edición de horas en BD', async () => {
        // 1. Ejecutar la actualización a través de la API
        await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', authEmpleado.cookies)
            .send({
                horas: 4,
                descripcion: 'Persistencia BD confirmada'
            });

        // 2. Consultar directamente en la base de datos para verificar persistencia
        const result = await pool.query(
            'SELECT horas, descripcion FROM registro_horas WHERE id_registro = $1',
            [registroTemporal.id_registro]
        );

        // 3. Resultado esperado
        expect(result.rows.length).toBe(1);
        expect(Number(result.rows[0].horas)).toBe(4);
        expect(result.rows[0].descripcion).toBe('Persistencia BD confirmada');
    });

    test('CP-HU30-3-BE - Restricción edición proyecto finalizado', async () => {
        // 1. Finalizar el proyecto temporalmente
        await pool.query('UPDATE proyecto SET fecha_fin_real = NOW() WHERE id_proyecto = $1', [registroTemporal.id_proyecto]);

        // 2. Intentar editar el registro asociado
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', authEmpleado.cookies)
            .send({
                horas: 2,
                descripcion: 'Edición en proyecto cerrado'
            });

        // 3. Resultado esperado: 400 (Bad Request)
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toBe('No puedes registrar horas en un proyecto finalizado');

        // Limpieza: revertir la finalización para otros tests
        await pool.query('UPDATE proyecto SET fecha_fin_real = NULL WHERE id_proyecto = $1', [registroTemporal.id_proyecto]);
    });

    test('CP-HU30-4-BE - Restricción duplicidad edición fase', async () => {
        // Necesitamos otra fase en el mismo proyecto para intentar duplicar
        const fases = await pool.query('SELECT id_fase FROM fase WHERE id_proyecto = $1 AND id_fase != $2 LIMIT 1',
            [registroTemporal.id_proyecto, registroTemporal.id_fase]);

        if (fases.rows.length > 0) {
            const otraFaseId = fases.rows[0].id_fase;

            // 1. Creamos el registro del conflicto en la MISMA fecha (hoy)
            // Ya sabemos que otraFaseId != registroTemporal.id_fase
            const registroConflicto = await createRegistroHoras({
                idProyecto: registroTemporal.id_proyecto,
                idFase: otraFaseId,
                idEmpleado: authEmpleado.user.id_usuario,
                fecha: new Date(),
                descripcion: 'Conflicto hoy'
            });

            // 2. Intentamos editar registroTemporal para cambiar su fase a otraFaseId
            const response = await request(app)
                .put(`/api/horas/${registroTemporal.id_registro}`)
                .set('Cookie', authEmpleado.cookies)
                .send({
                    id_fase: otraFaseId
                });

            console.log(response.status);
            console.log(response.body);

            // Resultado esperado: 400
            expect(response.status).toBe(400);
            // Asegúrate que el mensaje sea exactamente este
            expect(response.body.message).toBe('Ya existe un registro de horas para esta fase en esa fecha');

            // Limpieza
            await deleteRegistroHorasById(registroConflicto.id_registro);

        }

    });

    test('CP-HU30-5-BE - Validación payload vacío edición', async () => {
        // Intentar actualizar sin enviar datos en el cuerpo
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', authEmpleado.cookies)
            .send({});

        // Resultado esperado: 400 (Bad Request) según la validación en horas.validation.js
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toBe('Debes enviar al menos un campo para actualizar');
    });

    test('CP-HU30-6-BE - Validación token expirado edición', async () => {
        // Para simular un token expirado/inválido, enviamos un header de autorización
        // o cookie inexistente/inválido.
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', ['token=token_invalido_o_expirado']) // Simulación de cookie inválida
            .send({ horas: 2 });

        // Resultado esperado: 401 (Unauthorized)
        expect(response.status).toBe(401);
    });

    test('CP-HU30-7-BE - Restricción backend edición antigua (fecha pasada)', async () => {
        // 1. Crear un registro antiguo (ej. hace 2 días)
        const ayer = new Date();
        ayer.setDate(ayer.getDate() - 2);

        const registroAntiguo = await createRegistroHoras({
            idProyecto: registroTemporal.id_proyecto,
            idFase: registroTemporal.id_fase,
            idEmpleado: authEmpleado.user.id_usuario,
            fecha: ayer,
            descripcion: 'Registro de hace 2 días'
        });

        // 2. Intentar editar el registro antiguo
        const response = await request(app)
            .put(`/api/horas/${registroAntiguo.id_registro}`)
            .set('Cookie', authEmpleado.cookies)
            .send({ horas: 2 });

        console.log(response.status);
        console.log(response.body);

        // 3. Resultado esperado: 400 (Solo se permite editar registros del mismo día)
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toBe('Solo puedes editar registros del mismo día');

        // Limpieza
        await deleteRegistroHorasById(registroAntiguo.id_registro);
    });

    test('CP-HU30-8-BE - Restricción edición fase inactiva', async () => {
        // 1. Crear una fase nueva y desactivarla en la BD
        const nuevaFase = await pool.query(
            'INSERT INTO fase (nombre, id_proyecto, horas_estimadas, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
            ['Fase Inactiva Test', registroTemporal.id_proyecto, 10, false]
        );
        const faseInactivaId = nuevaFase.rows[0].id_fase;

        // 2. Intentar editar el registro temporal para cambiar su fase a la inactiva
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', authEmpleado.cookies)
            .send({
                id_fase: faseInactivaId
            });

        // 3. Resultado esperado: 404 (Fase no encontrada)
        // El servicio intenta encontrar la fase, pero como está desactivada o filtrada,
        // retorna 404 Fase no encontrada.
        expect(response.status).toBe(404);
        expect(response.body.message).toBe('Fase no encontrada');

        // Limpieza
        await pool.query('DELETE FROM fase WHERE id_fase = $1', [faseInactivaId]);
    });

    test('CP-HU30-10-BE - Validación horas negativas edición', async () => {
        // Intentar enviar horas negativas
        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', authEmpleado.cookies)
            .send({
                horas: -1
            });

        // Resultado esperado: 400 (Bad Request)
        // El middleware updateHorasValidation en horas.validation.js valida esto con .isFloat({ min: 0.5 })
        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors[0].msg).toBe('Las horas deben estar entre 0.5 y 12');
    });

    test('CP-HU30-11-BE - Error interno API edición horas', async () => {
        // Espiamos el repositorio y forzamos un error
        const spy = jest.spyOn(registroHorasRepository, 'update').mockRejectedValue(new Error('Error de BD simulado'));

        const response = await request(app)
            .put(`/api/horas/${registroTemporal.id_registro}`)
            .set('Cookie', authEmpleado.cookies)
            .send({
                horas: 3,
                descripcion: 'Test error 500'
            });

        // Resultado esperado: 500 (Internal Server Error)
        expect(response.status).toBe(500);

        // Restauramos el espía
        spy.mockRestore();
    });

    test('CP-HU30-12-BE - Registro inexistente API edición', async () => {
        // ID que probablemente no existe (usamos un número muy grande)
        const idInexistente = 99999999;

        const response = await request(app)
            .put(`/api/horas/${idInexistente}`)
            .set('Cookie', authEmpleado.cookies)
            .send({
                horas: 2
            });

        // Resultado esperado: 404 (Not Found)
        expect(response.status).toBe(404);
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.message).toBe('Registro de horas no encontrado');
    });
});
