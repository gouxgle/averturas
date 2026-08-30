# Auditoría de responsive design — claude/aberturas

Auditoría de todo el frontend contra la sección "Convenciones de UI / Responsive" de `CLAUDE.md`, con foco en 375px (iPhone SE) como breakpoint de referencia. Cubre: meta viewport, anchos fijos, `grid-cols` sin variante responsive, tablas/listados sin contención de overflow, sidebars fijas, modales sin `max-h`/`dvh`, touch targets y tamaño de inputs.

Los checkboxes reflejan el estado al momento de escribir este documento (sesión del 2026-08-29/30). Items sin marcar son los que quedaron pendientes o deliberadamente fuera de alcance — el detalle de por qué está en cada ítem.

---

## Meta viewport e infraestructura

**Archivo:** `index.html`

- [x] Meta viewport correcto (`width=device-width, initial-scale=1.0`, sin `maximum-scale`/`user-scalable=no`). Sin acción requerida.

**Archivo:** `src/index.css`

- [x] Red de seguridad global `html, body { overflow-x: hidden; }` ya presente — tapa desbordes puntuales pero no los soluciona; los bugs de abajo siguen siendo reales aunque esta regla los oculte visualmente.

**Archivo:** `src/components/Layout/AppLayout.tsx` / `src/components/Layout/Sidebar.tsx`

- [x] Sidebar off-canvas en mobile (drawer + overlay + botón hamburguesa) funciona correctamente en 375px. Sin bug de layout.
- [x] Redacción de `CLAUDE.md` corregida: la regla decía breakpoint `md:`, la implementación real usa `lg:` — ya alineado en la documentación.

---

## Componentes globales (impacto multiplicado en toda la app)

**Archivo:** `src/components/HelpDrawer.tsx`

- [x] Drawer de ayuda con ancho fijo `w-[440px]` sin `max-w-full`/`max-w-[95vw]` — se salía del viewport en 375px. — **Prioridad: Alta** (visible desde cualquier pantalla).
- [x] `max-h-[Nvh]` → `max-h-[Ndvh]`.

**Archivo:** `src/components/BuzonComentarios.tsx`

- [x] Panel flotante `w-[380px]` sin cap de viewport (380px > 375px). — **Prioridad: Alta** (widget global, visible en casi toda la app).
- [x] `max-h-[75vh]` → `max-h-[75dvh]`.

**Archivo:** `src/components/NotificationBell.tsx`

- [x] Dropdown `w-80` (320px) sin margen de seguridad — cabía justo en 375px pero sin aire. — **Prioridad: Media**.

**Archivo:** `src/components/oportunidades/AccionesContacto.tsx`

- [x] Popover `w-72` sin `max-w-[95vw]`, inconsistente con su componente hermano `AccionesEntrega.tsx` que sí lo tenía. — **Prioridad: Baja** (CRM, uso menos frecuente que Comercial).

---

## Presupuestos — listado

**Archivo:** `src/pages/Presupuestos.tsx`

- [x] Listado con `min-w-[640px]` + `overflow-x-auto` — forzaba scroll horizontal en vez de apilar en tarjeta. Convertido a `grid-cols-1 sm:grid-cols-[...]` con reflow real. — **Prioridad: Alta** (pantalla de uso diario, la más usada del sistema comercial).
- [x] Header de columnas ahora oculto en mobile (`hidden sm:grid`), cada fila es autodescriptiva.
- [x] Botones de acción por fila (WhatsApp, Llamar, Email, Detalle) a 28px → 44px de área táctil en mobile (`w-11 h-11 sm:w-7 sm:h-7`).
- [x] Buscador principal `text-xs` → `text-base sm:text-xs` (evita zoom automático de iOS).
- [x] Grid `grid-cols-3` del resumen de cobranza (en el modal de detalle) — se mantuvo en 3 columnas pero con gap reducido en mobile; son 3 valores numéricos cortos que caben sin apilar.

