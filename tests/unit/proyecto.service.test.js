const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('proyecto.service', () => {
    let mockProyectoRepo;
    let mockServicioRepo;
    let mockUsuarioRepo;
    let proyectoService;

    beforeEach(() => {
        jest.resetModules();

        mockProyectoRepo = {
            findByNombreAndEmpresa: jest.fn(),
            findById: jest.fn(),
            findBasicById: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            desactivar: jest.fn(),
            finalizar: jest.fn(),
            findAll: jest.fn(),
            findAllByLider: jest.fn(),
            findAllByEmpleado: jest.fn(),
            findHorasResumenByProyecto: jest.fn(),
        };

        mockServicioRepo = {
            findById: jest.fn()
        };

        mockUsuarioRepo = {
            findById: jest.fn(),
            findByIds: jest.fn()
        };

        jest.doMock('../../src/modules/proyecto/proyecto.repository', () => mockProyectoRepo);
        jest.doMock('../../src/modules/servicio/servicio.repository', () => mockServicioRepo);
        jest.doMock('../../src/modules/usuario/usuario.repository', () => mockUsuarioRepo);

        proyectoService = require('../../src/modules/proyecto/proyecto.service');
    });

    it('getProyectosLider lanza 400 si faltan params', async () => {
        await expect(proyectoService.getProyectosLider({})).rejects.toThrow('Empresa y líder son requeridos');
    });

    it('createProyecto lanza si existe duplicado', async () => {
        mockProyectoRepo.findByNombreAndEmpresa.mockResolvedValue({ id_proyecto: 1 });

        await expect(proyectoService.createProyecto(1, { nombre: '  X  ' })).rejects.toThrow('Ya existe un proyecto con ese nombre en tu empresa');
    });

    it('createProyecto lanza si servicio inválido', async () => {
        mockProyectoRepo.findByNombreAndEmpresa.mockResolvedValue(null);
        mockServicioRepo.findById.mockResolvedValue(null);

        await expect(proyectoService.createProyecto(1, { nombre: 'Proyecto', id_servicio: 99, id_lider: 3 })).rejects.toThrow('Servicio no válido');
    });

    it('createProyecto lanza si líder inválido', async () => {
        mockProyectoRepo.findByNombreAndEmpresa.mockResolvedValue(null);
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockUsuarioRepo.findById.mockResolvedValue(null);

        await expect(proyectoService.createProyecto(1, { nombre: 'Proyecto', id_servicio: 1, id_lider: 999 })).rejects.toThrow('Líder no válido');
    });

    it('createProyecto lanza si hay empleados duplicados', async () => {
        mockProyectoRepo.findByNombreAndEmpresa.mockResolvedValue(null);
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1, rol: 'lider' });

        await expect(proyectoService.createProyecto(1, { nombre: 'P', id_servicio: 1, id_lider: 3, empleados: [4, 4] })).rejects.toThrow('Empleados duplicados');
    });

    it('createProyecto lanza si empleados no existen en DB', async () => {
        mockProyectoRepo.findByNombreAndEmpresa.mockResolvedValue(null);
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1, rol: 'lider' });
        mockUsuarioRepo.findByIds.mockResolvedValue([{ id_usuario: 4, id_empresa: 1, rol: 'empleado' }]); // only one returned

        await expect(proyectoService.createProyecto(1, { nombre: 'P', id_servicio: 1, id_lider: 3, empleados: [4, 5] })).rejects.toThrow('Empleado no válido');
    });

    it('createProyecto lanza si líder está en empleados', async () => {
        mockProyectoRepo.findByNombreAndEmpresa.mockResolvedValue(null);
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1, rol: 'lider' });
        // devolver ambos empleados para que pase la verificación de existencia
        mockUsuarioRepo.findByIds.mockResolvedValue([
            { id_usuario: 3, id_empresa: 1, rol: 'empleado' },
            { id_usuario: 4, id_empresa: 1, rol: 'empleado' }
        ]);

        await expect(proyectoService.createProyecto(1, { nombre: 'P', id_servicio: 1, id_lider: 3, empleados: [3, 4] })).rejects.toThrow('El líder no puede ser empleado');
    });

    it('createProyecto retorna proyecto creado cuando todo ok', async () => {
        mockProyectoRepo.findByNombreAndEmpresa.mockResolvedValue(null);
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1, rol: 'lider' });
        mockUsuarioRepo.findByIds.mockResolvedValue([{ id_empleado: 4, id_empresa: 1, rol: 'empleado' }]);
        mockProyectoRepo.create.mockResolvedValue({ id_proyecto: 10, nombre: 'P' });

        const res = await proyectoService.createProyecto(1, { nombre: 'P', id_servicio: 1, id_lider: 3, empleados: [4] });
        expect(res).toEqual({ id_proyecto: 10, nombre: 'P' });
    });

    it('createProyecto permite crear cotizado sin lider ni fechas', async () => {
        mockProyectoRepo.findByNombreAndEmpresa.mockResolvedValue(null);
        mockServicioRepo.findById.mockResolvedValue({ id_empresa: 1 });
        mockProyectoRepo.create.mockResolvedValue({ id_proyecto: 11, estado: 'Cotizado' });

        const res = await proyectoService.createProyecto(1, { nombre: 'P', id_servicio: 1 });

        expect(res).toEqual({ id_proyecto: 11, estado: 'Cotizado' });
        expect(mockUsuarioRepo.findById).not.toHaveBeenCalled();
        expect(mockProyectoRepo.create).toHaveBeenCalledWith(expect.objectContaining({
            estado: 'Cotizado',
            id_lider: undefined,
            fecha_inicio: undefined,
            fecha_fin_estimada: undefined
        }));
    });

    it('updateProyecto rechaza aprobar sin lider', async () => {
        mockProyectoRepo.findById.mockResolvedValue({
            id_proyecto: 1,
            id_empresa: 1,
            estado: 'Cotizado',
            id_lider: null,
            fecha_inicio: '2025-01-01',
            fecha_fin_estimada: '2025-12-31'
        });

        await expect(proyectoService.updateProyecto(1, 1, { estado: 'Aprobado' }))
            .rejects.toThrow('El lider es obligatorio para aprobar el proyecto');
    });

    it('updateProyecto permite aprobar con lider y fechas', async () => {
        mockProyectoRepo.findById.mockResolvedValue({
            id_proyecto: 1,
            id_empresa: 1,
            estado: 'Cotizado',
            id_lider: null,
            fecha_inicio: null,
            fecha_fin_estimada: null
        });
        mockUsuarioRepo.findById.mockResolvedValue({ id_empresa: 1, rol: 'lider' });
        mockProyectoRepo.update.mockResolvedValue({ id_proyecto: 1, estado: 'Aprobado' });

        const res = await proyectoService.updateProyecto(1, 1, {
            estado: 'Aprobado',
            id_lider: 3,
            fecha_inicio: '2025-01-01',
            fecha_fin_estimada: '2025-12-31'
        });

        expect(res).toEqual({ id_proyecto: 1, estado: 'Aprobado' });
    });

    it('updateProyecto permite pasar de aprobado a ejecucion', async () => {
        mockProyectoRepo.findById.mockResolvedValue({
            id_proyecto: 1,
            id_empresa: 1,
            estado: 'Aprobado',
            fecha_fin_real: null
        });
        mockProyectoRepo.update.mockResolvedValue({ id_proyecto: 1, estado: 'Ejecución' });

        const res = await proyectoService.updateProyecto(1, 1, { estado: 'Ejecución' });

        expect(res).toEqual({ id_proyecto: 1, estado: 'Ejecución' });
    });

    it('finalizarProyecto rechaza estado distinto de ejecucion', async () => {
        mockProyectoRepo.findById.mockResolvedValue({
            id_proyecto: 1,
            id_empresa: 1,
            id_lider: 3,
            estado: 'Cotizado',
            fecha_fin_real: null
        });

        await expect(proyectoService.finalizarProyecto({ proyectoId: 1, empresaId: 1, liderId: 3 }))
            .rejects.toThrow('Solo los proyectos en ejecucion pueden finalizarse');
    });

    it('finalizarProyecto permite finalizar proyecto en ejecucion', async () => {
        mockProyectoRepo.findById.mockResolvedValue({
            id_proyecto: 1,
            id_empresa: 1,
            id_lider: 3,
            estado: 'Ejecución',
            fecha_fin_real: null
        });
        mockProyectoRepo.finalizar.mockResolvedValue({ id_proyecto: 1, estado: 'Finalizado' });

        const res = await proyectoService.finalizarProyecto({ proyectoId: 1, empresaId: 1, liderId: 3 });

        expect(res).toEqual({ id_proyecto: 1, estado: 'Finalizado' });
    });
});
