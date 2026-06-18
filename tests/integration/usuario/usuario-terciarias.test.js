const request = require('supertest');
const app = require('../../../src/app');
const {
  cleanupContext,
  createContext,
  createUsuario,
  uniqueText
} = require('../../helpers/integration.helper');
const { authCookie, expectFailure, responseText } = require('../../helpers/testinyTerciarias.helper');

jest.setTimeout(60000);

describe('Testiny terciarias - Usuario empleado', () => {
  test("TC-1147 - CP-HU13-7-BE - Correo inválido empleado", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/usuarios')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Empleado Correo',
          email: 'correo-invalido',
          password: 'Qa123456*',
          rol: 'empleado',
          tipo_pago: 'mensual',
          monto: 3000,
          horas_mensuales: 160
        });

      expectFailure(response, 400);
      expect(responseText(response)).toMatch(/Email inv.lido/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1149 - CP-HU13-8-BE - Sueldo inválido empleado", async () => {
    const ctx = await createContext();

    try {
      const response = await request(app)
        .post('/api/usuarios')
        .set('Cookie', authCookie(ctx.propietario))
        .send({
          nombre: 'Empleado Sueldo',
          email: `${uniqueText('empleado_sueldo')}@test.com`.toLowerCase(),
          password: 'Qa123456*',
          rol: 'empleado',
          tipo_pago: 'mensual',
          monto: -1,
          horas_mensuales: 160
        });

      expectFailure(response, 400);
      expect(responseText(response)).toMatch(/monto/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1153 - CP-HU16-8-BE - Correo inválido edición empleado", async () => {
    const ctx = await createContext();

    try {
      const empleado = await createUsuario(ctx, {
        idEmpresa: ctx.empresa.id_empresa,
        rol: 'empleado'
      });

      const response = await request(app)
        .put(`/api/usuarios/${empleado.id_usuario}`)
        .set('Cookie', authCookie(ctx.propietario))
        .send({ email: 'correo-invalido' });

      expectFailure(response, 400);
      expect(responseText(response)).toMatch(/Email inv.lido/i);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1154 - CP-HU16-11-BE - Sesión expirada edición empleado", async () => {
    const ctx = await createContext();

    try {
      const empleado = await createUsuario(ctx, {
        idEmpresa: ctx.empresa.id_empresa,
        rol: 'empleado'
      });

      const response = await request(app)
        .put(`/api/usuarios/${empleado.id_usuario}`)
        .set('Cookie', authCookie(ctx.propietario, '-1h'))
        .send({ nombre: 'Empleado Expirado' });

      expectFailure(response, 401);
    } finally {
      await cleanupContext(ctx);
    }
  });

  test("TC-1157 - CP-HU15-9-BE - Sesión expirada eliminación usuario", async () => {
    const ctx = await createContext({ asignarEmpleado: false });

    try {
      const response = await request(app)
        .put(`/api/usuarios/${ctx.empleado.id_usuario}/desactivar`)
        .set('Cookie', authCookie(ctx.propietario, '-1h'))
        .send();

      expectFailure(response, 401);
    } finally {
      await cleanupContext(ctx);
    }
  });
});
