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

function requiredPositiveNumber(payload, field, errors) {
  const rawValue = payload?.[field];
  const value = Number(rawValue);

  if (rawValue === undefined || rawValue === null || rawValue === "") {
    errors.push(`${field} es obligatorio.`);
    return 0;
  }

  if (!Number.isFinite(value) || value <= 0) {
    errors.push(`${field} debe ser un numero mayor que cero.`);
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
const metodosPago = ["EFECTIVO", "TARJETA", "TRANSFERENCIA", "OTRO"];
const estadosPago = ["PENDIENTE", "CONFIRMADO", "RECHAZADO", "REEMBOLSADO"];
const estadosEntrega = ["PENDIENTE", "EN_RUTA", "ENTREGADA", "FALLIDA", "CANCELADA"];
const tiposMovimientoCaja = ["INGRESO", "EGRESO"];
const conceptosCaja = ["VENTA", "REEMBOLSO", "GASTO", "PLANILLA", "DEPOSITO", "RETIRO", "AJUSTE_CAJA"];
const estadosEmpleado = ["ACTIVO", "INACTIVO"];
const estadosPlanilla = ["ABIERTA", "APROBADA", "PAGADA", "ANULADA"];
const estadosActivo = ["ACTIVO", "EN_MANTENIMIENTO", "TRASLADADO", "BAJA"];
const tiposEventoActivo = ["COMPRA", "DEPRECIACION", "MANTENIMIENTO", "REPARACION", "TRASLADO", "BAJA", "OTRO"];
const estadosUsuario = ["ACTIVO", "INACTIVO", "BLOQUEADO"];
const estadosPedidoConVenta = ["PAGADO", "DESPACHADO", "ENTREGADO"];

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

function normalizarPagoCuerpo(cuerpo) {
  const errores = [];
  const metodoPago = textField(cuerpo, "metodo_pago").toUpperCase();
  const estado = textField(cuerpo, "estado").toUpperCase() || "CONFIRMADO";

  const datos = {
    pedido_id: requiredPositiveInteger(cuerpo, "pedido_id", errores),
    sucursal_id: requiredPositiveInteger(cuerpo, "sucursal_id", errores),
    usuario_id: nullablePositiveInteger(cuerpo, "usuario_id", errores),
    monto: roundMoney(requiredPositiveNumber(cuerpo, "monto", errores)),
    metodo_pago: metodoPago,
    referencia: nullableTextField(cuerpo, "referencia"),
    estado
  };

  if (!metodosPago.includes(datos.metodo_pago)) {
    errores.push(`metodo_pago debe ser uno de: ${metodosPago.join(", ")}.`);
  }

  if (!estadosPago.includes(datos.estado)) {
    errores.push(`estado debe ser uno de: ${estadosPago.join(", ")}.`);
  }

  return { data: datos, errors: errores };
}

function normalizarEntregaCuerpo(cuerpo) {
  const errores = [];
  const estado = textField(cuerpo, "estado").toUpperCase() || "PENDIENTE";

  const datos = {
    pedido_id: requiredPositiveInteger(cuerpo, "pedido_id", errores),
    sucursal_id: requiredPositiveInteger(cuerpo, "sucursal_id", errores),
    fecha_programada: nullableTextField(cuerpo, "fecha_programada"),
    fecha_entrega: nullableTextField(cuerpo, "fecha_entrega"),
    direccion_entrega: textField(cuerpo, "direccion_entrega"),
    referencia_direccion: nullableTextField(cuerpo, "referencia_direccion"),
    estado,
    observacion: nullableTextField(cuerpo, "observacion")
  };

  if (!datos.direccion_entrega) {
    errores.push("direccion_entrega es obligatoria.");
  }

  if (!estadosEntrega.includes(datos.estado)) {
    errores.push(`estado debe ser uno de: ${estadosEntrega.join(", ")}.`);
  }

  if (datos.fecha_programada && datos.fecha_entrega && datos.fecha_entrega < datos.fecha_programada) {
    errores.push("fecha_entrega no puede ser anterior a fecha_programada.");
  }

  return { data: datos, errors: errores };
}

function normalizarMovimientoCajaCuerpo(cuerpo) {
  const errores = [];
  const tipo = textField(cuerpo, "tipo").toUpperCase();
  const concepto = textField(cuerpo, "concepto").toUpperCase();
  const metodoPago = nullableTextField(cuerpo, "metodo_pago")?.toUpperCase() || null;

  const datos = {
    sucursal_id: requiredPositiveInteger(cuerpo, "sucursal_id", errores),
    usuario_id: nullablePositiveInteger(cuerpo, "usuario_id", errores),
    pedido_id: nullablePositiveInteger(cuerpo, "pedido_id", errores),
    pago_id: nullablePositiveInteger(cuerpo, "pago_id", errores),
    planilla_id: nullablePositiveInteger(cuerpo, "planilla_id", errores),
    entrega_id: nullablePositiveInteger(cuerpo, "entrega_id", errores),
    tipo,
    concepto,
    monto: roundMoney(requiredPositiveNumber(cuerpo, "monto", errores)),
    metodo_pago: metodoPago,
    referencia: nullableTextField(cuerpo, "referencia"),
    observacion: nullableTextField(cuerpo, "observacion")
  };

  if (!tiposMovimientoCaja.includes(datos.tipo)) {
    errores.push(`tipo debe ser uno de: ${tiposMovimientoCaja.join(", ")}.`);
  }

  if (!conceptosCaja.includes(datos.concepto)) {
    errores.push(`concepto debe ser uno de: ${conceptosCaja.join(", ")}.`);
  }

  if (datos.metodo_pago && !metodosPago.includes(datos.metodo_pago)) {
    errores.push(`metodo_pago debe ser uno de: ${metodosPago.join(", ")}.`);
  }

  return { data: datos, errors: errores };
}

function normalizarEmpleadoCuerpo(cuerpo) {
  const errores = [];
  const estado = textField(cuerpo, "estado").toUpperCase() || "ACTIVO";

  const datos = {
    sucursal_id: nullablePositiveInteger(cuerpo, "sucursal_id", errores),
    nombre: textField(cuerpo, "nombre"),
    cargo: textField(cuerpo, "cargo"),
    telefono: nullableTextField(cuerpo, "telefono"),
    email: nullableTextField(cuerpo, "email"),
    fecha_ingreso: textField(cuerpo, "fecha_ingreso"),
    estado
  };

  if (!datos.nombre) errores.push("nombre es obligatorio.");
  if (!datos.cargo) errores.push("cargo es obligatorio.");
  if (!datos.fecha_ingreso) errores.push("fecha_ingreso es obligatoria.");
  if (datos.email && !datos.email.includes("@")) {
    errores.push("email debe tener un formato valido.");
  }
  if (!estadosEmpleado.includes(datos.estado)) {
    errores.push(`estado debe ser uno de: ${estadosEmpleado.join(", ")}.`);
  }

  return { data: datos, errors: errores };
}

function normalizarPlanillaCuerpo(cuerpo) {
  const errores = [];
  const estado = textField(cuerpo, "estado").toUpperCase() || "ABIERTA";
  const detalles = Array.isArray(cuerpo?.detalles) ? cuerpo.detalles : [];

  const datos = {
    sucursal_id: requiredPositiveInteger(cuerpo, "sucursal_id", errores),
    periodo_inicio: textField(cuerpo, "periodo_inicio"),
    periodo_fin: textField(cuerpo, "periodo_fin"),
    fecha_pago: nullableTextField(cuerpo, "fecha_pago"),
    estado,
    detalles: detalles.map((detalle, indice) => ({
      empleado_id: requiredPositiveInteger(detalle, "empleado_id", errores),
      concepto: textField(detalle, "concepto"),
      monto: roundMoney(requiredNonNegativeNumber(detalle, "monto", errores)),
      indice
    }))
  };

  if (!datos.periodo_inicio) errores.push("periodo_inicio es obligatorio.");
  if (!datos.periodo_fin) errores.push("periodo_fin es obligatorio.");
  if (datos.periodo_inicio && datos.periodo_fin && datos.periodo_fin < datos.periodo_inicio) {
    errores.push("periodo_fin no puede ser anterior a periodo_inicio.");
  }
  if (!estadosPlanilla.includes(datos.estado)) {
    errores.push(`estado debe ser uno de: ${estadosPlanilla.join(", ")}.`);
  }
  if (datos.detalles.length === 0) {
    errores.push("detalles debe incluir al menos un empleado.");
  }

  datos.detalles.forEach((detalle) => {
    if (!detalle.concepto) {
      errores.push(`detalles[${detalle.indice}].concepto es obligatorio.`);
    }
  });
  datos.total = roundMoney(datos.detalles.reduce((total, detalle) => total + detalle.monto, 0));
  datos.detalles = datos.detalles.map(({ indice, ...detalle }) => detalle);

  return { data: datos, errors: errores };
}

function normalizarActivoCuerpo(cuerpo) {
  const errores = [];
  const estado = textField(cuerpo, "estado").toUpperCase() || "ACTIVO";

  const datos = {
    sucursal_id: requiredPositiveInteger(cuerpo, "sucursal_id", errores),
    descripcion: textField(cuerpo, "descripcion"),
    fecha_adquisicion: textField(cuerpo, "fecha_adquisicion"),
    valor_adquisicion: roundMoney(requiredNonNegativeNumber(cuerpo, "valor_adquisicion", errores)),
    estado
  };

  if (!datos.descripcion) errores.push("descripcion es obligatoria.");
  if (!datos.fecha_adquisicion) errores.push("fecha_adquisicion es obligatoria.");
  if (!estadosActivo.includes(datos.estado)) {
    errores.push(`estado debe ser uno de: ${estadosActivo.join(", ")}.`);
  }

  return { data: datos, errors: errores };
}

function normalizarEventoActivoCuerpo(cuerpo) {
  const errores = [];
  const tipoEvento = textField(cuerpo, "tipo_evento").toUpperCase();

  const datos = {
    activo_fijo_id: requiredPositiveInteger(cuerpo, "activo_fijo_id", errores),
    usuario_id: nullablePositiveInteger(cuerpo, "usuario_id", errores),
    tipo_evento: tipoEvento,
    valor: roundMoney(requiredNonNegativeNumber(cuerpo, "valor", errores)),
    observacion: nullableTextField(cuerpo, "observacion")
  };

  if (!tiposEventoActivo.includes(datos.tipo_evento)) {
    errores.push(`tipo_evento debe ser uno de: ${tiposEventoActivo.join(", ")}.`);
  }

  return { data: datos, errors: errores };
}

function normalizarUsuarioCuerpo(cuerpo, requiereClave = true) {
  const errores = [];
  const estado = textField(cuerpo, "estado").toUpperCase() || "ACTIVO";
  const roles = Array.isArray(cuerpo?.roles) ? cuerpo.roles : [];

  const datos = {
    nombre_usuario: textField(cuerpo, "nombre_usuario"),
    password_hash: textField(cuerpo, "password_hash"),
    empleado_id: nullablePositiveInteger(cuerpo, "empleado_id", errores),
    estado,
    roles: roles.map((rol) => Number(rol)).filter((rol) => Number.isInteger(rol) && rol > 0)
  };

  if (!datos.nombre_usuario) errores.push("nombre_usuario es obligatorio.");
  if (requiereClave && !datos.password_hash) errores.push("password_hash es obligatorio.");
  if (!estadosUsuario.includes(datos.estado)) {
    errores.push(`estado debe ser uno de: ${estadosUsuario.join(", ")}.`);
  }

  return { data: datos, errors: errores };
}

function normalizarRolCuerpo(cuerpo) {
  const errores = [];
  const datos = {
    nombre_rol: textField(cuerpo, "nombre_rol").toUpperCase(),
    descripcion: nullableTextField(cuerpo, "descripcion")
  };

  if (!datos.nombre_rol) errores.push("nombre_rol es obligatorio.");

  return { data: datos, errors: errores };
}

function formatEntityCode(prefix, id) {
  return `${prefix}-${String(id || 0).padStart(3, "0")}`;
}

async function registrarAuditoria(env, datos) {
  try {
    await env.DB.prepare(
      `INSERT INTO auditoria (sucursal_id, usuario_id, accion, entidad, entidad_id, detalle)
      VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        datos.sucursal_id || null,
        datos.usuario_id || null,
        datos.accion,
        datos.entidad,
        datos.entidad_id || null,
        typeof datos.detalle === "string" ? datos.detalle : JSON.stringify(datos.detalle || {})
      )
      .run();
  } catch (error) {
    // ponytail: la auditoria no debe bloquear la operacion principal; revisar alertas si se vuelve critico.
  }
}

async function totalMovimientoInventarioAutomatico(env, referencia, sucursalId, loteId, tipoMovimiento) {
  const fila = await env.DB.prepare(
    `SELECT COALESCE(SUM(cantidad), 0) AS total
    FROM movimiento_inventario
    WHERE referencia = ? AND sucursal_id = ? AND lote_id = ? AND tipo_movimiento = ?`
  )
    .bind(referencia, sucursalId, loteId, tipoMovimiento)
    .first();

  return Math.abs(Number(fila?.total || 0));
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

async function eliminarMovimientosInventarioAutomaticos(env, referencia) {
  const resultado = await env.DB.prepare(
    `SELECT id_movimiento_inv, sucursal_id, lote_id, cantidad
    FROM movimiento_inventario
    WHERE referencia = ?`
  )
    .bind(referencia)
    .all();

  for (const movimiento of resultado.results || []) {
    await applyInventoryDelta(env, movimiento.sucursal_id, movimiento.lote_id, -Number(movimiento.cantidad));
    await env.DB.prepare("DELETE FROM movimiento_inventario WHERE id_movimiento_inv = ?")
      .bind(movimiento.id_movimiento_inv)
      .run();
  }
}

async function insertarMovimientoInventarioAutomatico(env, datos) {
  await applyInventoryDelta(env, datos.sucursal_id, datos.lote_id, datos.cantidad);
  await env.DB.prepare(
    `INSERT INTO movimiento_inventario (
      sucursal_id, lote_id, usuario_id, transferencia_id, item_transferencia_id,
      tipo_movimiento, cantidad, referencia, observacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      datos.sucursal_id,
      datos.lote_id,
      datos.usuario_id || null,
      datos.transferencia_id || null,
      datos.item_transferencia_id || null,
      datos.tipo_movimiento,
      datos.cantidad,
      datos.referencia,
      datos.observacion
    )
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
    await registrarAuditoria(env, {
      sucursal_id: movimiento.sucursal_id,
      usuario_id: movimiento.usuario_id,
      accion: "CREAR",
      entidad: "MOVIMIENTO_INVENTARIO",
      entidad_id: movimiento.id_movimiento_inv,
      detalle: movimiento
    });

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
    await registrarAuditoria(env, {
      sucursal_id: movimiento.sucursal_id,
      usuario_id: movimiento.usuario_id,
      accion: "ACTUALIZAR",
      entidad: "MOVIMIENTO_INVENTARIO",
      entidad_id: movimiento.id_movimiento_inv,
      detalle: movimiento
    });

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
    await registrarAuditoria(env, {
      sucursal_id: existing.sucursal_id,
      usuario_id: existing.usuario_id,
      accion: "ELIMINAR",
      entidad: "MOVIMIENTO_INVENTARIO",
      entidad_id: idMovimiento,
      detalle: existing
    });

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

async function validateTransferStock(env, transferencia, referencia = "") {
  const shortages = [];

  for (const item of transferencia.items) {
    const inventory = await findInventoryBySucursalAndLote(
      env,
      transferencia.sucursal_origen_id,
      item.lote_id
    );
    const reservadoAutomatico = referencia
      ? await totalMovimientoInventarioAutomatico(
          env,
          referencia,
          transferencia.sucursal_origen_id,
          item.lote_id,
          "TRANSFERENCIA_SALIDA"
        )
      : 0;
    const available = Number(inventory?.stock_disponible || 0) + reservadoAutomatico;

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

async function registrarMovimientosTransferencia(env, transferencia) {
  const referencia = formatEntityCode("TRA", transferencia.id_transferencia);
  await eliminarMovimientosInventarioAutomaticos(env, referencia);

  if (!["ENVIADA", "RECIBIDA"].includes(transferencia.estado)) return;

  for (const item of transferencia.items || []) {
    await insertarMovimientoInventarioAutomatico(env, {
      sucursal_id: transferencia.sucursal_origen_id,
      lote_id: item.lote_id,
      usuario_id: transferencia.usuario_creador_id,
      transferencia_id: transferencia.id_transferencia,
      item_transferencia_id: item.id_item_transferencia,
      tipo_movimiento: "TRANSFERENCIA_SALIDA",
      cantidad: -Math.abs(Number(item.cantidad_enviada)),
      referencia,
      observacion: `Salida automatica por transferencia ${referencia}`
    });

    if (transferencia.estado === "RECIBIDA" && Number(item.cantidad_recibida) > 0) {
      await insertarMovimientoInventarioAutomatico(env, {
        sucursal_id: transferencia.sucursal_destino_id,
        lote_id: item.lote_id,
        usuario_id: transferencia.usuario_creador_id,
        transferencia_id: transferencia.id_transferencia,
        item_transferencia_id: item.id_item_transferencia,
        tipo_movimiento: "TRANSFERENCIA_ENTRADA",
        cantidad: Math.abs(Number(item.cantidad_recibida)),
        referencia,
        observacion: `Entrada automatica por transferencia ${referencia}`
      });
    }
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
    await registrarMovimientosTransferencia(env, transferencia);
    await registrarAuditoria(env, {
      sucursal_id: transferencia.sucursal_origen_id,
      usuario_id: transferencia.usuario_creador_id,
      accion: "CREAR",
      entidad: "TRANSFERENCIA",
      entidad_id: idTransferencia,
      detalle: transferencia
    });

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

  const referencia = formatEntityCode("TRA", idTransferencia);
  const stockErrors = await validateTransferStock(env, data, referencia);
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
    await eliminarMovimientosInventarioAutomaticos(env, referencia);
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
    await registrarMovimientosTransferencia(env, transferencia);
    await registrarAuditoria(env, {
      sucursal_id: transferencia.sucursal_origen_id,
      usuario_id: transferencia.usuario_creador_id,
      accion: "ACTUALIZAR",
      entidad: "TRANSFERENCIA",
      entidad_id: idTransferencia,
      detalle: transferencia
    });

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
    const referencia = formatEntityCode("TRA", idTransferencia);
    const relatedMovement = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM movimiento_inventario WHERE transferencia_id = ? AND referencia <> ?"
    )
      .bind(idTransferencia, referencia)
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

    await eliminarMovimientosInventarioAutomaticos(env, referencia);
    await env.DB.prepare("DELETE FROM item_transferencia WHERE transferencia_id = ?")
      .bind(idTransferencia)
      .run();
    await env.DB.prepare("DELETE FROM transferencia WHERE id_transferencia = ?")
      .bind(idTransferencia)
      .run();
    await registrarAuditoria(env, {
      sucursal_id: existing.sucursal_origen_id,
      usuario_id: existing.usuario_creador_id,
      accion: "ELIMINAR",
      entidad: "TRANSFERENCIA",
      entidad_id: idTransferencia,
      detalle: existing
    });

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

async function validatePedidoItems(env, pedido, referencia = "") {
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
    const vendidoAutomatico = referencia
      ? await totalMovimientoInventarioAutomatico(env, referencia, pedido.sucursal_id, item.lote_id, "VENTA")
      : 0;
    const available = Number(inventory?.stock_disponible || 0) + vendidoAutomatico;

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

async function registrarMovimientosPedido(env, pedido) {
  const referencia = formatEntityCode("PED", pedido.id_pedido);
  await eliminarMovimientosInventarioAutomaticos(env, referencia);

  if (!estadosPedidoConVenta.includes(pedido.estado)) return;

  for (const item of pedido.items || []) {
    if (!item.lote_id) continue;

    await insertarMovimientoInventarioAutomatico(env, {
      sucursal_id: pedido.sucursal_id,
      lote_id: item.lote_id,
      tipo_movimiento: "VENTA",
      cantidad: -Math.abs(Number(item.cantidad)),
      referencia,
      observacion: `Venta automatica por pedido ${referencia}`
    });
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
    await registrarMovimientosPedido(env, pedido);
    await registrarAuditoria(env, {
      sucursal_id: pedido.sucursal_id,
      accion: "CREAR",
      entidad: "PEDIDO",
      entidad_id: idPedido,
      detalle: pedido
    });

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

  const itemErrors = await validatePedidoItems(env, data, formatEntityCode("PED", idPedido));
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
    await eliminarMovimientosInventarioAutomaticos(env, formatEntityCode("PED", idPedido));
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
    await registrarMovimientosPedido(env, pedido);
    await registrarAuditoria(env, {
      sucursal_id: pedido.sucursal_id,
      accion: "ACTUALIZAR",
      entidad: "PEDIDO",
      entidad_id: idPedido,
      detalle: pedido
    });

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
    await eliminarMovimientosInventarioAutomaticos(env, formatEntityCode("PED", idPedido));
    await env.DB.prepare("DELETE FROM pedido WHERE id_pedido = ?").bind(idPedido).run();
    await registrarAuditoria(env, {
      sucursal_id: existing.sucursal_id,
      accion: "ELIMINAR",
      entidad: "PEDIDO",
      entidad_id: idPedido,
      detalle: existing
    });

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

async function validarPedidoSucursal(env, idPedido, idSucursal, nombreEntidad) {
  const pedido = await findPedidoHeaderById(env, idPedido);

  if (!pedido) {
    return `${nombreEntidad} debe estar asociado a un pedido existente.`;
  }

  if (Number(pedido.sucursal_id) !== Number(idSucursal)) {
    return `${nombreEntidad} debe usar la misma sucursal del pedido.`;
  }

  return "";
}

async function eliminarMovimientosCajaAutomaticos(env, referencia) {
  await env.DB.prepare("DELETE FROM movimiento_caja WHERE referencia = ?").bind(referencia).run();
}

async function registrarMovimientoCajaAutomatico(env, datos) {
  await eliminarMovimientosCajaAutomaticos(env, datos.referencia);
  await env.DB.prepare(
    `INSERT INTO movimiento_caja (
      sucursal_id, usuario_id, pedido_id, pago_id, planilla_id, entrega_id,
      tipo, concepto, monto, metodo_pago, referencia, observacion
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      datos.sucursal_id,
      datos.usuario_id || null,
      datos.pedido_id || null,
      datos.pago_id || null,
      datos.planilla_id || null,
      datos.entrega_id || null,
      datos.tipo,
      datos.concepto,
      datos.monto,
      datos.metodo_pago || null,
      datos.referencia,
      datos.observacion
    )
    .run();
}

async function sincronizarMovimientoCajaPago(env, pago) {
  const referencia = formatEntityCode("PAG", pago.id_pago);

  if (!["CONFIRMADO", "REEMBOLSADO"].includes(pago.estado)) {
    await eliminarMovimientosCajaAutomaticos(env, referencia);
    return;
  }

  await registrarMovimientoCajaAutomatico(env, {
    sucursal_id: pago.sucursal_id,
    usuario_id: pago.usuario_id,
    pedido_id: pago.pedido_id,
    pago_id: pago.id_pago,
    tipo: pago.estado === "REEMBOLSADO" ? "EGRESO" : "INGRESO",
    concepto: pago.estado === "REEMBOLSADO" ? "REEMBOLSO" : "VENTA",
    monto: pago.monto,
    metodo_pago: pago.metodo_pago,
    referencia,
    observacion: `Movimiento automatico por pago ${referencia}`
  });
}

async function sincronizarMovimientoCajaPlanilla(env, planilla) {
  const referencia = formatEntityCode("PLA", planilla.id_planilla);

  if (planilla.estado !== "PAGADA") {
    await eliminarMovimientosCajaAutomaticos(env, referencia);
    return;
  }

  await registrarMovimientoCajaAutomatico(env, {
    sucursal_id: planilla.sucursal_id,
    planilla_id: planilla.id_planilla,
    tipo: "EGRESO",
    concepto: "PLANILLA",
    monto: planilla.total,
    referencia,
    observacion: `Movimiento automatico por planilla ${referencia}`
  });
}

async function listarPagos(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT
        pg.id_pago,
        pg.pedido_id,
        p.total AS pedido_total,
        p.estado AS pedido_estado,
        pg.sucursal_id,
        s.nombre AS sucursal_nombre,
        p.cliente_id,
        c.nombre AS cliente_nombre,
        pg.usuario_id,
        u.nombre_usuario,
        pg.fecha_hora,
        pg.monto,
        pg.metodo_pago,
        pg.referencia,
        pg.estado
      FROM pago pg
      JOIN pedido p ON p.id_pedido = pg.pedido_id
      JOIN sucursal s ON s.id_sucursal = pg.sucursal_id
      LEFT JOIN cliente c ON c.id_cliente = p.cliente_id
      LEFT JOIN usuario u ON u.id_usuario = pg.usuario_id
      ORDER BY pg.fecha_hora DESC, pg.id_pago DESC`
    ).all();

    return json({
      ok: true,
      data: resultado.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer pagos.",
        data: []
      },
      500
    );
  }
}

async function buscarPagoPorId(env, idPago) {
  return env.DB.prepare(
    `SELECT
      pg.id_pago,
      pg.pedido_id,
      p.total AS pedido_total,
      p.estado AS pedido_estado,
      pg.sucursal_id,
      s.nombre AS sucursal_nombre,
      p.cliente_id,
      c.nombre AS cliente_nombre,
      pg.usuario_id,
      u.nombre_usuario,
      pg.fecha_hora,
      pg.monto,
      pg.metodo_pago,
      pg.referencia,
      pg.estado
    FROM pago pg
    JOIN pedido p ON p.id_pedido = pg.pedido_id
    JOIN sucursal s ON s.id_sucursal = pg.sucursal_id
    LEFT JOIN cliente c ON c.id_cliente = p.cliente_id
    LEFT JOIN usuario u ON u.id_usuario = pg.usuario_id
    WHERE pg.id_pago = ?`
  )
    .bind(idPago)
    .first();
}

async function consultarPago(env, idPago) {
  try {
    const pago = await buscarPagoPorId(env, idPago);

    if (!pago) {
      return json(
        {
          ok: false,
          message: "Pago no encontrado."
        },
        404
      );
    }

    return json({
      ok: true,
      data: pago
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar el pago."
      },
      500
    );
  }
}

async function crearPago(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarPagoCuerpo(cuerpo);

  if (errores.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del pago.",
        errors: errores
      },
      400
    );
  }

  const errorPedido = await validarPedidoSucursal(env, datos.pedido_id, datos.sucursal_id, "El pago");
  if (errorPedido) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del pago.",
        errors: [errorPedido]
      },
      400
    );
  }

  try {
    const resultado = await env.DB.prepare(
      `INSERT INTO pago (
        pedido_id,
        sucursal_id,
        usuario_id,
        monto,
        metodo_pago,
        referencia,
        estado
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        datos.pedido_id,
        datos.sucursal_id,
        datos.usuario_id,
        datos.monto,
        datos.metodo_pago,
        datos.referencia,
        datos.estado
      )
      .run();

    const pago = await buscarPagoPorId(env, resultado.meta.last_row_id);
    await sincronizarMovimientoCajaPago(env, pago);
    await registrarAuditoria(env, {
      sucursal_id: pago.sucursal_id,
      usuario_id: pago.usuario_id,
      accion: "CREAR",
      entidad: "PAGO",
      entidad_id: pago.id_pago,
      detalle: pago
    });

    return json(
      {
        ok: true,
        data: pago
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear el pago."
      },
      500
    );
  }
}

async function actualizarPago(request, env, idPago) {
  const pagoExistente = await buscarPagoPorId(env, idPago);

  if (!pagoExistente) {
    return json(
      {
        ok: false,
        message: "Pago no encontrado."
      },
      404
    );
  }

  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarPagoCuerpo(cuerpo);

  if (errores.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del pago.",
        errors: errores
      },
      400
    );
  }

  const errorPedido = await validarPedidoSucursal(env, datos.pedido_id, datos.sucursal_id, "El pago");
  if (errorPedido) {
    return json(
      {
        ok: false,
        message: "Corrige los datos del pago.",
        errors: [errorPedido]
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE pago
      SET
        pedido_id = ?,
        sucursal_id = ?,
        usuario_id = ?,
        monto = ?,
        metodo_pago = ?,
        referencia = ?,
        estado = ?
      WHERE id_pago = ?`
    )
      .bind(
        datos.pedido_id,
        datos.sucursal_id,
        datos.usuario_id,
        datos.monto,
        datos.metodo_pago,
        datos.referencia,
        datos.estado,
        idPago
      )
      .run();

    const pago = await buscarPagoPorId(env, idPago);
    await sincronizarMovimientoCajaPago(env, pago);
    await registrarAuditoria(env, {
      sucursal_id: pago.sucursal_id,
      usuario_id: pago.usuario_id,
      accion: "ACTUALIZAR",
      entidad: "PAGO",
      entidad_id: pago.id_pago,
      detalle: pago
    });

    return json({
      ok: true,
      data: pago
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar el pago."
      },
      500
    );
  }
}

async function eliminarPago(env, idPago) {
  const pagoExistente = await buscarPagoPorId(env, idPago);

  if (!pagoExistente) {
    return json(
      {
        ok: false,
        message: "Pago no encontrado."
      },
      404
    );
  }

  try {
    const referencia = formatEntityCode("PAG", idPago);
    const relacionados = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM movimiento_caja WHERE pago_id = ? AND referencia <> ?"
    )
      .bind(idPago, referencia)
      .first();

    if (Number(relacionados?.total || 0) > 0) {
      return json(
        {
          ok: false,
          message: "No fue posible eliminar el pago. Tiene movimientos de caja asociados."
        },
        409
      );
    }

    await eliminarMovimientosCajaAutomaticos(env, referencia);
    await env.DB.prepare("DELETE FROM pago WHERE id_pago = ?").bind(idPago).run();
    await registrarAuditoria(env, {
      sucursal_id: pagoExistente.sucursal_id,
      usuario_id: pagoExistente.usuario_id,
      accion: "ELIMINAR",
      entidad: "PAGO",
      entidad_id: idPago,
      detalle: pagoExistente
    });

    return json({
      ok: true,
      data: {
        id_pago: idPago
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar el pago."
      },
      409
    );
  }
}

async function listarEntregas(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT
        e.id_entrega,
        e.pedido_id,
        p.estado AS pedido_estado,
        p.total AS pedido_total,
        e.sucursal_id,
        s.nombre AS sucursal_nombre,
        p.cliente_id,
        c.nombre AS cliente_nombre,
        c.telefono AS cliente_telefono,
        e.fecha_programada,
        e.fecha_entrega,
        e.direccion_entrega,
        e.referencia_direccion,
        e.estado,
        e.observacion,
        e.created_at,
        e.updated_at,
        CASE
          WHEN e.estado IN ('PENDIENTE', 'EN_RUTA')
            AND e.fecha_programada IS NOT NULL
            AND date(e.fecha_programada) < date('now')
          THEN 1
          ELSE 0
        END AS retrasada
      FROM entrega e
      JOIN pedido p ON p.id_pedido = e.pedido_id
      JOIN sucursal s ON s.id_sucursal = e.sucursal_id
      LEFT JOIN cliente c ON c.id_cliente = p.cliente_id
      ORDER BY e.fecha_programada ASC, e.id_entrega DESC`
    ).all();

    return json({
      ok: true,
      data: resultado.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer entregas.",
        data: []
      },
      500
    );
  }
}

async function listarEntregasPendientes(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT
        e.id_entrega,
        e.pedido_id,
        p.estado AS pedido_estado,
        p.total AS pedido_total,
        e.sucursal_id,
        s.nombre AS sucursal_nombre,
        p.cliente_id,
        c.nombre AS cliente_nombre,
        c.telefono AS cliente_telefono,
        e.fecha_programada,
        e.fecha_entrega,
        e.direccion_entrega,
        e.referencia_direccion,
        e.estado,
        e.observacion,
        CASE
          WHEN e.estado IN ('PENDIENTE', 'EN_RUTA')
            AND e.fecha_programada IS NOT NULL
            AND date(e.fecha_programada) < date('now')
          THEN 1
          ELSE 0
        END AS retrasada
      FROM entrega e
      JOIN pedido p ON p.id_pedido = e.pedido_id
      JOIN sucursal s ON s.id_sucursal = e.sucursal_id
      LEFT JOIN cliente c ON c.id_cliente = p.cliente_id
      WHERE e.estado IN ('PENDIENTE', 'EN_RUTA')
      ORDER BY retrasada DESC, e.fecha_programada ASC, e.id_entrega DESC`
    ).all();

    return json({
      ok: true,
      data: resultado.results || []
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible leer entregas pendientes.",
        data: []
      },
      500
    );
  }
}

async function buscarEntregaPorId(env, idEntrega) {
  return env.DB.prepare(
    `SELECT
      e.id_entrega,
      e.pedido_id,
      p.estado AS pedido_estado,
      p.total AS pedido_total,
      e.sucursal_id,
      s.nombre AS sucursal_nombre,
      p.cliente_id,
      c.nombre AS cliente_nombre,
      c.telefono AS cliente_telefono,
      e.fecha_programada,
      e.fecha_entrega,
      e.direccion_entrega,
      e.referencia_direccion,
      e.estado,
      e.observacion,
      e.created_at,
      e.updated_at,
      CASE
        WHEN e.estado IN ('PENDIENTE', 'EN_RUTA')
          AND e.fecha_programada IS NOT NULL
          AND date(e.fecha_programada) < date('now')
        THEN 1
        ELSE 0
      END AS retrasada
    FROM entrega e
    JOIN pedido p ON p.id_pedido = e.pedido_id
    JOIN sucursal s ON s.id_sucursal = e.sucursal_id
    LEFT JOIN cliente c ON c.id_cliente = p.cliente_id
    WHERE e.id_entrega = ?`
  )
    .bind(idEntrega)
    .first();
}

async function consultarEntrega(env, idEntrega) {
  try {
    const entrega = await buscarEntregaPorId(env, idEntrega);

    if (!entrega) {
      return json(
        {
          ok: false,
          message: "Entrega no encontrada."
        },
        404
      );
    }

    return json({
      ok: true,
      data: entrega
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible consultar la entrega."
      },
      500
    );
  }
}

async function crearEntrega(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarEntregaCuerpo(cuerpo);

  if (errores.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos de la entrega.",
        errors: errores
      },
      400
    );
  }

  const errorPedido = await validarPedidoSucursal(env, datos.pedido_id, datos.sucursal_id, "La entrega");
  if (errorPedido) {
    return json(
      {
        ok: false,
        message: "Corrige los datos de la entrega.",
        errors: [errorPedido]
      },
      400
    );
  }

  try {
    const resultado = await env.DB.prepare(
      `INSERT INTO entrega (
        pedido_id,
        sucursal_id,
        fecha_programada,
        fecha_entrega,
        direccion_entrega,
        referencia_direccion,
        estado,
        observacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        datos.pedido_id,
        datos.sucursal_id,
        datos.fecha_programada,
        datos.fecha_entrega,
        datos.direccion_entrega,
        datos.referencia_direccion,
        datos.estado,
        datos.observacion
      )
      .run();

    const entrega = await buscarEntregaPorId(env, resultado.meta.last_row_id);
    await registrarAuditoria(env, {
      sucursal_id: entrega.sucursal_id,
      accion: "CREAR",
      entidad: "ENTREGA",
      entidad_id: entrega.id_entrega,
      detalle: entrega
    });

    return json(
      {
        ok: true,
        data: entrega
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible crear la entrega. Revisa que el pedido no tenga una entrega existente."
      },
      500
    );
  }
}

async function actualizarEntrega(request, env, idEntrega) {
  const entregaExistente = await buscarEntregaPorId(env, idEntrega);

  if (!entregaExistente) {
    return json(
      {
        ok: false,
        message: "Entrega no encontrada."
      },
      404
    );
  }

  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarEntregaCuerpo(cuerpo);

  if (errores.length > 0) {
    return json(
      {
        ok: false,
        message: "Corrige los datos de la entrega.",
        errors: errores
      },
      400
    );
  }

  const errorPedido = await validarPedidoSucursal(env, datos.pedido_id, datos.sucursal_id, "La entrega");
  if (errorPedido) {
    return json(
      {
        ok: false,
        message: "Corrige los datos de la entrega.",
        errors: [errorPedido]
      },
      400
    );
  }

  try {
    await env.DB.prepare(
      `UPDATE entrega
      SET
        pedido_id = ?,
        sucursal_id = ?,
        fecha_programada = ?,
        fecha_entrega = ?,
        direccion_entrega = ?,
        referencia_direccion = ?,
        estado = ?,
        observacion = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id_entrega = ?`
    )
      .bind(
        datos.pedido_id,
        datos.sucursal_id,
        datos.fecha_programada,
        datos.fecha_entrega,
        datos.direccion_entrega,
        datos.referencia_direccion,
        datos.estado,
        datos.observacion,
        idEntrega
      )
      .run();

    const entrega = await buscarEntregaPorId(env, idEntrega);
    await registrarAuditoria(env, {
      sucursal_id: entrega.sucursal_id,
      accion: "ACTUALIZAR",
      entidad: "ENTREGA",
      entidad_id: entrega.id_entrega,
      detalle: entrega
    });

    return json({
      ok: true,
      data: entrega
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible actualizar la entrega. Revisa que el pedido no tenga otra entrega."
      },
      500
    );
  }
}

async function eliminarEntrega(env, idEntrega) {
  const entregaExistente = await buscarEntregaPorId(env, idEntrega);

  if (!entregaExistente) {
    return json(
      {
        ok: false,
        message: "Entrega no encontrada."
      },
      404
    );
  }

  try {
    const relacionados = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM movimiento_caja WHERE entrega_id = ?"
    )
      .bind(idEntrega)
      .first();

    if (Number(relacionados?.total || 0) > 0) {
      return json(
        {
          ok: false,
          message: "No fue posible eliminar la entrega. Tiene movimientos de caja asociados."
        },
        409
      );
    }

    await env.DB.prepare("DELETE FROM entrega WHERE id_entrega = ?").bind(idEntrega).run();
    await registrarAuditoria(env, {
      sucursal_id: entregaExistente.sucursal_id,
      accion: "ELIMINAR",
      entidad: "ENTREGA",
      entidad_id: idEntrega,
      detalle: entregaExistente
    });

    return json({
      ok: true,
      data: {
        id_entrega: idEntrega
      }
    });
  } catch (error) {
    return json(
      {
        ok: false,
        message: "No fue posible eliminar la entrega."
      },
      409
    );
  }
}

async function listarMovimientosCaja(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT
        mc.id_movimiento_caja,
        mc.sucursal_id,
        s.nombre AS sucursal_nombre,
        mc.usuario_id,
        u.nombre_usuario,
        mc.pedido_id,
        mc.pago_id,
        mc.planilla_id,
        mc.entrega_id,
        mc.fecha_hora,
        mc.tipo,
        mc.concepto,
        mc.monto,
        mc.metodo_pago,
        mc.referencia,
        mc.observacion
      FROM movimiento_caja mc
      JOIN sucursal s ON s.id_sucursal = mc.sucursal_id
      LEFT JOIN usuario u ON u.id_usuario = mc.usuario_id
      ORDER BY mc.fecha_hora DESC, mc.id_movimiento_caja DESC`
    ).all();

    return json({ ok: true, data: resultado.results || [] });
  } catch (error) {
    return json({ ok: false, message: "No fue posible leer movimientos de caja.", data: [] }, 500);
  }
}

async function buscarMovimientoCajaPorId(env, idMovimientoCaja) {
  return env.DB.prepare(
    `SELECT
      mc.id_movimiento_caja,
      mc.sucursal_id,
      s.nombre AS sucursal_nombre,
      mc.usuario_id,
      u.nombre_usuario,
      mc.pedido_id,
      mc.pago_id,
      mc.planilla_id,
      mc.entrega_id,
      mc.fecha_hora,
      mc.tipo,
      mc.concepto,
      mc.monto,
      mc.metodo_pago,
      mc.referencia,
      mc.observacion
    FROM movimiento_caja mc
    JOIN sucursal s ON s.id_sucursal = mc.sucursal_id
    LEFT JOIN usuario u ON u.id_usuario = mc.usuario_id
    WHERE mc.id_movimiento_caja = ?`
  )
    .bind(idMovimientoCaja)
    .first();
}

async function consultarMovimientoCaja(env, idMovimientoCaja) {
  try {
    const movimiento = await buscarMovimientoCajaPorId(env, idMovimientoCaja);
    if (!movimiento) return json({ ok: false, message: "Movimiento de caja no encontrado." }, 404);
    return json({ ok: true, data: movimiento });
  } catch (error) {
    return json({ ok: false, message: "No fue posible consultar el movimiento de caja." }, 500);
  }
}

async function crearMovimientoCaja(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarMovimientoCajaCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del movimiento de caja.", errors: errores }, 400);
  }

  try {
    const resultado = await env.DB.prepare(
      `INSERT INTO movimiento_caja (
        sucursal_id, usuario_id, pedido_id, pago_id, planilla_id, entrega_id,
        tipo, concepto, monto, metodo_pago, referencia, observacion
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        datos.sucursal_id,
        datos.usuario_id,
        datos.pedido_id,
        datos.pago_id,
        datos.planilla_id,
        datos.entrega_id,
        datos.tipo,
        datos.concepto,
        datos.monto,
        datos.metodo_pago,
        datos.referencia,
        datos.observacion
      )
      .run();

    const movimiento = await buscarMovimientoCajaPorId(env, resultado.meta.last_row_id);
    await registrarAuditoria(env, {
      sucursal_id: movimiento.sucursal_id,
      usuario_id: movimiento.usuario_id,
      accion: "CREAR",
      entidad: "MOVIMIENTO_CAJA",
      entidad_id: movimiento.id_movimiento_caja,
      detalle: movimiento
    });
    return json({ ok: true, data: movimiento }, 201);
  } catch (error) {
    return json({ ok: false, message: "No fue posible crear el movimiento de caja." }, 500);
  }
}

async function actualizarMovimientoCaja(request, env, idMovimientoCaja) {
  const movimientoExistente = await buscarMovimientoCajaPorId(env, idMovimientoCaja);
  if (!movimientoExistente) return json({ ok: false, message: "Movimiento de caja no encontrado." }, 404);

  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarMovimientoCajaCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del movimiento de caja.", errors: errores }, 400);
  }

  try {
    await env.DB.prepare(
      `UPDATE movimiento_caja
      SET sucursal_id = ?, usuario_id = ?, pedido_id = ?, pago_id = ?, planilla_id = ?,
        entrega_id = ?, tipo = ?, concepto = ?, monto = ?, metodo_pago = ?, referencia = ?, observacion = ?
      WHERE id_movimiento_caja = ?`
    )
      .bind(
        datos.sucursal_id,
        datos.usuario_id,
        datos.pedido_id,
        datos.pago_id,
        datos.planilla_id,
        datos.entrega_id,
        datos.tipo,
        datos.concepto,
        datos.monto,
        datos.metodo_pago,
        datos.referencia,
        datos.observacion,
        idMovimientoCaja
      )
      .run();

    const movimiento = await buscarMovimientoCajaPorId(env, idMovimientoCaja);
    await registrarAuditoria(env, {
      sucursal_id: movimiento.sucursal_id,
      usuario_id: movimiento.usuario_id,
      accion: "ACTUALIZAR",
      entidad: "MOVIMIENTO_CAJA",
      entidad_id: movimiento.id_movimiento_caja,
      detalle: movimiento
    });
    return json({ ok: true, data: movimiento });
  } catch (error) {
    return json({ ok: false, message: "No fue posible actualizar el movimiento de caja." }, 500);
  }
}

async function eliminarMovimientoCaja(env, idMovimientoCaja) {
  const movimientoExistente = await buscarMovimientoCajaPorId(env, idMovimientoCaja);
  if (!movimientoExistente) return json({ ok: false, message: "Movimiento de caja no encontrado." }, 404);

  try {
    await env.DB.prepare("DELETE FROM movimiento_caja WHERE id_movimiento_caja = ?").bind(idMovimientoCaja).run();
    await registrarAuditoria(env, {
      sucursal_id: movimientoExistente.sucursal_id,
      usuario_id: movimientoExistente.usuario_id,
      accion: "ELIMINAR",
      entidad: "MOVIMIENTO_CAJA",
      entidad_id: idMovimientoCaja,
      detalle: movimientoExistente
    });
    return json({ ok: true, data: { id_movimiento_caja: idMovimientoCaja } });
  } catch (error) {
    return json({ ok: false, message: "No fue posible eliminar el movimiento de caja." }, 409);
  }
}

async function consultarFlujoCaja(request, env) {
  const url = new URL(request.url);
  const idSucursal = url.searchParams.get("sucursal_id");
  const fechaInicio = url.searchParams.get("fecha_inicio");
  const fechaFin = url.searchParams.get("fecha_fin");
  const condiciones = [];
  const parametros = [];

  if (idSucursal) {
    condiciones.push("id_sucursal = ?");
    parametros.push(Number(idSucursal));
  }
  if (fechaInicio) {
    condiciones.push("date(fecha_hora) >= date(?)");
    parametros.push(fechaInicio);
  }
  if (fechaFin) {
    condiciones.push("date(fecha_hora) <= date(?)");
    parametros.push(fechaFin);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  try {
    const movimientos = await env.DB.prepare(
      `SELECT * FROM vw_flujo_efectivo_sucursal ${where} ORDER BY fecha_hora DESC`
    )
      .bind(...parametros)
      .all();
    const filas = movimientos.results || [];
    const ingresos = roundMoney(filas.filter((fila) => fila.tipo === "INGRESO").reduce((total, fila) => total + Number(fila.monto_neto || 0), 0));
    const egresos = roundMoney(Math.abs(filas.filter((fila) => fila.tipo === "EGRESO").reduce((total, fila) => total + Number(fila.monto_neto || 0), 0)));

    return json({
      ok: true,
      data: {
        movimientos: filas,
        ingresos,
        egresos,
        neto: roundMoney(ingresos - egresos)
      }
    });
  } catch (error) {
    return json({ ok: false, message: "No fue posible consultar el flujo de caja." }, 500);
  }
}

async function listarEmpleados(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT
        e.id_empleado,
        e.sucursal_id,
        s.nombre AS sucursal_nombre,
        e.nombre,
        e.cargo,
        e.telefono,
        e.email,
        e.fecha_ingreso,
        e.estado,
        e.created_at,
        e.updated_at,
        COUNT(dp.id_detalle_planilla) AS total_planillas
      FROM empleado e
      LEFT JOIN sucursal s ON s.id_sucursal = e.sucursal_id
      LEFT JOIN detalle_planilla dp ON dp.empleado_id = e.id_empleado
      GROUP BY e.id_empleado, e.sucursal_id, s.nombre, e.nombre, e.cargo, e.telefono, e.email, e.fecha_ingreso, e.estado, e.created_at, e.updated_at
      ORDER BY e.nombre ASC`
    ).all();

    return json({ ok: true, data: resultado.results || [] });
  } catch (error) {
    return json({ ok: false, message: "No fue posible leer empleados.", data: [] }, 500);
  }
}