---

## Remitos — listado

**Archivo:** `src/pages/Remitos.tsx`

- [x] Sidebar fija `w-[280px] shrink-0` sin `w-full` — nunca se apilaba en mobile, dejaba ~95px para el contenido principal. — **Prioridad: Alta**.
- [x] Skeleton de carga con el mismo bug de sidebar, corregido en paralelo.
- [x] Listado con `min-w-[680px]` + `overflow-x-auto` — convertido a `flex-col sm:flex-row` con reflow real por fila. — **Prioridad: Alta** (uso diario).
- [x] Botones de acción por fila (WhatsApp, Ver detalle, Cambiar estado) a 44px de área táctil en mobile.

---

## Recibos — listado

**Archivo:** `src/pages/Recibos.tsx`

- [x] Listado con `min-w-[560px]` + `overflow-x-auto` — convertido a reflow real por fila. — **Prioridad: Alta**.
- [x] Botones de acción (WhatsApp, Imprimir) con área de toque `p-1` (~20px) → `p-2.5 sm:p-1` en mobile.
- [x] Modal "Anular recibo" sin `max-h`/`overflow-y-auto` — agregado, con motivo de anulación (dropdown + texto libre) que puede crecer el contenido.

---

## Pedidos — listado

**Archivo:** `src/pages/Pedidos.tsx`

- [x] Listado con `min-w-[680px]` + `overflow-x-auto` — convertido a reflow real por fila. — **Prioridad: Alta**.
- [x] Botón de detalle por fila y botón de WhatsApp (`WARowButton`) a área táctil de 44px en mobile.

---

## Clientes — listado

**Archivo:** `src/pages/Clientes.tsx`

- [x] Listado con `min-w-[600px]` + `overflow-x-auto` — convertido a reflow real (avatar+nombre agrupados, stats+acciones agrupados). — **Prioridad: Alta** (se usa constantemente para buscar/dar de alta clientes).

---

## Existencias (Stock) — listado

**Archivo:** `src/pages/Stock.tsx`

- [x] Sidebar fija `w-64 shrink-0` sin `w-full` — no se apilaba en mobile. — **Prioridad: Alta**.
- [x] Tabla de ítems de lote (`ProductoRow` expandido) sin `overflow-x-auto` — envuelta.
- [x] Listado principal (`ProductoRow`) convertido al patrón real tarjeta-mobile/tabla-desktop (`sm:hidden` / `hidden sm:grid`), mismo componente y misma fuente de datos, sin duplicar lógica. — **Prioridad: Alta**.
- [x] Bug de desborde horizontal en la tarjeta mobile: `<p className="truncate">` del nombre de producto sin `min-w-0` dentro de una fila flex — el truncado nunca se activaba para nombres largos y la tarjeta se salía del viewport. Corregido (`min-w-0` en el nombre, `flex-wrap` en la línea de código/tipo/color y en el footer de valor+acciones).
- [x] Botones de acción (Ingresar, Egresar, Ajustar, Exhibir en salón, Historial) a área táctil de 44px en mobile.

---

## Proveedores — listado

**Archivo:** `src/pages/Proveedores.tsx`

- [x] Sidebar fija `w-64 shrink-0` sin `w-full`. — **Prioridad: Media** (Catálogo, uso menos frecuente que Comercial).
- [x] Fila de proveedor (`ProveedorRow`) con `min-w-[730px]` — convertida a reflow real con `grid-cols-2 sm:grid-cols-[...]`.
- [x] 5 grillas del modal de alta/edición de proveedor (`grid-cols-3`/`grid-cols-2` sin variante) — corregidas.

---

## Estado de Cuenta Global — listado

**Archivo:** `src/pages/EstadoCuentaGlobal.tsx`

