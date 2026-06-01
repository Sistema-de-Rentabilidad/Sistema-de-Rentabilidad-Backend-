const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('nota.service', () => {
    let mockNotaRepo;
    let mockVerifyProyectoAccess;
    let notaService;

    beforeEach(() => {
        jest.resetModules();

        mockNotaRepo = {
            findByProyecto: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            findByIdFull: jest.fn(),
            desactivar: jest.fn()
        };

        mockVerifyProyectoAccess = jest.fn();

        jest.doMock('../../src/modules/nota/nota.repository', () => mockNotaRepo);
        jest.doMock('../../src/utils/verifyProyectoAccess', () => mockVerifyProyectoAccess);
        notaService = require('../../src/modules/nota/nota.service');
    });

    it('getNotasByProyecto llama verifyProyectoAccess y devuelve notas', async () => {
        mockVerifyProyectoAccess.mockResolvedValue(true);
        mockNotaRepo.findByProyecto.mockResolvedValue(['nota1']);
        const res = await notaService.getNotasByProyecto(1, 1);
        expect(mockVerifyProyectoAccess).toHaveBeenCalledWith(1, 1);
        expect(res).toEqual(['nota1']);
    });

    it('createNota lanza si el usuario no es líder del proyecto', async () => {
        mockVerifyProyectoAccess.mockResolvedValue({ id_lider: 2 });
        await expect(notaService.createNota(1, { descripcion: 'x' }, { id_usuario: 3 }, 1)).rejects.toThrow('Solo el líder asignado a este proyecto puede registrar notas');
    });

    it('createNota crea nota cuando el usuario es líder', async () => {
        mockVerifyProyectoAccess.mockResolvedValue({ id_lider: 3 });
        mockNotaRepo.create.mockResolvedValue({ id_nota: 10 });
        const res = await notaService.createNota(1, { descripcion: 'x' }, { id_usuario: 3 }, 1);
        expect(res).toEqual({ id_nota: 10 });
    });

    it('getNotaById lanza si no existe', async () => {
        mockNotaRepo.findById.mockResolvedValue(null);
        await expect(notaService.getNotaById(1, 1)).rejects.toThrow('Nota no encontrada');
    });

    it('getNotaById lanza si no pertenece a la empresa', async () => {
        mockNotaRepo.findById.mockResolvedValue({ id_empresa: 2 });
        await expect(notaService.getNotaById(1, 1)).rejects.toThrow('No tienes permisos para acceder a esta nota');
    });

    it('updateNota lanza si no existe', async () => {
        mockNotaRepo.findById.mockResolvedValue(null);
        await expect(notaService.updateNota(1, { descripcion: 'x' }, { id_usuario: 3 }, 1)).rejects.toThrow('Nota no encontrada');
    });

    it('updateNota lanza si no es dueño', async () => {
        mockNotaRepo.findById.mockResolvedValue({ id_empresa: 1, id_lider: 2 });
        await expect(notaService.updateNota(1, { descripcion: 'x' }, { id_usuario: 3 }, 1)).rejects.toThrow('Solo puedes editar tus propias notas');
    });

    it('updateNota actualiza nota correctamente', async () => {
        mockNotaRepo.findById.mockResolvedValue({ id_empresa: 1, id_lider: 3 });
        mockNotaRepo.update.mockResolvedValue({ id_nota: 5, descripcion: 'x' });
        const res = await notaService.updateNota(1, { descripcion: 'x' }, { id_usuario: 3 }, 1);
        expect(res).toEqual({ id_nota: 5, descripcion: 'x' });
    });

    it('desactivarNota lanza si no existe', async () => {
        mockNotaRepo.findByIdFull.mockResolvedValue(null);
        await expect(notaService.desactivarNota(1, { id_usuario: 3 }, 1)).rejects.toThrow('Nota no encontrada');
    });

    it('desactivarNota lanza si no es dueño', async () => {
        mockNotaRepo.findByIdFull.mockResolvedValue({ id_empresa: 1, id_lider: 2, is_active: true });
        await expect(notaService.desactivarNota(1, { id_usuario: 3 }, 1)).rejects.toThrow('Solo puedes eliminar tus propias notas');
    });

    it('desactivarNota lanza si ya fue eliminada', async () => {
        mockNotaRepo.findByIdFull.mockResolvedValue({ id_empresa: 1, id_lider: 3, is_active: false });
        await expect(notaService.desactivarNota(1, { id_usuario: 3 }, 1)).rejects.toThrow('La nota ya fue eliminada');
    });

    it('desactivarNota desactiva correctamente', async () => {
        mockNotaRepo.findByIdFull.mockResolvedValue({ id_empresa: 1, id_lider: 3, is_active: true });
        mockNotaRepo.desactivar.mockResolvedValue({ success: true });
        const res = await notaService.desactivarNota(1, { id_usuario: 3 }, 1);
        expect(res).toEqual({ success: true });
    });
});
