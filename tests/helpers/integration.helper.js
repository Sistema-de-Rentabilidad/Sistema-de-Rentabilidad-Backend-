const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../../src/config/db');
const { getFechaActual } = require('../../src/utils/dateTime');
const {
  JWT_SECRET,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_REQUIRE_CLAIMS
} = require('../../src/config/env');
const { ACCESS_TOKEN_COOKIE } = require('../../src/config/authCookie');

let sequence = 0;

const alphaSuffix = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  let value = Date.now() + sequence++;
  let suffix = '';

  while (value > 0) {
    suffix += alphabet[value % alphabet.length];
    value = Math.floor(value / alphabet.length);
  }

  return suffix;
};

const uniquePhaseName = (prefix = 'Fase Testiny') => `${prefix} ${alphaSuffix()}`;
const uniqueText = (prefix = 'QA_TESTINY') => `${prefix}_${Date.now()}_${sequence++}`;

const pushId = (ctx, key, value) => {
  if (value) {
    ctx.ids[key].push(Number(value));
  }
};

const createTracker = () => ({
  ids: {
    registros: [],
    marcajes: [],
    fases: [],
    proyectos: [],
    usuarios: [],
    servicios: [],
    empresas: [],
    notas: [] // Nueva categoría para notas
  }
});

const deleteByIds = async (table, column, ids) => {
  if (!ids.length) return;
  await pool.query(`DELETE FROM ${table} WHERE ${column} = ANY($1::int[])`, [ids]);
};

const cleanupContext = async (ctx) => {
  if (!ctx?.ids) return;

  await deleteByIds('registro_horas', 'id_registro', ctx.ids.registros);

  if (ctx.ids.proyectos.length) {
    await pool.query('DELETE FROM registro_horas WHERE id_proyecto = ANY($1::int[])', [ctx.ids.proyectos]);
  }

  if (ctx.ids.fases.length) {
    await pool.query('DELETE FROM fase_empleado WHERE id_fase = ANY($1::int[])', [ctx.ids.fases]);
  }

  if (ctx.ids.usuarios.length) {
    await pool.query('DELETE FROM fase_empleado WHERE id_empleado = ANY($1::int[])', [ctx.ids.usuarios]);
    await pool.query('DELETE FROM proyecto_empleado WHERE id_empleado = ANY($1::int[])', [ctx.ids.usuarios]);
  }

  await deleteByIds('marcaje', 'id_marcaje', ctx.ids.marcajes);

  if (ctx.ids.usuarios.length) {
    await pool.query('DELETE FROM marcaje WHERE id_usuario = ANY($1::int[])', [ctx.ids.usuarios]);
    await pool.query('DELETE FROM historial_sueldo WHERE id_usuario = ANY($1::int[])', [ctx.ids.usuarios]);
  }

  if (ctx.ids.proyectos.length) {
    await pool.query('DELETE FROM proyecto_empleado WHERE id_proyecto = ANY($1::int[])', [ctx.ids.proyectos]);
  }

  await deleteByIds('fase', 'id_fase', ctx.ids.fases);

  if (ctx.ids.proyectos.length) {
    await pool.query('DELETE FROM fase WHERE id_proyecto = ANY($1::int[])', [ctx.ids.proyectos]);
  }

  await deleteByIds('proyecto', 'id_proyecto', ctx.ids.proyectos);
  await deleteByIds('usuario', 'id_usuario', ctx.ids.usuarios);
  await deleteByIds('servicio', 'id_servicio', ctx.ids.servicios);
  await deleteByIds('empresa', 'id_empresa', ctx.ids.empresas);
  await deleteByIds('nota', 'id_nota', ctx.ids.notas);
};

const createEmpresa = async (ctx, nombre = uniqueText('QA Empresa Testiny')) => {
  const result = await pool.query(
    'INSERT INTO empresa (nombre) VALUES ($1) RETURNING *',
    [nombre]
  );

  pushId(ctx, 'empresas', result.rows[0].id_empresa);
  return result.rows[0];
};

