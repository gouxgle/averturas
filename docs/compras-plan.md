# Módulo Compras y Proveedores — evolución de "Pedidos al proveedor"

> **Estado (2026-09-22): Etapa 1 IMPLEMENTADA y deployada a test** (aprobada por el usuario
> el 2026-09-21). Etapas 2 y 3 pendientes; arrancar cada una desde este plan. Resumen
> ejecutivo: https://claude.ai/artifact/Mfzm55KzNmeRSaNBHBxmZt. Desvíos de la etapa 1 respecto
> al plan: `registrarDoc`/`compras_documentos` quedan para la etapa 3 (los adjuntos van en el
> JSONB de cada fila); se agregaron `compras_solicitud_items.costo_referencia`/`proveedor_sku`
> y `compras_cotizacion_proveedores.iva_pct`; los PDFs de PC/OC se abren por `GET .../pdf`
> (fetch con token → blob) y hay `GET .../mensaje` para previsualizar el texto antes de enviar.
>
> Original en `~/.claude/plans/snazzy-dreaming-lobster.md`; este archivo es la copia versionada.

## Contexto

Hoy "Pedidos al proveedor" es un solo salto: de la venta al `PED-` y de ahí a un
"recibido" todo-o-nada que ingresa stock. No hay solicitud previa, no se cotiza a
varios proveedores, no se compara, la recepción no es por ítem ni parcial, no existen
reclamos, no hay documentos adjuntos, y la deuda con el proveedor es un número que se
tipea a mano (`proveedores.deuda_actual`). El usuario quiere reconstruir la historia
completa de cada compra: necesidad → cotización → proveedor elegido → OC → recepción →
reclamos → facturas → pagos → saldo, para aberturas estándar y a medida, perfiles,
vidrios y herrajes.

Hallazgo que define la arquitectura: **`pedidos`/`pedido_items` ya es un esqueleto de
orden de compra** (proveedor, ítems con costo, fecha estimada, recepción que ingresa
stock, `operacion_item_id` por línea para la cobertura). No se renombra ni se migra: **la
OC del módulo nuevo ES la tabla `pedidos` extendida**. Así el kanban de Operaciones, la
cobertura (`lib/coverage.ts`), remitos, dashboard y Presupuestos siguen funcionando sin
tocarlos. Los `PED-` existentes quedan como OC históricas; las nuevas se numeran `OC-`.

Decisiones tomadas con el usuario (2026-09-19):
- **Una OC puede agrupar solicitudes de varios clientes** al mismo proveedor; cada ítem
  sabe de qué solicitud/cliente viene; el flete se prorratea por monto (calculado, no
  guardado); cancelar un ítem no cancela la OC.
- **Precios neto + IVA % por línea; se compara y se registra en cuenta corriente por
  total final** (neto − descuento + IVA + flete).
- **Orden de entrega: 1) SC → PC → comparar → OC; 2) envío/confirmación, seguimiento,
  recepción por ítem, reclamos; 3) documentos, control económico, cuenta corriente,
  pagos, estado de cuenta, cierre por 4 estados.** Cada etapa se deploya a test sola y
  deja el módulo usable.
- Del diseño previo (`docs/pedidos-rediseno-pendiente.md`) quedan **descartadas** para
  esta versión: cola automática por proveedor, "aprender precio al recibir", parser de
  texto de WhatsApp, historial de `proveedor_precios`. La comparación de precios la hace
  la cotización (PC), no la lista de precios.

Principio de UI acordado: **los pasos complejos aparecen solo cuando ocurren.** Una compra
normal es: SC (o directo desde la venta) → OC → recibir → pagar. Reclamos, diferencias de
precio y seguimiento por demora son paneles que se abren únicamente al marcar un ítem con
problema, al cargar una factura que no coincide, o al vencer la fecha prometida.

Convenciones del proyecto que se respetan en todo el módulo: numeración
`XX-YYYYMM-NNNN` con `MAX(SUBSTRING(numero FROM '(\d+)$')::int)+1` dentro de la
transacción (copiar `nextNumeroRecibo` de `server/src/routes/recibos.ts:90-98`); adjuntos
como `JSONB` array de URLs en la fila + upload `sharp → webp` (copiar
`POST /visitas-tecnicas/upload-imagen`, la variante robusta a fotos de Android); Zod en
`server/src/lib/schemas.ts` + tests en `server/src/__tests__/schemas.test.ts`; rutas
específicas antes de `/:id`; `registrarActividad()` en cada acción; changelog por etapa;
`data-section="pedidos"` (se reutilizan los tokens CSS existentes, cambia solo la etiqueta).

---

## Modelo de datos (todas las etapas, para que la etapa 1 no deje huecos)

Tablas nuevas con prefijo `compras_`. Cada migración termina con su `INSERT INTO
schema_migrations`. Tipos como `TEXT CHECK (...)` (patrón del repo), no enums de Postgres.

### Etapa 1

**`compras_solicitudes`** (`SC-YYYYMM-NNNN`)
`id, numero UNIQUE, origen CHECK (venta|proforma|orden_trabajo|reposicion_stock|
produccion_propia|faltante|garantia|reposicion_falla), operacion_id?, visita_tecnica_id?,
cliente_id?, obra TEXT?, tipo_producto CHECK (abertura_estandar|abertura_medida|perfil|
vidrio|herraje_accesorio|otro), fecha_necesaria DATE?, observaciones, adjuntos JSONB '[]',
estado CHECK (abierta|en_cotizacion|con_oc|cerrada|cancelada) DEFAULT 'abierta',
proveedor_sugerido_id?, created_by, created_at, updated_at`.

