const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: jsonHeaders
  });
}

function notFound(pathname) {
  return json(
    {
      ok: false,
      message: `Ruta no encontrada: ${pathname}`
    },
    404
  );
}

function methodNotAllowed(method, allowed) {
  return json(
    {
      ok: false,
      message: `Metodo ${method} no permitido. Usa: ${allowed.join(", ")}.`
    },
    405
  );
}

async function firstNumber(db, sql) {
  const row = await db.prepare(sql).first();
  const value = row ? Object.values(row)[0] : 0;
  return Number(value || 0);
}

async function dashboard(env) {
  try {
    const [
      sucursalesActivas,
      medicamentosActivos,
      inventarioDisponible,
      entregasPendientes,
      cajaIngresos,
      cajaEgresos
    ] = await Promise.all([
      firstNumber(env.DB, "SELECT COUNT(*) AS total FROM sucursal WHERE estado = 'ACTIVA'"),
      firstNumber(env.DB, "SELECT COUNT(*) AS total FROM medicamento WHERE estado = 'ACTIVO'"),
      firstNumber(env.DB, "SELECT COALESCE(SUM(stock_disponible), 0) AS total FROM inventario"),
      firstNumber(env.DB, "SELECT COUNT(*) AS total FROM entrega WHERE estado IN ('PENDIENTE', 'EN_RUTA')"),
      firstNumber(env.DB, "SELECT COALESCE(SUM(monto), 0) AS total FROM movimiento_caja WHERE tipo = 'INGRESO'"),
      firstNumber(env.DB, "SELECT COALESCE(SUM(monto), 0) AS total FROM movimiento_caja WHERE tipo = 'EGRESO'")
    ]);

    return json({
      ok: true,
      data: {
        sucursalesActivas,
        medicamentosActivos,
        inventarioDisponible,
        entregasPendientes,
        cajaNeta: cajaIngresos - cajaEgresos
      }
    });
  } catch (error) {
    return json({
      ok: false,
      message: "La API esta activa, pero SQLite/D1 no tiene el schema aplicado.",
      data: {
        sucursalesActivas: 0,
        medicamentosActivos: 0,
        inventarioDisponible: 0,
        entregasPendientes: 0,
        cajaNeta: 0
      }
    });
  }
}

async function health(env) {
  try {
    await env.DB.prepare("SELECT 1").first();
    return json({
      ok: true,
      service: "farmacias-alejandro-api",
      database: "SQLite/D1 conectado"
    });
  } catch (error) {
    return json({
      ok: false,
      service: "farmacias-alejandro-api",
      database: "SQLite/D1 no disponible",
      message: "Revisa el binding DB y aplica schema.sqlite.sql."
    });
  }
}

async function listSucursales(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        id_sucursal,
        nombre,
        tipo,
        direccion,
        departamento,
        municipio,
        telefono,
        centro_comercial_id,
        gasolinera_id,
        estado
      FROM sucursal
      ORDER BY nombre ASC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer sucursales. Confirma que el schema exista en SQLite/D1.",
        data: []
      },
      500
    );
  }
}

async function readRequestJson(request) {
  try {
    return await request.json();
  } catch (error) {
    return null;
  }
}

function textField(payload, field) {
  return typeof payload?.[field] === "string" ? payload[field].trim() : "";
}

function nullableTextField(payload, field) {
  const value = textField(payload, field);
  return value || null;
}

function nullablePositiveInteger(payload, field, errors) {
  const rawValue = payload?.[field];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value <= 0) {
    errors.push(`${field} debe ser un numero entero positivo.`);
    return null;
  }

  return value;
}

