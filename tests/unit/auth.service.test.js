const { describe, it, expect, beforeEach, afterEach } = require('@jest/globals');

describe('auth.service', () => {
    let mockAuthRepo;
    let mockUsuarioRepo;
    let mockHash;
    let mockJwt;
    let authService;
    let nowSpy;

    beforeEach(() => {
        jest.resetModules();

        mockAuthRepo = {
            setFailedLoginState: jest.fn(),
            clearFailedLoginState: jest.fn(),
            findActiveUserById: jest.fn()
        };

        mockUsuarioRepo = {
            findByEmail: jest.fn()
        };

        mockHash = {
            comparePassword: jest.fn()
        };

        mockJwt = {
            generateToken: jest.fn().mockReturnValue('FAKE_TOKEN')
        };

        jest.doMock('../../src/modules/auth/auth.repository', () => mockAuthRepo);
        jest.doMock('../../src/modules/usuario/usuario.repository', () => mockUsuarioRepo);
        jest.doMock('../../src/utils/hash', () => mockHash);
        jest.doMock('../../src/utils/jwt', () => mockJwt);

        nowSpy = jest.spyOn(Date, 'now').mockReturnValue(new Date('2025-06-01T12:00:00Z').getTime());
        authService = require('../../src/modules/auth/auth.service');
    });

    afterEach(() => {
        nowSpy.mockRestore();
    });

    it('loginService lanza credenciales invalidas si no existe usuario', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue(null);
        await expect(authService.loginService('user@test.com', 'password')).rejects.toThrow('CREDENCIALES_INVALIDAS');
    });

    it('loginService lanza si usuario inactivo', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue({ id_usuario: 1, email: 'user@test.com', password: 'x', is_active: false });
        await expect(authService.loginService('user@test.com', 'password')).rejects.toThrow('USUARIO_INACTIVO');
    });

    it('loginService lanza si usuario bloqueado', async () => {
        const lockedUntil = new Date(Date.now() + 60 * 1000).toISOString();
        mockUsuarioRepo.findByEmail.mockResolvedValue({ id_usuario: 1, email: 'user@test.com', password: 'x', is_active: true, locked_until: lockedUntil });
        await expect(authService.loginService('user@test.com', 'password')).rejects.toThrow('USUARIO_BLOQUEADO');
    });

    it('loginService aumenta intentos y lanza credenciales invalidas', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue({
            id_usuario: 2,
            email: 'user@test.com',
            password: 'hash',
            is_active: true,
            failed_login_attempts: 0,
            last_failed_login_at: null
        });
        mockHash.comparePassword.mockResolvedValue(false);

        await expect(authService.loginService('user@test.com', 'wrong')).rejects.toThrow('CREDENCIALES_INVALIDAS');
        expect(mockAuthRepo.setFailedLoginState).toHaveBeenCalledWith(2, 1, null);
    });

    it('loginService bloquea usuario en tercer intento', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue({
            id_usuario: 3,
            email: 'user@test.com',
            password: 'hash',
            is_active: true,
            failed_login_attempts: 2,
            last_failed_login_at: new Date(Date.now()).toISOString()
        });
        mockHash.comparePassword.mockResolvedValue(false);

        await expect(authService.loginService('user@test.com', 'wrong')).rejects.toThrow('USUARIO_BLOQUEADO');
        expect(mockAuthRepo.setFailedLoginState).toHaveBeenCalled();
    });

    it('loginService retorna token y usuario cuando credenciales validas', async () => {
        mockUsuarioRepo.findByEmail.mockResolvedValue({
            id_usuario: 4,
            nombre: 'Test User',
            email: 'user@test.com',
            password: 'hash',
            rol: 'empleado',
            id_empresa: 1,
            is_active: true
        });
        mockHash.comparePassword.mockResolvedValue(true);

        const result = await authService.loginService('user@test.com', 'Password123!');

        expect(mockAuthRepo.clearFailedLoginState).toHaveBeenCalledWith(4);
        expect(result).toEqual({
            token: 'FAKE_TOKEN',
            user: {
                id_usuario: 4,
                nombre: 'Test User',
                email: 'user@test.com',
                rol: 'empleado',
                id_empresa: 1
            }
        });
    });

    it('getCurrentUserService lanza 401 si no encuentra usuario activo', async () => {
        mockAuthRepo.findActiveUserById.mockResolvedValue(null);
        await expect(authService.getCurrentUserService(1)).rejects.toThrow('USUARIO_NO_ENCONTRADO');
    });

    it('getCurrentUserService retorna usuario activo', async () => {
        mockAuthRepo.findActiveUserById.mockResolvedValue({
            id_usuario: 5,
            nombre: 'Active User',
            email: 'active@test.com',
            rol: 'lider',
            id_empresa: 2,
            empresa_nombre: 'Demo'
        });

        const res = await authService.getCurrentUserService(5);
        expect(res).toEqual({
            id_usuario: 5,
            nombre: 'Active User',
            email: 'active@test.com',
            rol: 'lider',
            id_empresa: 2,
            empresa_nombre: 'Demo'
        });
    });
});