- [x] Sidebar fija `w-64 shrink-0` sin `w-full`. — **Prioridad: Alta**.
- [x] Listado principal con `min-w-[997px]` — el caso más extremo del repo (scroll de ~2.6× el ancho de pantalla en 375px). Convertido a reflow real de 8 → 2 columnas en mobile, header y footer de totales ocultos en mobile con un resumen simplificado propio.
- [x] Modal "Nuevo compromiso de pago" sin `max-h`/`overflow-y-auto` — agregado.
- [x] 3 grillas del modal (`grid-cols-2` sin variante) y grilla de resumen financiero (`grid-cols-3`, gap reducido en mobile) — corregidas.

---

## Formularios comerciales

**Archivo:** `src/pages/NuevaOperacion.tsx`

- [x] 6 grillas sin ninguna variante responsive en toda la página (0% de cobertura). Todas corregidas. — **Prioridad: Alta** (formulario de uso diario).
- [x] Input compartido (`const cls`) en `text-sm` → `text-base sm:text-sm`.

**Archivo:** `src/pages/NuevoCliente.tsx`

- [x] 10 grillas sin variante responsive (inconsistente con otras secciones del mismo archivo que sí eran responsive). Todas corregidas. — **Prioridad: Alta**.
- [x] Input compartido (`const inp`) en `text-sm` → `text-base sm:text-sm`.

**Archivo:** `src/pages/NuevoRecibo.tsx`

- [x] 3 grillas sin variante (radio pago total/parcial, compromiso de cancelación, resumen de operación). Corregidas. — **Prioridad: Alta**.
- [x] Input compartido (`const inputCls`) y campo "Otro %" en `text-xs`/`text-sm` → `text-base` en mobile.

**Archivo:** `src/pages/NuevoPedido.tsx`

- [x] 2 grillas sin variante (ítem no cubierto, fecha y notas). Corregidas. — **Prioridad: Alta**.

**Archivo:** `src/pages/NuevoRemito.tsx`

- [x] Fila de edición de ítem en `grid-cols-12` con `col-span-2/3/5/7` **sin ningún breakpoint** — en 375px daba celdas de ~50px, inputs inutilizables. Era el hallazgo de mayor severidad real del repo por afectar directamente la carga de datos. Corregido con `grid-cols-1 sm:grid-cols-12` / `grid-cols-2 sm:grid-cols-12` y `sm:col-span-*`. — **Prioridad: Alta**.
- [x] 5 inputs de la fila de ítem (buscador de producto, descripción, cantidad, precio, notas) en `text-xs` → `text-base sm:text-xs`.

**Archivo:** `src/pages/NuevoProducto.tsx`

- [x] **25 grillas sin variante responsive — el peor caso de todo el repo**, en el formulario más largo del sistema (identificación, estructura, apertura, cerradura, medidas, precios, promociones). Todas corregidas. — **Prioridad: Alta** (Catálogo, pero es la pantalla de carga de producto más compleja).
- [x] Input compartido (`const inputCls`) en `text-sm` → `text-base sm:text-sm`.

**Archivo:** `src/pages/NuevoPresupuesto.tsx`

- [x] Grilla del buscador de productos (`grid-cols-3`) sin variante — corregida a `grid-cols-2 sm:grid-cols-3`.
- [x] Input del buscador de productos en `text-xs` → `text-base sm:text-xs`.
- [ ] **Layout de 3 columnas desktop-only** (`h-screen overflow-hidden` + `grid-cols-1 lg:grid-cols-[340px_1fr_240px] xl:grid-cols-[420px_1fr_280px]`) — colapsa a 1 columna en mobile sin un modelo de interacción repensado (pasos/tabs vs. scroll único). **Deliberadamente fuera de alcance de esta auditoría** — necesita rediseño de UX, no solo clases responsive. — **Prioridad: Alta** (queda como tarea aparte).
- [ ] Carrito de ítems con `min-w-[450px]` + `overflow-x-auto` — trade-off consciente ya documentado en el propio código (comentario explícito), ligado al punto anterior.

