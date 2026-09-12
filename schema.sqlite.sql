PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS proveedor (
  id_proveedor INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  nit TEXT,
  telefono TEXT,
  direccion TEXT,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medicamento (
  id_medicamento INTEGER PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  presentacion TEXT NOT NULL,
  unidad TEXT NOT NULL,
  requiere_receta INTEGER NOT NULL DEFAULT 0 CHECK (requiere_receta IN (0, 1)),
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lote (
  id_lote INTEGER PRIMARY KEY,
  medicamento_id INTEGER NOT NULL,
  proveedor_id INTEGER,
  numero_lote TEXT NOT NULL,
  fecha_fabricacion TEXT,
  fecha_vencimiento TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'VENCIDO', 'RETIRADO')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (medicamento_id) REFERENCES medicamento(id_medicamento),
  FOREIGN KEY (proveedor_id) REFERENCES proveedor(id_proveedor),
  UNIQUE (medicamento_id, numero_lote)
);

CREATE TABLE IF NOT EXISTS centro_comercial (
  id_centro_comercial INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  direccion TEXT,
  departamento TEXT,
  municipio TEXT,
  telefono TEXT,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE TABLE IF NOT EXISTS gasolinera (
  id_gasolinera INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  marca TEXT,
  direccion TEXT,
  departamento TEXT,
  municipio TEXT,
  telefono TEXT,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

CREATE TABLE IF NOT EXISTS sucursal (
  id_sucursal INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('FARMACIA', 'STAND', 'GASOLINERA')),
  direccion TEXT NOT NULL,
  departamento TEXT NOT NULL,
  municipio TEXT,
  telefono TEXT,
  latitud REAL,
  longitud REAL,
  centro_comercial_id INTEGER,
  gasolinera_id INTEGER,
  estado TEXT NOT NULL DEFAULT 'ACTIVA' CHECK (estado IN ('ACTIVA', 'INACTIVA')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (centro_comercial_id) REFERENCES centro_comercial(id_centro_comercial),
  FOREIGN KEY (gasolinera_id) REFERENCES gasolinera(id_gasolinera),
  CHECK (
    (tipo = 'FARMACIA' AND gasolinera_id IS NULL)
    OR (tipo = 'STAND' AND gasolinera_id IS NOT NULL AND centro_comercial_id IS NULL)
    OR (tipo = 'GASOLINERA' AND gasolinera_id IS NOT NULL AND centro_comercial_id IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS empleado (
  id_empleado INTEGER PRIMARY KEY,
  sucursal_id INTEGER,
  nombre TEXT NOT NULL,
  cargo TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  fecha_ingreso TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS usuario (
  id_usuario INTEGER PRIMARY KEY,
  nombre_usuario TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  empleado_id INTEGER UNIQUE,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO', 'BLOQUEADO')),
  ultimo_acceso_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (empleado_id) REFERENCES empleado(id_empleado)
);

CREATE TABLE IF NOT EXISTS rol (
  id_rol INTEGER PRIMARY KEY,
  nombre_rol TEXT NOT NULL UNIQUE,
  descripcion TEXT
);

CREATE TABLE IF NOT EXISTS usuario_rol (
  id_usuario_rol INTEGER PRIMARY KEY,
  usuario_id INTEGER NOT NULL,
  rol_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE,
  FOREIGN KEY (rol_id) REFERENCES rol(id_rol) ON DELETE CASCADE,
  UNIQUE (usuario_id, rol_id)
);

CREATE TABLE IF NOT EXISTS inventario (
  id_inventario INTEGER PRIMARY KEY,
  sucursal_id INTEGER NOT NULL,
  lote_id INTEGER NOT NULL,
  stock_actual INTEGER NOT NULL DEFAULT 0 CHECK (stock_actual >= 0),
  stock_reservado INTEGER NOT NULL DEFAULT 0 CHECK (stock_reservado >= 0),
  stock_disponible INTEGER NOT NULL DEFAULT 0 CHECK (stock_disponible >= 0),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal),
  FOREIGN KEY (lote_id) REFERENCES lote(id_lote),
  UNIQUE (sucursal_id, lote_id),
  CHECK (stock_actual >= stock_reservado),
  CHECK (stock_disponible = stock_actual - stock_reservado)
);

CREATE TABLE IF NOT EXISTS transferencia (
  id_transferencia INTEGER PRIMARY KEY,
  sucursal_origen_id INTEGER NOT NULL,
  sucursal_destino_id INTEGER NOT NULL,
  fecha_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_envio TEXT,
  fecha_recepcion TEXT,
  estado TEXT NOT NULL DEFAULT 'CREADA' CHECK (estado IN ('CREADA', 'APROBADA', 'ENVIADA', 'RECIBIDA', 'CANCELADA')),
  observacion TEXT,
  usuario_creador_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sucursal_origen_id) REFERENCES sucursal(id_sucursal),
  FOREIGN KEY (sucursal_destino_id) REFERENCES sucursal(id_sucursal),
  FOREIGN KEY (usuario_creador_id) REFERENCES usuario(id_usuario),
  CHECK (sucursal_origen_id <> sucursal_destino_id)
);

CREATE TABLE IF NOT EXISTS item_transferencia (
  id_item_transferencia INTEGER PRIMARY KEY,
  transferencia_id INTEGER NOT NULL,
  lote_id INTEGER NOT NULL,
  cantidad_enviada INTEGER NOT NULL CHECK (cantidad_enviada > 0),
  cantidad_recibida INTEGER NOT NULL DEFAULT 0 CHECK (cantidad_recibida >= 0),
  FOREIGN KEY (transferencia_id) REFERENCES transferencia(id_transferencia) ON DELETE CASCADE,
  FOREIGN KEY (lote_id) REFERENCES lote(id_lote),
  UNIQUE (transferencia_id, lote_id),
  CHECK (cantidad_recibida <= cantidad_enviada)
);

CREATE TABLE IF NOT EXISTS movimiento_inventario (
  id_movimiento_inv INTEGER PRIMARY KEY,
  sucursal_id INTEGER NOT NULL,
  lote_id INTEGER NOT NULL,
  usuario_id INTEGER,
  transferencia_id INTEGER,
  item_transferencia_id INTEGER,
  tipo_movimiento TEXT NOT NULL CHECK (
    tipo_movimiento IN ('COMPRA', 'VENTA', 'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'AJUSTE', 'DEVOLUCION', 'VENCIMIENTO')
  ),
  cantidad INTEGER NOT NULL CHECK (cantidad <> 0),
  fecha_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  referencia TEXT,
  observacion TEXT,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal),
  FOREIGN KEY (lote_id) REFERENCES lote(id_lote),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario),
  FOREIGN KEY (transferencia_id) REFERENCES transferencia(id_transferencia),
  FOREIGN KEY (item_transferencia_id) REFERENCES item_transferencia(id_item_transferencia)
);

CREATE TABLE IF NOT EXISTS cliente (
  id_cliente INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  referencia_direccion TEXT,
  latitud REAL,
  longitud REAL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedido (
  id_pedido INTEGER PRIMARY KEY,
  sucursal_id INTEGER NOT NULL,
  cliente_id INTEGER,
  fecha_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  canal TEXT NOT NULL CHECK (canal IN ('FARMACIA', 'CALL_CENTER', 'PORTAL')),
  estado TEXT NOT NULL DEFAULT 'CREADO' CHECK (estado IN ('CREADO', 'RESERVADO', 'PAGADO', 'DESPACHADO', 'ENTREGADO', 'CANCELADO')),
  subtotal NUMERIC NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  descuento_total NUMERIC NOT NULL DEFAULT 0 CHECK (descuento_total >= 0),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
  observacion TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal),
  FOREIGN KEY (cliente_id) REFERENCES cliente(id_cliente)
);

CREATE TABLE IF NOT EXISTS item_pedido (
  id_item_pedido INTEGER PRIMARY KEY,
  pedido_id INTEGER NOT NULL,
  medicamento_id INTEGER NOT NULL,
  lote_id INTEGER,
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC NOT NULL CHECK (precio_unitario >= 0),
  descuento NUMERIC NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  sub_total NUMERIC NOT NULL CHECK (sub_total >= 0),
  FOREIGN KEY (pedido_id) REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  FOREIGN KEY (medicamento_id) REFERENCES medicamento(id_medicamento),
  FOREIGN KEY (lote_id) REFERENCES lote(id_lote)
);

CREATE TABLE IF NOT EXISTS pago (
  id_pago INTEGER PRIMARY KEY,
  pedido_id INTEGER NOT NULL,
  sucursal_id INTEGER NOT NULL,
  usuario_id INTEGER,
  fecha_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  monto NUMERIC NOT NULL CHECK (monto > 0),
  metodo_pago TEXT NOT NULL CHECK (metodo_pago IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO')),
  referencia TEXT,
  estado TEXT NOT NULL DEFAULT 'CONFIRMADO' CHECK (estado IN ('PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'REEMBOLSADO')),
  FOREIGN KEY (pedido_id) REFERENCES pedido(id_pedido),
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario)
);

CREATE TABLE IF NOT EXISTS entrega (
  id_entrega INTEGER PRIMARY KEY,
  pedido_id INTEGER NOT NULL UNIQUE,
  sucursal_id INTEGER NOT NULL,
  fecha_programada TEXT,
  fecha_entrega TEXT,
  direccion_entrega TEXT NOT NULL,
  referencia_direccion TEXT,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'EN_RUTA', 'ENTREGADA', 'FALLIDA', 'CANCELADA')),
  observacion TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pedido_id) REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS planilla (
  id_planilla INTEGER PRIMARY KEY,
  sucursal_id INTEGER NOT NULL,
  periodo_inicio TEXT NOT NULL,
  periodo_fin TEXT NOT NULL,
  fecha_pago TEXT,
  estado TEXT NOT NULL DEFAULT 'ABIERTA' CHECK (estado IN ('ABIERTA', 'APROBADA', 'PAGADA', 'ANULADA')),
  total NUMERIC NOT NULL DEFAULT 0 CHECK (total >= 0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal),
  CHECK (periodo_fin >= periodo_inicio)
);

CREATE TABLE IF NOT EXISTS detalle_planilla (
  id_detalle_planilla INTEGER PRIMARY KEY,
  planilla_id INTEGER NOT NULL,
  empleado_id INTEGER NOT NULL,
  concepto TEXT NOT NULL,
  monto NUMERIC NOT NULL CHECK (monto >= 0),
  FOREIGN KEY (planilla_id) REFERENCES planilla(id_planilla) ON DELETE CASCADE,
  FOREIGN KEY (empleado_id) REFERENCES empleado(id_empleado)
);

CREATE TABLE IF NOT EXISTS activo_fijo (
  id_activo_fijo INTEGER PRIMARY KEY,
  sucursal_id INTEGER NOT NULL,
  descripcion TEXT NOT NULL,
  codigo_interno TEXT NOT NULL UNIQUE,
  fecha_adquisicion TEXT NOT NULL,
  valor_adquisicion NUMERIC NOT NULL CHECK (valor_adquisicion >= 0),
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'EN_MANTENIMIENTO', 'TRASLADADO', 'BAJA')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal)
);

CREATE TABLE IF NOT EXISTS evento_activo (
  id_evento_activo INTEGER PRIMARY KEY,
  activo_fijo_id INTEGER NOT NULL,
  usuario_id INTEGER,
  tipo_evento TEXT NOT NULL CHECK (tipo_evento IN ('COMPRA', 'DEPRECIACION', 'MANTENIMIENTO', 'REPARACION', 'TRASLADO', 'BAJA', 'OTRO')),
  fecha_evento TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  valor NUMERIC NOT NULL DEFAULT 0 CHECK (valor >= 0),
  observacion TEXT,
  FOREIGN KEY (activo_fijo_id) REFERENCES activo_fijo(id_activo_fijo) ON DELETE CASCADE,
  FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario)
);

CREATE TABLE IF NOT EXISTS movimiento_caja (
  id_movimiento_caja INTEGER PRIMARY KEY,
  sucursal_id INTEGER NOT NULL,
  usuario_id INTEGER,
  pedido_id INTEGER,
  pago_id INTEGER,
  planilla_id INTEGER,
  entrega_id INTEGER,
  fecha_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo TEXT NOT NULL CHECK (tipo IN ('INGRESO', 'EGRESO')),
  concepto TEXT NOT NULL CHECK (concepto IN ('VENTA', 'REEMBOLSO', 'GASTO', 'PLANILLA', 'DEPOSITO', 'RETIRO', 'AJUSTE_CAJA')),
  monto NUMERIC NOT NULL CHECK (monto > 0),
  metodo_pago TEXT CHECK (metodo_pago IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO')),
  referencia TEXT,
  observacion TEXT,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario),
  FOREIGN KEY (pedido_id) REFERENCES pedido(id_pedido),
  FOREIGN KEY (pago_id) REFERENCES pago(id_pago),
  FOREIGN KEY (planilla_id) REFERENCES planilla(id_planilla),
  FOREIGN KEY (entrega_id) REFERENCES entrega(id_entrega)
);

CREATE TABLE IF NOT EXISTS auditoria (
  id_auditoria INTEGER PRIMARY KEY,
  sucursal_id INTEGER,
  usuario_id INTEGER,
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id INTEGER,
  fecha_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ip_origen TEXT,
  detalle TEXT,
  FOREIGN KEY (sucursal_id) REFERENCES sucursal(id_sucursal),
  FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario)
);

