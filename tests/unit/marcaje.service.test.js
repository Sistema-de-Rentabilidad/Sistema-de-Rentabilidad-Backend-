const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('marcaje.service', () => {
    let mockMarcajeRepo;
    let mockDateUtils;
    let marcajeService;

    beforeEach(() => {
        jest.resetModules();

        mockMarcajeRepo = {
            findByUsuario: jest.fn(),
            registrarEntrada: jest.fn(),
            registrarSalida: jest.fn()
        };

        mockDateUtils = {
            getFechaActual: jest.fn().mockReturnValue('2025-06-01')
        };

        jest.doMock('../../src/modules/marcaje/marcaje.repository', () => mockMarcajeRepo);
        jest.doMock('../../src/utils/dateTime', () => mockDateUtils);
        jest.doMock('../../src/modules/usuario/usuario.repository', () => ({}));
        marcajeService = require('../../src/modules/marcaje/marcaje.service');
    });

    it('getMarcajes delega al repositorio', async () => {
        mockMarcajeRepo.findByUsuario.mockResolvedValue(['marca']);
        const res = await marcajeService.getMarcajes({ user: { id_usuario: 4 } });
        expect(res).toEqual(['marca']);
    });

    it('marcarEntrada lanza si ya hay entrada duplicada', async () => {
        mockMarcajeRepo.registrarEntrada.mockResolvedValue({ error: 'ENTRADA_DUPLICADA' });
        await expect(marcajeService.marcarEntrada({ user: { id_usuario: 4 } })).rejects.toThrow('Ya registraste tu entrada del dia');
    });

    it('marcarEntrada retorna marcaje cuando no hay error', async () => {
        mockMarcajeRepo.registrarEntrada.mockResolvedValue({ marcaje: { id: 1 } });
        const res = await marcajeService.marcarEntrada({ user: { id_usuario: 4 } });
        expect(res).toEqual({ id: 1 });
    });

    it('marcarSalida lanza si no existe entrada', async () => {
        mockMarcajeRepo.registrarSalida.mockResolvedValue({ error: 'ENTRADA_NO_REGISTRADA' });
        await expect(marcajeService.marcarSalida({ user: { id_usuario: 4, rol: 'empleado' } })).rejects.toThrow('Debes registrar tu entrada antes de marcar salida');
    });

    it('marcarSalida lanza si salida duplicada', async () => {
        mockMarcajeRepo.registrarSalida.mockResolvedValue({ error: 'SALIDA_DUPLICADA' });
        await expect(marcajeService.marcarSalida({ user: { id_usuario: 4, rol: 'empleado' } })).rejects.toThrow('Ya registraste tu salida del dia');
    });

    it('marcarSalida lanza si horas no registradas', async () => {
        mockMarcajeRepo.registrarSalida.mockResolvedValue({ error: 'REGISTRO_HORAS_NO_REGISTRADO' });
        await expect(marcajeService.marcarSalida({ user: { id_usuario: 4, rol: 'empleado' } })).rejects.toThrow('Debes registrar horas del dia antes de marcar salida');
    });

    it('marcarSalida lanza si horas exceden y usuario no es lider', async () => {
        mockMarcajeRepo.registrarSalida.mockResolvedValue({ error: 'HORAS_EXCEDEN_MARCAJE' });
        await expect(marcajeService.marcarSalida({ user: { id_usuario: 4, rol: 'empleado' } })).rejects.toThrow('Las horas registradas exceden el tiempo trabajado del dia');
    });

    it('marcarSalida retorna resumen para empleado', async () => {
        mockMarcajeRepo.registrarSalida.mockResolvedValue({ marcaje: { id: 1 }, resumenHoras: { total: 8, trabajadas: 10 } });
        const res = await marcajeService.marcarSalida({ user: { id_usuario: 4, rol: 'empleado' } });
        expect(res).toEqual({ id: 1, total_horas_registradas: 8, horas_trabajadas: 10 });
    });

    it('marcarSalida no añade resumen para lider', async () => {
        mockMarcajeRepo.registrarSalida.mockResolvedValue({ marcaje: { id: 1 }, resumenHoras: { total: 8, trabajadas: 10 } });
        const res = await marcajeService.marcarSalida({ user: { id_usuario: 4, rol: 'lider' } });
        expect(res).toEqual({ id: 1 });
    });
});
