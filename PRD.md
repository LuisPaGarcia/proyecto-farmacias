# PRD - Sistema integral para cadena de farmacias

## 1. Objetivo

Construir una plataforma centralizada para controlar, auditar y operar una cadena de farmacias distribuida en sucursales ubicadas en centros comerciales y stands o puntos pequeños ubicados en tiendas de gasolineras.

El sistema debe permitir:

- controlar inventario por sucursal, medicamento y lote;
- auditar movimientos de medicamentos entre farmacias;
- consultar flujo de efectivo en cualquier momento;
- controlar gastos de planilla;
- registrar y valorar activos fijos;
- coordinar entregas de medicamentos al cliente final;
- dejar preparada la integración futura con portal web, pedidos telefónicos y call center centralizado.

La prioridad del producto es dar visibilidad operativa y financiera confiable para una expansión nacional y para procesos de auditoría empresarial.

## 2. Alcance funcional

### Inventario y medicamentos

| Tabla | Propósito |
| --- | --- |
| **`MEDICAMENTO`** | Catálogo maestro de medicamentos vendidos por la cadena. Define código, nombre, presentación y unidad. No representa existencias físicas. |
| **`PROVEEDOR`** | Empresas o distribuidores que suministran medicamentos. Permite rastrear procedencia comercial. |
| **`LOTE`** | Lote específico de un medicamento, con número de lote, fabricación y vencimiento. Es obligatorio para trazabilidad sanitaria y vencimientos. |
| **`INVENTARIO`** | Estado actual de existencias por sucursal y lote. Mantiene stock actual, reservado y disponible. |
| **`MOVIMIENTO_INVENTARIO`** | Historial auditable de entradas, salidas, ventas, compras, transferencias, ajustes, devoluciones y vencimientos. |

Principio operativo:

```text
INVENTARIO muestra el estado actual.
MOVIMIENTO_INVENTARIO explica cómo se llegó a ese estado.
```

### Sucursales y transferencias

| Tabla | Propósito |
| --- | --- |
| **`SUCURSAL`** | Punto de venta u operación. Puede ser farmacia en centro comercial, farmacia independiente o stand/punto en gasolinera. Inventario, empleados, caja, activos y pedidos dependen de esta entidad. |
| **`CENTRO_COMERCIAL`** | Catálogo opcional de centros comerciales donde puede ubicarse una sucursal. |
| **`GASOLINERA`** | Catálogo opcional de gasolineras o tiendas en gasolinera donde puede ubicarse una sucursal. |
| **`TRANSFERENCIA`** | Encabezado del traslado de medicamentos entre dos sucursales. Guarda origen, destino, fechas, estado y observaciones. |
| **`ITEM_TRANSFERENCIA`** | Detalle de productos/lotes enviados en una transferencia. |

La separación entre `TRANSFERENCIA` e `ITEM_TRANSFERENCIA` permite que un traslado contenga múltiples medicamentos.

### Clientes, ventas y entregas

| Tabla | Propósito |
| --- | --- |
| **`CLIENTE`** | Información básica del cliente para ventas presenciales y pedidos futuros por portal o call center. |
| **`PEDIDO`** | Orden de compra. Contiene cliente, sucursal que atiende, canal, estado y totales. |
| **`ITEM_PEDIDO`** | Medicamentos contenidos en el pedido, con cantidad, precio, descuento y subtotal. |
| **`PAGO`** | Pagos asociados a pedidos. Permite efectivo, tarjeta, transferencia u otros medios. |
| **`ENTREGA`** | Coordinación logística de entrega al cliente: sucursal despachadora, dirección, fechas estimada/real y estado. |

Relación operativa principal:

```text
CLIENTE -> PEDIDO -> ITEM_PEDIDO
                  -> PAGO
                  -> ENTREGA
```

Esto permite que un operador de call center consulte si hay inventario disponible, desde qué sucursal puede despacharse, cuánto costará, cómo puede pagarse y cuándo podría entregarse.

### Caja y flujo de efectivo

| Tabla | Propósito |
| --- | --- |
| **`MOVIMIENTO_CAJA`** | Registra entradas y salidas de dinero por sucursal. Es la fuente principal para auditar flujo de efectivo. |

Conceptos esperados:

```text
VENTA
REEMBOLSO
GASTO
PLANILLA
DEPOSITO
RETIRO
AJUSTE_CAJA
```