async function buscarEmpleadoPorId(env, idEmpleado) {
  return env.DB.prepare(
    `SELECT
      e.id_empleado,
      e.sucursal_id,
      s.nombre AS sucursal_nombre,
      e.nombre,
      e.cargo,
      e.telefono,
      e.email,
      e.fecha_ingreso,
      e.estado,
      e.created_at,
      e.updated_at,
      COUNT(dp.id_detalle_planilla) AS total_planillas
    FROM empleado e
    LEFT JOIN sucursal s ON s.id_sucursal = e.sucursal_id
    LEFT JOIN detalle_planilla dp ON dp.empleado_id = e.id_empleado
    WHERE e.id_empleado = ?
    GROUP BY e.id_empleado, e.sucursal_id, s.nombre, e.nombre, e.cargo, e.telefono, e.email, e.fecha_ingreso, e.estado, e.created_at, e.updated_at`
  )
    .bind(idEmpleado)
    .first();
}

async function consultarEmpleado(env, idEmpleado) {
  try {
    const empleado = await buscarEmpleadoPorId(env, idEmpleado);
    if (!empleado) return json({ ok: false, message: "Empleado no encontrado." }, 404);
    return json({ ok: true, data: empleado });
  } catch (error) {
    return json({ ok: false, message: "No fue posible consultar el empleado." }, 500);
  }
}

