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

function requiredPositiveInteger(payload, field, errors) {
  const value = nullablePositiveInteger(payload, field, errors);

  if (!value) {
    errors.push(`${field} es obligatorio.`);
  }

  return value;
}

function requiredNonNegativeInteger(payload, field, errors) {
  const rawValue = payload?.[field];
  const value = Number(rawValue);

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    errors.push(`${field} es obligatorio.`);
    return 0;
  }

  if (!Number.isInteger(value) || value < 0) {
    errors.push(`${field} debe ser un numero entero mayor o igual a cero.`);
    return 0;
  }

  return value;
}

function requiredInteger(payload, field, errors) {
  const rawValue = payload?.[field];
  const value = Number(rawValue);

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    errors.push(`${field} es obligatorio.`);
    return 0;
  }

  if (!Number.isInteger(value)) {
    errors.push(`${field} debe ser un numero entero.`);
    return 0;
  }

  return value;
}

function nullableNumber(payload, field, errors) {
  const rawValue = payload?.[field];

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  const value = Number(rawValue);

  if (!Number.isFinite(value)) {
    errors.push(`${field} debe ser un numero valido.`);
    return null;
  }

  return value;
}

function requiredNonNegativeNumber(payload, field, errors) {
  const rawValue = payload?.[field];
  const value = Number(rawValue);

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    errors.push(`${field} es obligatorio.`);
    return 0;
  }

  if (!Number.isFinite(value) || value < 0) {
    errors.push(`${field} debe ser un numero mayor o igual a cero.`);
    return 0;
  }

  return value;
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function normalizeSucursalPayload(payload) {
  const errors = [];
  const tipo = textField(payload, "tipo").toUpperCase();
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
    gasolinera_id: gasolineraId
  };

  if (!data.nombre) errors.push("nombre es obligatorio.");
  if (!["FARMACIA", "STAND", "GASOLINERA"].includes(data.tipo)) {
    errors.push("tipo debe ser FARMACIA, STAND o GASOLINERA.");
  }
  if (!data.direccion) errors.push("direccion es obligatoria.");
  if (!data.departamento) errors.push("departamento es obligatorio.");
  if (!data.municipio) errors.push("municipio es obligatorio.");

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

function normalizeBooleanField(payload, field) {
  const value = payload?.[field];

  return value === true || value === 1 || value === "1" ? 1 : 0;
}

function normalizeMedicamentoPayload(payload) {
  const errors = [];

  const data = {
    nombre: textField(payload, "nombre"),
    presentacion: textField(payload, "presentacion"),
    unidad: textField(payload, "unidad").toUpperCase(),
    requiere_receta: normalizeBooleanField(payload, "requiere_receta")
  };

  if (!data.nombre) errors.push("nombre es obligatorio.");
  if (!data.presentacion) errors.push("presentacion es obligatoria.");
  if (!data.unidad) errors.push("unidad es obligatoria.");

  return { data, errors };
}

function normalizeProveedorPayload(payload) {
  const errors = [];
  const data = {
    nombre: textField(payload, "nombre"),
    nit: nullableTextField(payload, "nit"),
    telefono: nullableTextField(payload, "telefono"),
    direccion: nullableTextField(payload, "direccion")
  };

  if (!data.nombre) errors.push("nombre es obligatorio.");

  return { data, errors };
}

function normalizeLotePayload(payload) {
  const errors = [];
  const data = {
    medicamento_id: requiredPositiveInteger(payload, "medicamento_id", errors),
    proveedor_id: nullablePositiveInteger(payload, "proveedor_id", errors),
    numero_lote: textField(payload, "numero_lote").toUpperCase(),
    fecha_fabricacion: nullableTextField(payload, "fecha_fabricacion"),
    fecha_vencimiento: textField(payload, "fecha_vencimiento")
  };

  if (!data.numero_lote) errors.push("numero_lote es obligatorio.");
  if (!data.fecha_vencimiento) errors.push("fecha_vencimiento es obligatoria.");
  if (data.fecha_fabricacion && data.fecha_vencimiento < data.fecha_fabricacion) {
    errors.push("fecha_vencimiento no puede ser anterior a fecha_fabricacion.");
  }

  return { data, errors };
}

function normalizeInventarioPayload(payload) {
  const errors = [];
  const stockActual = requiredNonNegativeInteger(payload, "stock_actual", errors);
  const stockReservado = requiredNonNegativeInteger(payload, "stock_reservado", errors);

  const data = {
    sucursal_id: requiredPositiveInteger(payload, "sucursal_id", errors),
    lote_id: requiredPositiveInteger(payload, "lote_id", errors),
    stock_actual: stockActual,
    stock_reservado: stockReservado,
    stock_disponible: stockActual - stockReservado
  };

  if (stockReservado > stockActual) {
    errors.push("stock_reservado no puede ser mayor que stock_actual.");
  }

  return { data, errors };
}

const movementTypes = [
  "COMPRA",
  "VENTA",
  "TRANSFERENCIA_SALIDA",
  "TRANSFERENCIA_ENTRADA",
  "AJUSTE",
  "DEVOLUCION",
  "VENCIMIENTO"
];

const transferStates = ["CREADA", "APROBADA", "ENVIADA", "RECIBIDA", "CANCELADA"];
const pedidoChannels = ["FARMACIA", "CALL_CENTER", "PORTAL"];
const pedidoStates = ["CREADO", "RESERVADO", "PAGADO", "DESPACHADO", "ENTREGADO", "CANCELADO"];

function signedMovementQuantity(tipoMovimiento, cantidad) {
  if (["VENTA", "TRANSFERENCIA_SALIDA", "VENCIMIENTO"].includes(tipoMovimiento)) {
    return -Math.abs(cantidad);
  }

  if (["COMPRA", "TRANSFERENCIA_ENTRADA", "DEVOLUCION"].includes(tipoMovimiento)) {
    return Math.abs(cantidad);
  }

  return cantidad;
}

function normalizeMovimientoInventarioPayload(payload) {
  const errors = [];
  const tipoMovimiento = textField(payload, "tipo_movimiento").toUpperCase();
  const rawCantidad = requiredInteger(payload, "cantidad", errors);
  const cantidad = signedMovementQuantity(tipoMovimiento, rawCantidad);

  const data = {
    sucursal_id: requiredPositiveInteger(payload, "sucursal_id", errors),
    lote_id: requiredPositiveInteger(payload, "lote_id", errors),
    usuario_id: nullablePositiveInteger(payload, "usuario_id", errors),
    transferencia_id: nullablePositiveInteger(payload, "transferencia_id", errors),
    item_transferencia_id: nullablePositiveInteger(payload, "item_transferencia_id", errors),
    tipo_movimiento: tipoMovimiento,
    cantidad,
    referencia: nullableTextField(payload, "referencia"),
    observacion: nullableTextField(payload, "observacion")
  };

  if (!movementTypes.includes(data.tipo_movimiento)) {
    errors.push(`tipo_movimiento debe ser uno de: ${movementTypes.join(", ")}.`);
  }

  if (data.cantidad === 0) {
    errors.push("cantidad no puede ser cero.");
  }

  return { data, errors };
}

