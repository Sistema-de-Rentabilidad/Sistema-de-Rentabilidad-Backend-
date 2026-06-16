const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('horas.service', () => {
    let mockRegistroHorasRepo;
    let mockProyectoRepo;
    let mockProyectoEmpleadoRepo;
    let mockFaseRepo;
    let mockFaseEmpleadoRepo;
    let mockDateUtils;
    let horasService;

    beforeEach(() => {
        jest.resetModules();

        mockRegistroHorasRepo = {
            findByEmpleado: jest.fn(),
            getTotalHorasByEmpleadoYFecha: jest.fn(),
            getTotalHorasSinRegistro: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn()
        };

        mockProyectoRepo = {
            findById: jest.fn()
        };

        mockProyectoEmpleadoRepo = {
            exists: jest.fn()
        };

        mockFaseRepo = {
            findById: jest.fn(),
            findByProyecto: jest.fn()
        };

        mockFaseEmpleadoRepo = {
            exists: jest.fn(),
            create: jest.fn()
        };

        mockDateUtils = {
            getFechaActual: jest.fn().mockReturnValue('2025-06-01'),
            toFechaString: jest.fn().mockImplementation((date) => date)
        };

        jest.doMock('../../src/modules/registro_horas/horas.repository', () => mockRegistroHorasRepo);
        jest.doMock('../../src/modules/proyecto/proyecto.repository', () => mockProyectoRepo);
        jest.doMock('../../src/modules/proyecto_empleado/proyecto_empleado.repository', () => mockProyectoEmpleadoRepo);
        jest.doMock('../../src/modules/fase/fase.repository', () => mockFaseRepo);
        jest.doMock('../../src/modules/fase_empleado/fase_empleado.repository', () => mockFaseEmpleadoRepo);
        jest.doMock('../../src/utils/dateTime', () => mockDateUtils);

        horasService = require('../../src/modules/registro_horas/horas.service');
    });
    
    it('getRegistrosHoras delega al repositorio', async () => {
        mockRegistroHorasRepo.findByEmpleado.mockResolvedValue(['Y']);
        const res = await horasService.getRegistrosHoras({ user: { id_usuario: 7 }, empresaId: 2 });
        expect(res).toEqual(['Y']);
    });

    it('createRegistroHoras lanza si total mayor a 12 horas diarias', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: null });
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(true);
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 1, id_fase: 2 });
        mockFaseRepo.findByProyecto.mockResolvedValue([{ id_fase: 2 }]);
        mockRegistroHorasRepo.getTotalHorasByEmpleadoYFecha.mockResolvedValue(8);

        await expect(horasService.createRegistroHoras({
            id_proyecto: 1,
            id_fase: 2,
            horas: 5,
            descripcion: 'x',
            user: { id_usuario: 4, tipo_pago: 'mensual' },
            empresaId: 1
        })).rejects.toThrow('No puedes registrar más de 12 horas diarias');
    });

    it('createRegistroHoras retorna sin error si tipo_pago no es mensual', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: null });
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(true);
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 1, id_fase: 2 });
        mockFaseRepo.findByProyecto.mockResolvedValue([{ id_fase: 2 }]);
        mockRegistroHorasRepo.getTotalHorasByEmpleadoYFecha.mockResolvedValue(2);
        mockFaseEmpleadoRepo.exists.mockResolvedValue(true);
        mockRegistroHorasRepo.create.mockResolvedValue({ id_registro: 6 });

        const res = await horasService.createRegistroHoras({
            id_proyecto: 1,
            id_fase: 2,
            horas: 5,
            descripcion: 'x',
            user: { id_usuario: 4, tipo_pago: 'por_hora' },
            empresaId: 1
        });

        expect(res).toEqual({ id_registro: 6 });
    });

    it('createRegistroHoras lanza si proyecto no existe', async () => {
        mockProyectoRepo.findById.mockResolvedValue(null);
        await expect(horasService.createRegistroHoras({ id_proyecto: 1, id_fase: 2, horas: 1, descripcion: 'x', user: { id_usuario: 4, tipo_pago: 'mensual' }, empresaId: 1 })).rejects.toThrow('Proyecto no encontrado');
    });

    it('createRegistroHoras lanza si proyecto es de otra empresa', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 2, fecha_fin_real: null });
        await expect(horasService.createRegistroHoras({ id_proyecto: 1, id_fase: 2, horas: 1, descripcion: 'x', user: { id_usuario: 4, tipo_pago: 'mensual' }, empresaId: 1 })).rejects.toThrow('No tienes permisos para acceder a este proyecto');
    });

    it('createRegistroHoras lanza si proyecto finalizado', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: '2025-05-02' });
        await expect(horasService.createRegistroHoras({ id_proyecto: 1, id_fase: 2, horas: 1, descripcion: 'x', user: { id_usuario: 4, tipo_pago: 'mensual' }, empresaId: 1 })).rejects.toThrow('No se pueden registrar horas en un proyecto finalizado');
    });

    it('createRegistroHoras lanza si empleado no esta asignado', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: null });
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(false);
        await expect(horasService.createRegistroHoras({ id_proyecto: 1, id_fase: 2, horas: 1, descripcion: 'x', user: { id_usuario: 4, tipo_pago: 'mensual' }, empresaId: 1 })).rejects.toThrow('No estás asignado a este proyecto');
    });

    it('createRegistroHoras lanza si fase no existe', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: null });
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(true);
        mockFaseRepo.findById.mockResolvedValue(null);
        await expect(horasService.createRegistroHoras({ id_proyecto: 1, id_fase: 2, horas: 1, descripcion: 'x', user: { id_usuario: 4, tipo_pago: 'mensual' }, empresaId: 1 })).rejects.toThrow('Fase no encontrada');
    });

    it('createRegistroHoras lanza si fase no pertenece a empresa', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: null });
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(true);
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 2 });
        await expect(horasService.createRegistroHoras({ id_proyecto: 1, id_fase: 2, horas: 1, descripcion: 'x', user: { id_usuario: 4, tipo_pago: 'mensual' }, empresaId: 1 })).rejects.toThrow('No tienes permisos para acceder a esta fase');
    });

    it('createRegistroHoras lanza si fase no pertenece al proyecto', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: null });
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(true);
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 1, id_fase: 99 });
        await expect(horasService.createRegistroHoras({ id_proyecto: 1, id_fase: 2, horas: 1, descripcion: 'x', user: { id_usuario: 4, tipo_pago: 'mensual' }, empresaId: 1 })).rejects.toThrow('La fase no pertenece al proyecto');
    });

    it('createRegistroHoras crea faseEmpleado y registro cuando todo es correcto', async () => {
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: null });
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(true);
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 1, id_fase: 2 });
        mockFaseRepo.findByProyecto.mockResolvedValue([{ id_fase: 2 }]);
        mockRegistroHorasRepo.getTotalHorasByEmpleadoYFecha.mockResolvedValue(2);
        mockFaseEmpleadoRepo.exists.mockResolvedValue(false);
        mockRegistroHorasRepo.create.mockResolvedValue({ id_registro: 5 });

        const res = await horasService.createRegistroHoras({
            id_proyecto: 1,
            id_fase: 2,
            horas: 3,
            descripcion: 'Trabajo',
            user: { id_usuario: 4, tipo_pago: 'mensual' },
            empresaId: 1
        });

        expect(mockFaseEmpleadoRepo.create).toHaveBeenCalledWith(4, 2);
        expect(res).toEqual({ id_registro: 5 });
    });

    it('updateRegistroHoras actualiza correctamente registro del mismo día', async () => {
        mockRegistroHorasRepo.findById.mockResolvedValue({
            id_empleado: 4,
            id_proyecto: 1,
            id_fase: 2,
            horas: 3,
            descripcion: 'Trabajo',
            fecha: '2025-06-01'
        });
        mockProyectoRepo.findById.mockResolvedValue({ id_empresa: 1, fecha_fin_real: null });
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(true);
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 1, id_fase: 2 });
        mockFaseRepo.findByProyecto.mockResolvedValue([{ id_fase: 2 }]);
        mockRegistroHorasRepo.getTotalHorasByEmpleadoYFecha.mockResolvedValue(2);
        mockRegistroHorasRepo.update.mockResolvedValue({ id_registro: 7, horas: 4, descripcion: 'Actualizado' });

        const res = await horasService.updateRegistroHoras({
            id: 1,
            id_proyecto: 1,
            id_fase: 2,
            horas: 4,
            descripcion: 'Actualizado',
            user: { id_usuario: 4, tipo_pago: 'mensual' },
            empresaId: 1
        });

        expect(res).toEqual({ id_registro: 7, horas: 4, descripcion: 'Actualizado' });
        expect(mockRegistroHorasRepo.update).toHaveBeenCalledWith({
            id: 1,
            id_proyecto: 1,
            id_fase: 2,
            horas: 4,
            descripcion: 'Actualizado'
        });
    });

    it('getRegistroHorasById lanza 404 si no existe', async () => {
        mockRegistroHorasRepo.findById.mockResolvedValue(null);
        await expect(horasService.getRegistroHorasById({ id: 1, user: { id_usuario: 4 } })).rejects.toThrow('Registro de horas no encontrado');
    });

    it('getRegistroHorasById lanza si usuario no es dueño', async () => {
        mockRegistroHorasRepo.findById.mockResolvedValue({ id_empleado: 5 });
        await expect(horasService.getRegistroHorasById({ id: 1, user: { id_usuario: 4 } })).rejects.toThrow('No tienes acceso a este registro');
    });

    it('getRegistroHorasById retorna registro si es dueño', async () => {
        const registro = { id_empleado: 4, id_registro: 1 };
        mockRegistroHorasRepo.findById.mockResolvedValue(registro);
        const res = await horasService.getRegistroHorasById({ id: 1, user: { id_usuario: 4 } });
        expect(res).toEqual(registro);
    });
});