CREATE INDEX IF NOT EXISTS idx_lote_medicamento ON lote(medicamento_id);
CREATE INDEX IF NOT EXISTS idx_lote_vencimiento ON lote(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_inventario_sucursal ON inventario(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_inventario_lote ON inventario(lote_id);
CREATE INDEX IF NOT EXISTS idx_mov_inv_sucursal_fecha ON movimiento_inventario(sucursal_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_mov_inv_lote ON movimiento_inventario(lote_id);
CREATE INDEX IF NOT EXISTS idx_transferencia_origen_estado ON transferencia(sucursal_origen_id, estado);
CREATE INDEX IF NOT EXISTS idx_transferencia_destino_estado ON transferencia(sucursal_destino_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedido_sucursal_estado ON pedido(sucursal_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedido_cliente ON pedido(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pago_pedido ON pago(pedido_id);
CREATE INDEX IF NOT EXISTS idx_entrega_estado_fecha ON entrega(estado, fecha_programada);
CREATE INDEX IF NOT EXISTS idx_mov_caja_sucursal_fecha ON movimiento_caja(sucursal_id, fecha_hora);
CREATE INDEX IF NOT EXISTS idx_planilla_sucursal_periodo ON planilla(sucursal_id, periodo_inicio, periodo_fin);
CREATE INDEX IF NOT EXISTS idx_activo_sucursal ON activo_fijo(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha_hora);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidad ON auditoria(entidad, entidad_id);

CREATE VIEW IF NOT EXISTS vw_inventario_disponible AS
SELECT
  s.id_sucursal,
  s.nombre AS sucursal,
  m.id_medicamento,
  m.codigo,
  m.nombre AS medicamento,
  m.presentacion,
  l.id_lote,
  l.numero_lote,
  l.fecha_vencimiento,
  i.stock_actual,
  i.stock_reservado,
  i.stock_disponible
FROM inventario i
JOIN sucursal s ON s.id_sucursal = i.sucursal_id
JOIN lote l ON l.id_lote = i.lote_id
JOIN medicamento m ON m.id_medicamento = l.medicamento_id
WHERE s.estado = 'ACTIVA'
  AND m.estado = 'ACTIVO'
  AND l.estado = 'ACTIVO'
  AND i.stock_disponible > 0;

CREATE VIEW IF NOT EXISTS vw_flujo_efectivo_sucursal AS
SELECT
  s.id_sucursal,
  s.nombre AS sucursal,
  mc.fecha_hora,
  mc.tipo,
  mc.concepto,
  CASE WHEN mc.tipo = 'INGRESO' THEN mc.monto ELSE -mc.monto END AS monto_neto,
  mc.metodo_pago,
  mc.referencia
FROM movimiento_caja mc
JOIN sucursal s ON s.id_sucursal = mc.sucursal_id;

CREATE VIEW IF NOT EXISTS vw_valor_activos_sucursal AS
SELECT
  s.id_sucursal,
  s.nombre AS sucursal,
  COUNT(af.id_activo_fijo) AS cantidad_activos,
  COALESCE(SUM(af.valor_adquisicion), 0) AS valor_adquisicion_total
FROM sucursal s
LEFT JOIN activo_fijo af
  ON af.sucursal_id = s.id_sucursal
 AND af.estado <> 'BAJA'
GROUP BY s.id_sucursal, s.nombre;

INSERT OR IGNORE INTO rol (nombre_rol, descripcion) VALUES
  ('ADMINISTRADOR', 'Administracion general del sistema'),
  ('AUDITOR', 'Consulta de auditoria e informacion financiera'),
  ('CAJERO', 'Gestion de ventas, pagos y caja'),
  ('INVENTARIO', 'Gestion de inventario, lotes y transferencias'),
  ('CALL_CENTER', 'Consulta y creacion de pedidos para entrega');

INSERT OR IGNORE INTO usuario (nombre_usuario, password_hash, estado) VALUES
  ('vendedor', 'vendedor123', 'ACTIVO'),
  ('vendedor-call-center', 'callcenter123', 'ACTIVO'),
  ('admin', 'admin123', 'ACTIVO'),
  ('auditor', 'auditor123', 'ACTIVO');

INSERT OR IGNORE INTO usuario_rol (usuario_id, rol_id)
SELECT u.id_usuario, r.id_rol
FROM usuario u
JOIN rol r ON r.nombre_rol = 'CAJERO'
WHERE u.nombre_usuario = 'vendedor'
UNION ALL
SELECT u.id_usuario, r.id_rol
FROM usuario u
JOIN rol r ON r.nombre_rol = 'CALL_CENTER'
WHERE u.nombre_usuario = 'vendedor-call-center'
UNION ALL
SELECT u.id_usuario, r.id_rol
FROM usuario u
JOIN rol r ON r.nombre_rol = 'ADMINISTRADOR'
WHERE u.nombre_usuario = 'admin'
UNION ALL
SELECT u.id_usuario, r.id_rol
FROM usuario u
JOIN rol r ON r.nombre_rol = 'AUDITOR'
WHERE u.nombre_usuario = 'auditor';