function normalizeTransferenciaPayload(payload) {
  const errors = [];
  const estado = textField(payload, "estado").toUpperCase() || "CREADA";
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const data = {
    sucursal_origen_id: requiredPositiveInteger(payload, "sucursal_origen_id", errors),
    sucursal_destino_id: requiredPositiveInteger(payload, "sucursal_destino_id", errors),
    fecha_envio: nullableTextField(payload, "fecha_envio"),
    fecha_recepcion: nullableTextField(payload, "fecha_recepcion"),
    estado,
    observacion: nullableTextField(payload, "observacion"),
    usuario_creador_id: nullablePositiveInteger(payload, "usuario_creador_id", errors),
    items: items.map((item, index) => {
      const cantidadEnviada = requiredPositiveInteger(item, "cantidad_enviada", errors);
      const cantidadRecibida = requiredNonNegativeInteger(
        { cantidad_recibida: item?.cantidad_recibida ?? 0 },
        "cantidad_recibida",
        errors
      );

      if (cantidadRecibida > cantidadEnviada) {
        errors.push(`items[${index}].cantidad_recibida no puede ser mayor que cantidad_enviada.`);
      }

      return {
        lote_id: requiredPositiveInteger(item, "lote_id", errors),
        cantidad_enviada: cantidadEnviada,
        cantidad_recibida: cantidadRecibida
      };
    })
  };

  if (data.sucursal_origen_id && data.sucursal_origen_id === data.sucursal_destino_id) {
    errors.push("sucursal_origen_id y sucursal_destino_id deben ser diferentes.");
  }

  if (!transferStates.includes(data.estado)) {
    errors.push(`estado debe ser uno de: ${transferStates.join(", ")}.`);
  }

  if (data.fecha_envio && data.fecha_recepcion && data.fecha_recepcion < data.fecha_envio) {
    errors.push("fecha_recepcion no puede ser anterior a fecha_envio.");
  }

  if (data.items.length === 0) {
    errors.push("items debe incluir al menos un lote.");
  }

  const repeatedLotes = new Set();
  const seenLotes = new Set();
  data.items.forEach((item) => {
    if (seenLotes.has(item.lote_id)) {
      repeatedLotes.add(item.lote_id);
    }
    seenLotes.add(item.lote_id);
  });

  if (repeatedLotes.size > 0) {
    errors.push("items no puede repetir el mismo lote.");
  }

  return { data, errors };
}

function normalizeClientePayload(payload) {
  const errors = [];
  const data = {
    nombre: textField(payload, "nombre"),
    telefono: nullableTextField(payload, "telefono"),
    email: nullableTextField(payload, "email"),
    direccion: nullableTextField(payload, "direccion"),
    referencia_direccion: nullableTextField(payload, "referencia_direccion"),
    latitud: nullableNumber(payload, "latitud", errors),
    longitud: nullableNumber(payload, "longitud", errors)
  };

  if (!data.nombre) errors.push("nombre es obligatorio.");
  if (data.email && !data.email.includes("@")) {
    errors.push("email debe tener un formato valido.");
  }

  return { data, errors };
}

function normalizePedidoPayload(payload) {
  const errors = [];
  const canal = textField(payload, "canal").toUpperCase() || "FARMACIA";
  const estado = textField(payload, "estado").toUpperCase() || "CREADO";
  const items = Array.isArray(payload?.items) ? payload.items : [];

  const data = {
    sucursal_id: requiredPositiveInteger(payload, "sucursal_id", errors),
    cliente_id: nullablePositiveInteger(payload, "cliente_id", errors),
    canal,
    estado,
    observacion: nullableTextField(payload, "observacion"),
    subtotal: 0,
    descuento_total: 0,
    total: 0,
    items: items.map((item, index) => {
      const cantidad = requiredPositiveInteger(item, "cantidad", errors);
      const precioUnitario = requiredNonNegativeNumber(item, "precio_unitario", errors);
      const descuento = requiredNonNegativeNumber({ descuento: item?.descuento ?? 0 }, "descuento", errors);
      const lineBase = roundMoney(cantidad * precioUnitario);
      const subTotal = roundMoney(lineBase - descuento);

      if (descuento > lineBase) {
        errors.push(`items[${index}].descuento no puede ser mayor que el subtotal del item.`);
      }

      return {
        medicamento_id: requiredPositiveInteger(item, "medicamento_id", errors),
        lote_id: nullablePositiveInteger(item, "lote_id", errors),
        cantidad,
        precio_unitario: precioUnitario,
        descuento,
        sub_total: Math.max(subTotal, 0)
      };
    })
  };

  if (!pedidoChannels.includes(data.canal)) {
    errors.push(`canal debe ser uno de: ${pedidoChannels.join(", ")}.`);
  }

  if (!pedidoStates.includes(data.estado)) {
    errors.push(`estado debe ser uno de: ${pedidoStates.join(", ")}.`);
  }

  if (data.items.length === 0) {
    errors.push("items debe incluir al menos un medicamento.");
  }

  data.subtotal = roundMoney(data.items.reduce((total, item) => total + item.cantidad * item.precio_unitario, 0));
  data.descuento_total = roundMoney(data.items.reduce((total, item) => total + item.descuento, 0));
  data.total = roundMoney(data.subtotal - data.descuento_total);

  if (data.total < 0) {
    errors.push("total no puede ser negativo.");
  }

  return { data, errors };
}

function formatEntityCode(prefix, id) {
  return `${prefix}-${String(id || 0).padStart(3, "0")}`;
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVA')`
    )
      .bind(
        data.nombre,
        data.tipo,
        data.direccion,
        data.departamento,
        data.municipio,
        data.telefono,
        data.centro_comercial_id,
        data.gasolinera_id
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

async function deleteSucursal(env, idSucursal) {
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

  try {
    await env.DB.prepare("DELETE FROM sucursal WHERE id_sucursal = ?").bind(idSucursal).run();

    return json({
      ok: true,
      data: {
        id_sucursal: idSucursal
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar la sucursal. Puede tener inventario, caja, empleados u otros registros asociados."
      },
      409
    );
  }
}

async function listMedicamentos(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        m.id_medicamento,
        m.codigo,
        m.nombre,
        m.presentacion,
        m.unidad,
        m.requiere_receta,
        m.estado,
        COUNT(DISTINCT l.id_lote) AS total_lotes,
        COALESCE(SUM(i.stock_disponible), 0) AS stock_disponible
      FROM medicamento m
      LEFT JOIN lote l ON l.medicamento_id = m.id_medicamento
      LEFT JOIN inventario i ON i.lote_id = l.id_lote
      GROUP BY
        m.id_medicamento,
        m.codigo,
        m.nombre,
        m.presentacion,
        m.unidad,
        m.requiere_receta,
        m.estado
      ORDER BY m.nombre ASC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer medicamentos. Confirma que el schema exista en SQLite/D1.",
        data: []
      },
      500
    );
  }
}

async function findMedicamentoById(env, idMedicamento) {
  return env.DB.prepare(
    `SELECT
      m.id_medicamento,
      m.codigo,
      m.nombre,
      m.presentacion,
      m.unidad,
      m.requiere_receta,
      m.estado,
      m.created_at,
      m.updated_at,
      COUNT(DISTINCT l.id_lote) AS total_lotes,
      COALESCE(SUM(i.stock_disponible), 0) AS stock_disponible
    FROM medicamento m
    LEFT JOIN lote l ON l.medicamento_id = m.id_medicamento
    LEFT JOIN inventario i ON i.lote_id = l.id_lote
    WHERE m.id_medicamento = ?
    GROUP BY
      m.id_medicamento,
      m.codigo,
      m.nombre,
      m.presentacion,
      m.unidad,
      m.requiere_receta,
      m.estado,
      m.created_at,
      m.updated_at`
  )
    .bind(idMedicamento)
    .first();
}

async function getMedicamento(env, idMedicamento) {
  try {
    const medicamento = await findMedicamentoById(env, idMedicamento);

    if (!medicamento) {
      return json(
        {
          ok: false,
          message: "Medicamento no encontrado."
        },
        404
      );
    }

    return json({
      ok: true,
      data: medicamento
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar el medicamento."
      },
      500
    );
  }
}

async function createMedicamento(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizeMedicamentoPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del medicamento.",
        errors
      },
      400
    );
  }

  try {
    const temporaryCode = `PEND-MED-${crypto.randomUUID()}`;
    const result = await env.DB.prepare(
      `INSERT INTO medicamento (
        codigo,
        nombre,
        presentacion,
        unidad,
        requiere_receta,
        estado
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVO')`
    )
      .bind(temporaryCode, data.nombre, data.presentacion, data.unidad, data.requiere_receta)
      .run();

    const idMedicamento = result.meta.last_row_id;

    await env.DB.prepare(
      `UPDATE medicamento
      SET codigo = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id_medicamento = ?`
    )
      .bind(formatEntityCode("MED", idMedicamento), idMedicamento)
      .run();

    const medicamento = await findMedicamentoById(env, idMedicamento);

    return json(
      {
        ok: true,
        data: medicamento
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear el medicamento."
      },
      500
    );
  }
}