async function crearEmpleado(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarEmpleadoCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del empleado.", errors: errores }, 400);
  }

  try {
    const resultado = await env.DB.prepare(
      `INSERT INTO empleado (sucursal_id, nombre, cargo, telefono, email, fecha_ingreso, estado)
      VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(datos.sucursal_id, datos.nombre, datos.cargo, datos.telefono, datos.email, datos.fecha_ingreso, datos.estado)
      .run();

    const empleado = await buscarEmpleadoPorId(env, resultado.meta.last_row_id);
    return json({ ok: true, data: empleado }, 201);
  } catch (error) {
    return json({ ok: false, message: "No fue posible crear el empleado." }, 500);
  }
}

async function actualizarEmpleado(request, env, idEmpleado) {
  const empleadoExistente = await buscarEmpleadoPorId(env, idEmpleado);
  if (!empleadoExistente) return json({ ok: false, message: "Empleado no encontrado." }, 404);

  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarEmpleadoCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del empleado.", errors: errores }, 400);
  }

  try {
    await env.DB.prepare(
      `UPDATE empleado
      SET sucursal_id = ?, nombre = ?, cargo = ?, telefono = ?, email = ?, fecha_ingreso = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id_empleado = ?`
    )
      .bind(datos.sucursal_id, datos.nombre, datos.cargo, datos.telefono, datos.email, datos.fecha_ingreso, datos.estado, idEmpleado)
      .run();

    const empleado = await buscarEmpleadoPorId(env, idEmpleado);
    return json({ ok: true, data: empleado });
  } catch (error) {
    return json({ ok: false, message: "No fue posible actualizar el empleado." }, 500);
  }
}

async function eliminarEmpleado(env, idEmpleado) {
  const empleadoExistente = await buscarEmpleadoPorId(env, idEmpleado);
  if (!empleadoExistente) return json({ ok: false, message: "Empleado no encontrado." }, 404);

  try {
    await env.DB.prepare("DELETE FROM empleado WHERE id_empleado = ?").bind(idEmpleado).run();
    return json({ ok: true, data: { id_empleado: idEmpleado } });
  } catch (error) {
    return json({ ok: false, message: "No fue posible eliminar el empleado. Puede tener usuarios o planillas asociadas." }, 409);
  }
}

async function listarPlanillas(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT
        p.id_planilla,
        p.sucursal_id,
        s.nombre AS sucursal_nombre,
        p.periodo_inicio,
        p.periodo_fin,
        p.fecha_pago,
        p.estado,
        p.total,
        p.created_at,
        p.updated_at,
        COUNT(dp.id_detalle_planilla) AS total_detalles
      FROM planilla p
      JOIN sucursal s ON s.id_sucursal = p.sucursal_id
      LEFT JOIN detalle_planilla dp ON dp.planilla_id = p.id_planilla
      GROUP BY p.id_planilla, p.sucursal_id, s.nombre, p.periodo_inicio, p.periodo_fin, p.fecha_pago, p.estado, p.total, p.created_at, p.updated_at
      ORDER BY p.periodo_inicio DESC, p.id_planilla DESC`
    ).all();

    return json({ ok: true, data: resultado.results || [] });
  } catch (error) {
    return json({ ok: false, message: "No fue posible leer planillas.", data: [] }, 500);
  }
}

