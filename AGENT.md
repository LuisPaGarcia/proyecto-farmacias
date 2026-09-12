# AGENT.md - Convenciones del proyecto

Estas instrucciones aplican a las tareas de implementacion dentro de este repositorio.

## Orden de trabajo

- Usar `requerimientos.md` como fuente principal para decidir la siguiente vista, API o validacion pendiente.
- Respetar el campo `Orden` de cada requerimiento antes de avanzar a otro modulo.
- Marcar un requerimiento como completado solo cuando la vista/API funcione y haya sido verificada localmente.
- Mantener la arquitectura simple: React, Vite, API REST sencilla, SQLite/D1 y Cloudflare Workers.
- Usar nombres de archivos y variables en espanol para nuevas vistas y codigo de dominio. Mantener sin traducir APIs tecnicas del lenguaje, navegador, React, Bootstrap o librerias (`useState`, `fetch`, `method`, `value`, `form-control`, etc.).
- Cuando el usuario pida la misma preferencia o ajuste varias veces y se vea como un patron del proyecto, actualizar este `AGENT.md` para convertirlo en una convencion explicita.

## Diseno y CSS

- Seguir `DESIGN.md` como guia visual del proyecto.
- Usar Bootstrap 5.3.8 por CDN como sistema base.
- No escribir CSS propio salvo que sea necesario y no pueda resolverse con Bootstrap.
- Si se agrega CSS propio, debe ser pequeno, justificado con comentario y centralizado en `src/styles.css`.
- Preferir clases Bootstrap para layout, formularios, tablas, botones, alertas, badges, estados y responsive.

## Patron para vistas de mantenimiento

Todas las vistas de mantenimiento deben seguir el mismo flujo base:

1. Vista de lista.
   - Al hacer click en el modulo desde la navegacion, mostrar primero la lista.
   - La lista debe permitir escanear registros con tabla o lista compacta.
   - Cada registro debe tener una accion clara para abrir su detalle.
   - Debe existir un estado de carga, error y lista vacia.

2. Vista de creacion.
   - Mostrar un boton `Nuevo/Nueva [entidad]` arriba de la lista.
   - Al hacer click, abrir el formulario vacio y listo para ser llenado.
   - El formulario debe validar obligatorios sin borrar lo ingresado.
   - Al guardar correctamente, volver a la lista y recargar los registros.
   - Debe existir un boton para volver/cancelar y regresar a la lista.

3. Vista de detalle.
   - Al hacer click en un registro, mostrar un resumen legible de la entidad.
   - Incluir un boton `Volver a lista`.
   - Incluir un boton `Editar` cuando la entidad sea editable.
   - Las acciones destructivas deben vivir en el detalle, no en la lista.

4. Vista de edicion.
   - La edicion usa el mismo formulario de creacion, cargado con los datos actuales.
   - Mostrar claramente que se esta editando un registro existente.
   - Al guardar correctamente, volver a la lista y recargar los registros.
   - Eliminar solo debe mostrarse cuando se edita o consulta un registro existente, nunca en creacion.

## Acciones destructivas y estados

- Mantener `Eliminar` como accion destructiva principal solo cuando exista endpoint y caso funcional claro.
- No agregar acciones de `Desactivar`, `Inactivar` o cambios de estado similares salvo que el requerimiento lo pida explicitamente.
- Si una entidad tiene estados operativos, mostrarlos como `badge` con texto; no depender solo del color.
- Confirmar acciones destructivas con `window.confirm` o un patron Bootstrap equivalente antes de llamar la API.
- Si la API rechaza una eliminacion por relaciones existentes, mostrar un mensaje util y conservar la vista actual.

## Formularios dependientes

- Cuando un campo dependa de otro, el campo dependiente debe permanecer deshabilitado hasta que el campo padre tenga valor.
- Al cambiar el campo padre, limpiar el campo dependiente para evitar combinaciones invalidas.
- Usar fuentes de datos existentes del proyecto para catalogos y constantes antes de crear datos duplicados.
- Ejemplo actual: en sucursales, primero se elige departamento y luego municipio usando `constantes/departamentos.json` y `constantes/municipios.json`.

## APIs REST

- Mantener endpoints REST simples y consistentes:
  - `GET /api/[entidad]` para listar.
  - `POST /api/[entidad]` para crear.
  - `GET /api/[entidad]/:id` para consultar detalle cuando haga falta.
  - `PUT /api/[entidad]/:id` para actualizar.
  - `DELETE /api/[entidad]/:id` para eliminar cuando sea permitido.
- Validar payloads en la API antes de escribir en la base de datos.
- Devolver errores JSON con mensajes utiles para mostrar en la interfaz.
- No exponer campos editables en la API si el usuario no debe modificarlos desde mantenimiento.

## Navegacion y estado

- Cada modulo de mantenimiento debe tener un estado interno equivalente a `list`, `form` y `detail`.
- Entrar al modulo desde la navegacion debe resetear seleccion, formulario y errores, y mostrar `list`.
- Guardar exitosamente debe recargar datos y volver a `list`.
- Cancelar o volver debe limpiar errores de formulario/accion.
- Evitar abrir detalle y formulario al mismo tiempo.

## Verificacion minima

- Ejecutar `npm run build` antes de cerrar cambios de frontend o API.
- Ejecutar `node --check src/worker.js` cuando se cambie la API del worker.
- Revisar que no se haya agregado CSS innecesario.
- Validar manualmente el flujo principal de la vista tocada: lista, nuevo, guardar, detalle, editar, guardar, eliminar si aplica.

## Indicaciones extras

- Nunca crees la sección `Resumen de *` para las tablas con la suma de los registros. Esto no es necesario.
- El código de cada entidad debe ser con un prefijo del nombre de la entidad y luego un número. Por ejemplo, para sucursales tenemos SUC-001. Este debe ser creado automáticamente, no esperar a que el usuario lo agregue.