async function updateMedicamento(request, env, idMedicamento) {
  const existing = await findMedicamentoById(env, idMedicamento);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Medicamento no encontrado."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizeMedicamentoPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del medicamento.",
        errors
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE medicamento
      SET
        nombre = ?,
        presentacion = ?,
        unidad = ?,
        requiere_receta = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_medicamento = ?`
    )
      .bind(data.nombre, data.presentacion, data.unidad, data.requiere_receta, idMedicamento)
      .run();

    const medicamento = await findMedicamentoById(env, idMedicamento);

    return json({
      ok: true,
      data: medicamento
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar el medicamento."
      },
      500
    );
  }
}

async function deleteMedicamento(env, idMedicamento) {
  const existing = await findMedicamentoById(env, idMedicamento);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Medicamento no encontrado."
      },
      404
    );
  }

  try {
    await env.DB.prepare("DELETE FROM medicamento WHERE id_medicamento = ?").bind(idMedicamento).run();

    return json({
      ok: true,
      data: {
        id_medicamento: idMedicamento
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar el medicamento. Puede tener lotes, inventario o pedidos asociados."
      },
      409
    );
  }
}

async function listProveedores(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        p.id_proveedor,
        p.nombre,
        p.nit,
        p.telefono,
        p.direccion,
        p.estado,
        COUNT(l.id_lote) AS total_lotes
      FROM proveedor p
      LEFT JOIN lote l ON l.proveedor_id = p.id_proveedor
      GROUP BY
        p.id_proveedor,
        p.nombre,
        p.nit,
        p.telefono,
        p.direccion,
        p.estado
      ORDER BY p.nombre ASC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer proveedores. Confirma que el schema exista en SQLite/D1.",
        data: []
      },
      500
    );
  }
}

async function findProveedorById(env, idProveedor) {
  return env.DB.prepare(
    `SELECT
      p.id_proveedor,
      p.nombre,
      p.nit,
      p.telefono,
      p.direccion,
      p.estado,
      p.created_at,
      p.updated_at,
      COUNT(l.id_lote) AS total_lotes
    FROM proveedor p
    LEFT JOIN lote l ON l.proveedor_id = p.id_proveedor
    WHERE p.id_proveedor = ?
    GROUP BY
      p.id_proveedor,
      p.nombre,
      p.nit,
      p.telefono,
      p.direccion,
      p.estado,
      p.created_at,
      p.updated_at`
  )
    .bind(idProveedor)
    .first();
}

async function getProveedor(env, idProveedor) {
  try {
    const proveedor = await findProveedorById(env, idProveedor);

    if (!proveedor) {
      return json(
        {
          ok: false,
          message: "Proveedor no encontrado."
        },
        404
      );
    }

    return json({
      ok: true,
      data: proveedor
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar el proveedor."
      },
      500
    );
  }
}

async function createProveedor(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizeProveedorPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del proveedor.",
        errors
      },
      400
    );
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO proveedor (
        nombre,
        nit,
        telefono,
        direccion,
        estado
      ) VALUES (?, ?, ?, ?, 'ACTIVO')`
    )
      .bind(data.nombre, data.nit, data.telefono, data.direccion)
      .run();

    const proveedor = await findProveedorById(env, result.meta.last_row_id);

    return json(
      {
        ok: true,
        data: proveedor
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear el proveedor."
      },
      500
    );
  }
}

async function updateProveedor(request, env, idProveedor) {
  const existing = await findProveedorById(env, idProveedor);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Proveedor no encontrado."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizeProveedorPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del proveedor.",
        errors
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE proveedor
      SET
        nombre = ?,
        nit = ?,
        telefono = ?,
        direccion = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_proveedor = ?`
    )
      .bind(data.nombre, data.nit, data.telefono, data.direccion, idProveedor)
      .run();

    const proveedor = await findProveedorById(env, idProveedor);

    return json({
      ok: true,
      data: proveedor
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar el proveedor."
      },
      500
    );
  }
}

async function deleteProveedor(env, idProveedor) {
  const existing = await findProveedorById(env, idProveedor);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Proveedor no encontrado."
      },
      404
    );
  }

  try {
    await env.DB.prepare("DELETE FROM proveedor WHERE id_proveedor = ?").bind(idProveedor).run();

    return json({
      ok: true,
      data: {
        id_proveedor: idProveedor
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar el proveedor. Puede tener lotes asociados."
      },
      409
    );
  }
}

async function listLotes(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        l.id_lote,
        l.medicamento_id,
        m.codigo AS medicamento_codigo,
        m.nombre AS medicamento_nombre,
        m.presentacion AS medicamento_presentacion,
        l.proveedor_id,
        p.nombre AS proveedor_nombre,
        l.numero_lote,
        l.fecha_fabricacion,
        l.fecha_vencimiento,
        l.estado,
        COALESCE(SUM(i.stock_disponible), 0) AS stock_disponible
      FROM lote l
      JOIN medicamento m ON m.id_medicamento = l.medicamento_id
      LEFT JOIN proveedor p ON p.id_proveedor = l.proveedor_id
      LEFT JOIN inventario i ON i.lote_id = l.id_lote
      GROUP BY
        l.id_lote,
        l.medicamento_id,
        m.codigo,
        m.nombre,
        m.presentacion,
        l.proveedor_id,
        p.nombre,
        l.numero_lote,
        l.fecha_fabricacion,
        l.fecha_vencimiento,
        l.estado
      ORDER BY l.fecha_vencimiento ASC, m.nombre ASC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer lotes. Confirma que el schema exista en SQLite/D1.",
        data: []
      },
      500
    );
  }
}

async function findLoteById(env, idLote) {
  return env.DB.prepare(
    `SELECT
      l.id_lote,
      l.medicamento_id,
      m.codigo AS medicamento_codigo,
      m.nombre AS medicamento_nombre,
      m.presentacion AS medicamento_presentacion,
      l.proveedor_id,
      p.nombre AS proveedor_nombre,
      l.numero_lote,
      l.fecha_fabricacion,
      l.fecha_vencimiento,
      l.estado,
      l.created_at,
      l.updated_at,
      COALESCE(SUM(i.stock_disponible), 0) AS stock_disponible
    FROM lote l
    JOIN medicamento m ON m.id_medicamento = l.medicamento_id
    LEFT JOIN proveedor p ON p.id_proveedor = l.proveedor_id
    LEFT JOIN inventario i ON i.lote_id = l.id_lote
    WHERE l.id_lote = ?
    GROUP BY
      l.id_lote,
      l.medicamento_id,
      m.codigo,
      m.nombre,
      m.presentacion,
      l.proveedor_id,
      p.nombre,
      l.numero_lote,
      l.fecha_fabricacion,
      l.fecha_vencimiento,
      l.estado,
      l.created_at,
      l.updated_at`
  )
    .bind(idLote)
    .first();
}

async function getLote(env, idLote) {
  try {
    const lote = await findLoteById(env, idLote);

    if (!lote) {
      return json(
        {
          ok: false,
          message: "Lote no encontrado."
        },
        404
      );
    }

    return json({
      ok: true,
      data: lote
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar el lote."
      },
      500
    );
  }
}

async function createLote(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizeLotePayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del lote.",
        errors
      },
      400
    );
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO lote (
        medicamento_id,
        proveedor_id,
        numero_lote,
        fecha_fabricacion,
        fecha_vencimiento,
        estado
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVO')`
    )
      .bind(
        data.medicamento_id,
        data.proveedor_id,
        data.numero_lote,
        data.fecha_fabricacion,
        data.fecha_vencimiento
      )
      .run();

    const lote = await findLoteById(env, result.meta.last_row_id);

    return json(
      {
        ok: true,
        data: lote
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear el lote. Revisa medicamento, proveedor y numero de lote."
      },
      500
    );
  }
}