async function buscarPlanillaPorId(env, idPlanilla) {
  const planilla = await env.DB.prepare(
    `SELECT
      p.id_planilla,
      p.sucursal_id,
      s.nombre AS sucursal_nombre,
      p.periodo_inicio,
      p.periodo_fin,
      p.fecha_pago,
      p.estado,
      p.total,
      p.created_at,
      p.updated_at
    FROM planilla p
    JOIN sucursal s ON s.id_sucursal = p.sucursal_id
    WHERE p.id_planilla = ?`
  )
    .bind(idPlanilla)
    .first();

  if (!planilla) return null;

  const detalles = await env.DB.prepare(
    `SELECT
      dp.id_detalle_planilla,
      dp.planilla_id,
      dp.empleado_id,
      e.nombre AS empleado_nombre,
      e.cargo AS empleado_cargo,
      dp.concepto,
      dp.monto
    FROM detalle_planilla dp
    JOIN empleado e ON e.id_empleado = dp.empleado_id
    WHERE dp.planilla_id = ?
    ORDER BY dp.id_detalle_planilla ASC`
  )
    .bind(idPlanilla)
    .all();

  return {
    ...planilla,
    detalles: detalles.results || []
  };
}

async function consultarPlanilla(env, idPlanilla) {
  try {
    const planilla = await buscarPlanillaPorId(env, idPlanilla);
    if (!planilla) return json({ ok: false, message: "Planilla no encontrada." }, 404);
    return json({ ok: true, data: planilla });
  } catch (error) {
    return json({ ok: false, message: "No fue posible consultar la planilla." }, 500);
  }
}