---

## Vistas públicas (clientes finales, sin login)

**Archivo:** `src/pages/VistaPublicaPresupuesto.tsx`

- [x] 2 grillas sin variante (opciones "qué querés cambiar" y "por qué no vas a avanzar"). Corregidas. — **Prioridad: Alta** (la ve el cliente final en su celular, vía WhatsApp).
- [x] `max-h-[85vh]` del modal de Términos y Condiciones → `dvh`.

**Archivo:** `src/pages/VistaPublicaRemito.tsx`

- [x] Tabla de ítems (8 columnas, estilos inline) evaluada — **se decide dejar el scroll horizontal actual**, no convertir al patrón tarjeta/tabla: es una tabla de confirmación de recepción, de uso puntual y corto por remito, con scroll funcional (no rota ni recorta contenido). Documentado como decisión consciente, no como pendiente. — **Prioridad: Baja**.

---

## Modales de acción rápida

**Archivo:** `src/pages/CRM.tsx`

- [x] Modal "Nuevo Lead": sin `max-h`/`overflow-y-auto` (agregado) + 2 grillas sin variante (corregidas).
- [x] Modal "Mover etapa": sin `max-h`/`overflow-y-auto` (agregado).

**Archivo:** `src/components/oportunidades/ModalOportunidad.tsx`

- [x] `max-h-[90vh]` → `max-h-[90dvh]`.
- [ ] Grilla `grid-cols-3` del selector "Nivel de interés" — detectada en la auditoría inicial, **no se tocó** (3 botones cortos, riesgo bajo, no llegó a priorizarse dentro de las 7 etapas ejecutadas). — **Prioridad: Baja**.

**Archivo:** `src/components/remitos/ModalProgramarEntrega.tsx`

- [x] `max-h-[90vh]` → `max-h-[90dvh]`.
- [x] Input compartido (`const inp`) en `text-sm` → `text-base sm:text-sm`.
- [ ] Grilla `grid-cols-2` de campos de fecha — detectada, no se tocó (bajo impacto). — **Prioridad: Baja**.

**Archivo:** `src/components/productos/ModalRenovarValidezPrecios.tsx`

- [x] `max-h-[85vh]` → `max-h-[85dvh]`.

**Otros modales sin `max-h`/`overflow-y-auto` en general** (`NuevoCliente.tsx`, `ProveedorPrecios.tsx` ×2, `NuevoPresupuesto.tsx` ×2, `NuevoPedido.tsx`, `Remitos.tsx` ×2, `Productos.tsx` ×2, `ModalAjusteStock.tsx`, `TarjetaProductoMosaico.tsx`, `PDFDialog.tsx` ×2):

- [ ] No llegaron a auditarse/corregirse uno por uno — son diálogos de confirmación o formularios cortos donde hoy no truncan contenido, pero ninguno tiene la red de seguridad `max-h-[90dvh] overflow-y-auto` que pide `CLAUDE.md`. — **Prioridad: Baja** (riesgo latente, no un bug visible hoy).

---

## Tablas críticas sin contención de overflow

**Archivo:** `src/pages/ProveedorPrecios.tsx`

- [x] Modal "Actualizar precios" paso 2 (diff, 7 columnas) sin ningún `overflow-x-auto` — corregido.
- [x] Modal "Importar CSV" preview (3 columnas) sin contención — corregido.

**Archivo:** `src/pages/VisitasTecnicas.tsx`

- [x] Listado principal (7 columnas) con `overflow-hidden` en el ancestro — **recortaba contenido en vez de dar scroll**, el más severo de los 5 casos críticos porque ocultaba datos sin avisar. Corregido con wrapper `overflow-x-auto` propio. — **Prioridad: Alta**.

**Archivo:** `src/pages/Stock.tsx`

