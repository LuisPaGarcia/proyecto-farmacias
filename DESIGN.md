# DESIGN.md - Farmacias Alejandro

## Contexto

- Tipo de artefacto: SaaS app / dashboard operativo.
- Posicionamiento: utilitario, empresarial, claro.
- Audiencia: administradores, auditores, operadores de sucursal y futuros operadores de call center.
- Accion primaria: consultar el estado operativo y financiero, detectar problemas y avanzar hacia modulos de control.
- Adjetivos: confiable, denso, sobrio, auditable.
- Traducciones visuales:
  - Confiable: componentes Bootstrap reconocibles, jerarquia clara, estados visibles.
  - Denso: tablas, listas y metricas compactas, sin composicion de landing page.
  - Sobrio: pocos colores, bordes definidos, sin decoracion innecesaria.
  - Auditable: labels explicitos, fechas, estados, totales y acciones trazables.
- Esencia visual: operativo, sanitario, contable.
- Propuesta unica: una consola administrativa que muestra inventario, caja, entregas y auditoria sin distraccion.
- Modo: claro primero.
- Densidad: media-alta.
- Restricciones: React, Vite, SQLite/D1, Cloudflare Workers, Bootstrap 5.3.8 por CDN, sin Next.js.

## Bootstrap primero

El proyecto debe usar Bootstrap como sistema base de CSS. La meta es no escribir CSS propio salvo que sea realmente necesario.