async function guardarDetallesPlanilla(env, idPlanilla, detalles) {
  for (const detalle of detalles) {
    await env.DB.prepare(
      "INSERT INTO detalle_planilla (planilla_id, empleado_id, concepto, monto) VALUES (?, ?, ?, ?)"
    )
      .bind(idPlanilla, detalle.empleado_id, detalle.concepto, detalle.monto)
      .run();
  }
}

async function crearPlanilla(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarPlanillaCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos de la planilla.", errors: errores }, 400);
  }

  try {
    const resultado = await env.DB.prepare(
      `INSERT INTO planilla (sucursal_id, periodo_inicio, periodo_fin, fecha_pago, estado, total)
      VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(datos.sucursal_id, datos.periodo_inicio, datos.periodo_fin, datos.fecha_pago, datos.estado, datos.total)
      .run();

    await guardarDetallesPlanilla(env, resultado.meta.last_row_id, datos.detalles);
    const planilla = await buscarPlanillaPorId(env, resultado.meta.last_row_id);
    await sincronizarMovimientoCajaPlanilla(env, planilla);
    await registrarAuditoria(env, {
      sucursal_id: planilla.sucursal_id,
      accion: "CREAR",
      entidad: "PLANILLA",
      entidad_id: planilla.id_planilla,
      detalle: planilla
    });
    return json({ ok: true, data: planilla }, 201);
  } catch (error) {
    return json({ ok: false, message: "No fue posible crear la planilla." }, 500);
  }
}

async function actualizarPlanilla(request, env, idPlanilla) {
  const planillaExistente = await buscarPlanillaPorId(env, idPlanilla);
  if (!planillaExistente) return json({ ok: false, message: "Planilla no encontrada." }, 404);

  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarPlanillaCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos de la planilla.", errors: errores }, 400);
  }

  try {
    await env.DB.prepare(
      `UPDATE planilla
      SET sucursal_id = ?, periodo_inicio = ?, periodo_fin = ?, fecha_pago = ?, estado = ?, total = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id_planilla = ?`
    )
      .bind(datos.sucursal_id, datos.periodo_inicio, datos.periodo_fin, datos.fecha_pago, datos.estado, datos.total, idPlanilla)
      .run();
    await env.DB.prepare("DELETE FROM detalle_planilla WHERE planilla_id = ?").bind(idPlanilla).run();
    await guardarDetallesPlanilla(env, idPlanilla, datos.detalles);

    const planilla = await buscarPlanillaPorId(env, idPlanilla);
    await sincronizarMovimientoCajaPlanilla(env, planilla);
    await registrarAuditoria(env, {
      sucursal_id: planilla.sucursal_id,
      accion: "ACTUALIZAR",
      entidad: "PLANILLA",
      entidad_id: planilla.id_planilla,
      detalle: planilla
    });
    return json({ ok: true, data: planilla });
  } catch (error) {
    return json({ ok: false, message: "No fue posible actualizar la planilla." }, 500);
  }
}

async function eliminarPlanilla(env, idPlanilla) {
  const planillaExistente = await buscarPlanillaPorId(env, idPlanilla);
  if (!planillaExistente) return json({ ok: false, message: "Planilla no encontrada." }, 404);

  try {
    const referencia = formatEntityCode("PLA", idPlanilla);
    const relacionados = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM movimiento_caja WHERE planilla_id = ? AND referencia <> ?"
    )
      .bind(idPlanilla, referencia)
      .first();

    if (Number(relacionados?.total || 0) > 0) {
      return json({ ok: false, message: "No fue posible eliminar la planilla. Tiene movimientos de caja asociados." }, 409);
    }

    await eliminarMovimientosCajaAutomaticos(env, referencia);
    await env.DB.prepare("DELETE FROM planilla WHERE id_planilla = ?").bind(idPlanilla).run();
    await registrarAuditoria(env, {
      sucursal_id: planillaExistente.sucursal_id,
      accion: "ELIMINAR",
      entidad: "PLANILLA",
      entidad_id: idPlanilla,
      detalle: planillaExistente
    });
    return json({ ok: true, data: { id_planilla: idPlanilla } });
  } catch (error) {
    return json({ ok: false, message: "No fue posible eliminar la planilla. Puede tener movimientos de caja asociados." }, 409);
  }
}

async function listarActivos(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT
        af.id_activo_fijo,
        af.sucursal_id,
        s.nombre AS sucursal_nombre,
        af.descripcion,
        af.codigo_interno,
        af.fecha_adquisicion,
        af.valor_adquisicion,
        af.estado,
        af.created_at,
        af.updated_at,
        COUNT(ea.id_evento_activo) AS total_eventos
      FROM activo_fijo af
      JOIN sucursal s ON s.id_sucursal = af.sucursal_id
      LEFT JOIN evento_activo ea ON ea.activo_fijo_id = af.id_activo_fijo
      GROUP BY af.id_activo_fijo, af.sucursal_id, s.nombre, af.descripcion, af.codigo_interno, af.fecha_adquisicion, af.valor_adquisicion, af.estado, af.created_at, af.updated_at
      ORDER BY af.id_activo_fijo DESC`
    ).all();

    return json({ ok: true, data: resultado.results || [] });
  } catch (error) {
    return json({ ok: false, message: "No fue posible leer activos fijos.", data: [] }, 500);
  }
}