Cada pago confirmado debe poder reflejarse como movimiento de caja. Cada gasto relevante, incluyendo planilla, también debe quedar registrado para reconstruir el flujo financiero.

### Empleados y planilla

| Tabla | Propósito |
| --- | --- |
| **`EMPLEADO`** | Personal asignado a sucursales. Incluye cargo, fecha de ingreso y estado. |
| **`PLANILLA`** | Período de nómina por sucursal, con fechas, estado y total pagado. |
| **`DETALLE_PLANILLA`** | Montos pagados a cada empleado dentro de una planilla. |

Los pagos de planilla deben generar o vincularse con movimientos de caja para que el gasto sea auditable.

### Activos fijos

| Tabla | Propósito |
| --- | --- |
| **`ACTIVO_FIJO`** | Bienes físicos propiedad de la empresa: refrigeradores, computadoras, cajas registradoras, mobiliario, vehículos y equipo. |
| **`EVENTO_ACTIVO`** | Historial operativo y financiero del activo: compra, depreciación, mantenimiento, traslado, reparación o baja. |

Esto permite consultar el valor de activos por sucursal y el valor total de la empresa.

### Usuarios, roles y auditoría

| Tabla | Propósito |
| --- | --- |
| **`USUARIO`** | Cuenta de acceso asociada a un empleado. |
| **`ROL`** | Catálogo de permisos: administrador, auditor, cajero, inventario, call center, etc. |
| **`USUARIO_ROL`** | Relación muchos-a-muchos entre usuarios y roles. |
| **`AUDITORIA`** | Bitácora de acciones relevantes: usuario, sucursal, acción, entidad afectada, fecha, IP y detalle. |

`AUDITORIA` no debe ser editable desde pantallas operativas. Su finalidad es conservar evidencia de acciones críticas.

## 3. Relaciones de tablas

### Inventario

| Relación | Cardinalidad | Descripción |
| --- | --- | --- |
| `MEDICAMENTO.id_medicamento -> LOTE.medicamento_id` | 1:N | Un medicamento puede tener muchos lotes. |
| `PROVEEDOR.id_proveedor -> LOTE.proveedor_id` | 1:N | Un proveedor puede suministrar muchos lotes. |
| `SUCURSAL.id_sucursal -> INVENTARIO.sucursal_id` | 1:N | Una sucursal tiene muchos registros de inventario. |
| `LOTE.id_lote -> INVENTARIO.lote_id` | 1:N | Un lote puede existir en varias sucursales. |
| `SUCURSAL.id_sucursal -> MOVIMIENTO_INVENTARIO.sucursal_id` | 1:N | Cada movimiento ocurre en una sucursal. |
| `LOTE.id_lote -> MOVIMIENTO_INVENTARIO.lote_id` | 1:N | Cada movimiento afecta un lote específico. |
| `USUARIO.id_usuario -> MOVIMIENTO_INVENTARIO.usuario_id` | 1:N opcional | Permite auditar quién registró el movimiento. |

### Sucursales y ubicaciones

| Relación | Cardinalidad | Descripción |
| --- | --- | --- |
| `CENTRO_COMERCIAL.id_centro_comercial -> SUCURSAL.centro_comercial_id` | 1:N opcional | Una sucursal puede estar en un centro comercial. |
| `GASOLINERA.id_gasolinera -> SUCURSAL.gasolinera_id` | 1:N opcional | Una sucursal puede estar en una gasolinera. |
| `SUCURSAL.id_sucursal -> TRANSFERENCIA.sucursal_origen_id` | 1:N | Una sucursal puede originar muchas transferencias. |
| `SUCURSAL.id_sucursal -> TRANSFERENCIA.sucursal_destino_id` | 1:N | Una sucursal puede recibir muchas transferencias. |
| `TRANSFERENCIA.id_transferencia -> ITEM_TRANSFERENCIA.transferencia_id` | 1:N | Una transferencia tiene muchos renglones. |
| `LOTE.id_lote -> ITEM_TRANSFERENCIA.lote_id` | 1:N | Cada renglón transfiere un lote específico. |

### Ventas, pagos y entregas