async function updateLote(request, env, idLote) {
  const existing = await findLoteById(env, idLote);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Lote no encontrado."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizeLotePayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del lote.",
        errors
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE lote
      SET
        medicamento_id = ?,
        proveedor_id = ?,
        numero_lote = ?,
        fecha_fabricacion = ?,
        fecha_vencimiento = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_lote = ?`
    )
      .bind(
        data.medicamento_id,
        data.proveedor_id,
        data.numero_lote,
        data.fecha_fabricacion,
        data.fecha_vencimiento,
        idLote
      )
      .run();

    const lote = await findLoteById(env, idLote);

    return json({
      ok: true,
      data: lote
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar el lote. Revisa medicamento, proveedor y numero de lote."
      },
      500
    );
  }
}

async function deleteLote(env, idLote) {
  const existing = await findLoteById(env, idLote);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Lote no encontrado."
      },
      404
    );
  }

  try {
    await env.DB.prepare("DELETE FROM lote WHERE id_lote = ?").bind(idLote).run();

    return json({
      ok: true,
      data: {
        id_lote: idLote
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar el lote. Puede tener inventario o movimientos asociados."
      },
      409
    );
  }
}

async function listInventario(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        i.id_inventario,
        i.sucursal_id,
        s.nombre AS sucursal_nombre,
        i.lote_id,
        l.numero_lote,
        l.fecha_vencimiento,
        m.id_medicamento,
        m.codigo AS medicamento_codigo,
        m.nombre AS medicamento_nombre,
        m.presentacion AS medicamento_presentacion,
        i.stock_actual,
        i.stock_reservado,
        i.stock_disponible,
        i.updated_at
      FROM inventario i
      JOIN sucursal s ON s.id_sucursal = i.sucursal_id
      JOIN lote l ON l.id_lote = i.lote_id
      JOIN medicamento m ON m.id_medicamento = l.medicamento_id
      ORDER BY s.nombre ASC, m.nombre ASC, l.fecha_vencimiento ASC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer inventario. Confirma que el schema exista en SQLite/D1.",
        data: []
      },
      500
    );
  }
}

async function listInventarioDisponible(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        id_sucursal,
        sucursal,
        id_medicamento,
        codigo,
        medicamento,
        presentacion,
        id_lote,
        numero_lote,
        fecha_vencimiento,
        stock_actual,
        stock_reservado,
        stock_disponible
      FROM vw_inventario_disponible
      ORDER BY sucursal ASC, medicamento ASC, fecha_vencimiento ASC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer inventario disponible.",
        data: []
      },
      500
    );
  }
}

async function findInventarioById(env, idInventario) {
  return env.DB.prepare(
    `SELECT
      i.id_inventario,
      i.sucursal_id,
      s.nombre AS sucursal_nombre,
      i.lote_id,
      l.numero_lote,
      l.fecha_vencimiento,
      m.id_medicamento,
      m.codigo AS medicamento_codigo,
      m.nombre AS medicamento_nombre,
      m.presentacion AS medicamento_presentacion,
      i.stock_actual,
      i.stock_reservado,
      i.stock_disponible,
      i.updated_at
    FROM inventario i
    JOIN sucursal s ON s.id_sucursal = i.sucursal_id
    JOIN lote l ON l.id_lote = i.lote_id
    JOIN medicamento m ON m.id_medicamento = l.medicamento_id
    WHERE i.id_inventario = ?`
  )
    .bind(idInventario)
    .first();
}

async function getInventario(env, idInventario) {
  try {
    const inventario = await findInventarioById(env, idInventario);

    if (!inventario) {
      return json(
        {
          ok: false,
          message: "Inventario no encontrado."
        },
        404
      );
    }

    return json({
      ok: true,
      data: inventario
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar el inventario."
      },
      500
    );
  }
}

async function createInventario(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizeInventarioPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del inventario.",
        errors
      },
      400
    );
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO inventario (
        sucursal_id,
        lote_id,
        stock_actual,
        stock_reservado,
        stock_disponible
      ) VALUES (?, ?, ?, ?, ?)`
    )
      .bind(
        data.sucursal_id,
        data.lote_id,
        data.stock_actual,
        data.stock_reservado,
        data.stock_disponible
      )
      .run();

    const inventario = await findInventarioById(env, result.meta.last_row_id);

    return json(
      {
        ok: true,
        data: inventario
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear el inventario. Revisa sucursal, lote y que la combinacion no exista."
      },
      500
    );
  }
}

async function updateInventario(request, env, idInventario) {
  const existing = await findInventarioById(env, idInventario);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Inventario no encontrado."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizeInventarioPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del inventario.",
        errors
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE inventario
      SET
        sucursal_id = ?,
        lote_id = ?,
        stock_actual = ?,
        stock_reservado = ?,
        stock_disponible = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_inventario = ?`
    )
      .bind(
        data.sucursal_id,
        data.lote_id,
        data.stock_actual,
        data.stock_reservado,
        data.stock_disponible,
        idInventario
      )
      .run();

    const inventario = await findInventarioById(env, idInventario);

    return json({
      ok: true,
      data: inventario
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar el inventario. Revisa sucursal, lote y que la combinacion no exista."
      },
      500
    );
  }
}

async function deleteInventario(env, idInventario) {
  const existing = await findInventarioById(env, idInventario);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Inventario no encontrado."
      },
      404
    );
  }

  try {
    await env.DB.prepare("DELETE FROM inventario WHERE id_inventario = ?").bind(idInventario).run();

    return json({
      ok: true,
      data: {
        id_inventario: idInventario
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar el inventario. Puede tener movimientos asociados."
      },
      409
    );
  }
}

async function findInventoryBySucursalAndLote(env, sucursalId, loteId) {
  return env.DB.prepare(
    `SELECT
      id_inventario,
      sucursal_id,
      lote_id,
      stock_actual,
      stock_reservado,
      stock_disponible
    FROM inventario
    WHERE sucursal_id = ? AND lote_id = ?`
  )
    .bind(sucursalId, loteId)
    .first();
}

async function applyInventoryDelta(env, sucursalId, loteId, delta) {
  const inventory = await findInventoryBySucursalAndLote(env, sucursalId, loteId);

  if (!inventory && delta < 0) {
    throw new Error("No hay inventario disponible para registrar esta salida.");
  }

  if (!inventory) {
    await env.DB.prepare(
      `INSERT INTO inventario (
        sucursal_id,
        lote_id,
        stock_actual,
        stock_reservado,
        stock_disponible
      ) VALUES (?, ?, ?, 0, ?)`
    )
      .bind(sucursalId, loteId, delta, delta)
      .run();
    return;
  }

  const nextStockActual = Number(inventory.stock_actual || 0) + delta;
  const stockReservado = Number(inventory.stock_reservado || 0);
  const nextStockDisponible = nextStockActual - stockReservado;

  if (nextStockActual < stockReservado || nextStockDisponible < 0) {
    throw new Error("Stock disponible insuficiente para registrar esta salida.");
  }

  await env.DB.prepare(
    `UPDATE inventario
    SET
      stock_actual = ?,
      stock_disponible = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id_inventario = ?`
  )
    .bind(nextStockActual, nextStockDisponible, inventory.id_inventario)
    .run();
}

async function listMovimientosInventario(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        mi.id_movimiento_inv,
        mi.sucursal_id,
        s.nombre AS sucursal_nombre,
        mi.lote_id,
        l.numero_lote,
        l.fecha_vencimiento,
        m.codigo AS medicamento_codigo,
        m.nombre AS medicamento_nombre,
        m.presentacion AS medicamento_presentacion,
        mi.usuario_id,
        u.nombre_usuario,
        mi.transferencia_id,
        mi.item_transferencia_id,
        mi.tipo_movimiento,
        mi.cantidad,
        mi.fecha_hora,
        mi.referencia,
        mi.observacion
      FROM movimiento_inventario mi
      JOIN sucursal s ON s.id_sucursal = mi.sucursal_id
      JOIN lote l ON l.id_lote = mi.lote_id
      JOIN medicamento m ON m.id_medicamento = l.medicamento_id
      LEFT JOIN usuario u ON u.id_usuario = mi.usuario_id
      ORDER BY mi.fecha_hora DESC, mi.id_movimiento_inv DESC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer movimientos de inventario.",
        data: []
      },
      500
    );
  }
}

async function findMovimientoInventarioById(env, idMovimiento) {
  return env.DB.prepare(
    `SELECT
      mi.id_movimiento_inv,
      mi.sucursal_id,
      s.nombre AS sucursal_nombre,
      mi.lote_id,
      l.numero_lote,
      l.fecha_vencimiento,
      m.codigo AS medicamento_codigo,
      m.nombre AS medicamento_nombre,
      m.presentacion AS medicamento_presentacion,
      mi.usuario_id,
      u.nombre_usuario,
      mi.transferencia_id,
      mi.item_transferencia_id,
      mi.tipo_movimiento,
      mi.cantidad,
      mi.fecha_hora,
      mi.referencia,
      mi.observacion
    FROM movimiento_inventario mi
    JOIN sucursal s ON s.id_sucursal = mi.sucursal_id
    JOIN lote l ON l.id_lote = mi.lote_id
    JOIN medicamento m ON m.id_medicamento = l.medicamento_id
    LEFT JOIN usuario u ON u.id_usuario = mi.usuario_id
    WHERE mi.id_movimiento_inv = ?`
  )
    .bind(idMovimiento)
    .first();
}

async function getMovimientoInventario(env, idMovimiento) {
  try {
    const movimiento = await findMovimientoInventarioById(env, idMovimiento);

    if (!movimiento) {
      return json(
        {
          ok: false,
          message: "Movimiento de inventario no encontrado."
        },
        404
      );
    }

    return json({
      ok: true,
      data: movimiento
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar el movimiento de inventario."
      },
      500
    );
  }
}

async function createMovimientoInventario(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizeMovimientoInventarioPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del movimiento.",
        errors
      },
      400
    );
  }

  try {
    await applyInventoryDelta(env, data.sucursal_id, data.lote_id, data.cantidad);

    const result = await env.DB.prepare(
      `INSERT INTO movimiento_inventario (
        sucursal_id,
        lote_id,
        usuario_id,
        transferencia_id,
        item_transferencia_id,
        tipo_movimiento,
        cantidad,
        referencia,
        observacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        data.sucursal_id,
        data.lote_id,
        data.usuario_id,
        data.transferencia_id,
        data.item_transferencia_id,
        data.tipo_movimiento,
        data.cantidad,
        data.referencia,
        data.observacion
      )
      .run();

    const movimiento = await findMovimientoInventarioById(env, result.meta.last_row_id);

    return json(
      {
        ok: true,
        data: movimiento
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: error.message || "No fue posible crear el movimiento de inventario."
      },
      400
    );
  }
}

