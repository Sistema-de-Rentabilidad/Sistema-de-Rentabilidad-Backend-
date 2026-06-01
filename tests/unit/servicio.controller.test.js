const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('servicio.controller', () => {
    let mockServicioService;
    let servicioController;

    beforeEach(() => {
        jest.resetModules();

        mockServicioService = {
            getServiciosByEmpresa: jest.fn(),
            createServicio: jest.fn(),
            getServicioById: jest.fn(),
            updateServicio: jest.fn(),
            desactivarServicio: jest.fn()
        };

        jest.doMock('../../src/modules/servicio/servicio.service', () => mockServicioService);
        servicioController = require('../../src/modules/servicio/servicio.controller');
    });

    const makeResponse = () => {
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        return res;
    };

    it('getServicios devuelve lista cuando hay resultados', async () => {
        mockServicioService.getServiciosByEmpresa.mockResolvedValue([{ id_servicio: 1 }]);
        const req = { user: { id_empresa: 2 } };
        const res = makeResponse();
        const next = jest.fn();

        await servicioController.getServicios(req, res, next);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: [{ id_servicio: 1 }] });
    });

    it('getServicios devuelve mensaje cuando no hay servicios', async () => {
        mockServicioService.getServiciosByEmpresa.mockResolvedValue([]);
        const req = { user: { id_empresa: 2 } };
        const res = makeResponse();
        const next = jest.fn();

        await servicioController.getServicios(req, res, next);

        expect(res.json).toHaveBeenCalledWith({ success: true, message: 'No hay servicios disponibles', data: [] });
    });

    it('createServicio responde 201 con el servicio creado', async () => {
        mockServicioService.createServicio.mockResolvedValue({ id_servicio: 10, nombre: 'Nuevo' });
        const req = { body: { nombre: 'Nuevo', descripcion: 'Desc' }, empresaId: 5 };
        const res = makeResponse();
        const next = jest.fn();

        await servicioController.createServicio(req, res, next);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith({ success: true, data: { id_servicio: 10, nombre: 'Nuevo' } });
    });

    it('getServicioById responde con el servicio solicitado', async () => {
        mockServicioService.getServicioById.mockResolvedValue({ id_servicio: 7 });
        const req = { params: { id: '7' }, user: { id_empresa: 3 } };
        const res = makeResponse();
        const next = jest.fn();

        await servicioController.getServicioById(req, res, next);

        expect(res.json).toHaveBeenCalledWith({ success: true, data: { id_servicio: 7 } });
    });
});
