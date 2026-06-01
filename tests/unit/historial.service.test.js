const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('historial.service', () => {
    let mockHistorialRepo;
    let mockUsuarioRepo;
    let historialService;

    beforeEach(() => {
        jest.resetModules();

        mockHistorialRepo = {
            findActivo: jest.fn(),
            findCambioHoy: jest.fn(),
            cerrarHistorial: jest.fn(),
            create: jest.fn()
        };

        mockUsuarioRepo = {
            findById: jest.fn()
        };

        jest.doMock('../../src/modules/historial_sueldo/historial.repository.js', () => mockHistorialRepo);
        jest.doMock('../../src/modules/usuario/usuario.repository.js', () => mockUsuarioRepo);
        historialService = require('../../src/modules/historial_sueldo/historial.service');
    });

    it('createHistorial lanza si usuario no existe', async () => {
        mockUsuarioRepo.findById.mockResolvedValue(null);
        await expect(historialService.createHistorial({ id_usuario: 1, tipo_pago: 'mensual', monto: 100 }, 1)).rejects.toThrow('Usuario no existe');
    });

    it('createHistorial lanza si usuario no pertenece a la empresa', async () => {
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 2 });
        await expect(historialService.createHistorial({ id_usuario: 1, tipo_pago: 'mensual', monto: 100 }, 1)).rejects.toThrow('No autorizado');
    });

    it('createHistorial lanza si ya existe cambio hoy', async () => {
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockHistorialRepo.findCambioHoy.mockResolvedValue({ id_historial: 1 });
        await expect(historialService.createHistorial({ id_usuario: 1, tipo_pago: 'mensual', monto: 100, horas_mensuales: 160 }, 1)).rejects.toThrow('Ya existe un cambio de sueldo para este empleado hoy');
    });

    it('createHistorial cierra historial activo antes de crear uno nuevo', async () => {
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockHistorialRepo.findCambioHoy.mockResolvedValue(null);
        mockHistorialRepo.findActivo.mockResolvedValue({ id_historial: 7 });
        mockHistorialRepo.create.mockResolvedValue({ id_historial: 8 });

        const res = await historialService.createHistorial({ id_usuario: 1, tipo_pago: 'por_hora', monto: 50 }, 1);

        expect(mockHistorialRepo.cerrarHistorial).toHaveBeenCalledWith(7);
        expect(res).toEqual({ id_historial: 8 });
    });

    it('createHistorial lanza si es mensual y no manda horas_mensuales', async () => {
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockHistorialRepo.findCambioHoy.mockResolvedValue(null);
        mockHistorialRepo.findActivo.mockResolvedValue(null);
        await expect(historialService.createHistorial({ id_usuario: 1, tipo_pago: 'mensual', monto: 100 }, 1)).rejects.toThrow('Las horas mensuales son obligatorias para sueldo mensual');
    });

    it('createHistorial crea historial correctamente', async () => {
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockHistorialRepo.findCambioHoy.mockResolvedValue(null);
        mockHistorialRepo.findActivo.mockResolvedValue(null);
        mockHistorialRepo.create.mockResolvedValue({ id_historial: 9 });

        const res = await historialService.createHistorial({ id_usuario: 1, tipo_pago: 'por_hora', monto: 45 }, 1);
        expect(res).toEqual({ id_historial: 9 });
    });
});