async function updateMovimientoInventario(request, env, idMovimiento) {
  const existing = await findMovimientoInventarioById(env, idMovimiento);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Movimiento de inventario no encontrado."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizeMovimientoInventarioPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del movimiento.",
        errors
      },
      400
    );
  }

  try {
    await applyInventoryDelta(env, existing.sucursal_id, existing.lote_id, -Number(existing.cantidad));
    await applyInventoryDelta(env, data.sucursal_id, data.lote_id, data.cantidad);

    await env.DB.prepare(
      `UPDATE movimiento_inventario
      SET
        sucursal_id = ?,
        lote_id = ?,
        usuario_id = ?,
        transferencia_id = ?,
        item_transferencia_id = ?,
        tipo_movimiento = ?,
        cantidad = ?,
        referencia = ?,
        observacion = ?
      WHERE id_movimiento_inv = ?`
    )
      .bind(
        data.sucursal_id,
        data.lote_id,
        data.usuario_id,
        data.transferencia_id,
        data.item_transferencia_id,
        data.tipo_movimiento,
        data.cantidad,
        data.referencia,
        data.observacion,
        idMovimiento
      )
      .run();

    const movimiento = await findMovimientoInventarioById(env, idMovimiento);

    return json({
      ok: true,
      data: movimiento
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: error.message || "No fue posible actualizar el movimiento de inventario."
      },
      400
    );
  }
}

async function deleteMovimientoInventario(env, idMovimiento) {
  const existing = await findMovimientoInventarioById(env, idMovimiento);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Movimiento de inventario no encontrado."
      },
      404
    );
  }

  try {
    await applyInventoryDelta(env, existing.sucursal_id, existing.lote_id, -Number(existing.cantidad));
    await env.DB.prepare("DELETE FROM movimiento_inventario WHERE id_movimiento_inv = ?")
      .bind(idMovimiento)
      .run();

    return json({
      ok: true,
      data: {
        id_movimiento_inv: idMovimiento
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: error.message || "No fue posible eliminar el movimiento de inventario."
      },
      400
    );
  }
}

async function listMedicamentosProximosVencer(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        l.id_lote,
        l.numero_lote,
        l.fecha_vencimiento,
        m.id_medicamento,
        m.codigo,
        m.nombre,
        m.presentacion,
        COALESCE(SUM(i.stock_disponible), 0) AS stock_disponible
      FROM lote l
      JOIN medicamento m ON m.id_medicamento = l.medicamento_id
      LEFT JOIN inventario i ON i.lote_id = l.id_lote
      WHERE l.estado = 'ACTIVO'
        AND date(l.fecha_vencimiento) BETWEEN date('now') AND date('now', '+30 days')
      GROUP BY
        l.id_lote,
        l.numero_lote,
        l.fecha_vencimiento,
        m.id_medicamento,
        m.codigo,
        m.nombre,
        m.presentacion
      ORDER BY l.fecha_vencimiento ASC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer medicamentos proximos a vencer.",
        data: []
      },
      500
    );
  }
}

async function validateTransferStock(env, transferencia) {
  const shortages = [];

  for (const item of transferencia.items) {
    const inventory = await findInventoryBySucursalAndLote(
      env,
      transferencia.sucursal_origen_id,
      item.lote_id
    );
    const available = Number(inventory?.stock_disponible || 0);

    if (available < item.cantidad_enviada) {
      shortages.push(`Lote ${item.lote_id} tiene ${available} disponible y requiere ${item.cantidad_enviada}.`);
    }
  }

  return shortages;
}

async function listTransferencias(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        t.id_transferencia,
        t.sucursal_origen_id,
        so.nombre AS sucursal_origen_nombre,
        t.sucursal_destino_id,
        sd.nombre AS sucursal_destino_nombre,
        t.fecha_hora,
        t.fecha_envio,
        t.fecha_recepcion,
        t.estado,
        t.observacion,
        t.usuario_creador_id,
        u.nombre_usuario,
        COUNT(it.id_item_transferencia) AS total_items,
        COALESCE(SUM(it.cantidad_enviada), 0) AS total_enviado,
        COALESCE(SUM(it.cantidad_recibida), 0) AS total_recibido
      FROM transferencia t
      JOIN sucursal so ON so.id_sucursal = t.sucursal_origen_id
      JOIN sucursal sd ON sd.id_sucursal = t.sucursal_destino_id
      LEFT JOIN usuario u ON u.id_usuario = t.usuario_creador_id
      LEFT JOIN item_transferencia it ON it.transferencia_id = t.id_transferencia
      GROUP BY
        t.id_transferencia,
        t.sucursal_origen_id,
        so.nombre,
        t.sucursal_destino_id,
        sd.nombre,
        t.fecha_hora,
        t.fecha_envio,
        t.fecha_recepcion,
        t.estado,
        t.observacion,
        t.usuario_creador_id,
        u.nombre_usuario
      ORDER BY t.fecha_hora DESC, t.id_transferencia DESC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer transferencias.",
        data: []
      },
      500
    );
  }
}

async function findTransferenciaHeaderById(env, idTransferencia) {
  return env.DB.prepare(
    `SELECT
      t.id_transferencia,
      t.sucursal_origen_id,
      so.nombre AS sucursal_origen_nombre,
      t.sucursal_destino_id,
      sd.nombre AS sucursal_destino_nombre,
      t.fecha_hora,
      t.fecha_envio,
      t.fecha_recepcion,
      t.estado,
      t.observacion,
      t.usuario_creador_id,
      u.nombre_usuario,
      COUNT(it.id_item_transferencia) AS total_items,
      COALESCE(SUM(it.cantidad_enviada), 0) AS total_enviado,
      COALESCE(SUM(it.cantidad_recibida), 0) AS total_recibido
    FROM transferencia t
    JOIN sucursal so ON so.id_sucursal = t.sucursal_origen_id
    JOIN sucursal sd ON sd.id_sucursal = t.sucursal_destino_id
    LEFT JOIN usuario u ON u.id_usuario = t.usuario_creador_id
    LEFT JOIN item_transferencia it ON it.transferencia_id = t.id_transferencia
    WHERE t.id_transferencia = ?
    GROUP BY
      t.id_transferencia,
      t.sucursal_origen_id,
      so.nombre,
      t.sucursal_destino_id,
      sd.nombre,
      t.fecha_hora,
      t.fecha_envio,
      t.fecha_recepcion,
      t.estado,
      t.observacion,
      t.usuario_creador_id,
      u.nombre_usuario`
  )
    .bind(idTransferencia)
    .first();
}