**`compras_solicitud_items`**
`id, solicitud_id FK CASCADE, orden, operacion_item_id?, visita_tecnica_item_id?,
producto_id?, descripcion NOT NULL, cantidad NUMERIC(10,2) > 0, unidad TEXT DEFAULT 'u'
(u|m|m2|kg), especificaciones JSONB '{}', adjuntos JSONB '[]', observaciones,
estado CHECK (pendiente|en_cotizacion|comprado|cancelado) DEFAULT 'pendiente'`.
`especificaciones` es la ficha técnica normalizada, con claves por `tipo_producto`:
- abertura (estándar o a medida): `ancho_m, alto_m, sistema, color, vidrio, apertura,
  herrajes, mosquitero (bool), accesorios[], premarco (bool), observaciones`.
- perfil: `codigo, descripcion, color, largo_mm, cantidad_barras`.
- vidrio: `tipo, espesor_mm, ancho_mm, alto_mm, cantidad`.
- herraje/accesorio: `codigo, marca, descripcion`.
Se rellena automáticamente desde el origen (ver "Autocompletado" abajo).

**`compras_cotizaciones`** (`PC-YYYYMM-NNNN`)
`id, numero UNIQUE, solicitud_id FK, estado CHECK (abierta|adjudicada|no_concretada|
cancelada), motivo_cierre TEXT?, fecha_limite DATE?, observaciones, adjuntos JSONB,
adjudicada_a_id? (→ compras_cotizacion_proveedores), created_by, created_at, updated_at`.
Los ítems de la PC son los de la SC (no se duplican): `compras_cotizacion_items`
`(cotizacion_id, solicitud_item_id, cantidad)` para permitir cotizar un subconjunto.

**`compras_cotizacion_proveedores`** — una fila por proveedor invitado
`id, cotizacion_id FK CASCADE, proveedor_id FK, enviada_at?, enviada_medio CHECK
(whatsapp|email|manual)?, contacto TEXT?, respondida_at?, estado CHECK (pendiente|
enviada|respondida|sin_respuesta|seleccionada|descartada), subtotal_neto NUMERIC(14,2),
descuento_monto, iva_monto, flete NUMERIC(12,2) DEFAULT 0, total NUMERIC(14,2)
(calculado y guardado), plazo_dias INT?, disponibilidad CHECK (inmediata|a_fabricar|
parcial|sin_stock)?, forma_pago TEXT?, validez_hasta DATE?, observaciones, archivo_url
(la cotización del proveedor), adjuntos JSONB, UNIQUE (cotizacion_id, proveedor_id)`.

**`compras_cotizacion_respuesta_items`** — precio por ítem (opcional)
`id, cotizacion_proveedor_id FK CASCADE, solicitud_item_id FK, precio_unitario_neto,
descuento_pct DEFAULT 0, iva_pct DEFAULT 21, plazo_dias?, disponibilidad?, observaciones`.
Si el proveedor pasa un solo total, se cargan solo los campos de cabecera; si pasa precios
por ítem, la cabecera se recalcula sola. La OC toma precios por ítem si existen; si no,
prorratea el total neto por cantidad × costo de referencia.