| Relación | Cardinalidad | Descripción |
| --- | --- | --- |
| `CLIENTE.id_cliente -> PEDIDO.cliente_id` | 1:N | Un cliente puede tener muchos pedidos. |
| `SUCURSAL.id_sucursal -> PEDIDO.sucursal_id` | 1:N | Una sucursal atiende muchos pedidos. |
| `PEDIDO.id_pedido -> ITEM_PEDIDO.pedido_id` | 1:N | Un pedido contiene muchos medicamentos. |
| `MEDICAMENTO.id_medicamento -> ITEM_PEDIDO.medicamento_id` | 1:N | Un medicamento puede aparecer en muchos pedidos. |
| `LOTE.id_lote -> ITEM_PEDIDO.lote_id` | 1:N opcional | El lote puede asignarse al despachar. |
| `PEDIDO.id_pedido -> PAGO.pedido_id` | 1:N | Un pedido puede tener uno o varios pagos. |
| `SUCURSAL.id_sucursal -> PAGO.sucursal_id` | 1:N | El pago queda asociado a la sucursal que lo cobra. |
| `PEDIDO.id_pedido -> ENTREGA.pedido_id` | 1:0..1 | Un pedido puede tener una entrega cuando no es retiro en tienda. |
| `SUCURSAL.id_sucursal -> ENTREGA.sucursal_id` | 1:N | La sucursal despachadora puede tener muchas entregas. |

### Finanzas, planilla y activos

| Relación | Cardinalidad | Descripción |
| --- | --- | --- |
| `SUCURSAL.id_sucursal -> MOVIMIENTO_CAJA.sucursal_id` | 1:N | Cada movimiento de dinero pertenece a una sucursal. |
| `USUARIO.id_usuario -> MOVIMIENTO_CAJA.usuario_id` | 1:N opcional | Identifica quién registró o confirmó el movimiento. |
| `PEDIDO.id_pedido -> MOVIMIENTO_CAJA.pedido_id` | 1:N opcional | Permite rastrear ingresos por venta. |
| `PAGO.id_pago -> MOVIMIENTO_CAJA.pago_id` | 1:N opcional | Vincula caja con pagos específicos. |
| `SUCURSAL.id_sucursal -> EMPLEADO.sucursal_id` | 1:N | Una sucursal tiene muchos empleados. |
| `SUCURSAL.id_sucursal -> PLANILLA.sucursal_id` | 1:N | La planilla se controla por sucursal. |
| `PLANILLA.id_planilla -> DETALLE_PLANILLA.planilla_id` | 1:N | Una planilla tiene muchos pagos a empleados. |
| `EMPLEADO.id_empleado -> DETALLE_PLANILLA.empleado_id` | 1:N | Un empleado puede aparecer en muchas planillas. |
| `SUCURSAL.id_sucursal -> ACTIVO_FIJO.sucursal_id` | 1:N | Una sucursal tiene muchos activos. |
| `ACTIVO_FIJO.id_activo_fijo -> EVENTO_ACTIVO.activo_fijo_id` | 1:N | Un activo tiene muchos eventos históricos. |

### Seguridad y auditoría

| Relación | Cardinalidad | Descripción |
| --- | --- | --- |
| `EMPLEADO.id_empleado -> USUARIO.empleado_id` | 1:0..1 | Un empleado puede tener una cuenta de usuario. |
| `USUARIO.id_usuario -> USUARIO_ROL.usuario_id` | 1:N | Un usuario puede tener varios roles. |
| `ROL.id_rol -> USUARIO_ROL.rol_id` | 1:N | Un rol puede asignarse a varios usuarios. |
| `SUCURSAL.id_sucursal -> AUDITORIA.sucursal_id` | 1:N opcional | La acción puede estar asociada a una sucursal. |
| `USUARIO.id_usuario -> AUDITORIA.usuario_id` | 1:N opcional | La acción puede estar asociada a un usuario. |

## 4. Revisión del alcance de fuentes de datos

El alcance actual de datos sí cubre el objetivo central de control y auditoría si se alimenta desde fuentes internas confiables. Las tablas críticas son `MOVIMIENTO_INVENTARIO`, `MOVIMIENTO_CAJA` y `AUDITORIA`, porque permiten reconstruir qué ocurrió, cuándo ocurrió y quién lo ejecutó.

### Fuentes necesarias para cumplir el objetivo