const createServicio = async (ctx, idEmpresa) => {
  const result = await pool.query(
    `INSERT INTO servicio (id_empresa, nombre, descripcion, is_active)
     VALUES ($1, $2, $3, true)
     RETURNING *`,
    [idEmpresa, uniqueText('QA Servicio Testiny'), 'Servicio temporal Testiny']
  );

  pushId(ctx, 'servicios', result.rows[0].id_servicio);
  return result.rows[0];
};

const createUsuario = async (ctx, {
  idEmpresa,
  rol = 'empleado',
  tipoPago = 'mensual',
  isActive = true,
  horasMensuales = 160
} = {}) => {
  const passwordPlano = 'Qa123456*';
  const passwordHash = await bcrypt.hash(passwordPlano, 10);
  const email = `qa_testiny_${rol}_${Date.now()}_${sequence++}@test.com`.toLowerCase();

  const result = await pool.query(
    `INSERT INTO usuario (id_empresa, nombre, email, password, rol, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [idEmpresa, `QA Testiny ${rol}`, email, passwordHash, rol, isActive]
  );

  const usuario = {
    ...result.rows[0],
    passwordPlano
  };

  pushId(ctx, 'usuarios', usuario.id_usuario);

  if (rol === 'empleado') {
    await pool.query(
      `INSERT INTO historial_sueldo (id_usuario, tipo_pago, monto, fecha_inicio, horas_mensuales)
       VALUES ($1, $2, $3, CURRENT_DATE - INTERVAL '1 day', $4)`,
      [
        usuario.id_usuario,
        tipoPago,
        tipoPago === 'por_hora' ? 20 : 3000,
        tipoPago === 'mensual' ? horasMensuales : null
      ]
    );
  }

  return usuario;
};

const createProyecto = async (ctx, {
  idEmpresa,
  idServicio,
  idLider = null,
  finalizado = false,
  isActive = true
} = {}) => {
  const result = await pool.query(
    `INSERT INTO proyecto (
        id_empresa,
        id_servicio,
        id_lider,
        nombre,
        descripcion,
        presupuesto,
        fecha_inicio,
        fecha_fin_estimada,
        fecha_fin_real,
        margen,
        is_active
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      RETURNING *`,
    [
      idEmpresa,
      idServicio,
      idLider,
      uniqueText('Proyecto Testiny'),
      'Proyecto temporal Testiny',
      10000,
      '2025-01-01',
      '2027-12-31',
      finalizado ? '2026-01-01' : null,
      20,
      isActive
    ]
  );

  pushId(ctx, 'proyectos', result.rows[0].id_proyecto);
  return result.rows[0];
};

const assignEmpleado = async (idProyecto, idEmpleado) => {
  await pool.query(
    `INSERT INTO proyecto_empleado (id_proyecto, id_empleado)
     VALUES ($1, $2)`,
    [idProyecto, idEmpleado]
  );
};

const createFase = async (ctx, {
  idProyecto,
  nombre = uniquePhaseName(),
  horasEstimadas = 40,
  isActive = true
} = {}) => {
  const result = await pool.query(
    `INSERT INTO fase (id_proyecto, nombre, horas_estimadas, is_active)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [idProyecto, nombre, horasEstimadas, isActive]
  );

  pushId(ctx, 'fases', result.rows[0].id_fase);
  return result.rows[0];
};

const createRegistroHoras = async (ctx, {
  idProyecto,
  idFase,
  idEmpleado,
  fecha = getFechaActual(),
  horas = 1,
  descripcion = uniqueText('QA_TESTINY_HORAS')
} = {}) => {
  const result = await pool.query(
    `INSERT INTO registro_horas (id_proyecto, id_fase, id_empleado, fecha, horas, descripcion)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [idProyecto, idFase, idEmpleado, fecha, horas, descripcion]
  );

  pushId(ctx, 'registros', result.rows[0].id_registro);
  return result.rows[0];
};

const createMarcaje = async (ctx, {
  idUsuario,
  fecha = getFechaActual(),
  entradaHaceHoras = 4,
  salidaHaceHoras = null
} = {}) => {
  const result = await pool.query(
    `INSERT INTO marcaje (id_usuario, fecha, hora_entrada, hora_salida)
     VALUES (
       $1,
       $2,
       timezone('America/Lima', now()) - ($3::text || ' hours')::interval,
       CASE
         WHEN $4::numeric IS NULL THEN NULL
         ELSE timezone('America/Lima', now()) - ($4::text || ' hours')::interval
       END
     )
     RETURNING *`,
    [idUsuario, fecha, entradaHaceHoras, salidaHaceHoras]
  );

  pushId(ctx, 'marcajes', result.rows[0].id_marcaje);
  return result.rows[0];
};

const createNota = async (ctx, {
  idProyecto,
  idLider,
  descripcion = uniqueText('QA Nota'),
  fecha = getFechaActual()
} = {}) => {
  const result = await pool.query(
    `INSERT INTO nota (id_proyecto, id_lider, descripcion, fecha, is_active)
     VALUES ($1, $2, $3, $4, true)
     RETURNING *`,
    [idProyecto, idLider, descripcion, fecha]
  );

  pushId(ctx, 'notas', result.rows[0].id_nota);
  return result.rows[0];
};

const createContext = async ({
  empleadoTipoPago = 'mensual',
  empleadoActivo = true,
  liderActivo = true,
  proyectoFinalizado = false,
  asignarEmpleado = true,
  crearFase = true,
  faseActiva = true,
  incluirAdmin = false // Nuevo parámetro
} = {}) => {
  const ctx = createTracker();
  const empresa = await createEmpresa(ctx);
  const servicio = await createServicio(ctx, empresa.id_empresa);

  const admin = incluirAdmin
    ? await createUsuario(ctx, { idEmpresa: null, rol: 'admin' })
    : null;

  const propietario = await createUsuario(ctx, { idEmpresa: empresa.id_empresa, rol: 'propietario' });
  const lider = await createUsuario(ctx, { idEmpresa: empresa.id_empresa, rol: 'lider', isActive: liderActivo });
  const empleado = await createUsuario(ctx, {
    idEmpresa: empresa.id_empresa,
    rol: 'empleado',
    tipoPago: empleadoTipoPago,
    isActive: empleadoActivo
  });
  const proyecto = await createProyecto(ctx, {
    idEmpresa: empresa.id_empresa,
    idServicio: servicio.id_servicio,
    idLider: lider.id_usuario,
    finalizado: proyectoFinalizado
  });

  if (asignarEmpleado) {
    await assignEmpleado(proyecto.id_proyecto, empleado.id_usuario);
  }

  const fase = crearFase
    ? await createFase(ctx, { idProyecto: proyecto.id_proyecto, isActive: faseActiva })
    : null;

  return {
    ...ctx,
    empresa,
    servicio,
    admin,
    propietario,
    lider,
    empleado,
    proyecto,
    fase
  };
};

const tokenCookieForUser = (user, expiresIn = '1h') => {
  const options = { expiresIn };

  if (JWT_REQUIRE_CLAIMS) {
    options.issuer = JWT_ISSUER;
    options.audience = JWT_AUDIENCE;
    options.subject = String(user.id_usuario);
  }

  const token = jwt.sign({
    id_usuario: user.id_usuario,
    email: user.email,
    rol: user.rol,
    id_empresa: user.id_empresa
  }, JWT_SECRET, options);

  return [`${ACCESS_TOKEN_COOKIE}=${token}`];
};

const resetDatabase = async () => {
  // Orden crítico para evitar errores de Foreign Key
  await pool.query('TRUNCATE TABLE registro_horas, marcaje, fase_empleado, proyecto_empleado, historial_sueldo, fase, proyecto, servicio, usuario, empresa RESTART IDENTITY CASCADE');
};

module.exports = {
  cleanupContext,
  createContext,
  createEmpresa,
  createServicio,
  createUsuario,
  createProyecto,
  assignEmpleado,
  createFase,
  createRegistroHoras,
  createMarcaje,
  createNota,
  createTracker,
  tokenCookieForUser,
  uniquePhaseName,
  uniqueText,
  resetDatabase
};