**`pedidos` (OC) — columnas nuevas** (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`)
`solicitud_id?, cotizacion_id?, cotizacion_proveedor_id?, es_consolidada BOOL DEFAULT
false, subtotal_neto, descuento_monto, iva_monto, total (= subtotal_neto − descuento +
iva + costo_envio; `monto_total` queda como espejo de `total` para los lectores actuales),
forma_pago TEXT?, contacto_proveedor TEXT?, enviada_at?, enviada_medio?, adjuntos JSONB,
confirmacion_recepcion_at?, confirmacion_precio BOOL?, confirmacion_caracteristicas BOOL?,
fecha_prometida DATE?, estado_logistica CHECK (borrador|enviada|confirmada|
en_preparacion|en_fabricacion|terminado|listo_despacho|en_transito|demorado|
recibida_parcial|recibida|cerrada|cancelada) DEFAULT 'borrador', estado_calidad CHECK
(sin_reclamos|reclamo_pendiente|resuelto) DEFAULT 'sin_reclamos', estado_finanzas CHECK
(sin_factura|pendiente|pago_parcial|pagada|con_credito) DEFAULT 'sin_factura',
estado_docs CHECK (incompleta|completa) DEFAULT 'incompleta', cerrada_totalmente_at?`.
**`estado` (legacy) se mantiene y se deriva** en cada escritura: borrador→`pendiente`,
enviada..demorado→`enviado`, recibida_parcial→`enviado` (para la cobertura sigue "en
pedido"), recibida/cerrada→`recibido`, cancelada→`cancelado`. Una función
`sincronizarEstadoLegacy(client, pedidoId)` en `server/src/lib/compras.ts` es el único
lugar que lo escribe. Backfill: `estado_logistica` desde `estado`.

**`pedido_items` — columnas nuevas**
`solicitud_item_id?, especificaciones JSONB '{}', unidad DEFAULT 'u', proveedor_sku?,
precio_unitario_neto (backfill = costo_unitario; `costo_unitario` queda como espejo del
neto para el ingreso a stock), descuento_pct DEFAULT 0, iva_pct DEFAULT 21,
cantidad_recibida NUMERIC DEFAULT 0, cantidad_conforme DEFAULT 0, cantidad_problema
DEFAULT 0, estado_item CHECK (pendiente|parcial|recibido|cancelado) DEFAULT 'pendiente'`.
`cantidad` pasa a `NUMERIC(10,2)` (perfiles en metros). `operacion_item_id` se sigue
copiando desde la SC para que `coverage.ts` no cambie.

### Etapa 2

**`compras_seguimientos`** — bitácora de la OC
`id, pedido_id FK CASCADE, fecha DATE, tipo CHECK (envio|confirmacion|estado|seguimiento|
demora|nota), estado_logistica_nuevo?, respuesta_proveedor, nueva_fecha_prometida DATE?,
observaciones, created_by, created_at`.

**`compras_recepciones`** — una por entrega (soporta parciales)
`id, pedido_id FK, numero_secuencia INT (1, 2, …), fecha DATE, remito_proveedor_nro?,
transportista_id?, costo_envio_real?, adjuntos JSONB (remito, fotos), notas, created_by,
created_at`.
**`compras_recepcion_items`**
`id, recepcion_id FK CASCADE, pedido_item_id FK, cantidad_recibida, cantidad_conforme,
cantidad_problema, no_recibido BOOL (marca explícita "no vino"), observaciones`.
Al confirmar una recepción: por cada ítem con `producto_id`, un `stock_movimientos`
`ingreso` **por la cantidad conforme** (hoy se ingresa la cantidad pedida entera al marcar
"recibido"); se actualizan los acumulados en `pedido_items`; `estado_logistica` pasa a
`recibida_parcial` o `recibida`; si `recibida` y sin otras OC activas → `operaciones.estado
= 'listo'` (misma regla de hoy, `pedidos.ts:713-726`, movida a `lib/compras.ts`).

**`compras_incidencias`** (`REC-YYYYMM-NNNN`)
`id, numero UNIQUE, pedido_id FK, pedido_item_id FK, recepcion_item_id?, tipo CHECK
(producto_faltante|medida_incorrecta|color_incorrecto|vidrio_roto|vidrio_rayado|
perfil_golpeado|perfil_rayado|herraje_faltante|herraje_incorrecto|producto_incompleto|
error_fabricacion|otro), cantidad_afectada, descripcion, adjuntos JSONB (fotos; videos
como URL externa igual que `video_url` de productos — no hay upload de video en el
proyecto), estado CHECK (abierta|reclamada|respondida|en_reposicion|resuelta|rechazada)
DEFAULT 'abierta', reclamada_at?, respuesta_proveedor?, respondida_at?, solucion CHECK
(reposicion_total|reposicion_parcial|cambio_vidrio|envio_herraje|reparacion|descuento|
nota_credito|devolucion|rechazado)?, solucion_detalle, monto_descuento?,
reposicion_pedido_item_id? (ítem nuevo generado en la misma OC, cantidad = afectada,
precio 0, marcado `es_reposicion_reclamo`), resuelta_at?, created_by, created_at`.
Regla: **una incidencia solo pasa a `resuelta` cuando** (a) la solución no requiere
mercadería (descuento / nota de crédito / rechazo / reparación en sitio), o (b) el ítem de
reposición fue recibido conforme en una recepción posterior. `estado_calidad` de la OC =
`reclamo_pendiente` mientras haya alguna abierta.

### Etapa 3

**`compras_documentos`** — carpeta digital de la OC
`id, pedido_id FK CASCADE, tipo CHECK (cotizacion|orden_compra|remito|factura|
nota_credito|nota_debito|comprobante_pago|foto_incidencia|otro), url NOT NULL, nombre,
numero?, fecha DATE?, monto?, origen_id? (id del registro que lo generó, p.ej. la
recepción o la incidencia), notas, created_by, created_at`.
Los adjuntos cargados en PC/recepción/incidencia/pago se **reflejan** acá automáticamente
(inserción en la misma transacción) para que la carpeta sea completa sin cargar dos
veces. `estado_docs = completa` cuando existe al menos: OC (PDF generado), factura, y —si
hubo recepción— remito.

**`compras_facturas`**
`id, proveedor_id FK, pedido_id? FK, numero, fecha DATE, subtotal_neto, iva_monto, total,
url?, diferencia_vs_oc NUMERIC (calculada al guardar), diferencia_motivo CHECK (flete|
aumento|iva|adicional|error|otro)?, diferencia_obs, created_by, created_at`.
Control económico: en el detalle de la OC, tres columnas **Cotizado / Orden / Facturado**
(total y por ítem cuando hay precios por ítem). Si `|facturado − orden| > 0.01`, el alta
de la factura **exige** `diferencia_motivo` (422 si falta).

**`proveedor_cc_movimientos`** — libro mayor del proveedor (única fuente del saldo)
`id, proveedor_id FK, fecha DATE, tipo CHECK (saldo_inicial|compra|debito|pago|credito|
anticipo|ajuste), monto NUMERIC(14,2) (**convención: positivo = aumenta lo que debemos;
negativo = lo reduce**), pedido_id?, factura_id?, pago_id?, incidencia_id?, concepto,
created_by, created_at`.
Se escribe **solo** desde `lib/compras.ts` (`asentarMovimiento`), nunca desde rutas:
compra (al cargar la factura, o al confirmar la OC si el proveedor no factura — flag por
proveedor `factura_al_recibir`), débito (nota de débito), pago (−), crédito (nota de
crédito, −), anticipo (pago sin OC, −; queda como saldo a favor hasta aplicarse).

**`proveedor_pagos`** + **`proveedor_pago_aplicaciones`**
`proveedor_pagos(id, proveedor_id, fecha, importe, medio CHECK (transferencia|efectivo|
cheque|otro), nro_operacion?, comprobantes JSONB, observacion, created_by)`;
`proveedor_pago_aplicaciones(pago_id, pedido_id, monto)` — varios pagos a una OC, un pago a
varias OC, y el remanente sin aplicar es anticipo/saldo a favor (aplicable después con
`POST /compras/pagos/:id/aplicar`).

**`proveedores.deuda_actual` deja de ser manual**: la migración de la etapa 3 crea un
movimiento `saldo_inicial` con el valor actual de cada proveedor (fecha = día de la
migración, concepto "Saldo inicial migrado") y una **vista `proveedor_saldos`**
(`proveedor_id, saldo = SUM(monto)`). `GET /catalogo/proveedores/tablero` y `informes.ts`
pasan a leer la vista; el input "Deuda actual" del modal de Proveedores se vuelve solo
lectura con link al estado de cuenta. La columna se conserva (no se borra) pero no se
escribe más.

---

## Autocompletado de ítems desde el origen (`server/src/lib/compras.ts` → `armarItemDesde()`)

| Origen | Fuente | `especificaciones` que se llenan |
|---|---|---|
| venta / proforma | `operacion_items` + JOIN `catalogo_productos.atributos` por `producto_id` | `ancho_m/alto_m` de `medida_*`; `sistema` de `sistemas.nombre` (o `atributos.sistema`); `color`, `vidrio`, `premarco`, `accesorios[]` directos; `apertura` de `atributos.apertura|tipo_ventana|tipo_mosquitera`; `herrajes` de `atributos.herrajes` + `cerradura`; `mosquitero` de `atributos.mosquitero` o `configuracion_especial='con_mosquitero'`; `observaciones` = `notas`; adjunto = `calculo_url` |
| orden de trabajo / relevamiento | `visita_tecnica_items` | idem; `ancho_mm/alto_mm ÷ 1000`; adjuntos = `calculo_url` + fotos de la visita |
| reposición de stock / faltante | `catalogo_productos` | `ancho/alto ÷ 100`, `color`, `vidrio`, `atributos.*` como arriba; `proveedor_sugerido` = `proveedor_id`; `proveedor_sku` |
| garantía / reposición por falla | ítem de una OC anterior o de una incidencia | copia `especificaciones` del `pedido_item` original y referencia la incidencia |
| producción propia / manual | formulario | libre |

Hallazgo a tener en cuenta: en `operacion_items` **"tipo de apertura", "herrajes" y
"mosquitero" no están estructurados** (viven en el texto de `descripcion` vía
`aplicarResumenAtributos`). Cuando el ítem no tiene `producto_id`, esos campos quedan
vacíos y el formulario de la SC los pide (con los mismos selectores de
`EspecificacionesAbertura.tsx`). No se cambia el modelo de presupuestos por esto.

---

## Etapa 1 — Solicitud → Cotización → Comparación → Orden de compra

### Backend
Archivo nuevo `server/src/routes/compras.ts` montado en `/api/compras` (registrar en
`server/src/index.ts` junto a `/pedidos`). `pedidos.ts` se conserva íntegro (lo consumen
Presupuestos, NuevoRecibo, NuevoRemito, Operaciones) y se le agregan solo los campos
nuevos al `WITH_PROVEEDOR`/`GET /:id`. Helpers compartidos en `server/src/lib/compras.ts`:
`nextNumeroCompra(client, 'SC'|'PC'|'OC'|'REC')`, `armarItemDesde()`, `calcularTotales()`
(neto, desc, IVA por línea, flete → total), `sincronizarEstadoLegacy()`, `registrarDoc()`.

Rutas (todas con Zod; nombres = convención del repo):
- `GET /compras/tablero` — contadores por pestaña + listas (SC abiertas, PC en curso,
  OC por `estado_logistica`), en 3-4 queries paralelas como `pedidos/tablero`.
- **Solicitudes**: `GET /compras/solicitudes`, `POST` (con `items[]`; `origen` +
  `operacion_id|visita_tecnica_id|producto_id` disparan `armarItemDesde`), `GET /:id`,
  `PUT /:id` (solo `abierta`), `PATCH /:id/estado` (cancelar), `POST /:id/adjuntos` (upload,
  copia de `visitasTecnicas.ts:102-137`, dir `uploads/compras`). Endpoint de ayuda
  `GET /compras/solicitudes/pendientes-desde-operaciones`: operaciones aprobadas con
  ítems no cubiertos (reusa `sqlItemsPendientes` de `coverage.ts`; reemplaza al inline
  de `pedidos.ts:329-342`, que se elimina).
- **Cotizaciones**: `POST /compras/cotizaciones` `{solicitud_id, item_ids[], proveedor_ids[],
  fecha_limite?}` → crea PC + una fila por proveedor (`pendiente`); `POST /:id/enviar`
  `{proveedor_id, medio: whatsapp|email}` → genera el PDF de la PC (ver PDF), lo manda y
  marca `enviada_at`; `PUT /:id/proveedores/:pid/respuesta` (cabecera + `items[]`
  opcionales, guarda `respondida_at`, recalcula `total`); `GET /:id/comparativa` →
  filas por proveedor con `total, plazo_dias, disponibilidad, forma_pago, flete,
  precio_unitario_promedio` y el "mejor" por cada columna marcado; `POST /:id/adjudicar`
  `{proveedor_id}` → **crea la OC** (`pedidos`) tomando ítems, precios, IVA, flete, plazo
  (`fecha_prometida = hoy + plazo_dias`), forma de pago y el archivo de la cotización como
  documento; marca `adjudicada`, ítems de la SC `comprado`, SC `con_oc`;
  `POST /:id/cerrar` `{motivo}` → `no_concretada` (los ítems de la SC vuelven a
  `pendiente`).
- **Órdenes**: `POST /compras/ordenes/directa` `{solicitud_id, proveedor_id, item_ids[]}`
  (proveedor ya definido, sin PC) y `POST /compras/ordenes/consolidar` `{proveedor_id,
  solicitud_item_ids[]}` (ítems de varias SC → una OC con `es_consolidada = true`,
  `operacion_id = NULL`); `GET /compras/ordenes/:id` (OC + ítems con su
  cliente/obra de origen + SC/PC vinculadas + totales + prorrateo de flete calculado);
  `PUT /:id` (solo `borrador`); `POST /:id/enviar` `{medio, contacto}` → PDF + envío +
  `estado_logistica='enviada'`; `POST /:id/pdf` → devuelve el PDF (lo usa el botón
  "Ver PDF" y el archivado en `compras_documentos` tipo `orden_compra`).
- **Compatibilidad**: `POST /pedidos` (flujo viejo desde una operación o stock propio)
  sigue funcionando y **además crea la SC implícita** (`origen = venta` o
  `reposicion_stock`, estado `con_oc`) para que la trazabilidad sea completa también en el
  camino corto. Las OC creadas por acá nacen con `estado_logistica = 'borrador'` y número
  `OC-`.

PDFs: `generarPDFCompra(tipo: 'cotizacion'|'orden', data, empresa)` en
`server/src/lib/pdf.ts`, copiando la estructura de `generarPDFRecibo` (encabezado con
logo/empresa, tabla de ítems con especificaciones en segunda línea, totales neto/desc/
IVA/flete/total, condiciones). Antes: **extraer** de `pdf.ts` un `buildEncabezadoHTML(empresa)`
+ `buildPieHTML(empresa)` + `lanzarChromium()` compartidos (hoy están copiados en los dos
generadores) — sin cambiar el resultado de los PDFs existentes.

Envío: agregar a `server/src/lib/whatsapp.ts` un `enviarWhatsappPdf(telefono, pdf, nombre,
caption)` que centraliza el `sendMedia` que hoy está inline en `clientes.ts:611-635` y
`recibos.ts` (esas dos rutas pasan a usarlo — mismo comportamiento); agregar `attachments`
al `sendMail` privado de `server/src/email.ts` y un `sendCompra(to, asunto, html, pdf)`.
Plantillas nuevas en `mensajes_plantilla` (migración `INSERT ... ON CONFLICT DO NOTHING`,
aparecen solas en Configuración): `compra_cotizacion` (`{{numero}}, {{detalle}},
{{fecha_limite}}`), `compra_orden` (`{{numero}}, {{detalle}}, {{total}}, {{fecha_prometida}}`).
La plantilla vieja `pedido_proveedor` queda para el flujo viejo.

Zod (`schemas.ts`): `SolicitudCompraSchema`, `SolicitudItemSchema` (con `especificaciones`
como `z.record` validado por `tipo_producto` mediante `superRefine`), `CotizacionCrearSchema`,
`CotizacionRespuestaSchema` (neto/desc/iva ≥ 0, `iva_pct ∈ {0, 10.5, 21, 27}`),
`OrdenDirectaSchema`, `OrdenConsolidarSchema`, `EnviarCompraSchema`. Tests en
`schemas.test.ts` con el mismo estilo (`base` + acepta/rechaza + `it.each` para enums).

Actividad: agregar `'compra'` a `EntidadActividad` (`server/src/lib/actividad.ts:4`) y
las etiquetas en `src/pages/Actividad.tsx` (`ENTIDAD_LABEL`, `ENTIDAD_FILTROS`). Acciones:
`crear_solicitud`, `pedir_cotizacion`, `enviar`, `responder_cotizacion`, `adjudicar`,
`cerrar_cotizacion`, `crear_oc`.

### Frontend
- **`/compras`** reemplaza a `/pedidos` (App.tsx: `/pedidos*` → `<Navigate to="/compras">`;
  las rutas internas `/pedidos/nuevo` y `/pedidos/:id/editar` siguen sirviendo el flujo
  viejo bajo `/compras/oc/nueva` y `/compras/oc/:id/editar`). Sidebar: "Pedidos" →
  **"Compras"** (mismo ícono y color; `data-section="pedidos"` se conserva para no tocar
  `index.css` ni `SECTION_COLORS`).
- `src/pages/compras/Compras.tsx`: `SectionHero` + `CompactStatsBar` (SC abiertas · PC
  esperando respuesta · OC en curso · OC demoradas) + **pestañas con contadores** (patrón
  `Presupuestos.tsx:1207-1279`): **Solicitudes · Cotizaciones · Órdenes** (etapa 2 suma
  Recepciones y Reclamos; etapa 3 suma Cuenta corriente). Cada pestaña es un componente
  en `src/pages/compras/` con lista + modal de detalle (patrón `ReciboModal`).
- **Nueva solicitud** (`NuevaSolicitud.tsx`): paso 1 origen (8 tarjetas grandes, como
  las de tipo de pago en `NuevoRecibo`); según el origen, selector de operación /
  relevamiento / producto (reusa `ModalCatalogoProductos` y el buscador de operaciones de
  `NuevoPedido.tsx:453-464`) y los ítems se autocompletan; paso 2 revisar ítems
  (`EspecificacionesAbertura.tsx` para aberturas; sub-formulario simple para perfil /
  vidrio / herraje), cantidad, fecha necesaria, observaciones, adjuntos (dropzone de
  `NuevoRecibo.tsx:1008-1037`); paso 3 **"¿Cómo seguimos?"**: *Pedir cotización* (elige
  proveedores → crea PC) · *Comprar directo* (elige proveedor → OC borrador) · *Solo
  guardar*.
- **Cotización** (`DetalleCotizacion.tsx`): cabecera (SC, ítems, fecha límite), una
  tarjeta por proveedor con estado (pendiente / enviada hace X / respondida) y botones
  *Enviar por WhatsApp / Email* (PDF adjunto, con preview del mensaje como `PDFDialog`) y
  *Cargar respuesta* (modal: cabecera neto/desc/IVA%/flete → total en vivo, plazo,
  disponibilidad, forma de pago, validez, observaciones, archivo; sección plegada
  "Precio por ítem" opcional). **Comparativa**: tabla proveedores × (Total final · Neto ·
  Flete · Plazo · Disponibilidad · Forma de pago · Validez), mejor valor de cada columna
  resaltado en verde, fila del más barato con badge "Menor costo"; botones
  **Elegir este proveedor → genera la OC** y **Cerrar sin comprar** (pide motivo).
- **Orden de compra** (`DetalleOrden.tsx`): resumen con las 4 franjas de estado
  (Logística · Calidad · Finanzas · Documentación — en etapa 1 solo Logística cambia;
  las otras muestran "—"), proveedor y contacto, ítems con especificaciones y cliente/obra
  de origen (badge por cliente cuando es consolidada), totales, "Vinculado a SC-… / PC-…"
  con links, adjuntos, botones *Enviar por WhatsApp / Email*, *Ver PDF*, *Editar*
  (borrador). Los `PED-` viejos se abren en esta misma pantalla.
- `HelpDrawer`: nuevo tema `compras` con el circuito completo (una sección por etapa).

### Verificación etapa 1
- `npm run check`; tests nuevos de schemas.
- Migraciones en local; `SELECT` confirmando backfill (`estado_logistica` derivado de
  `estado`, `precio_unitario_neto = costo_unitario`, `total = monto_total`) para los 100%
  de los `pedidos` existentes; `diff` de `GET /operaciones/tablero`, `/operaciones/:id`,
  `/pedidos/tablero` y `/pedidos/:id` **antes y después** (snapshots como en el refactor de
  coverage) → deben ser idénticos.
- API con `curl` al backend nativo: SC desde una operación real → ítems con
  especificaciones cargadas; PC a 2 proveedores → respuestas con IVA distinto →
  comparativa marca el menor total; adjudicar → OC con totales que cuadran (neto − desc +
  IVA + flete) y `estado` legacy = `pendiente`; enviar OC → `enviada` y `estado` legacy =
  `enviado`, y la operación aparece en "Pedido proveedor" del kanban; flujo viejo
  `POST /pedidos` sigue devolviendo 201 y crea la SC implícita.
- PDFs de PC y OC generados con `tsx` directo (sin enviar) y revisados con `Read`.
- Playwright a 1366×768 y 375: crear SC desde venta (autocompletado visible), comparativa,
  OC; y la pantalla vieja de un `PED-` histórico abre sin errores.

## Etapa 2 — Envío/confirmación, seguimiento, recepción por ítem, reclamos

### Backend (`compras.ts` + `lib/compras.ts`)
- `POST /compras/ordenes/:id/confirmacion` `{confirmacion_recepcion, confirmacion_precio,
  confirmacion_caracteristicas, fecha_prometida, contacto}` → `confirmada` + seguimiento
  tipo `confirmacion`.
- `PATCH /compras/ordenes/:id/estado-logistica` (transiciones válidas en una tabla, como
  `pedidos.ts:640-645`) + `POST /:id/seguimientos` `{respuesta_proveedor,
  nueva_fecha_prometida?, observaciones}` (si trae fecha nueva → la OC sale de `demorado`).
- **Demora automática**: en `GET /compras/tablero` y en la fuente de notificaciones,
  una OC con `fecha_prometida < CURRENT_DATE` y logística no terminal se considera
  demorada (badge rojo "Demorada N días"); no hace falta cron. Nueva fuente
  `compra_demorada` en `notificaciones.ts` (UNION + `MARCAR_UNA` + `marcar-leidas`, con
  flag `pedidos.demora_notif_leida`) y tipo `compra_demorada` en `AvisosEmergentes.tsx`
  (`EMERGE: true`, tono ámbar, CTA "Registrar seguimiento"). La tarjeta "pedidos
  atrasados" del Dashboard pasa a usar `fecha_prometida` (con fallback a
  `fecha_entrega_est`).
- **Recepciones**: `POST /compras/ordenes/:id/recepciones` `{fecha, remito_proveedor_nro,
  transportista_id, costo_envio_real, adjuntos, items[{pedido_item_id, cantidad_recibida,
  cantidad_conforme, cantidad_problema, no_recibido, observaciones}]}` en transacción:
  valida `recibida + pendiente ≤ pedida`, ingresa stock por conforme, actualiza acumulados
  y `estado_item`, decide `recibida_parcial|recibida`, sincroniza legacy, registra
  documento `remito`, y **por cada ítem con `cantidad_problema > 0` crea la incidencia
  en estado `abierta`** (una por ítem) devolviendo sus ids para que la UI abra el panel de
  reclamo en el acto. `GET /:id/recepciones`.
- `PATCH /pedidos/:id/estado` con `recibido` (flujo viejo) pasa a crear una recepción
  completa (todo conforme) por esta misma vía — un solo camino de ingreso a stock.
- **Incidencias**: `GET /compras/incidencias` (filtros proveedor/estado/OC), `GET /:id`,
  `PUT /:id` (tipo, descripción, adjuntos), `POST /:id/reclamar` `{medio}` → mensaje al
  proveedor (plantilla `compra_reclamo` con fotos como adjuntos de WhatsApp) →
  `reclamada`; `POST /:id/respuesta` `{respuesta_proveedor, solucion, solucion_detalle,
  monto_descuento?}` → si la solución implica mercadería (`reposicion_*`, `cambio_vidrio`,
  `envio_herraje`) crea el `pedido_item` de reposición (cantidad afectada, precio 0,
  `es_reposicion_reclamo = true`, no cuenta en cobertura) y pasa a `en_reposicion`;
  `descuento` → asiento en la etapa 3 (por ahora guarda el monto); `rechazado` →
  `rechazada`; el resto → `resuelta`. Al recibir conforme el ítem de reposición en una
  recepción posterior, la incidencia se cierra sola.
- Cancelar una OC con recepciones revierte el stock ingresado con movimientos
  `devolucion` (cierra el bug asimétrico documentado).

### Frontend
- `DetalleOrden.tsx`: franja Logística con la línea de tiempo de estados y el botón
  contextual del próximo paso (*Marcar enviada* → *Registrar confirmación* → estado
  siguiente…); panel **"Seguimiento"** que aparece solo si está demorada o si se tocan
  "Registrar contacto" (fecha, respuesta, nueva fecha, observaciones; historial abajo).
- **Recepción** (`ModalRecepcion.tsx`): tabla ítem por ítem — Pedido · Recibido · Conforme
  · Con problema · Pendiente (calculado en vivo), tres botones por fila (✓ conforme /
  ⚠ con problema / ✗ no recibido) que rellenan las cantidades, remito y fotos, "Confirmar
  recepción". Si algún ítem quedó con problema, al confirmar se abre directamente el
  **panel de reclamo** del primero (tipo, descripción, fotos) — el usuario nunca busca
  "crear reclamo".
- Pestañas **Recepciones** (lista por OC con parciales) y **Reclamos** (REC- por
  estado, con contador rojo de abiertos en la pestaña). `DetalleIncidencia.tsx`: datos,
  fotos, *Reclamar al proveedor*, *Registrar respuesta* (solución con explicación de qué
  pasa después), estado y, si hay reposición, el link a la recepción que la cerró.
- Franja **Calidad** de la OC: "Sin reclamos" / "N reclamos abiertos" (link) / "Resueltos".

### Verificación etapa 2
- Escenario completo por API: OC de 3 ítems → recepción parcial (2 conforme, 1 con
  problema) → stock ingresó solo lo conforme (`SELECT` en `stock_movimientos`), OC
  `recibida_parcial`, incidencia creada; respuesta `reposicion_total` → ítem de reposición;
  segunda recepción conforme → incidencia `resuelta`, OC `recibida`, operación `listo`.
  Demora: `fecha_prometida` en el pasado → aparece en `/notificaciones` y en el tablero.
- Flujo viejo: `PATCH /pedidos/:id/estado recibido` sigue ingresando stock igual que hoy
  (snapshot de `stock_movimientos` antes/después de un caso).
- Playwright: recepción por ítem y apertura automática del reclamo.

## Etapa 3 — Documentación, control económico, cuenta corriente, cierre

### Backend
- **Documentos**: `GET /compras/ordenes/:id/documentos`, `POST` (upload + tipo + numero/
  fecha/monto), `DELETE`. Reflejo automático desde PC/recepción/incidencia/pago
  (`registrarDoc` en `lib/compras.ts`). `estado_docs` recalculado en cada cambio.
- **Facturas**: `POST /compras/facturas` `{proveedor_id, pedido_id?, numero, fecha, neto,
  iva, total, url, diferencia_motivo?, diferencia_obs?}` → calcula `diferencia_vs_oc`,
  exige motivo si difiere, asienta `compra` en la cuenta corriente, `estado_finanzas =
  pendiente`, documento `factura`. `GET /compras/ordenes/:id/control-economico` →
  `{cotizado, orden, facturado, diferencias[]}`.
- **Cuenta corriente**: `POST /compras/pagos` `{proveedor_id, fecha, importe, medio,
  nro_operacion, comprobantes, observacion, aplicaciones[{pedido_id, monto}]}` (suma de
  aplicaciones ≤ importe; el resto queda como anticipo) → asiento `pago` (−) + documentos
  `comprobante_pago` en cada OC aplicada + `estado_finanzas` por OC (`pago_parcial` /
  `pagada`); `POST /compras/pagos/:id/aplicar` (aplicar saldo a favor a una OC);
  `POST /compras/notas` `{proveedor_id, tipo: credito|debito, pedido_id?, incidencia_id?,
  numero, fecha, monto, url}` → asiento `credito` (−) / `debito` (+), documento, y si viene
  de una incidencia con solución `nota_credito`/`descuento` la cierra.
- **Estado de cuenta**: `GET /compras/proveedores/:id/estado-cuenta?desde&hasta&pedido_id`
  → `{saldo_inicial (suma de movimientos anteriores a `desde`), movimientos[] con saldo
  acumulado, totales {compras, debitos, pagos, creditos, saldo_final}}`;
  `POST /:id/estado-cuenta/pdf` y `/enviar-whatsapp` con `generarPDFEstadoCuentaProveedor`
  (adaptación de `generarPDFEstadoCuenta` con las columnas Compras/Débitos/Pagos/Créditos).
  Vista `proveedor_saldos` reemplaza `deuda_actual` en `/catalogo/proveedores/tablero` e
  `informes.ts`.
- **Cierre**: `estado_logistica = cerrada` se habilita cuando todo recibido, cantidades
  conforme = pedidas (o la diferencia está cubierta por incidencias resueltas), sin
  incidencias abiertas y control realizado (checkbox "Control realizado" en la última
  recepción); `cerrada_totalmente_at` se setea automáticamente cuando además el saldo de
  la OC (facturado − pagos aplicados − créditos) es 0 y `estado_docs = completa`.
  `GET /compras/ordenes/:id/cierre` devuelve la checklist con qué falta.

### Frontend
- Pestaña **Cuenta corriente**: selector de proveedor (o vista global con saldo por
  proveedor, como `EstadoCuentaGlobal`), libro mayor con filtros (fechas, OC), tarjetas
  Saldo inicial · Compras · Débitos · Pagos · Créditos · Saldo final, botones *Registrar
  pago* (modal: importe, medio, N° operación, comprobantes multi como los del recibo,
  aplicar a una o varias OC con "Resto"), *Nota de crédito/débito*, *PDF* y *WhatsApp*.
- `DetalleOrden.tsx`: sección **Documentos** (carpeta: chips por tipo con contador y
  faltantes en gris), **Control económico** (tres columnas; si hay diferencia, el motivo y
  la observación en ámbar — solo aparece si difiere), franja **Finanzas** (Sin factura /
  Pendiente $X / Pago parcial $X de $Y / Pagada / Con crédito) y **Documentación**
  (Completa / faltan: …). Botón **Cerrar OC** con la checklist; sello "CERRADA
  TOTALMENTE" cuando aplica.
- Proveedores: el input "Deuda actual" pasa a texto con link "Ver estado de cuenta";
  el widget "Deudas a pagar" lee `proveedor_saldos`.

### Verificación etapa 3
- Migración de `deuda_actual`: `SELECT` confirmando que `proveedor_saldos.saldo` =
  `deuda_actual` anterior para todos los proveedores.
- Caso por API: OC 100.000 + IVA → factura 121.000 (sin diferencia) → cuenta corriente
  +121.000; pago 50.000 aplicado → `pago_parcial`, saldo 71.000; nota de crédito por
  incidencia 10.000 → saldo 61.000, incidencia resuelta; pago 61.000 → `pagada`, saldo 0;
  cierre logístico ok + docs completa → `cerrada_totalmente_at` seteado. Un pago de
  200.000 aplicado 121.000 → anticipo 79.000 visible como saldo a favor y aplicable a otra
  OC. Factura con total distinto sin motivo → 422.
- PDF de estado de cuenta generado con `tsx` y revisado.

---

## Orden de trabajo y entregas

Cada etapa: migraciones → `lib/compras.ts` → rutas + Zod + tests → frontend → `npm run
check` + e2e → changelog → commit → push → **deploy a test** → rebuild `:3000` → reporte
con la línea de estado (prod queda a decisión del usuario). Tres commits grandes (uno por
etapa), cada uno usable por sí solo. En el reporte de cada etapa: qué se puede probar en
test y con qué datos.

Riesgos y cómo se controlan: (1) romper el flujo viejo de pedidos → snapshots antes/
después de los 4 endpoints que lo consumen; (2) doble ingreso a stock → un único camino
(`crearRecepcion`) desde la etapa 2, con test de escenario; (3) `deuda_actual` mal migrada
→ `SELECT` de igualdad antes de dar por buena la etapa 3 y la columna no se borra.

Fuera de alcance (se anota, no se hace): cola automática por proveedor, aprender precios
al recibir, parser de texto de WhatsApp, historial de `proveedor_precios`, exclusividad de
proveedores por producto, upload de video.
