const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('servicio.service', () => {
    let mockServicioRepo;
    let servicioService;

    beforeEach(() => {
        jest.resetModules();

        mockServicioRepo = {
            findByEmpresaId: jest.fn(),
            findByNombreAndEmpresa: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            findByIdFull: jest.fn(),
            desactivar: jest.fn(),
            countProyectosByServicio: jest.fn()
        };

        jest.doMock('../../src/modules/servicio/servicio.repository', () => mockServicioRepo);
        servicioService = require('../../src/modules/servicio/servicio.service');

        mockServicioRepo.countProyectosByServicio.mockResolvedValue(0);
    });

    it('getServiciosByEmpresa delega al repositorio', async () => {
        mockServicioRepo.findByEmpresaId.mockResolvedValue(['A']);
        const res = await servicioService.getServiciosByEmpresa(1);
        expect(res).toEqual(['A']);
    });

    it('createServicio lanza si ya existe nombre duplicado', async () => {
        mockServicioRepo.findByNombreAndEmpresa.mockResolvedValue({ id_servicio: 10 });
        await expect(servicioService.createServicio({ nombre: '  Test  ', descripcion: 'X', empresaId: 1 })).rejects.toThrow('Ya existe un servicio con este nombre en tu empresa');
    });

    it('createServicio crea correctamente con nombre limpio', async () => {
        mockServicioRepo.findByNombreAndEmpresa.mockResolvedValue(null);
        mockServicioRepo.create.mockResolvedValue({ id_servicio: 11, nombre: 'Test' });

        const res = await servicioService.createServicio({ nombre: '  Test  ', descripcion: 'X', empresaId: 1 });
        expect(mockServicioRepo.create).toHaveBeenCalledWith({ nombre: 'Test', descripcion: 'X', empresaId: 1 });
        expect(res).toEqual({ id_servicio: 11, nombre: 'Test' });
    });

    it('getServicioById lanza si no existe', async () => {
        mockServicioRepo.findById.mockResolvedValue(null);
        await expect(servicioService.getServicioById(1, 1)).rejects.toThrow('Servicio no encontrado');
    });

    it('getServicioById lanza si no pertenece a empresa', async () => {
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 2 });
        await expect(servicioService.getServicioById(1, 1)).rejects.toThrow('No tienes permisos para acceder a este servicio');
    });

    it('updateServicio lanza si nombre duplicado en otra entidad', async () => {
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 1, id_servicio: 5 });
        mockServicioRepo.findByNombreAndEmpresa.mockResolvedValue({ id_servicio: 6 });

        await expect(servicioService.updateServicio(5, 1, { nombre: 'New' })).rejects.toThrow('Ya existe un servicio con este nombre en tu empresa');
    });

    it('updateServicio actualiza cuando no hay duplicado propio', async () => {
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 1, id_servicio: 5 });
        mockServicioRepo.findByNombreAndEmpresa.mockResolvedValue({ id_servicio: 5 });
        mockServicioRepo.update.mockResolvedValue({ id_servicio: 5, nombre: 'New' });

        const res = await servicioService.updateServicio(5, 1, { nombre: 'New' });
        expect(res).toEqual({ id_servicio: 5, nombre: 'New' });
    });

    it('desactivarServicio lanza si servicio no existe', async () => {
        mockServicioRepo.findByIdFull.mockResolvedValue(null);
        await expect(servicioService.desactivarServicio(1, 1)).rejects.toThrow('Servicio no encontrado');
    });

    it('desactivarServicio lanza si servicio ya inactivo', async () => {
        mockServicioRepo.findByIdFull.mockResolvedValue({ id_empresa: 1, is_active: false });
        await expect(servicioService.desactivarServicio(1, 1)).rejects.toThrow('El servicio ya está inactivo');
    });

    it('desactivarServicio lanza si el servicio tiene proyectos asociados', async () => {
        mockServicioRepo.findByIdFull.mockResolvedValue({ id_empresa: 1, is_active: true });
        mockServicioRepo.countProyectosByServicio.mockResolvedValue(2);

        await expect(servicioService.desactivarServicio(1, 1))
            .rejects.toThrow('No se puede eliminar un servicio con proyectos asociados');
        expect(mockServicioRepo.desactivar).not.toHaveBeenCalled();
    });

    it('desactivarServicio desactiva correctamente', async () => {
        mockServicioRepo.findByIdFull.mockResolvedValue({ id_empresa: 1, is_active: true });
        mockServicioRepo.desactivar.mockResolvedValue({ success: true });
        const res = await servicioService.desactivarServicio(1, 1);
        expect(res).toEqual({ success: true });
    });
});
