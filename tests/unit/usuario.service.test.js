const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('usuario.service', () => {
    let mockUsuarioRepo;
    let mockHistorialRepo;
    let mockHistorialService;
    let mockHash;
    let usuarioService;

    beforeEach(() => {
        jest.resetModules();

        mockUsuarioRepo = {
            findOnlypropietario: jest.fn(),
            findByEmpresa: jest.fn(),
            findByEmail: jest.fn(),
            findPropietarioByEmpresa: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            update: jest.fn(),
            findByIdFull: jest.fn(),
            desactivar: jest.fn(),
        };

        mockHistorialRepo = {
            findActivo: jest.fn()
        };

        mockHistorialService = {
            createHistorial: jest.fn()
        };

        mockHash = {
            hashPassword: jest.fn().mockResolvedValue('hashed')
        };

        jest.doMock('../../src/modules/usuario/usuario.repository', () => mockUsuarioRepo);
        jest.doMock('../../src/modules/historial_sueldo/historial.repository', () => mockHistorialRepo);
        jest.doMock('../../src/modules/historial_sueldo/historial.service', () => mockHistorialService);
        jest.doMock('../../src/utils/hash', () => mockHash);

        usuarioService = require('../../src/modules/usuario/usuario.service');
    });

    it('getUsuarios admin usa findOnlypropietario', async () => {
        mockUsuarioRepo.findOnlypropietario.mockResolvedValue([1]);
        const res = await usuarioService.getUsuarios({ rol: 'admin' });
        expect(res).toEqual([1]);
    });

    it('getUsuarios propietario usa findByEmpresa', async () => {
        mockUsuarioRepo.findByEmpresa.mockResolvedValue([2]);
        const res = await usuarioService.getUsuarios({ rol: 'propietario', id_empresa: 5, id_usuario: 10 });
        expect(res).toEqual([2]);
    });

    it('getUsuarios otro rol lanza 403', async () => {
        await expect(usuarioService.getUsuarios({ rol: 'empleado' })).rejects.toThrow('No tienes permisos para ver usuarios');
    });

    it('createUsuario lanza si email existe', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue({ email: 'a' });
        await expect(usuarioService.createUsuario({ email: 'test@test.com' }, { rol: 'admin' })).rejects.toThrow('El email ya está registrado');
    });

    it('createUsuario lanza si admin no pasa id_empresa', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue(null);
        await expect(usuarioService.createUsuario({ email: 'a@b.com', password: 'P4ssword' }, { rol: 'admin' })).rejects.toThrow('Admin debe especificar la empresa');
    });

    it('createUsuario lanza si propietario intenta crear rol inválido', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue(null);
        await expect(usuarioService.createUsuario({ email: 'a@b.com', password: 'P4ssword', rol: 'propietario' }, { rol: 'propietario', id_empresa: 1 })).rejects.toThrow('Propietario solo puede crear empleado o lider');
    });

    it('createUsuario valida reglas de sueldo para empleado', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue(null);
        mockUsuarioRepo.findPropietarioByEmpresa.mockResolvedValue(null);

        await expect(usuarioService.createUsuario({ email: 'a@b.com', password: 'x', rol: 'empleado' }, { rol: 'propietario', id_empresa: 1 })).rejects.toThrow('Empleado/Lider requiere monto y tipo de pago');
    });

    it('createUsuario crea empleado y llama historialService', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue(null);
        mockUsuarioRepo.findPropietarioByEmpresa.mockResolvedValue(null);
        mockUsuarioRepo.create.mockResolvedValue({ id_usuario: 99 });

        const data = { email: ' emp@test.com ', password: 'P4ssword', rol: 'empleado', monto: 1000, tipo_pago: 'mensual', horas_mensuales: 160 };
        const res = await usuarioService.createUsuario(data, { rol: 'propietario', id_empresa: 2 });

        expect(mockHash.hashPassword).toHaveBeenCalled();
        expect(mockHistorialService.createHistorial).toHaveBeenCalled();
        expect(res).toEqual({ id_usuario: 99 });
    });

    it('getUsuarioById lanza 404 si no existe', async () => {
        mockUsuarioRepo.findById.mockResolvedValue(null);
        await expect(usuarioService.getUsuarioById(1, { rol: 'admin' })).rejects.toThrow('Usuario no encontrado');
    });

    it('getUsuarioById protege acceso de propietario a otra empresa', async () => {
        mockUsuarioRepo.findById.mockResolvedValue({ id_usuario: 4, id_empresa: 10 });
        await expect(usuarioService.getUsuarioById(4, { rol: 'propietario', id_empresa: 2 })).rejects.toThrow('No tienes permisos para acceder a este usuario');
    });

    it('updateUsuario lanza 404 si no existe', async () => {
        mockUsuarioRepo.findById.mockResolvedValue(null);
        await expect(usuarioService.updateUsuario(1, {}, { rol: 'admin' })).rejects.toThrow('Usuario no encontrado');
    });

    it('desactivarUsuario lanza 404 si no existe', async () => {
        mockUsuarioRepo.findByIdFull.mockResolvedValue(null);
        await expect(usuarioService.desactivarUsuario(1, { rol: 'admin' })).rejects.toThrow('Usuario no encontrado');
    });

});
