const pool = require('../../config/db');
const { LOG_PERFORMANCE } = require('../../config/env');
const logger = require('../../utils/logger');

const MARCAJE_ERRORS = {
  ENTRADA_DUPLICADA: 'ENTRADA_DUPLICADA',
  ENTRADA_NO_REGISTRADA: 'ENTRADA_NO_REGISTRADA',
  SALIDA_DUPLICADA: 'SALIDA_DUPLICADA',
  REGISTRO_HORAS_NO_REGISTRADO: 'REGISTRO_HORAS_NO_REGISTRADO',
  HORA_SALIDA_INVALIDA: 'HORA_SALIDA_INVALIDA'
};

const ahoraLimaSql = "timezone('America/Lima', now())";

const marcajeSelectSql = `
  id_marcaje,
  id_usuario,
  fecha::text AS fecha,
  to_char(hora_entrada, 'HH24:MI:SS') AS hora_entrada,
  CASE
    WHEN hora_salida IS NULL THEN NULL
    ELSE to_char(hora_salida, 'HH24:MI:SS')
  END AS hora_salida
`;

const findByUsuario = async (idUsuario) => {
  const result = await pool.query(
    `SELECT
        ${marcajeSelectSql}
     FROM marcaje
     WHERE id_usuario = $1
     ORDER BY fecha DESC, id_marcaje DESC`,
    [idUsuario]
  );

  return result.rows;
};

const findByEmpresa = async (idEmpresa) => {
  const result = await pool.query(
    `SELECT
        m.id_marcaje,
        m.id_usuario,
        u.nombre,
        m.fecha::text AS fecha,
        to_char(m.hora_entrada, 'HH24:MI:SS') AS hora_entrada,
        CASE
          WHEN m.hora_salida IS NULL THEN NULL
          ELSE to_char(m.hora_salida, 'HH24:MI:SS')
        END AS hora_salida
     FROM marcaje m
     JOIN usuario u ON m.id_usuario = u.id_usuario
     WHERE u.id_empresa = $1
     ORDER BY m.fecha DESC, m.id_marcaje DESC`,
    [idEmpresa]
  );
  return result.rows;
};

const withTransaction = async (callback) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await callback(client);

    await client.query('COMMIT');

    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const lockMarcajeDia = async (client, id_usuario, fecha) => {
  await client.query(
    `SELECT pg_advisory_xact_lock($1, TO_CHAR($2::date, 'YYYYMMDD')::int)`,
    [id_usuario, fecha]
  );
};

const findMarcajeDelDia = async (client, id_usuario, fecha) => {
  const result = await client.query(
    `SELECT id_marcaje, id_usuario, fecha, hora_entrada, hora_salida
     FROM marcaje
     WHERE id_usuario = $1
       AND fecha = $2
     LIMIT 1`,
    [id_usuario, fecha]
  );

  return result.rows[0];
};

const create = async (client, id_usuario, fecha) => {
  const result = await client.query(
    `INSERT INTO marcaje (id_usuario, fecha, hora_entrada)
     VALUES ($1, $2, ${ahoraLimaSql})
     RETURNING ${marcajeSelectSql}`,
    [id_usuario, fecha]
  );

  return result.rows[0];
};

const registrarEntrada = async ({ id_usuario, fecha }) => {
  return withTransaction(async (client) => {
    await lockMarcajeDia(client, id_usuario, fecha);

    const marcajeExistente = await findMarcajeDelDia(client, id_usuario, fecha);

    if (marcajeExistente) {
      return {
        error: MARCAJE_ERRORS.ENTRADA_DUPLICADA,
        marcaje: marcajeExistente
      };
    }

    let marcaje;

    try {
      marcaje = await create(client, id_usuario, fecha);
    } catch (error) {
      if (
        error.code === '23505' &&
        ['unique_marcaje_usuario_fecha', 'unico_marcaje_abierto'].includes(error.constraint)
      ) {
        return {
          error: MARCAJE_ERRORS.ENTRADA_DUPLICADA
        };
      }

      throw error;
    }

    return { marcaje };
  });
};

