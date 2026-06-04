describe('Pruebas secundarias Testiny - Horario marcaje', () => {
  test("TC-714 - CP-HU21-4-BE - Validación backend horario permitido", () => {
    jest.resetModules();
    jest.doMock('../../src/config/env', () => ({
      MARCAJE_ENTRADA_HORA_INICIO: '06:00',
      MARCAJE_ENTRADA_HORA_FIN: '10:00'
    }));
    jest.doMock('../../src/modules/marcaje/marcaje.repository', () => ({}));

    const { validarHorarioEntrada } = require('../../src/modules/marcaje/marcaje.service');

    expect(() => validarHorarioEntrada({
      fechaHora: new Date('2026-01-01T13:00:00-05:00')
    })).toThrow(/horario establecido/);

    jest.dontMock('../../src/config/env');
    jest.dontMock('../../src/modules/marcaje/marcaje.repository');
  });
});
