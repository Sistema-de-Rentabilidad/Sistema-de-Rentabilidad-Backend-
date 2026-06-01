const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('servicio.repository', () => {
    let mockPool;
    let servicioRepository;

    beforeEach(() => {
        jest.resetModules();

        mockPool = {
            query: jest.fn()
        };

        jest.doMock('../../src/config/db', () => mockPool);
        servicioRepository = require('../../src/modules/servicio/servicio.repository');
    });

    it('findByEmpresaId retorna los servicios de la empresa', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id_servicio: 1, nombre: 'S1' }] });

        const rows = await servicioRepository.findByEmpresaId(10);

        expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [10]);
        expect(rows).toEqual([{ id_servicio: 1, nombre: 'S1' }]);
    });

    it('findByNombreAndEmpresa construye la consulta con servicioId cuando se provee', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id_servicio: 2, nombre: 'Test' }] });

        const row = await servicioRepository.findByNombreAndEmpresa('  Test  ', 5, 99);

        expect(mockPool.query).toHaveBeenCalledWith(expect.stringContaining('AND id_servicio != $3'), ['Test', 5, 99]);
        expect(row).toEqual({ id_servicio: 2, nombre: 'Test' });
    });

    it('create inserta y devuelve el servicio creado', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id_servicio: 3, nombre: 'Nuevo' }] });

        const result = await servicioRepository.create({ nombre: 'Nuevo', descripcion: 'Desc', empresaId: 7 });

        expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [7, 'Nuevo', 'Desc']);
        expect(result).toEqual({ id_servicio: 3, nombre: 'Nuevo' });
    });

    it('update usa COALESCE y retorna la fila actualizada', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ id_servicio: 4, nombre: 'Editado' }] });

        const result = await servicioRepository.update(4, { nombre: 'Editado', descripcion: 'Desc' });

        expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [4, 'Editado', 'Desc']);
        expect(result).toEqual({ id_servicio: 4, nombre: 'Editado' });
    });

    it('countProyectosByServicio parsea el conteo como número entero', async () => {
        mockPool.query.mockResolvedValue({ rows: [{ count: '12' }] });

        const count = await servicioRepository.countProyectosByServicio(8);

        expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [8]);
        expect(count).toBe(12);
    });
});
