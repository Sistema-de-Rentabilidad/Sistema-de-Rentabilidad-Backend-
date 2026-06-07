const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('empresa.service', () => {
    let mockEmpresaRepo;
    let empresaService;

    beforeEach(() => {
        jest.resetModules();

        mockEmpresaRepo = {
            findAll: jest.fn(),
            findByNombre: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn()
        };

        jest.doMock('../../src/modules/empresa/empresa.repository', () => mockEmpresaRepo);
        empresaService = require('../../src/modules/empresa/empresa.service');
    });

    it('getEmpresas delega al repositorio', async () => {
        mockEmpresaRepo.findAll.mockResolvedValue(['empresa']);
        const res = await empresaService.getEmpresas();
        expect(res).toEqual(['empresa']);
    });

    it('createEmpresa lanza si nombre duplicado', async () => {
        mockEmpresaRepo.findByNombre.mockResolvedValue({ id_empresa: 1 });
        await expect(empresaService.createEmpresa({ nombre: 'Test' })).rejects.toThrow('Ya existe una empresa con ese nombre');
    });

    it('createEmpresa crea nueva empresa', async () => {
        mockEmpresaRepo.findByNombre.mockResolvedValue(null);
        mockEmpresaRepo.create.mockResolvedValue({ id_empresa: 3, nombre: 'Test' });
        const res = await empresaService.createEmpresa({ nombre: 'Test' });
        expect(res).toEqual({ id_empresa: 3, nombre: 'Test' });
    });

    it('getEmpresaById lanza si no existe', async () => {
        mockEmpresaRepo.findById.mockResolvedValue(null);
        await expect(empresaService.getEmpresaById({ id: 1, user: { rol: 'admin' } })).rejects.toThrow('Empresa no encontrada');
    });

    it('getEmpresaById lanza si no pertenece y no es admin', async () => {
        mockEmpresaRepo.findById.mockResolvedValue({ id_empresa: 2 });
        await expect(empresaService.getEmpresaById({ id: 1, user: { rol: 'propietario', id_empresa: 1 } })).rejects.toThrow('No tienes permisos para acceder a esta empresa');
    });

    it('getEmpresaById retorna empresa para admin', async () => {
        mockEmpresaRepo.findById.mockResolvedValue({ id_empresa: 2 });
        const res = await empresaService.getEmpresaById({ id: 1, user: { rol: 'admin' } });
        expect(res).toEqual({ id_empresa: 2 });
    });

    it('updateEmpresa lanza si no existe', async () => {
        mockEmpresaRepo.findById.mockResolvedValue(null);
        await expect(empresaService.updateEmpresa({ id: 1, nombre: 'X', user: { rol: 'admin' } })).rejects.toThrow('Empresa no encontrada');
    });

    it('updateEmpresa lanza si propietario edita otra empresa', async () => {
        mockEmpresaRepo.findById.mockResolvedValue({ id_empresa: 2 });
        await expect(empresaService.updateEmpresa({ id: 1, nombre: 'X', user: { rol: 'propietario', id_empresa: 1 } })).rejects.toThrow('No tienes permisos para editar esta empresa');
    });

    it('updateEmpresa lanza si nombre ya usado por otra empresa', async () => {
        mockEmpresaRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockEmpresaRepo.findByNombre.mockResolvedValue({ id_empresa: 2 });
        await expect(empresaService.updateEmpresa({ id: 1, nombre: 'X', user: { rol: 'admin' } })).rejects.toThrow('Ya existe una empresa con ese nombre');
    });

    it('updateEmpresa actualiza nombre sin conflicto', async () => {
        mockEmpresaRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockEmpresaRepo.findByNombre.mockResolvedValue({ id_empresa: 1 });
        mockEmpresaRepo.update.mockResolvedValue({ id_empresa: 1, nombre: 'X' });
        const res = await empresaService.updateEmpresa({ id: 1, nombre: 'X', user: { rol: 'admin' } });
        expect(res).toEqual({ id_empresa: 1, nombre: 'X' });
    });
});