async function listTransferenciaItems(env, idTransferencia) {
  const result = await env.DB.prepare(
    `SELECT
      it.id_item_transferencia,
      it.transferencia_id,
      it.lote_id,
      l.numero_lote,
      l.fecha_vencimiento,
      m.codigo AS medicamento_codigo,
      m.nombre AS medicamento_nombre,
      m.presentacion AS medicamento_presentacion,
      it.cantidad_enviada,
      it.cantidad_recibida
    FROM item_transferencia it
    JOIN lote l ON l.id_lote = it.lote_id
    JOIN medicamento m ON m.id_medicamento = l.medicamento_id
    WHERE it.transferencia_id = ?
    ORDER BY m.nombre ASC, l.fecha_vencimiento ASC`
  )
    .bind(idTransferencia)
    .all();

  return result.results || [];
}

async function findTransferenciaById(env, idTransferencia) {
  const transferencia = await findTransferenciaHeaderById(env, idTransferencia);

  if (!transferencia) return null;

  transferencia.items = await listTransferenciaItems(env, idTransferencia);
  return transferencia;
}

async function getTransferencia(env, idTransferencia) {
  try {
    const transferencia = await findTransferenciaById(env, idTransferencia);

    if (!transferencia) {
      return json(
        {
          ok: false,
          message: "Transferencia no encontrada."
        },
        404
      );
    }

    return json({
      ok: true,
      data: transferencia
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar la transferencia."
      },
      500
    );
  }
}

async function insertTransferenciaItems(env, idTransferencia, items) {
  for (const item of items) {
    await env.DB.prepare(
      `INSERT INTO item_transferencia (
        transferencia_id,
        lote_id,
        cantidad_enviada,
        cantidad_recibida
      ) VALUES (?, ?, ?, ?)`
    )
      .bind(idTransferencia, item.lote_id, item.cantidad_enviada, item.cantidad_recibida)
      .run();
  }
}

async function createTransferencia(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizeTransferenciaPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos de la transferencia.",
        errors
      },
      400
    );
  }

  const stockErrors = await validateTransferStock(env, data);
  if (stockErrors.length > 0) {
    return json(
      {
        ok: false,
        message: "Stock disponible insuficiente para la transferencia.",
        errors: stockErrors
      },
      400
    );
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO transferencia (
        sucursal_origen_id,
        sucursal_destino_id,
        fecha_envio,
        fecha_recepcion,
        estado,
        observacion,
        usuario_creador_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        data.sucursal_origen_id,
        data.sucursal_destino_id,
        data.fecha_envio,
        data.fecha_recepcion,
        data.estado,
        data.observacion,
        data.usuario_creador_id
      )
      .run();

    const idTransferencia = result.meta.last_row_id;
    await insertTransferenciaItems(env, idTransferencia, data.items);

    const transferencia = await findTransferenciaById(env, idTransferencia);

    return json(
      {
        ok: true,
        data: transferencia
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear la transferencia."
      },
      500
    );
  }
}

async function updateTransferencia(request, env, idTransferencia) {
  const existing = await findTransferenciaHeaderById(env, idTransferencia);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Transferencia no encontrada."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizeTransferenciaPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos de la transferencia.",
        errors
      },
      400
    );
  }

  const stockErrors = await validateTransferStock(env, data);
  if (stockErrors.length > 0) {
    return json(
      {
        ok: false,
        message: "Stock disponible insuficiente para la transferencia.",
        errors: stockErrors
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE transferencia
      SET
        sucursal_origen_id = ?,
        sucursal_destino_id = ?,
        fecha_envio = ?,
        fecha_recepcion = ?,
        estado = ?,
        observacion = ?,
        usuario_creador_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_transferencia = ?`
    )
      .bind(
        data.sucursal_origen_id,
        data.sucursal_destino_id,
        data.fecha_envio,
        data.fecha_recepcion,
        data.estado,
        data.observacion,
        data.usuario_creador_id,
        idTransferencia
      )
      .run();

    await env.DB.prepare("DELETE FROM item_transferencia WHERE transferencia_id = ?")
      .bind(idTransferencia)
      .run();
    await insertTransferenciaItems(env, idTransferencia, data.items);

    const transferencia = await findTransferenciaById(env, idTransferencia);

    return json({
      ok: true,
      data: transferencia
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar la transferencia."
      },
      500
    );
  }
}

async function deleteTransferencia(env, idTransferencia) {
  const existing = await findTransferenciaHeaderById(env, idTransferencia);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Transferencia no encontrada."
      },
      404
    );
  }

  try {
    const relatedMovement = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM movimiento_inventario WHERE transferencia_id = ?"
    )
      .bind(idTransferencia)
      .first();

    if (Number(relatedMovement?.total || 0) > 0) {
      return json(
        {
          ok: false,
          message: "No fue posible eliminar la transferencia. Tiene movimientos de inventario asociados."
        },
        409
      );
    }

    await env.DB.prepare("DELETE FROM item_transferencia WHERE transferencia_id = ?")
      .bind(idTransferencia)
      .run();
    await env.DB.prepare("DELETE FROM transferencia WHERE id_transferencia = ?")
      .bind(idTransferencia)
      .run();

    return json({
      ok: true,
      data: {
        id_transferencia: idTransferencia
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar la transferencia."
      },
      409
    );
  }
}

async function listClientes(env) {
  try {
    const result = await env.DB.prepare(
      `SELECT
        c.id_cliente,
        c.nombre,
        c.telefono,
        c.email,
        c.direccion,
        c.referencia_direccion,
        c.latitud,
        c.longitud,
        c.created_at,
        c.updated_at,
        COUNT(p.id_pedido) AS total_pedidos,
        COALESCE(SUM(p.total), 0) AS total_compras
      FROM cliente c
      LEFT JOIN pedido p ON p.cliente_id = c.id_cliente
      GROUP BY
        c.id_cliente,
        c.nombre,
        c.telefono,
        c.email,
        c.direccion,
        c.referencia_direccion,
        c.latitud,
        c.longitud,
        c.created_at,
        c.updated_at
      ORDER BY c.nombre ASC`
    ).all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer clientes.",
        data: []
      },
      500
    );
  }
}

async function findClienteById(env, idCliente) {
  return env.DB.prepare(
    `SELECT
      c.id_cliente,
      c.nombre,
      c.telefono,
      c.email,
      c.direccion,
      c.referencia_direccion,
      c.latitud,
      c.longitud,
      c.created_at,
      c.updated_at,
      COUNT(p.id_pedido) AS total_pedidos,
      COALESCE(SUM(p.total), 0) AS total_compras
    FROM cliente c
    LEFT JOIN pedido p ON p.cliente_id = c.id_cliente
    WHERE c.id_cliente = ?
    GROUP BY
      c.id_cliente,
      c.nombre,
      c.telefono,
      c.email,
      c.direccion,
      c.referencia_direccion,
      c.latitud,
      c.longitud,
      c.created_at,
      c.updated_at`
  )
    .bind(idCliente)
    .first();
}

async function getCliente(env, idCliente) {
  try {
    const cliente = await findClienteById(env, idCliente);

    if (!cliente) {
      return json(
        {
          ok: false,
          message: "Cliente no encontrado."
        },
        404
      );
    }

    return json({
      ok: true,
      data: cliente
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar el cliente."
      },
      500
    );
  }
}

async function createCliente(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizeClientePayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del cliente.",
        errors
      },
      400
    );
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO cliente (
        nombre,
        telefono,
        email,
        direccion,
        referencia_direccion,
        latitud,
        longitud
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        data.nombre,
        data.telefono,
        data.email,
        data.direccion,
        data.referencia_direccion,
        data.latitud,
        data.longitud
      )
      .run();

    const cliente = await findClienteById(env, result.meta.last_row_id);

    return json(
      {
        ok: true,
        data: cliente
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear el cliente."
      },
      500
    );
  }
}

async function updateCliente(request, env, idCliente) {
  const existing = await findClienteById(env, idCliente);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Cliente no encontrado."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizeClientePayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del cliente.",
        errors
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE cliente
      SET
        nombre = ?,
        telefono = ?,
        email = ?,
        direccion = ?,
        referencia_direccion = ?,
        latitud = ?,
        longitud = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_cliente = ?`
    )
      .bind(
        data.nombre,
        data.telefono,
        data.email,
        data.direccion,
        data.referencia_direccion,
        data.latitud,
        data.longitud,
        idCliente
      )
      .run();

    const cliente = await findClienteById(env, idCliente);

    return json({
      ok: true,
      data: cliente
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar el cliente."
      },
      500
    );
  }
}