- [x] Tabla de ítems de lote (detalle expandido, 6 columnas) sin contención — corregida.

**Archivo:** `src/pages/EstadoCuenta.tsx`

- [x] Tabla de ítems en acordeón (3 columnas, riesgo menor) — envuelta en `overflow-x-auto` como red de seguridad.

---

## Catálogo/Sistema — grillas menores

**Archivo:** `src/pages/Reportes.tsx`

- [x] `grid-cols-5` fijo de los "5 bloques sectoriales" (nunca colapsaba) — corregido a `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
- [x] `grid-cols-4` del skeleton de rankings — corregido.
- [x] `grid-cols-2` del resumen de descuentos — corregido.

**Archivo:** `src/pages/Configuracion.tsx`

- [ ] 2 inputs compartidos (`const inputCls`) en `text-sm`, no llegaron a subirse a `text-base` en mobile — quedó fuera del alcance de la Etapa 5 (se priorizaron formularios de Comercial/Catálogo, Configuración es Sistema, uso menos frecuente). — **Prioridad: Baja**.
- [ ] Patrón `p-1`/`p-1.5` en botones de acción de listas anidadas (categorías, tipos) — es el archivo con más repeticiones absolutas de este patrón en todo el repo, pero de uso poco frecuente. No se tocó. — **Prioridad: Baja**.

**Archivo:** `src/pages/Login.tsx`

- [ ] Input compartido (`const inputCls`) en `text-sm` — no se tocó (pantalla de un solo uso por sesión, prioridad mínima). — **Prioridad: Baja**.

---

## Touch targets — patrón general

**Archivos:** `src/pages/Presupuestos.tsx`, `src/pages/Remitos.tsx`, `src/pages/Pedidos.tsx`, `src/pages/Recibos.tsx`, `src/pages/Stock.tsx`

- [x] Botones de acción por fila en las 5 pantallas de mayor uso diario, subidos a área táctil de 44px **solo en mobile** (`sm:` revierte al tamaño de escritorio original) — decisión explícita del usuario de no tocar la densidad visual de desktop.

**Resto del repo** (~918 íconos `size={11}`–`size={17}` en botones chicos, `w-7 h-7`/`w-8 h-8` fuera de las 5 pantallas de arriba, concentrados sobre todo en `Configuracion.tsx`):

- [ ] No se tocaron — quedan con área de toque por debajo de 44px. Es un patrón muy extendido en todo el repo; subirlo en todos lados requeriría otra pasada dedicada. — **Prioridad: Baja/Media según pantalla** (baja en Configuración/Reportes, media en cualquier listado secundario no cubierto arriba).

---

## Tamaño de inputs — patrón general

- [x] 7 `const inp`/`cls`/`inputCls` compartidos identificados y corregidos: `NuevoRecibo.tsx`, `NuevoCliente.tsx`, `NuevoProducto.tsx`, `NuevaOperacion.tsx`, `CRM.tsx`, `ModalOportunidad.tsx`, `ModalProgramarEntrega.tsx`.
- [x] Campos sueltos en `text-xs` en flujos de carga real (no solo buscadores): `NuevoRemito.tsx` (5 campos), `NuevoRecibo.tsx` (% de recibo), `NuevoPresupuesto.tsx` (buscador), `Presupuestos.tsx` (buscador principal).
- [ ] `Configuracion.tsx` (2 ocurrencias) y `Login.tsx` (1) quedaron sin tocar — ver secciones de arriba.
- [ ] El estándar de facto del proyecto (`text-sm`, 14px) sigue siendo la base en **todos los inputs que no pasan por un `const inp`/`cls` con nombre** — no se hizo un barrido exhaustivo de cada `<input>` suelto del repo, solo de los puntos de mayor tráfico. Cualquier input nuevo que se agregue copiando un patrón existente puede seguir naciendo en `text-sm`. — **Prioridad: Media** (deuda de convención, no un bug puntual).