async function buscarActivoPorId(env, idActivo) {
  const activo = await env.DB.prepare(
    `SELECT
      af.id_activo_fijo,
      af.sucursal_id,
      s.nombre AS sucursal_nombre,
      af.descripcion,
      af.codigo_interno,
      af.fecha_adquisicion,
      af.valor_adquisicion,
      af.estado,
      af.created_at,
      af.updated_at
    FROM activo_fijo af
    JOIN sucursal s ON s.id_sucursal = af.sucursal_id
    WHERE af.id_activo_fijo = ?`
  )
    .bind(idActivo)
    .first();

  if (!activo) return null;

  const eventos = await env.DB.prepare(
    `SELECT
      ea.id_evento_activo,
      ea.activo_fijo_id,
      ea.usuario_id,
      u.nombre_usuario,
      ea.tipo_evento,
      ea.fecha_evento,
      ea.valor,
      ea.observacion
    FROM evento_activo ea
    LEFT JOIN usuario u ON u.id_usuario = ea.usuario_id
    WHERE ea.activo_fijo_id = ?
    ORDER BY ea.fecha_evento DESC, ea.id_evento_activo DESC`
  )
    .bind(idActivo)
    .all();

  return {
    ...activo,
    eventos: eventos.results || []
  };
}

async function consultarActivo(env, idActivo) {
  try {
    const activo = await buscarActivoPorId(env, idActivo);
    if (!activo) return json({ ok: false, message: "Activo fijo no encontrado." }, 404);
    return json({ ok: true, data: activo });
  } catch (error) {
    return json({ ok: false, message: "No fue posible consultar el activo fijo." }, 500);
  }
}