async function deleteCliente(env, idCliente) {
  const existing = await findClienteById(env, idCliente);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Cliente no encontrado."
      },
      404
    );
  }

  try {
    await env.DB.prepare("DELETE FROM cliente WHERE id_cliente = ?").bind(idCliente).run();

    return json({
      ok: true,
      data: {
        id_cliente: idCliente
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar el cliente. Puede tener pedidos asociados."
      },
      409
    );
  }
}

function pedidoFilterParam(url, name, allowedValues, errors) {
  const value = url.searchParams.get(name);
  const normalizedValue = value ? value.trim().toUpperCase() : null;

  if (normalizedValue && !allowedValues.includes(normalizedValue)) {
    errors.push(`${name} debe ser uno de: ${allowedValues.join(", ")}.`);
    return null;
  }

  return normalizedValue;
}

async function listPedidos(request, env) {
  const url = new URL(request.url);
  const errors = [];
  const estado = pedidoFilterParam(url, "estado", pedidoStates, errors);
  const canal = pedidoFilterParam(url, "canal", pedidoChannels, errors);
  const sucursalId = nullablePositiveInteger(
    { sucursal_id: url.searchParams.get("sucursal_id") },
    "sucursal_id",
    errors
  );

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los filtros de pedidos.",
        errors,
        data: []
      },
      400
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT
        p.id_pedido,
        p.sucursal_id,
        s.nombre AS sucursal_nombre,
        p.cliente_id,
        c.nombre AS cliente_nombre,
        c.telefono AS cliente_telefono,
        p.fecha_hora,
        p.canal,
        p.estado,
        p.subtotal,
        p.descuento_total,
        p.total,
        p.observacion,
        COUNT(ip.id_item_pedido) AS total_items,
        COALESCE(SUM(ip.cantidad), 0) AS total_unidades
      FROM pedido p
      JOIN sucursal s ON s.id_sucursal = p.sucursal_id
      LEFT JOIN cliente c ON c.id_cliente = p.cliente_id
      LEFT JOIN item_pedido ip ON ip.pedido_id = p.id_pedido
      WHERE (? IS NULL OR p.estado = ?)
        AND (? IS NULL OR p.canal = ?)
        AND (? IS NULL OR p.sucursal_id = ?)
      GROUP BY
        p.id_pedido,
        p.sucursal_id,
        s.nombre,
        p.cliente_id,
        c.nombre,
        c.telefono,
        p.fecha_hora,
        p.canal,
        p.estado,
        p.subtotal,
        p.descuento_total,
        p.total,
        p.observacion
      ORDER BY p.fecha_hora DESC, p.id_pedido DESC`
    )
      .bind(estado, estado, canal, canal, sucursalId, sucursalId)
      .all();

    return json({
      ok: true,
      data: result.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer pedidos.",
        data: []
      },
      500
    );
  }
}

async function findPedidoHeaderById(env, idPedido) {
  return env.DB.prepare(
    `SELECT
      p.id_pedido,
      p.sucursal_id,
      s.nombre AS sucursal_nombre,
      p.cliente_id,
      c.nombre AS cliente_nombre,
      c.telefono AS cliente_telefono,
      p.fecha_hora,
      p.canal,
      p.estado,
      p.subtotal,
      p.descuento_total,
      p.total,
      p.observacion,
      p.created_at,
      p.updated_at,
      COUNT(ip.id_item_pedido) AS total_items,
      COALESCE(SUM(ip.cantidad), 0) AS total_unidades
    FROM pedido p
    JOIN sucursal s ON s.id_sucursal = p.sucursal_id
    LEFT JOIN cliente c ON c.id_cliente = p.cliente_id
    LEFT JOIN item_pedido ip ON ip.pedido_id = p.id_pedido
    WHERE p.id_pedido = ?
    GROUP BY
      p.id_pedido,
      p.sucursal_id,
      s.nombre,
      p.cliente_id,
      c.nombre,
      c.telefono,
      p.fecha_hora,
      p.canal,
      p.estado,
      p.subtotal,
      p.descuento_total,
      p.total,
      p.observacion,
      p.created_at,
      p.updated_at`
  )
    .bind(idPedido)
    .first();
}

async function listPedidoItems(env, idPedido) {
  const result = await env.DB.prepare(
    `SELECT
      ip.id_item_pedido,
      ip.pedido_id,
      ip.medicamento_id,
      m.codigo AS medicamento_codigo,
      m.nombre AS medicamento_nombre,
      m.presentacion AS medicamento_presentacion,
      ip.lote_id,
      l.numero_lote,
      l.fecha_vencimiento,
      ip.cantidad,
      ip.precio_unitario,
      ip.descuento,
      ip.sub_total
    FROM item_pedido ip
    JOIN medicamento m ON m.id_medicamento = ip.medicamento_id
    LEFT JOIN lote l ON l.id_lote = ip.lote_id
    WHERE ip.pedido_id = ?
    ORDER BY ip.id_item_pedido ASC`
  )
    .bind(idPedido)
    .all();

  return result.results || [];
}

async function findPedidoById(env, idPedido) {
  const pedido = await findPedidoHeaderById(env, idPedido);

  if (!pedido) return null;

  pedido.items = await listPedidoItems(env, idPedido);
  return pedido;
}

async function getPedido(env, idPedido) {
  try {
    const pedido = await findPedidoById(env, idPedido);

    if (!pedido) {
      return json(
        {
          ok: false,
          message: "Pedido no encontrado."
        },
        404
      );
    }

    return json({
      ok: true,
      data: pedido
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar el pedido."
      },
      500
    );
  }
}

async function validatePedidoItems(env, pedido) {
  const errors = [];

  for (const item of pedido.items) {
    const medicamento = await env.DB.prepare(
      "SELECT id_medicamento FROM medicamento WHERE id_medicamento = ?"
    )
      .bind(item.medicamento_id)
      .first();

    if (!medicamento) {
      errors.push(`Medicamento ${item.medicamento_id} no existe.`);
      continue;
    }

    if (!item.lote_id) continue;

    const lote = await env.DB.prepare(
      "SELECT id_lote, medicamento_id, numero_lote FROM lote WHERE id_lote = ?"
    )
      .bind(item.lote_id)
      .first();

    if (!lote) {
      errors.push(`Lote ${item.lote_id} no existe.`);
      continue;
    }

    if (Number(lote.medicamento_id) !== Number(item.medicamento_id)) {
      errors.push(`Lote ${lote.numero_lote} no pertenece al medicamento seleccionado.`);
      continue;
    }

    const inventory = await findInventoryBySucursalAndLote(env, pedido.sucursal_id, item.lote_id);
    const available = Number(inventory?.stock_disponible || 0);

    if (available < item.cantidad) {
      errors.push(`Lote ${lote.numero_lote} tiene ${available} disponible y requiere ${item.cantidad}.`);
    }
  }

  return errors;
}

async function insertPedidoItems(env, idPedido, items) {
  for (const item of items) {
    await env.DB.prepare(
      `INSERT INTO item_pedido (
        pedido_id,
        medicamento_id,
        lote_id,
        cantidad,
        precio_unitario,
        descuento,
        sub_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        idPedido,
        item.medicamento_id,
        item.lote_id,
        item.cantidad,
        item.precio_unitario,
        item.descuento,
        item.sub_total
      )
      .run();
  }
}