function normalizeSucursalPayload(payload) {
  const errors = [];
  const tipo = textField(payload, "tipo").toUpperCase();
  const estado = textField(payload, "estado").toUpperCase() || "ACTIVA";
  const centroComercialId = nullablePositiveInteger(payload, "centro_comercial_id", errors);
  const gasolineraId = nullablePositiveInteger(payload, "gasolinera_id", errors);

  const data = {
    nombre: textField(payload, "nombre"),
    tipo,
    direccion: textField(payload, "direccion"),
    departamento: textField(payload, "departamento"),
    municipio: textField(payload, "municipio"),
    telefono: nullableTextField(payload, "telefono"),
    centro_comercial_id: centroComercialId,
    gasolinera_id: gasolineraId,
    estado
  };

  if (!data.nombre) errors.push("nombre es obligatorio.");
  if (!["FARMACIA", "STAND", "GASOLINERA"].includes(data.tipo)) {
    errors.push("tipo debe ser FARMACIA, STAND o GASOLINERA.");
  }
  if (!data.direccion) errors.push("direccion es obligatoria.");
  if (!data.departamento) errors.push("departamento es obligatorio.");
  if (!data.municipio) errors.push("municipio es obligatorio.");
  if (!["ACTIVA", "INACTIVA"].includes(data.estado)) {
    errors.push("estado debe ser ACTIVA o INACTIVA.");
  }

  if (data.tipo === "FARMACIA") {
    data.gasolinera_id = null;
  }

  if (["STAND", "GASOLINERA"].includes(data.tipo)) {
    data.centro_comercial_id = null;

    if (!data.gasolinera_id) {
      errors.push("gasolinera_id es obligatorio para sucursales tipo STAND o GASOLINERA.");
    }
  }

  return { data, errors };
}

async function findSucursalById(env, idSucursal) {
  return env.DB.prepare(
    `SELECT
      id_sucursal,
      nombre,
      tipo,
      direccion,
      departamento,
      municipio,
      telefono,
      centro_comercial_id,
      gasolinera_id,
      estado,
      created_at,
      updated_at
    FROM sucursal
    WHERE id_sucursal = ?`
  )
    .bind(idSucursal)
    .first();
}

async function getSucursal(env, idSucursal) {
  try {
    const sucursal = await findSucursalById(env, idSucursal);

    if (!sucursal) {
      return json(
        {
          ok: false,
          message: "Sucursal no encontrada."
        },
        404
      );
    }

    return json({
      ok: true,
      data: sucursal
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar la sucursal."
      },
      500
    );
  }
}

async function createSucursal(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizeSucursalPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos de la sucursal.",
        errors
      },
      400
    );
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO sucursal (
        nombre,
        tipo,
        direccion,
        departamento,
        municipio,
        telefono,
        centro_comercial_id,
        gasolinera_id,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        data.nombre,
        data.tipo,
        data.direccion,
        data.departamento,
        data.municipio,
        data.telefono,
        data.centro_comercial_id,
        data.gasolinera_id,
        data.estado
      )
      .run();

    const sucursal = await findSucursalById(env, result.meta.last_row_id);

    return json(
      {
        ok: true,
        data: sucursal
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear la sucursal. Revisa referencias de centro comercial o gasolinera."
      },
      500
    );
  }
}

async function updateSucursal(request, env, idSucursal) {
  const existing = await findSucursalById(env, idSucursal);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Sucursal no encontrada."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizeSucursalPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos de la sucursal.",
        errors
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE sucursal
      SET
        nombre = ?,
        tipo = ?,
        direccion = ?,
        departamento = ?,
        municipio = ?,
        telefono = ?,
        centro_comercial_id = ?,
        gasolinera_id = ?,
        estado = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_sucursal = ?`
    )
      .bind(
        data.nombre,
        data.tipo,
        data.direccion,
        data.departamento,
        data.municipio,
        data.telefono,
        data.centro_comercial_id,
        data.gasolinera_id,
        data.estado,
        idSucursal
      )
      .run();

    const sucursal = await findSucursalById(env, idSucursal);

    return json({
      ok: true,
      data: sucursal
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar la sucursal. Revisa referencias de centro comercial o gasolinera."
      },
      500
    );
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return health(env);
    }

    if (url.pathname === "/api/dashboard") {
      return dashboard(env);
    }

    if (url.pathname === "/api/sucursales") {
      if (request.method === "GET") {
        return listSucursales(env);
      }

      if (request.method === "POST") {
        return createSucursal(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    const sucursalMatch = url.pathname.match(/^\/api\/sucursales\/(\d+)$/);

    if (sucursalMatch) {
      const idSucursal = Number(sucursalMatch[1]);

      if (request.method === "GET") {
        return getSucursal(env, idSucursal);
      }

      if (request.method === "PUT") {
        return updateSucursal(request, env, idSucursal);
      }

      return methodNotAllowed(request.method, ["GET", "PUT"]);
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
