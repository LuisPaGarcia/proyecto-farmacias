# Requerimientos de la aplicacion

Checklist para llevar el control de vistas, APIs y tareas base de la aplicacion de farmacias.

## Tecnologia base

- [x] REQ-001 - Orden: 01 - Base - Usar React para construir todas las vistas del frontend.
- [x] REQ-002 - Orden: 02 - Base - Usar Node.js para crear la API que consume la informacion de SQLite.
- [x] REQ-003 - Orden: 03 - Base - Usar SQLite como base de datos principal.
- [x] REQ-004 - Orden: 04 - Base - Mantener la arquitectura simple, sin Next.js ni frameworks complejos.
- [x] REQ-005 - Orden: 05 - Base - Definir una API REST sencilla para comunicar React con Node.js.

## Vistas React

- [x] REQ-006 - Orden: 53 - Vista - Crear dashboard general con resumen de inventario, caja, pedidos, entregas y alertas.
- [x] REQ-007 - Orden: 08 - Vista - Crear vista de sucursales para listar, crear, editar y consultar farmacias o stands.
- [x] REQ-008 - Orden: 10 - Vista - Crear vista de medicamentos para administrar el catalogo maestro.
- [x] REQ-009 - Orden: 13 - Vista - Crear vista de proveedores y lotes para trazabilidad de medicamentos.
- [x] REQ-010 - Orden: 16 - Vista - Crear vista de inventario por sucursal, medicamento y lote.
- [x] REQ-011 - Orden: 19 - Vista - Crear vista de movimientos de inventario para auditar entradas, salidas y ajustes.
- [x] REQ-012 - Orden: 23 - Vista - Crear vista de transferencias entre sucursales con estado y detalle de items.
- [x] REQ-013 - Orden: 25 - Vista - Crear vista de clientes para datos de contacto y direccion de entrega.
- [x] REQ-014 - Orden: 29 - Vista - Crear vista de pedidos para ventas presenciales, call center y portal futuro.
- [x] REQ-015 - Orden: 32 - Vista - Crear vista de pagos asociados a pedidos.
- [x] REQ-016 - Orden: 35 - Vista - Crear vista de entregas para programar, dar seguimiento y cerrar entregas.
- [x] REQ-017 - Orden: 38 - Vista - Crear vista de caja y flujo de efectivo por sucursal y periodo.
- [x] REQ-018 - Orden: 40 - Vista - Crear vista de empleados por sucursal.
- [x] REQ-019 - Orden: 43 - Vista - Crear vista de planilla para periodos, aprobacion y pagos.
- [x] REQ-020 - Orden: 46 - Vista - Crear vista de activos fijos por sucursal.
- [x] REQ-021 - Orden: 49 - Vista - Crear vista de usuarios, roles y permisos.
- [x] REQ-022 - Orden: 52 - Vista - Crear vista de auditoria solo de consulta para revisar acciones criticas.

## APIs Node.js

- [x] REQ-023 - Orden: 07 - API - Crear endpoints REST para sucursales.
- [x] REQ-024 - Orden: 09 - API - Crear endpoints REST para medicamentos.
- [x] REQ-025 - Orden: 11 - API - Crear endpoints REST para proveedores.
- [x] REQ-026 - Orden: 12 - API - Crear endpoints REST para lotes.
- [x] REQ-027 - Orden: 14 - API - Crear endpoints REST para inventario.
- [x] REQ-028 - Orden: 17 - API - Crear endpoints REST para movimientos de inventario.
- [x] REQ-029 - Orden: 22 - API - Crear endpoints REST para transferencias e items de transferencia.
- [x] REQ-030 - Orden: 24 - API - Crear endpoints REST para clientes.
- [x] REQ-031 - Orden: 28 - API - Crear endpoints REST para pedidos e items de pedido.
- [x] REQ-032 - Orden: 30 - API - Crear endpoints REST para pagos.
- [x] REQ-033 - Orden: 34 - API - Crear endpoints REST para entregas.
- [x] REQ-034 - Orden: 37 - API - Crear endpoints REST para movimientos de caja.
- [x] REQ-035 - Orden: 39 - API - Crear endpoints REST para empleados.
- [x] REQ-036 - Orden: 42 - API - Crear endpoints REST para planilla y detalle de planilla.
- [x] REQ-037 - Orden: 45 - API - Crear endpoints REST para activos fijos y eventos de activo.
- [x] REQ-038 - Orden: 48 - API - Crear endpoints REST para usuarios, roles y asignacion de roles.
- [x] REQ-039 - Orden: 15 - API - Crear endpoint de consulta de inventario disponible por medicamento y sucursal.
- [x] REQ-040 - Orden: 20 - API - Crear endpoint de consulta de medicamentos proximos a vencer.
- [x] REQ-041 - Orden: 36 - API - Crear endpoint de consulta de flujo de caja por sucursal y rango de fechas.
- [x] REQ-042 - Orden: 44 - API - Crear endpoint de consulta de valor de activos por sucursal.
- [x] REQ-043 - Orden: 27 - API - Crear endpoint de consulta de pedidos por estado, canal y sucursal.
- [x] REQ-044 - Orden: 33 - API - Crear endpoint de consulta de entregas pendientes, en ruta y retrasadas.
- [x] REQ-045 - Orden: 51 - API - Crear endpoint de consulta de auditoria por usuario, entidad y fecha.

## Validaciones y auditoria

- [x] REQ-046 - Orden: 06 - Validacion - Validar datos obligatorios antes de crear o actualizar registros.
- [x] REQ-047 - Orden: 18 - Validacion - Validar stock disponible antes de reservar, vender o transferir medicamentos.
- [x] REQ-048 - Orden: 21 - Validacion - Validar que una transferencia no tenga la misma sucursal de origen y destino.
- [x] REQ-049 - Orden: 26 - Validacion - Validar estados permitidos para pedidos, pagos, entregas, planillas y transferencias.
- [x] REQ-050 - Orden: 31 - Auditoria - Registrar movimientos de inventario para toda compra, venta, ajuste, devolucion, vencimiento o transferencia.
- [x] REQ-051 - Orden: 41 - Auditoria - Registrar movimientos de caja para pagos confirmados, reembolsos, gastos, planilla, depositos y retiros.
- [x] REQ-052 - Orden: 47 - Auditoria - Registrar acciones criticas en la tabla de auditoria.
- [x] REQ-053 - Orden: 50 - Auditoria - Evitar que la auditoria sea editable desde pantallas operativas.

## Calidad de codigo

- [ ] REQ-054 - Orden: 54 - Calidad - Revisar que las entidades usen palabras solo en espanol en variables, funciones y archivos.

## Autenticacion y permisos

- [ ] REQ-055 - Orden: 55 - Autenticacion - Crear vista de login para acceder a la aplicacion antes de mostrar el dashboard.
- [ ] REQ-056 - Orden: 56 - Autenticacion - Validar credenciales contra la tabla de usuarios en la base de datos y mantener la sesion activa en el frontend.
- [ ] REQ-057 - Orden: 57 - Usuarios - Crear usuarios base en la base de datos para vendedor, vendedor-call-center y admin; evaluar agregar auditor para consulta separada de auditoria.
- [ ] REQ-058 - Orden: 58 - Permisos - Mostrar solo las vistas permitidas segun el usuario logeado y su rol.