async function createPedido(request, env) {
  const payload = await readRequestJson(request);
  const { data, errors } = normalizePedidoPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del pedido.",
        errors
      },
      400
    );
  }

  const itemErrors = await validatePedidoItems(env, data);
  if (itemErrors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los items del pedido.",
        errors: itemErrors
      },
      400
    );
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO pedido (
        sucursal_id,
        cliente_id,
        canal,
        estado,
        subtotal,
        descuento_total,
        total,
        observacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        data.sucursal_id,
        data.cliente_id,
        data.canal,
        data.estado,
        data.subtotal,
        data.descuento_total,
        data.total,
        data.observacion
      )
      .run();

    const idPedido = result.meta.last_row_id;
    await insertPedidoItems(env, idPedido, data.items);

    const pedido = await findPedidoById(env, idPedido);

    return json(
      {
        ok: true,
        data: pedido
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear el pedido. Revisa sucursal, cliente, medicamento y lote."
      },
      500
    );
  }
}

async function updatePedido(request, env, idPedido) {
  const existing = await findPedidoHeaderById(env, idPedido);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Pedido no encontrado."
      },
      404
    );
  }

  const payload = await readRequestJson(request);
  const { data, errors } = normalizePedidoPayload(payload);

  if (errors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del pedido.",
        errors
      },
      400
    );
  }

  const itemErrors = await validatePedidoItems(env, data);
  if (itemErrors.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los items del pedido.",
        errors: itemErrors
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE pedido
      SET
        sucursal_id = ?,
        cliente_id = ?,
        canal = ?,
        estado = ?,
        subtotal = ?,
        descuento_total = ?,
        total = ?,
        observacion = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_pedido = ?`
    )
      .bind(
        data.sucursal_id,
        data.cliente_id,
        data.canal,
        data.estado,
        data.subtotal,
        data.descuento_total,
        data.total,
        data.observacion,
        idPedido
      )
      .run();

    await env.DB.prepare("DELETE FROM item_pedido WHERE pedido_id = ?").bind(idPedido).run();
    await insertPedidoItems(env, idPedido, data.items);

    const pedido = await findPedidoById(env, idPedido);

    return json({
      ok: true,
      data: pedido
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar el pedido."
      },
      500
    );
  }
}

async function deletePedido(env, idPedido) {
  const existing = await findPedidoHeaderById(env, idPedido);

  if (!existing) {
    return json(
      {
        ok: false,
        message: "Pedido no encontrado."
      },
      404
    );
  }

  try {
    const related = await env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM pago WHERE pedido_id = ?) +
        (SELECT COUNT(*) FROM entrega WHERE pedido_id = ?) AS total`
    )
      .bind(idPedido, idPedido)
      .first();

    if (Number(related?.total || 0) > 0) {
      return json(
        {
          ok: false,
          message: "No fue posible eliminar el pedido. Tiene pagos o entregas asociadas."
        },
        409
      );
    }

    await env.DB.prepare("DELETE FROM item_pedido WHERE pedido_id = ?").bind(idPedido).run();
    await env.DB.prepare("DELETE FROM pedido WHERE id_pedido = ?").bind(idPedido).run();

    return json({
      ok: true,
      data: {
        id_pedido: idPedido
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar el pedido. Puede tener pagos o entregas asociadas."
      },
      409
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

    if (url.pathname === "/api/medicamentos") {
      if (request.method === "GET") {
        return listMedicamentos(env);
      }

      if (request.method === "POST") {
        return createMedicamento(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/proveedores") {
      if (request.method === "GET") {
        return listProveedores(env);
      }

      if (request.method === "POST") {
        return createProveedor(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/lotes") {
      if (request.method === "GET") {
        return listLotes(env);
      }

      if (request.method === "POST") {
        return createLote(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/inventario") {
      if (request.method === "GET") {
        return listInventario(env);
      }

      if (request.method === "POST") {
        return createInventario(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/inventario-disponible") {
      if (request.method === "GET") {
        return listInventarioDisponible(env);
      }

      return methodNotAllowed(request.method, ["GET"]);
    }

    if (url.pathname === "/api/medicamentos-proximos-vencer") {
      if (request.method === "GET") {
        return listMedicamentosProximosVencer(env);
      }

      return methodNotAllowed(request.method, ["GET"]);
    }

    if (url.pathname === "/api/movimientos-inventario") {
      if (request.method === "GET") {
        return listMovimientosInventario(env);
      }

      if (request.method === "POST") {
        return createMovimientoInventario(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/transferencias") {
      if (request.method === "GET") {
        return listTransferencias(env);
      }

      if (request.method === "POST") {
        return createTransferencia(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/clientes") {
      if (request.method === "GET") {
        return listClientes(env);
      }

      if (request.method === "POST") {
        return createCliente(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/pedidos") {
      if (request.method === "GET") {
        return listPedidos(request, env);
      }

      if (request.method === "POST") {
        return createPedido(request, env);
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

      if (request.method === "DELETE") {
        return deleteSucursal(env, idSucursal);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const medicamentoMatch = url.pathname.match(/^\/api\/medicamentos\/(\d+)$/);

    if (medicamentoMatch) {
      const idMedicamento = Number(medicamentoMatch[1]);

      if (request.method === "GET") {
        return getMedicamento(env, idMedicamento);
      }

      if (request.method === "PUT") {
        return updateMedicamento(request, env, idMedicamento);
      }

      if (request.method === "DELETE") {
        return deleteMedicamento(env, idMedicamento);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const proveedorMatch = url.pathname.match(/^\/api\/proveedores\/(\d+)$/);

    if (proveedorMatch) {
      const idProveedor = Number(proveedorMatch[1]);

      if (request.method === "GET") {
        return getProveedor(env, idProveedor);
      }

      if (request.method === "PUT") {
        return updateProveedor(request, env, idProveedor);
      }

      if (request.method === "DELETE") {
        return deleteProveedor(env, idProveedor);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const loteMatch = url.pathname.match(/^\/api\/lotes\/(\d+)$/);

    if (loteMatch) {
      const idLote = Number(loteMatch[1]);

      if (request.method === "GET") {
        return getLote(env, idLote);
      }

      if (request.method === "PUT") {
        return updateLote(request, env, idLote);
      }

      if (request.method === "DELETE") {
        return deleteLote(env, idLote);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const inventarioMatch = url.pathname.match(/^\/api\/inventario\/(\d+)$/);

    if (inventarioMatch) {
      const idInventario = Number(inventarioMatch[1]);

      if (request.method === "GET") {
        return getInventario(env, idInventario);
      }

      if (request.method === "PUT") {
        return updateInventario(request, env, idInventario);
      }

      if (request.method === "DELETE") {
        return deleteInventario(env, idInventario);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const movimientoInventarioMatch = url.pathname.match(/^\/api\/movimientos-inventario\/(\d+)$/);

    if (movimientoInventarioMatch) {
      const idMovimiento = Number(movimientoInventarioMatch[1]);

      if (request.method === "GET") {
        return getMovimientoInventario(env, idMovimiento);
      }

      if (request.method === "PUT") {
        return updateMovimientoInventario(request, env, idMovimiento);
      }

      if (request.method === "DELETE") {
        return deleteMovimientoInventario(env, idMovimiento);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const transferenciaMatch = url.pathname.match(/^\/api\/transferencias\/(\d+)$/);

    if (transferenciaMatch) {
      const idTransferencia = Number(transferenciaMatch[1]);

      if (request.method === "GET") {
        return getTransferencia(env, idTransferencia);
      }

      if (request.method === "PUT") {
        return updateTransferencia(request, env, idTransferencia);
      }

      if (request.method === "DELETE") {
        return deleteTransferencia(env, idTransferencia);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const clienteMatch = url.pathname.match(/^\/api\/clientes\/(\d+)$/);

    if (clienteMatch) {
      const idCliente = Number(clienteMatch[1]);

      if (request.method === "GET") {
        return getCliente(env, idCliente);
      }

      if (request.method === "PUT") {
        return updateCliente(request, env, idCliente);
      }

      if (request.method === "DELETE") {
        return deleteCliente(env, idCliente);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const pedidoMatch = url.pathname.match(/^\/api\/pedidos\/(\d+)$/);

    if (pedidoMatch) {
      const idPedido = Number(pedidoMatch[1]);

      if (request.method === "GET") {
        return getPedido(env, idPedido);
      }

      if (request.method === "PUT") {
        return updatePedido(request, env, idPedido);
      }

      if (request.method === "DELETE") {
        return deletePedido(env, idPedido);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
