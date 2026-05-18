const pool = require("../../config/db");

const ahoraLimaSql = "timezone('America/Lima', now())";

const marcajeSelectSql = `
  id_marcaje,
  id_empleado,
  fecha::text AS fecha,
  to_char(hora_entrada, 'HH24:MI:SS') AS hora_entrada,
  CASE
    WHEN hora_salida IS NULL THEN NULL
    ELSE to_char(hora_salida, 'HH24:MI:SS')
  END AS hora_salida
`;

const findEmpleadoActivo = async (idEmpleado) => {
  const result = await pool.query(
    `SELECT id_usuario, nombre, email, rol, id_empresa, is_active
     FROM usuario
     WHERE id_usuario = $1
       AND rol = 'empleado'
       AND is_active = true
     LIMIT 1`,
    [idEmpleado]
  );

  return result.rows[0] || null;
};

const registrarEntrada = async ({ id_empleado, fecha }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock($1, TO_CHAR($2::date, 'YYYYMMDD')::int)",
      [id_empleado, fecha]
    );

    const existe = await client.query(
      `SELECT *
       FROM marcaje
       WHERE id_empleado = $1
         AND fecha = $2
       LIMIT 1`,
      [id_empleado, fecha]
    );

    if (existe.rows[0]) {
      await client.query("COMMIT");
      return { error: "ENTRADA_DUPLICADA", marcaje: existe.rows[0] };
    }

    const result = await client.query(
      `INSERT INTO marcaje (id_empleado, fecha, hora_entrada)
       VALUES ($1, $2, ${ahoraLimaSql})
       RETURNING ${marcajeSelectSql}`,
      [id_empleado, fecha]
    );

    await client.query("COMMIT");

    return { marcaje: result.rows[0] };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const registrarSalida = async ({ id_empleado, fecha }) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      "SELECT pg_advisory_xact_lock($1, TO_CHAR($2::date, 'YYYYMMDD')::int)",
      [id_empleado, fecha]
    );

    const marcajeResult = await client.query(
      `SELECT *
       FROM marcaje
       WHERE id_empleado = $1
         AND fecha = $2
       LIMIT 1`,
      [id_empleado, fecha]
    );

    const marcaje = marcajeResult.rows[0];

    if (!marcaje || !marcaje.hora_entrada) {
      await client.query("COMMIT");
      return { error: "ENTRADA_NO_REGISTRADA" };
    }

    if (marcaje.hora_salida) {
      await client.query("COMMIT");
      return { error: "SALIDA_DUPLICADA", marcaje };
    }

    const horasResult = await client.query(
      `SELECT
          COALESCE(SUM(horas), 0)::numeric AS total_horas,
          (EXTRACT(EPOCH FROM (${ahoraLimaSql}::timestamp - $3::timestamp)) / 3600)::numeric AS horas_trabajadas
       FROM registro_horas
       WHERE id_empleado = $1
         AND fecha = $2`,
      [id_empleado, fecha, marcaje.hora_entrada]
    );

    const totalHoras = Number(horasResult.rows[0].total_horas);
    const horasTrabajadas = Number(horasResult.rows[0].horas_trabajadas);

    if (totalHoras > horasTrabajadas) {
      await client.query("COMMIT");
      return {
        error: "HORAS_EXCEDEN_MARCAJE",
        total_horas: totalHoras,
        horas_trabajadas: horasTrabajadas
      };
    }

    const result = await client.query(
      `UPDATE marcaje
       SET hora_salida = ${ahoraLimaSql}
       WHERE id_marcaje = $1
       RETURNING ${marcajeSelectSql}`,
      [marcaje.id_marcaje]
    );

    await client.query("COMMIT");

    return {
      marcaje: result.rows[0],
      total_horas: totalHoras,
      horas_trabajadas: horasTrabajadas
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const findByEmpleado = async (idEmpleado) => {
  const result = await pool.query(
    `SELECT
        ${marcajeSelectSql}
     FROM marcaje
     WHERE id_empleado = $1
     ORDER BY fecha DESC, id_marcaje DESC`,
    [idEmpleado]
  );

  return result.rows;
};

module.exports = {
  findEmpleadoActivo,
  registrarEntrada,
  registrarSalida,
  findByEmpleado
};