Incluir Bootstrap en `index.html` con:

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.min.css" rel="stylesheet">
```

Reglas:

- Usar clases Bootstrap antes que clases personalizadas: `container-fluid`, `row`, `col-*`, `d-flex`, `gap-*`, `p-*`, `m-*`, `table`, `card`, `btn`, `badge`, `alert`, `navbar`, `offcanvas`, `modal`, `form-control`, `form-select`, `input-group`, `list-group`, `breadcrumb`, `spinner-border`.
- Preferir utilidades Bootstrap para layout, espaciado, color, display, alineacion, bordes y responsive.
- No crear CSS para resolver algo que Bootstrap ya resuelve.
- No agregar librerias de CSS ni frameworks adicionales.
- Si hace falta CSS propio, debe ser pequeno, justificado y centralizado.
- Evitar estilos inline salvo valores dinamicos inevitables desde React.
- No usar CSS propio para crear una identidad visual compleja. La identidad debe salir de composicion, contenido, iconos, tablas, estados y uso consistente de Bootstrap.

## Politica de CSS propio

CSS propio permitido solo para:

- Variables minimas de marca si Bootstrap no cubre el tono requerido.
- Ajustes de foco o accesibilidad que Bootstrap no cubra bien en un componente concreto.
- Casos puntuales de layout que no puedan lograrse con grid/flex/utilities de Bootstrap.
- Overrides muy acotados para imprimir, tablas densas o estados operativos criticos.

CSS propio no permitido para:

- Reimplementar `card`, `button`, `table`, `form`, `badge`, `alert`, `modal`, `navbar` u otros componentes Bootstrap.
- Crear sistemas paralelos de spacing, sombras, radios o colores.
- Usar gradientes decorativos, glassmorphism, blobs, orbes, sombras difusas o efectos visuales de landing page.
- Crear clases por cada componente cuando una combinacion de Bootstrap basta.

Convencion de archivos:

- `src/styles.css` debe mantenerse pequeno.
- Antes de agregar una regla a `src/styles.css`, documentar en comentario breve por que Bootstrap no fue suficiente.
- Si una regla deja de ser necesaria, eliminarla en la misma tarea.
- Los componentes React deben mostrar primero clases Bootstrap y solo despues clases propias excepcionales.

## Sistema visual

- Direccion: dashboard administrativo de alta legibilidad basado en Bootstrap.
- Rasgo central: navegacion lateral o superior simple, metricas operativas visibles arriba y modulos con estados claros.
- Movimiento distintivo: indicadores de estado y tablas auditables, no decoracion.
- Componentes base: Bootstrap nativo.
- Iconos: preferir Bootstrap Icons si se instala o iconos simples de texto solo cuando no exista dependencia de iconos.
- Modo: claro.
- Densidad: media-alta.

## Tipografia

- Fuente base recomendada: Bootstrap default system font stack para reducir CSS y dependencias.
- Display: usar clases Bootstrap de encabezado, por ejemplo `h1`, `h2`, `h3`, `display-*` solo si la pantalla lo necesita.
- Body: usar estilos Bootstrap por defecto.
- Numeros: usar `font-monospace` o una clase excepcional solo en metricas financieras, conteos y tablas de auditoria si mejora la lectura.
- Escala: seguir la escala Bootstrap antes de definir tamanos propios.
- Tracking: mantener `letter-spacing: 0` salvo textos pequenos tipo etiqueta donde Bootstrap no alcance.

## Color

- Estrategia: Bootstrap con verde sanitario como color principal y amarillo/ambar como advertencia operativa.
- Distribucion: 60 neutral / 30 verde marca / 10 acento de atencion.
- Tokens conceptuales:
  - Fondo: `bg-light` o `bg-body-tertiary`.
  - Superficie: `bg-body`, `card`, `list-group`, `table`.
  - Texto: `text-body`, `text-secondary`, `text-muted`.
  - Marca: `text-success`, `bg-success`, `btn-success`.
  - Atencion: `text-warning`, `bg-warning`, `alert-warning`.
  - Error: `text-danger`, `bg-danger`, `alert-danger`.
  - Informacion: `text-info`, `alert-info` solo para datos auxiliares.
- No introducir paletas extensas si los semantic colors de Bootstrap son suficientes.
- Si se agregan variables de marca, usar pocas y mantener equivalentes claros con Bootstrap.

## Spacing, radio y sombra

- Spacing: usar escala Bootstrap `g-*`, `gap-*`, `p-*`, `px-*`, `py-*`, `m-*`, `mb-*`.
- Radius: usar `rounded`, `rounded-1`, `rounded-2` y evitar radios grandes.
- Shadow: evitar sombras por defecto. Usar bordes Bootstrap (`border`, `border-top`, `border-bottom`) para paneles operativos.
- Cards: radio moderado, borde visible, contenido compacto.
- No anidar cards dentro de cards.

## Layout y composicion

- Grid: Bootstrap grid con `container-fluid`, `row`, `col-12`, `col-md-*`, `col-xl-*`.
- Dashboard: metricas arriba, contenido operativo debajo, navegacion persistente.
- Tablas: prioridad alta para inventario, caja, transferencias, planilla, activos y auditoria.
- Escaneo: lectura tipo F, titulos cortos, estados visibles y numeros alineados.
- Responsive: mobile-first usando breakpoints Bootstrap.
- Pantallas operativas no deben parecer landing pages. Evitar hero, secciones promocionales y tarjetas decorativas.

## Componentes y estados

- Botones:
  - Primario: `btn btn-success`.
  - Secundario: `btn btn-outline-secondary`.
  - Terciario: `btn btn-link` o `btn btn-sm btn-outline-*`.
  - Estados: usar disabled real, spinners Bootstrap para loading y focus visible nativo.
- Formularios:
  - Usar `form-label`, `form-control`, `form-select`, `form-text`, `invalid-feedback`.
  - Validar sin borrar lo ingresado por el usuario.
  - Campos monetarios y cantidades deben tener labels explicitos.
- Tablas:
  - Usar `table`, `table-sm`, `table-hover`, `align-middle`, `table-responsive`.
  - Texto alineado a la izquierda.
  - Numeros, cantidades y moneda alineados a la derecha.
  - Estados con `badge` mas texto, no solo color.
- Alertas:
  - Usar `alert-success`, `alert-warning`, `alert-danger`, `alert-info`.
  - Mensajes concretos con accion siguiente cuando aplique.
- Badges:
  - Estados operativos: `badge text-bg-success`, `text-bg-warning`, `text-bg-danger`, `text-bg-secondary`.
  - No usar badges como botones.
- Empty/loading/error:
  - Loading: `spinner-border` y texto breve.
  - Empty: mensaje directo y boton de accion si corresponde.
  - Error: `alert-danger` con detalle util y opcion de reintentar.

## Motion

- Usar transiciones Bootstrap nativas para collapse, modal, offcanvas y dropdown.
- No agregar animaciones propias salvo una necesidad funcional.
- Si se agrega motion propio, limitar a opacity/transform y respetar `prefers-reduced-motion`.
- Duracion maxima recomendada: 200ms para microinteracciones, 300ms para overlays.

## Iconografia

- Si se requiere iconografia, preferir Bootstrap Icons para mantener coherencia con Bootstrap.
- Iconos dentro de botones solo cuando mejoren reconocimiento: guardar, editar, eliminar, buscar, filtrar, descargar.
- Todo icono sin texto debe tener `aria-label` o texto accesible.

## Imagenes e ilustracion

- Esta aplicacion no necesita hero ni imagenes decorativas.
- Usar imagenes solo cuando representen medicamentos, sucursales, comprobantes, mapas, documentos o activos reales.
- Evitar stock generico, personas mirando laptops, ilustraciones corporativas y graficos decorativos.

## Accesibilidad

- Mantener foco visible nativo de Bootstrap.
- Targets interactivos preferidos: 44px de alto cuando el contexto lo permita.
- No comunicar estados solo por color. Acompanar con texto, icono o label.
- Formularios siempre con label visible.
- Tablas con encabezados claros.
- Modales y offcanvas deben cerrar con teclado y devolver foco al disparador.
- Contraste objetivo: WCAG AA.

## Tokens

El adapter visual es Bootstrap 5.3.8 por CDN. No se deben crear tokens CSS completos mientras Bootstrap cubra el caso.

Tokens conceptuales del producto:

```text
brand-primary: Bootstrap success
brand-accent: Bootstrap warning
state-ok: Bootstrap success
state-warning: Bootstrap warning
state-error: Bootstrap danger
surface: Bootstrap body/card/table
border: Bootstrap border
spacing: Bootstrap spacing utilities
radius: Bootstrap rounded utilities
```

Si en el futuro se requiere personalizar Bootstrap, hacerlo en una tarea separada y documentar:

- problema visual concreto;
- por que Bootstrap CDN no basta;
- variable o clase minima agregada;
- componente afectado;
- prueba visual realizada.

## Checklist antes de escribir CSS

Antes de agregar CSS propio, responder:

- Se puede resolver con clases Bootstrap?
- Se puede resolver con markup mas simple?
- Es un requisito funcional o solo preferencia visual?
- Afecta varias pantallas o solo un caso aislado?
- La regla puede vivir como utilidad Bootstrap existente?
- La regla conserva accesibilidad y responsive?

Si la respuesta a la primera pregunta es si, no escribir CSS.

## Auditoria de slop

- Fecha: 2026-09-03.
- Resultado: pass actualizado.
- Notas: se establece Bootstrap como sistema base, se elimina la expectativa de un sistema CSS paralelo, se evita landing page generica y se priorizan pantallas operativas densas.

## Changelog

- 2026-09-03: Se actualizo el archivo para fijar Bootstrap 5.3.8 por CDN como adapter principal y documentar la meta de no escribir CSS salvo excepciones justificadas.