const registrarSalidaSql = `
  WITH parametros AS (
    SELECT
      $1::int AS id_usuario,
      $2::date AS fecha,
      $3::boolean AS validar_registro_horas,
      ${ahoraLimaSql} AS ahora_lima
  ),
  marcaje_actual AS MATERIALIZED (
    SELECT
      m.id_marcaje,
      m.id_usuario,
      m.fecha,
      m.hora_entrada,
      m.hora_salida
    FROM marcaje m
    JOIN parametros p
      ON m.id_usuario = p.id_usuario
     AND m.fecha = p.fecha
  ),
  resumen_horas AS MATERIALIZED (
    SELECT
      COUNT(rh.id_registro)::int AS registros,
      COALESCE(SUM(rh.horas), 0)::numeric AS total_horas,
      (
        EXTRACT(EPOCH FROM (p.ahora_lima - ma.hora_entrada)) / 3600
      )::numeric AS horas_trabajadas
    FROM parametros p
    JOIN marcaje_actual ma
      ON ma.hora_salida IS NULL
    LEFT JOIN registro_horas rh
      ON rh.id_empleado = ma.id_usuario
     AND rh.fecha = ma.fecha
    GROUP BY p.ahora_lima, ma.hora_entrada
  ),
  marcaje_actualizado AS (
    UPDATE marcaje m
    SET hora_salida = p.ahora_lima
    FROM parametros p
    JOIN marcaje_actual ma ON true
    JOIN resumen_horas rh ON true
    WHERE m.id_marcaje = ma.id_marcaje
      AND m.hora_salida IS NULL
      AND p.ahora_lima > m.hora_entrada
      AND (
        NOT p.validar_registro_horas
        OR rh.registros > 0
      )
    RETURNING
      m.id_marcaje,
      m.id_usuario,
      m.fecha::text AS fecha,
      to_char(m.hora_entrada, 'HH24:MI:SS') AS hora_entrada,
      to_char(m.hora_salida, 'HH24:MI:SS') AS hora_salida
  )
  SELECT
    CASE
      WHEN ma.id_marcaje IS NULL
        THEN '${MARCAJE_ERRORS.ENTRADA_NO_REGISTRADA}'
      WHEN ma.hora_salida IS NOT NULL
        THEN '${MARCAJE_ERRORS.SALIDA_DUPLICADA}'
      WHEN p.validar_registro_horas AND rh.registros = 0
        THEN '${MARCAJE_ERRORS.REGISTRO_HORAS_NO_REGISTRADO}'
      WHEN ma.hora_entrada IS NULL OR p.ahora_lima <= ma.hora_entrada
        THEN '${MARCAJE_ERRORS.HORA_SALIDA_INVALIDA}'
      WHEN mu.id_marcaje IS NULL
        THEN '${MARCAJE_ERRORS.SALIDA_DUPLICADA}'
      ELSE NULL
    END AS error,
    ma.id_marcaje AS id_marcaje_existente,
    ma.hora_entrada AS hora_entrada_existente,
    ma.hora_salida AS hora_salida_existente,
    mu.id_marcaje,
    mu.id_usuario,
    mu.fecha,
    mu.hora_entrada,
    mu.hora_salida,
    rh.registros,
    rh.total_horas,
    rh.horas_trabajadas
  FROM parametros p
  LEFT JOIN marcaje_actual ma ON true
  LEFT JOIN resumen_horas rh ON true
  LEFT JOIN marcaje_actualizado mu ON true
`;

const poolStats = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount
});

const elapsedMilliseconds = (startedAt) =>
  Number(process.hrtime.bigint() - startedAt) / 1e6;

const roundedMilliseconds = (milliseconds) =>
  Math.round(milliseconds * 1000) / 1000;

const buildResumenHoras = (row) => ({
  registros: Number(row.registros),
  total: Number(row.total_horas),
  trabajadas: Number(row.horas_trabajadas)
});

const buildRegistrarSalidaResult = (row) => {
  if (row.error === MARCAJE_ERRORS.ENTRADA_NO_REGISTRADA) {
    return { error: row.error };
  }

  if (row.error === MARCAJE_ERRORS.SALIDA_DUPLICADA) {
    const result = { error: row.error };

    if (row.hora_salida_existente !== null) {
      result.marcaje = {
        id_marcaje: row.id_marcaje_existente,
        hora_entrada: row.hora_entrada_existente,
        hora_salida: row.hora_salida_existente
      };
    }

    return result;
  }

  if (row.error === MARCAJE_ERRORS.REGISTRO_HORAS_NO_REGISTRADO) {
    return {
      error: row.error,
      resumenHoras: buildResumenHoras(row)
    };
  }

  if (row.error === MARCAJE_ERRORS.HORA_SALIDA_INVALIDA) {
    return { error: row.error };
  }

  return {
    marcaje: {
      id_marcaje: row.id_marcaje,
      id_usuario: row.id_usuario,
      fecha: row.fecha,
      hora_entrada: row.hora_entrada,
      hora_salida: row.hora_salida
    },
    resumenHoras: buildResumenHoras(row)
  };
};

const registrarSalida = async ({ id_usuario, fecha, validarRegistroHoras = true }) => {
  const repositoryStartedAt = LOG_PERFORMANCE ? process.hrtime.bigint() : null;
  const poolWaitStartedAt = LOG_PERFORMANCE ? process.hrtime.bigint() : null;
  const poolBeforeConnect = LOG_PERFORMANCE ? poolStats() : null;
  let poolAfterConnect = null;
  let poolWaitMs = null;
  let client;
  let outcome = 'EXCEPTION';

  try {
    client = await pool.connect();

    if (LOG_PERFORMANCE) {
      poolWaitMs = elapsedMilliseconds(poolWaitStartedAt);
      poolAfterConnect = poolStats();
    }

    const result = await client.query(registrarSalidaSql, [
      id_usuario,
      fecha,
      validarRegistroHoras
    ]);
    const response = buildRegistrarSalidaResult(result.rows[0]);

    outcome = response.error || 'OK';

    return response;
  } catch (error) {
    outcome = error.code || error.name || 'EXCEPTION';
    throw error;
  } finally {
    if (client) {
      client.release();
    }

    if (LOG_PERFORMANCE) {
      if (poolWaitMs === null) {
        poolWaitMs = elapsedMilliseconds(poolWaitStartedAt);
      }

      logger.info('Rendimiento marcaje salida', {
        event: 'marcaje_salida_performance',
        outcome,
        poolWaitMs: roundedMilliseconds(poolWaitMs),
        repositoryTotalMs: roundedMilliseconds(elapsedMilliseconds(repositoryStartedAt)),
        pool: {
          beforeConnect: poolBeforeConnect,
          afterConnect: poolAfterConnect,
          afterRelease: poolStats()
        }
      });
    }
  }
};

module.exports = {
  findByUsuario,
  findByEmpresa,
  registrarEntrada,
  registrarSalida
};