async function crearActivo(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarActivoCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del activo fijo.", errors: errores }, 400);
  }

  try {
    const resultado = await env.DB.prepare(
      `INSERT INTO activo_fijo (sucursal_id, descripcion, codigo_interno, fecha_adquisicion, valor_adquisicion, estado)
      VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(datos.sucursal_id, datos.descripcion, "ACT-PENDIENTE", datos.fecha_adquisicion, datos.valor_adquisicion, datos.estado)
      .run();

    const idActivo = resultado.meta.last_row_id;
    const codigo = formatEntityCode("ACT", idActivo);
    await env.DB.prepare("UPDATE activo_fijo SET codigo_interno = ? WHERE id_activo_fijo = ?").bind(codigo, idActivo).run();

    const activo = await buscarActivoPorId(env, idActivo);
    await registrarAuditoria(env, {
      sucursal_id: activo.sucursal_id,
      accion: "CREAR",
      entidad: "ACTIVO_FIJO",
      entidad_id: idActivo,
      detalle: activo
    });
    return json({ ok: true, data: activo }, 201);
  } catch (error) {
    return json({ ok: false, message: "No fue posible crear el activo fijo." }, 500);
  }
}

async function actualizarActivo(request, env, idActivo) {
  const activoExistente = await buscarActivoPorId(env, idActivo);
  if (!activoExistente) return json({ ok: false, message: "Activo fijo no encontrado." }, 404);

  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarActivoCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del activo fijo.", errors: errores }, 400);
  }

  try {
    await env.DB.prepare(
      `UPDATE activo_fijo
      SET sucursal_id = ?, descripcion = ?, fecha_adquisicion = ?, valor_adquisicion = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id_activo_fijo = ?`
    )
      .bind(datos.sucursal_id, datos.descripcion, datos.fecha_adquisicion, datos.valor_adquisicion, datos.estado, idActivo)
      .run();

    const activo = await buscarActivoPorId(env, idActivo);
    await registrarAuditoria(env, {
      sucursal_id: activo.sucursal_id,
      accion: "ACTUALIZAR",
      entidad: "ACTIVO_FIJO",
      entidad_id: idActivo,
      detalle: activo
    });
    return json({ ok: true, data: activo });
  } catch (error) {
    return json({ ok: false, message: "No fue posible actualizar el activo fijo." }, 500);
  }
}

async function eliminarActivo(env, idActivo) {
  const activoExistente = await buscarActivoPorId(env, idActivo);
  if (!activoExistente) return json({ ok: false, message: "Activo fijo no encontrado." }, 404);

  try {
    await env.DB.prepare("DELETE FROM activo_fijo WHERE id_activo_fijo = ?").bind(idActivo).run();
    await registrarAuditoria(env, {
      sucursal_id: activoExistente.sucursal_id,
      accion: "ELIMINAR",
      entidad: "ACTIVO_FIJO",
      entidad_id: idActivo,
      detalle: activoExistente
    });
    return json({ ok: true, data: { id_activo_fijo: idActivo } });
  } catch (error) {
    return json({ ok: false, message: "No fue posible eliminar el activo fijo." }, 409);
  }
}

async function crearEventoActivo(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarEventoActivoCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del evento.", errors: errores }, 400);
  }

  try {
    const resultado = await env.DB.prepare(
      "INSERT INTO evento_activo (activo_fijo_id, usuario_id, tipo_evento, valor, observacion) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(datos.activo_fijo_id, datos.usuario_id, datos.tipo_evento, datos.valor, datos.observacion)
      .run();

    await registrarAuditoria(env, {
      usuario_id: datos.usuario_id,
      accion: "CREAR",
      entidad: "EVENTO_ACTIVO",
      entidad_id: resultado.meta.last_row_id,
      detalle: datos
    });
    return json({ ok: true, data: { id_evento_activo: resultado.meta.last_row_id } }, 201);
  } catch (error) {
    return json({ ok: false, message: "No fue posible crear el evento del activo." }, 500);
  }
}

async function eliminarEventoActivo(env, idEvento) {
  try {
    await env.DB.prepare("DELETE FROM evento_activo WHERE id_evento_activo = ?").bind(idEvento).run();
    await registrarAuditoria(env, {
      accion: "ELIMINAR",
      entidad: "EVENTO_ACTIVO",
      entidad_id: idEvento
    });
    return json({ ok: true, data: { id_evento_activo: idEvento } });
  } catch (error) {
    return json({ ok: false, message: "No fue posible eliminar el evento del activo." }, 409);
  }
}

async function consultarValorActivos(env) {
  try {
    const resultado = await env.DB.prepare(
      "SELECT id_sucursal, sucursal, cantidad_activos, valor_adquisicion_total FROM vw_valor_activos_sucursal ORDER BY sucursal ASC"
    ).all();
    return json({ ok: true, data: resultado.results || [] });
  } catch (error) {
    return json({ ok: false, message: "No fue posible consultar valor de activos.", data: [] }, 500);
  }
}

async function rolesDeUsuario(env, idUsuario) {
  const resultado = await env.DB.prepare(
    `SELECT r.id_rol, r.nombre_rol, r.descripcion
    FROM usuario_rol ur
    JOIN rol r ON r.id_rol = ur.rol_id
    WHERE ur.usuario_id = ?
    ORDER BY r.nombre_rol ASC`
  )
    .bind(idUsuario)
    .all();

  return resultado.results || [];
}

async function listarUsuarios(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT
        u.id_usuario,
        u.nombre_usuario,
        u.empleado_id,
        e.nombre AS empleado_nombre,
        u.estado,
        u.ultimo_acceso_at,
        u.created_at,
        u.updated_at,
        COUNT(ur.id_usuario_rol) AS total_roles
      FROM usuario u
      LEFT JOIN empleado e ON e.id_empleado = u.empleado_id
      LEFT JOIN usuario_rol ur ON ur.usuario_id = u.id_usuario
      GROUP BY u.id_usuario, u.nombre_usuario, u.empleado_id, e.nombre, u.estado, u.ultimo_acceso_at, u.created_at, u.updated_at
      ORDER BY u.nombre_usuario ASC`
    ).all();

    return json({ ok: true, data: resultado.results || [] });
  } catch (error) {
    return json({ ok: false, message: "No fue posible leer usuarios.", data: [] }, 500);
  }
}

async function buscarUsuarioPorId(env, idUsuario) {
  const usuario = await env.DB.prepare(
    `SELECT
      u.id_usuario,
      u.nombre_usuario,
      u.password_hash,
      u.empleado_id,
      e.nombre AS empleado_nombre,
      u.estado,
      u.ultimo_acceso_at,
      u.created_at,
      u.updated_at
    FROM usuario u
    LEFT JOIN empleado e ON e.id_empleado = u.empleado_id
    WHERE u.id_usuario = ?`
  )
    .bind(idUsuario)
    .first();

  if (!usuario) return null;

  return {
    ...usuario,
    roles: await rolesDeUsuario(env, idUsuario)
  };
}

async function consultarUsuario(env, idUsuario) {
  try {
    const usuario = await buscarUsuarioPorId(env, idUsuario);
    if (!usuario) return json({ ok: false, message: "Usuario no encontrado." }, 404);
    return json({ ok: true, data: usuario });
  } catch (error) {
    return json({ ok: false, message: "No fue posible consultar el usuario." }, 500);
  }
}

async function buscarUsuarioPorNombre(env, nombreUsuario) {
  const usuario = await env.DB.prepare(
    `SELECT
      u.id_usuario,
      u.nombre_usuario,
      u.password_hash,
      u.empleado_id,
      e.nombre AS empleado_nombre,
      u.estado,
      u.ultimo_acceso_at,
      u.created_at,
      u.updated_at
    FROM usuario u
    LEFT JOIN empleado e ON e.id_empleado = u.empleado_id
    WHERE lower(u.nombre_usuario) = lower(?)`
  )
    .bind(nombreUsuario)
    .first();

  if (!usuario) return null;

  return {
    ...usuario,
    roles: await rolesDeUsuario(env, usuario.id_usuario)
  };
}

async function iniciarSesion(request, env) {
  const cuerpo = await readRequestJson(request);
  const nombreUsuario = textField(cuerpo, "nombre_usuario");
  const clave = textField(cuerpo, "clave");

  if (!nombreUsuario || !clave) {
    return json({ ok: false, message: "Usuario y clave son obligatorios." }, 400);
  }

  try {
    const usuario = await buscarUsuarioPorNombre(env, nombreUsuario);

    if (!usuario || usuario.estado !== "ACTIVO" || usuario.password_hash !== clave) {
      return json({ ok: false, message: "Usuario o clave incorrectos." }, 401);
    }

    await env.DB.prepare("UPDATE usuario SET ultimo_acceso_at = CURRENT_TIMESTAMP WHERE id_usuario = ?")
      .bind(usuario.id_usuario)
      .run();

    const sesion = await buscarUsuarioPorId(env, usuario.id_usuario);
    delete sesion.password_hash;

    await registrarAuditoria(env, {
      usuario_id: sesion.id_usuario,
      accion: "LOGIN",
      entidad: "USUARIO",
      entidad_id: sesion.id_usuario,
      detalle: { nombre_usuario: sesion.nombre_usuario }
    });

    return json({ ok: true, data: sesion });
  } catch (error) {
    return json({ ok: false, message: "No fue posible iniciar sesion." }, 500);
  }
}

async function guardarRolesUsuario(env, idUsuario, roles) {
  await env.DB.prepare("DELETE FROM usuario_rol WHERE usuario_id = ?").bind(idUsuario).run();
  for (const idRol of roles) {
    await env.DB.prepare("INSERT OR IGNORE INTO usuario_rol (usuario_id, rol_id) VALUES (?, ?)").bind(idUsuario, idRol).run();
  }
}

async function crearUsuario(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarUsuarioCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del usuario.", errors: errores }, 400);
  }

  try {
    const resultado = await env.DB.prepare(
      "INSERT INTO usuario (nombre_usuario, password_hash, empleado_id, estado) VALUES (?, ?, ?, ?)"
    )
      .bind(datos.nombre_usuario, datos.password_hash, datos.empleado_id, datos.estado)
      .run();

    await guardarRolesUsuario(env, resultado.meta.last_row_id, datos.roles);
    const usuario = await buscarUsuarioPorId(env, resultado.meta.last_row_id);
    await registrarAuditoria(env, {
      usuario_id: usuario.id_usuario,
      accion: "CREAR",
      entidad: "USUARIO",
      entidad_id: usuario.id_usuario,
      detalle: { ...usuario, password_hash: undefined }
    });
    return json({ ok: true, data: usuario }, 201);
  } catch (error) {
    return json({ ok: false, message: "No fue posible crear el usuario. Revisa usuario unico y empleado asociado." }, 500);
  }
}

async function actualizarUsuario(request, env, idUsuario) {
  const usuarioExistente = await buscarUsuarioPorId(env, idUsuario);
  if (!usuarioExistente) return json({ ok: false, message: "Usuario no encontrado." }, 404);

  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarUsuarioCuerpo(cuerpo, false);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del usuario.", errors: errores }, 400);
  }

  try {
    await env.DB.prepare(
      `UPDATE usuario
      SET nombre_usuario = ?, password_hash = ?, empleado_id = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id_usuario = ?`
    )
      .bind(
        datos.nombre_usuario,
        datos.password_hash || usuarioExistente.password_hash,
        datos.empleado_id,
        datos.estado,
        idUsuario
      )
      .run();
    await guardarRolesUsuario(env, idUsuario, datos.roles);

    const usuario = await buscarUsuarioPorId(env, idUsuario);
    await registrarAuditoria(env, {
      usuario_id: idUsuario,
      accion: "ACTUALIZAR",
      entidad: "USUARIO",
      entidad_id: idUsuario,
      detalle: { ...usuario, password_hash: undefined }
    });
    return json({ ok: true, data: usuario });
  } catch (error) {
    return json({ ok: false, message: "No fue posible actualizar el usuario." }, 500);
  }
}

async function eliminarUsuario(env, idUsuario) {
  const usuarioExistente = await buscarUsuarioPorId(env, idUsuario);
  if (!usuarioExistente) return json({ ok: false, message: "Usuario no encontrado." }, 404);

  try {
    await env.DB.prepare("DELETE FROM usuario WHERE id_usuario = ?").bind(idUsuario).run();
    await registrarAuditoria(env, {
      accion: "ELIMINAR",
      entidad: "USUARIO",
      entidad_id: idUsuario,
      detalle: { ...usuarioExistente, password_hash: undefined }
    });
    return json({ ok: true, data: { id_usuario: idUsuario } });
  } catch (error) {
    return json({ ok: false, message: "No fue posible eliminar el usuario. Puede tener registros asociados." }, 409);
  }
}

async function listarRoles(env) {
  try {
    const resultado = await env.DB.prepare(
      `SELECT r.id_rol, r.nombre_rol, r.descripcion, COUNT(ur.id_usuario_rol) AS total_usuarios
      FROM rol r
      LEFT JOIN usuario_rol ur ON ur.rol_id = r.id_rol
      GROUP BY r.id_rol, r.nombre_rol, r.descripcion
      ORDER BY r.nombre_rol ASC`
    ).all();

    return json({ ok: true, data: resultado.results || [] });
  } catch (error) {
    return json({ ok: false, message: "No fue posible leer roles.", data: [] }, 500);
  }
}

