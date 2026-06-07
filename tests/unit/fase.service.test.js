const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('fase.service', () => {
    let mockFaseRepo;
    let mockProyectoEmpleadoRepo;
    let mockVerifyProyectoAccess;
    let faseService;

    beforeEach(() => {
        jest.resetModules();

        mockFaseRepo = {
            findByProyecto: jest.fn(),
            findByNombreAndProyecto: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            findByIdFull: jest.fn(),
            desactivar: jest.fn()
        };

        mockProyectoEmpleadoRepo = {
            exists: jest.fn()
        };

        mockVerifyProyectoAccess = jest.fn();

        jest.doMock('../../src/modules/fase/fase.repository', () => mockFaseRepo);
        jest.doMock('../../src/modules/proyecto_empleado/proyecto_empleado.repository', () => mockProyectoEmpleadoRepo);
        jest.doMock('../../src/utils/verifyProyectoAccess', () => mockVerifyProyectoAccess);

        faseService = require('../../src/modules/fase/fase.service');
    });

    it('getFasesByProyecto llama verifyProyectoAccess y devuelve fases', async () => {
        mockVerifyProyectoAccess.mockResolvedValue(true);
        mockFaseRepo.findByProyecto.mockResolvedValue(['fase1']);
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(true);
        const res = await faseService.getFasesByProyecto(1, 1, { rol: 'empleado', id_usuario: 3 });
        expect(mockVerifyProyectoAccess).toHaveBeenCalledWith(1, 1);
        expect(res).toEqual(['fase1']);
    });

    it('getFasesByProyecto lanza si empleado no asignado', async () => {
        mockVerifyProyectoAccess.mockResolvedValue(true);
        mockProyectoEmpleadoRepo.exists.mockResolvedValue(false);
        await expect(faseService.getFasesByProyecto(1, 1, { rol: 'empleado', id_usuario: 3 })).rejects.toThrow('No tienes permisos para acceder a las fases de este proyecto');
    });

    it('createFase lanza si duplicado existe', async () => {
        mockVerifyProyectoAccess.mockResolvedValue(true);
        mockFaseRepo.findByNombreAndProyecto.mockResolvedValue({ id_fase: 5 });
        await expect(faseService.createFase(1, { nombre: 'Test', horas_estimadas: 10 }, 1)).rejects.toThrow('Ya existe una fase con ese nombre en este proyecto');
    });

    it('createFase crea una fase nueva', async () => {
        mockVerifyProyectoAccess.mockResolvedValue(true);
        mockFaseRepo.findByNombreAndProyecto.mockResolvedValue(null);
        mockFaseRepo.create.mockResolvedValue({ id_fase: 6 });
        const res = await faseService.createFase(1, { nombre: 'Test', horas_estimadas: 10 }, 1);
        expect(res).toEqual({ id_fase: 6 });
    });

    it('getFaseById lanza si no existe', async () => {
        mockFaseRepo.findById.mockResolvedValue(null);
        await expect(faseService.getFaseById(1, 1)).rejects.toThrow('Fase no encontrada');
    });

    it('getFaseById lanza si empresa no coincide', async () => {
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 2 });
        await expect(faseService.getFaseById(1, 1)).rejects.toThrow('No tienes permisos para acceder a esta fase');
    });

    it('updateFase lanza si hay duplicado con otro id', async () => {
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 1, id_proyecto: 10 });
        mockFaseRepo.findByNombreAndProyecto.mockResolvedValue({ id_fase: 2 });
        await expect(faseService.updateFase(1, { nombre: 'Nuevo' }, 1)).rejects.toThrow('Ya existe una fase con ese nombre en este proyecto');
    });

    it('updateFase actualiza cuando el nombre duplicado es el mismo registro', async () => {
        mockFaseRepo.findById.mockResolvedValue({ id_empresa: 1, id_proyecto: 10 });
        mockFaseRepo.findByNombreAndProyecto.mockResolvedValue({ id_fase: 1 });
        mockFaseRepo.update.mockResolvedValue({ id_fase: 1, nombre: 'Nuevo' });
        const res = await faseService.updateFase(1, { nombre: 'Nuevo' }, 1);
        expect(res).toEqual({ id_fase: 1, nombre: 'Nuevo' });
    });

    it('desactivarFase lanza si no existe', async () => {
        mockFaseRepo.findByIdFull.mockResolvedValue(null);
        await expect(faseService.desactivarFase(1, 1)).rejects.toThrow('Fase no encontrada');
    });

    it('desactivarFase lanza si ya inactiva', async () => {
        mockFaseRepo.findByIdFull.mockResolvedValue({ id_proyecto: 1, is_active: false });
        await expect(faseService.desactivarFase(1, 1)).rejects.toThrow('La fase ya fue eliminada');
    });

    it('desactivarFase desactiva correctamente', async () => {
        mockFaseRepo.findByIdFull.mockResolvedValue({ id_proyecto: 1, is_active: true });
        mockFaseRepo.desactivar.mockResolvedValue({ success: true });
        const res = await faseService.desactivarFase(1, 1);
        expect(res).toEqual({ success: true });
    });
});
