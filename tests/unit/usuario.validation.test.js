const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('usuario.validation', () => {
    let createUsuarioValidation;
    let updateUsuarioValidation;
    let mockEmpresaRepository;

    beforeEach(() => {
        jest.resetModules();

        mockEmpresaRepository = {
            findById: jest.fn()
        };

        jest.doMock('../../src/modules/empresa/empresa.repository', () => mockEmpresaRepository);
        ({ createUsuarioValidation, updateUsuarioValidation } = require('../../src/modules/usuario/usuario.validation'));
    });

    const runValidationMiddleware = async (middlewares, req) => {
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        const next = jest.fn();

        const validators = middlewares.slice(0, -1);
        for (const validator of validators) {
            if (typeof validator.run === 'function') {
                await validator.run(req);
            } else {
                await validator(req, res, next);
            }
        }

        await middlewares[middlewares.length - 1](req, res, next);
        return { res, next };
    };

    it('createUsuarioValidation devuelve errores cuando faltan campos obligatorios', async () => {
        mockEmpresaRepository.findById.mockResolvedValue({ id_empresa: 1 });
        const req = { body: { email: 'invalid', password: 'short', id_empresa: 1 }, user: { rol: 'admin' } };

        const { res } = await runValidationMiddleware(createUsuarioValidation, req);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false, errors: expect.any(Array) }));
        expect(res.json.mock.calls[0][0].errors.length).toBeGreaterThan(0);
    });

    it('createUsuarioValidation rechaza cuando propietario no envía rol', async () => {
        mockEmpresaRepository.findById.mockResolvedValue({ id_empresa: 1 });
        const req = {
            body: { nombre: 'Usuario', email: 'test@example.com', password: 'Aa1!aaaa', id_empresa: 1 },
            user: { rol: 'propietario' }
        };

        const { res } = await runValidationMiddleware(createUsuarioValidation, req);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].errors.some(err => err.msg === 'Rol es obligatorio')).toBe(true);
    });

    it('updateUsuarioValidation rechaza cuando no se envían campos para actualizar', async () => {
        const req = { body: {}, params: { id: '3' } };

        const { res } = await runValidationMiddleware(updateUsuarioValidation, req);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
            success: false,
            message: 'Debes enviar al menos un campo para actualizar'
        });
    });
});