async function crearRol(request, env) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarRolCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del rol.", errors: errores }, 400);
  }

  try {
    const resultado = await env.DB.prepare("INSERT INTO rol (nombre_rol, descripcion) VALUES (?, ?)")
      .bind(datos.nombre_rol, datos.descripcion)
      .run();
    await registrarAuditoria(env, {
      accion: "CREAR",
      entidad: "ROL",
      entidad_id: resultado.meta.last_row_id,
      detalle: datos
    });
    return json({ ok: true, data: { id_rol: resultado.meta.last_row_id, ...datos } }, 201);
  } catch (error) {
    return json({ ok: false, message: "No fue posible crear el rol." }, 500);
  }
}

async function actualizarRol(request, env, idRol) {
  const cuerpo = await readRequestJson(request);
  const { data: datos, errors: errores } = normalizarRolCuerpo(cuerpo);

  if (errores.length > 0) {
    return json({ ok: false, message: "Corrige los datos del rol.", errors: errores }, 400);
  }

  try {
    await env.DB.prepare("UPDATE rol SET nombre_rol = ?, descripcion = ? WHERE id_rol = ?")
      .bind(datos.nombre_rol, datos.descripcion, idRol)
      .run();
    await registrarAuditoria(env, {
      accion: "ACTUALIZAR",
      entidad: "ROL",
      entidad_id: idRol,
      detalle: datos
    });
    return json({ ok: true, data: { id_rol: idRol, ...datos } });
  } catch (error) {
    return json({ ok: false, message: "No fue posible actualizar el rol." }, 500);
  }
}

async function eliminarRol(env, idRol) {
  try {
    await env.DB.prepare("DELETE FROM rol WHERE id_rol = ?").bind(idRol).run();
    await registrarAuditoria(env, {
      accion: "ELIMINAR",
      entidad: "ROL",
      entidad_id: idRol
    });
    return json({ ok: true, data: { id_rol: idRol } });
  } catch (error) {
    return json({ ok: false, message: "No fue posible eliminar el rol. Puede tener usuarios asociados." }, 409);
  }
}

async function consultarAuditoria(request, env) {
  const url = new URL(request.url);
  const condiciones = [];
  const parametros = [];
  const usuarioId = url.searchParams.get("usuario_id");
  const entidad = url.searchParams.get("entidad");
  const fechaInicio = url.searchParams.get("fecha_inicio");
  const fechaFin = url.searchParams.get("fecha_fin");

  if (usuarioId) {
    condiciones.push("a.usuario_id = ?");
    parametros.push(Number(usuarioId));
  }
  if (entidad) {
    condiciones.push("a.entidad = ?");
    parametros.push(entidad.toUpperCase());
  }
  if (fechaInicio) {
    condiciones.push("date(a.fecha_hora) >= date(?)");
    parametros.push(fechaInicio);
  }
  if (fechaFin) {
    condiciones.push("date(a.fecha_hora) <= date(?)");
    parametros.push(fechaFin);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  try {
    const resultado = await env.DB.prepare(
      `SELECT
        a.id_auditoria,
        a.sucursal_id,
        s.nombre AS sucursal_nombre,
        a.usuario_id,
        u.nombre_usuario,
        a.accion,
        a.entidad,
        a.entidad_id,
        a.fecha_hora,
        a.ip_origen,
        a.detalle
      FROM auditoria a
      LEFT JOIN sucursal s ON s.id_sucursal = a.sucursal_id
      LEFT JOIN usuario u ON u.id_usuario = a.usuario_id
      ${where}
      ORDER BY a.fecha_hora DESC, a.id_auditoria DESC
      LIMIT 500`
    )
      .bind(...parametros)
      .all();

    return json({ ok: true, data: resultado.results || [] });
  } catch (error) {
    return json({ ok: false, message: "No fue posible consultar auditoria.", data: [] }, 500);
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

    if (url.pathname === "/api/login") {
      if (request.method === "POST") {
        return iniciarSesion(request, env);
      }

      return methodNotAllowed(request.method, ["POST"]);
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

    if (url.pathname === "/api/pagos") {
      if (request.method === "GET") {
        return listarPagos(env);
      }

      if (request.method === "POST") {
        return crearPago(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/entregas") {
      if (request.method === "GET") {
        return listarEntregas(env);
      }

      if (request.method === "POST") {
        return crearEntrega(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/entregas-pendientes") {
      if (request.method === "GET") {
        return listarEntregasPendientes(env);
      }

      return methodNotAllowed(request.method, ["GET"]);
    }

    if (url.pathname === "/api/movimientos-caja") {
      if (request.method === "GET") {
        return listarMovimientosCaja(env);
      }

      if (request.method === "POST") {
        return crearMovimientoCaja(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/flujo-caja") {
      if (request.method === "GET") {
        return consultarFlujoCaja(request, env);
      }

      return methodNotAllowed(request.method, ["GET"]);
    }

    if (url.pathname === "/api/empleados") {
      if (request.method === "GET") {
        return listarEmpleados(env);
      }

      if (request.method === "POST") {
        return crearEmpleado(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/planillas") {
      if (request.method === "GET") {
        return listarPlanillas(env);
      }

      if (request.method === "POST") {
        return crearPlanilla(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/activos-fijos") {
      if (request.method === "GET") {
        return listarActivos(env);
      }

      if (request.method === "POST") {
        return crearActivo(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/eventos-activo") {
      if (request.method === "POST") {
        return crearEventoActivo(request, env);
      }

      return methodNotAllowed(request.method, ["POST"]);
    }

    if (url.pathname === "/api/valor-activos") {
      if (request.method === "GET") {
        return consultarValorActivos(env);
      }

      return methodNotAllowed(request.method, ["GET"]);
    }

    if (url.pathname === "/api/usuarios") {
      if (request.method === "GET") {
        return listarUsuarios(env);
      }

      if (request.method === "POST") {
        return crearUsuario(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/roles") {
      if (request.method === "GET") {
        return listarRoles(env);
      }

      if (request.method === "POST") {
        return crearRol(request, env);
      }

      return methodNotAllowed(request.method, ["GET", "POST"]);
    }

    if (url.pathname === "/api/auditoria") {
      if (request.method === "GET") {
        return consultarAuditoria(request, env);
      }

      return methodNotAllowed(request.method, ["GET"]);
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

    const pagoMatch = url.pathname.match(/^\/api\/pagos\/(\d+)$/);

    if (pagoMatch) {
      const idPago = Number(pagoMatch[1]);

      if (request.method === "GET") {
        return consultarPago(env, idPago);
      }

      if (request.method === "PUT") {
        return actualizarPago(request, env, idPago);
      }

      if (request.method === "DELETE") {
        return eliminarPago(env, idPago);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const entregaMatch = url.pathname.match(/^\/api\/entregas\/(\d+)$/);

    if (entregaMatch) {
      const idEntrega = Number(entregaMatch[1]);

      if (request.method === "GET") {
        return consultarEntrega(env, idEntrega);
      }

      if (request.method === "PUT") {
        return actualizarEntrega(request, env, idEntrega);
      }

      if (request.method === "DELETE") {
        return eliminarEntrega(env, idEntrega);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const movimientoCajaMatch = url.pathname.match(/^\/api\/movimientos-caja\/(\d+)$/);

    if (movimientoCajaMatch) {
      const idMovimientoCaja = Number(movimientoCajaMatch[1]);

      if (request.method === "GET") {
        return consultarMovimientoCaja(env, idMovimientoCaja);
      }

      if (request.method === "PUT") {
        return actualizarMovimientoCaja(request, env, idMovimientoCaja);
      }

      if (request.method === "DELETE") {
        return eliminarMovimientoCaja(env, idMovimientoCaja);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const empleadoMatch = url.pathname.match(/^\/api\/empleados\/(\d+)$/);

    if (empleadoMatch) {
      const idEmpleado = Number(empleadoMatch[1]);

      if (request.method === "GET") {
        return consultarEmpleado(env, idEmpleado);
      }

      if (request.method === "PUT") {
        return actualizarEmpleado(request, env, idEmpleado);
      }

      if (request.method === "DELETE") {
        return eliminarEmpleado(env, idEmpleado);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const planillaMatch = url.pathname.match(/^\/api\/planillas\/(\d+)$/);

    if (planillaMatch) {
      const idPlanilla = Number(planillaMatch[1]);

      if (request.method === "GET") {
        return consultarPlanilla(env, idPlanilla);
      }

      if (request.method === "PUT") {
        return actualizarPlanilla(request, env, idPlanilla);
      }

      if (request.method === "DELETE") {
        return eliminarPlanilla(env, idPlanilla);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const activoMatch = url.pathname.match(/^\/api\/activos-fijos\/(\d+)$/);

    if (activoMatch) {
      const idActivo = Number(activoMatch[1]);

      if (request.method === "GET") {
        return consultarActivo(env, idActivo);
      }

      if (request.method === "PUT") {
        return actualizarActivo(request, env, idActivo);
      }

      if (request.method === "DELETE") {
        return eliminarActivo(env, idActivo);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const eventoActivoMatch = url.pathname.match(/^\/api\/eventos-activo\/(\d+)$/);

    if (eventoActivoMatch) {
      const idEvento = Number(eventoActivoMatch[1]);

      if (request.method === "DELETE") {
        return eliminarEventoActivo(env, idEvento);
      }

      return methodNotAllowed(request.method, ["DELETE"]);
    }

    const usuarioMatch = url.pathname.match(/^\/api\/usuarios\/(\d+)$/);

    if (usuarioMatch) {
      const idUsuario = Number(usuarioMatch[1]);

      if (request.method === "GET") {
        return consultarUsuario(env, idUsuario);
      }

      if (request.method === "PUT") {
        return actualizarUsuario(request, env, idUsuario);
      }

      if (request.method === "DELETE") {
        return eliminarUsuario(env, idUsuario);
      }

      return methodNotAllowed(request.method, ["GET", "PUT", "DELETE"]);
    }

    const rolMatch = url.pathname.match(/^\/api\/roles\/(\d+)$/);

    if (rolMatch) {
      const idRol = Number(rolMatch[1]);

      if (request.method === "PUT") {
        return actualizarRol(request, env, idRol);
      }

      if (request.method === "DELETE") {
        return eliminarRol(env, idRol);
      }

      return methodNotAllowed(request.method, ["PUT", "DELETE"]);
    }

    if (url.pathname.startsWith("/api/")) {
      return notFound(url.pathname);
    }

    return env.ASSETS.fetch(request);
  }
};
