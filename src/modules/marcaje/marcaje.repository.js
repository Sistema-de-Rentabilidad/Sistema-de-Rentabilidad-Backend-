const pool = require('../../config/db');

const MARCAJE_ERRORS = {
  ENTRADA_DUPLICADA: 'ENTRADA_DUPLICADA',
  ENTRADA_NO_REGISTRADA: 'ENTRADA_NO_REGISTRADA',
  SALIDA_DUPLICADA: 'SALIDA_DUPLICADA',
  REGISTRO_HORAS_NO_REGISTRADO: 'REGISTRO_HORAS_NO_REGISTRADO',
  HORAS_EXCEDEN_MARCAJE: 'HORAS_EXCEDEN_MARCAJE'
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

const calcularHorasTrabajadas = async (client, id_empleado, fecha, horaEntrada) => {
  const result = await client.query(
    `SELECT
        COUNT(*)::int AS total_registros,
        COALESCE(SUM(horas), 0)::numeric AS total_horas,
        (
          EXTRACT(
            EPOCH FROM (${ahoraLimaSql} - $3)
          ) / 3600
        )::numeric AS horas_trabajadas
     FROM registro_horas
     WHERE id_empleado = $1
       AND fecha = $2`,
    [id_empleado, fecha, horaEntrada]
  );

  return {
    registros: Number(result.rows[0].total_registros),
    total: Number(result.rows[0].total_horas),
    trabajadas: Number(result.rows[0].horas_trabajadas)
  };
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

const update = async (client, id_marcaje) => {
  const result = await client.query(
    `UPDATE marcaje
     SET hora_salida = ${ahoraLimaSql}
     WHERE id_marcaje = $1
     RETURNING ${marcajeSelectSql}`,
    [id_marcaje]
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

    const marcaje = await create(client, id_usuario, fecha);

    return { marcaje };
  });
};

const registrarSalida = async ({ id_usuario, fecha, validarRegistroHoras = true }) => {
  return withTransaction(async (client) => {
    await lockMarcajeDia(client, id_usuario, fecha);

    const marcaje = await findMarcajeDelDia(client, id_usuario, fecha);

    if (!marcaje?.hora_entrada) {
      return {
        error:
          MARCAJE_ERRORS.ENTRADA_NO_REGISTRADA
      };
    }

    if (marcaje.hora_salida) {
      return {
        error:
          MARCAJE_ERRORS.SALIDA_DUPLICADA,
        marcaje
      };
    }

    const resumenHoras = await calcularHorasTrabajadas(client, id_usuario, fecha, marcaje.hora_entrada);

    if (validarRegistroHoras && resumenHoras.registros === 0) {
      return {
        error:
          MARCAJE_ERRORS.REGISTRO_HORAS_NO_REGISTRADO,
        resumenHoras
      };
    }

    if (resumenHoras.total > resumenHoras.trabajadas) {
      return {
        error:
          MARCAJE_ERRORS.HORAS_EXCEDEN_MARCAJE,
        resumenHoras
      };
    }

    const marcajeActualizado = await update(client, marcaje.id_marcaje);

    return { marcaje: marcajeActualizado, resumenHoras };
  });
};


module.exports = {
  findByUsuario,
  registrarEntrada,
  registrarSalida
};