| Fuente de datos | Estado en el modelo | Evaluación |
| --- | --- | --- |
| Catálogo de medicamentos | Cubierto por `MEDICAMENTO` | Suficiente para MVP. Debe mantenerse normalizado y con códigos únicos. |
| Proveedores y lotes | Cubierto por `PROVEEDOR` y `LOTE` | Suficiente para trazabilidad básica. Puede ampliarse luego con órdenes de compra. |
| Inventario por sucursal | Cubierto por `INVENTARIO` y `MOVIMIENTO_INVENTARIO` | Cumple el objetivo de auditoría si todo cambio de stock genera movimiento. |
| Transferencias internas | Cubierto por `TRANSFERENCIA` e `ITEM_TRANSFERENCIA` | Cumple el objetivo de movimiento entre farmacias. |
| Ventas y pedidos | Cubierto por `PEDIDO` e `ITEM_PEDIDO` | Cumple venta presencial y deja preparada la integración con call center y portal. |
| Pagos y caja | Cubierto por `PAGO` y `MOVIMIENTO_CAJA` | Suficiente para flujo de efectivo operativo. Para bolsa/auditoría formal deberá integrarse luego con contabilidad bancaria. |
| Entregas | Cubierto por `ENTREGA` | Cumple coordinación básica. Para promesas de tiempo en llamada necesita datos de distancia, disponibilidad de repartidores o integración logística. |
| Empleados y planilla | Cubierto por `EMPLEADO`, `PLANILLA` y `DETALLE_PLANILLA` | Suficiente para gasto de planilla por sucursal. Puede integrarse luego con sistema HR externo. |
| Activos fijos | Cubierto por `ACTIVO_FIJO` y `EVENTO_ACTIVO` | Suficiente para control y valoración operativa. |
| Seguridad y auditoría | Cubierto por `USUARIO`, `ROL`, `USUARIO_ROL` y `AUDITORIA` | Cumple trazabilidad de acciones si se registra desde todas las operaciones críticas. |
| Ubicación de sucursales | Parcialmente cubierto por `SUCURSAL`, `CENTRO_COMERCIAL` y `GASOLINERA` | Suficiente para ubicación administrativa. Para optimizar entregas se recomienda agregar coordenadas y geocodificación. |

### Brechas a resolver antes de producción nacional

- Disponibilidad en tiempo real: el call center necesita inventario actualizado y reservas transaccionales para no prometer productos ya comprometidos.
- Logística de última milla: el modelo registra entregas, pero no calcula rutas, capacidad de repartidores ni ETA por tráfico.
- Conciliación financiera: `MOVIMIENTO_CAJA` permite auditoría interna, pero para una empresa que busca entrar a bolsa se requerirá integración futura con contabilidad, bancos, POS de tarjetas e impuestos.
- Compras y abastecimiento: proveedores y lotes cubren procedencia, pero no existe todavía un módulo formal de órdenes de compra, recepción y cuentas por pagar.
- Maestros externos: centros comerciales, gasolineras y direcciones deben tener mantenimiento de datos para que la expansión no dependa de texto libre.

Conclusión: el alcance de fuentes de datos cumple para un MVP operativo y auditable de sucursales, inventario, caja, activos y entregas. Para el objetivo completo a gran escala, el sistema debe diseñarse desde el inicio con integración futura a pagos, contabilidad, logística, geocodificación y compras.

## 5. Consultas clave esperadas

El modelo debe responder de forma eficiente:

- qué stock disponible existe por medicamento, lote y sucursal;
- qué medicamentos están próximos a vencer;
- qué sucursal puede atender un pedido según inventario disponible;
- qué transferencias están pendientes, enviadas o recibidas;
- cuánto efectivo ingresó o salió por sucursal y período;
- qué pedidos fueron pagados, pendientes, cancelados o reembolsados;
- qué entregas están retrasadas;
- cuánto se gastó en planilla por sucursal;
- qué activos existen por sucursal y cuál es su valor registrado;
- qué usuario ejecutó una operación crítica.

## 6. Tecnología objetivo

El sistema se mantendrá simple:

- Frontend: React.
- Backend/API: Cloudflare Workers.
- Base de datos: SQLite compatible con Cloudflare D1.
- Servicios Cloudflare complementarios: Pages, D1, R2 para documentos o comprobantes, Queues para eventos asíncronos y Workers Analytics para observabilidad básica.

El archivo `schema.sqlite.sql` define el esquema inicial para SQLite/D1.
