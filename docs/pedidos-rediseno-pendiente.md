# Pedidos a proveedores — rediseño pendiente

> Movido desde CLAUDE.md el 2026-09-16 para no cargarlo en cada sesión. Contenido íntegro.

Diseño relevado contra el código real, para retomar cuando se cierren las definiciones pendientes de abajo. No crear las migraciones ni tocar código hasta entonces.

**Problema:** cada venta confirmada dispara su propio pedido al proveedor. Con 3-4 proveedores para el mismo producto no hay forma de compararlos, y los pedidos salen atomizados en vez de agrupados. Algunos proveedores mandan lista de precios, otros no.

**Decisiones ya tomadas (no reabrir):**
- Agrupación: **cola de pendientes por proveedor**, sin corte horario automático — el operador arma y envía cuando quiere.
- Multi-proveedor: **comparar y sugerir** el más barato, pero **elige el operador**.
- Envío: **email y WhatsApp**, con canal preferido por proveedor pero elegible al enviar.
- Precios sin lista: **aprender del precio real pagado** al recibir + **pegar texto** de WhatsApp/mail. El import CSV se mantiene para quien sí manda lista.

**Hallazgos clave:**
- `proveedor_precios` (`proveedor_id, sku, descripcion, precio, producto_id`, UNIQUE en `(proveedor_id,sku)`) **ya es la tabla multi-proveedor** — no hace falta tabla nueva, falta *usarla*: `producto_id` se llena 100% a mano hoy, sin ninguna vista de comparación.
- `pedido_items.operacion_item_id` ya es por línea y nullable → un pedido consolidado multi-operación es viable casi sin tocar esquema. La fricción es que `pedidos.operacion_id` es escalar (precedente ya existe: `es_stock_propio` fuerza `operacion_id=NULL`, `pedidos.ts:244-245`).
- La regla de "ítem cubierto" (no necesita pedido) está **duplicada 5 veces con 2 semánticas distintas** (`pedidos.ts` ×3, `operaciones.ts` ×2) — `items_cubiertos` es stock-aware, `items_en_pedido` no, pese al nombre parecido. Unificar esto en un `lib/coverage.ts` es el refactor habilitante antes de tocar nada más.
- No hay historial de precios de proveedor — un aumento masivo mal aplicado no es reversible.
- `email.ts` no soporta adjuntos (`sendMail` privado solo pasa from/to/subject/html) — agregar `attachments` es trivial, nodemailer ya lo soporta.
- La plantilla WhatsApp `pedido_proveedor` en `mensajes_plantilla` ya existe; falta la de email.
- `GET /catalogo/proveedor-precios` tiene `LIMIT 500` sin paginación — truncamiento silencioso.

**Diseño por fases** (detalle completo, con SQL y rutas exactas, en el historial de esta sesión — pedir el plan completo si se retoma):
- **Fase 0**: unificar la regla de cobertura en `lib/coverage.ts` (5 call sites) + arreglar el `LIMIT 500` y el `PUT /pedidos/:id` sin guard anti-duplicado. Sin esto, las fases siguientes se implementan 5 veces.
- **Fase 1**: comparación multi-proveedor (`GET /catalogo/productos/:id/precios-proveedores`), conciliación asistida por SKU/descripción normalizada (siempre confirmada por el operador, nunca automática), historial de precios (`proveedor_precios_historial`).
- **Fase 2**: `GET /pedidos/cola` agrupada por proveedor sugerido + `POST /pedidos` acepta ítems de varias operaciones (`es_consolidado=true`, `operacion_id=NULL`) + nuevo componente `ColaPedidos.tsx` como pestaña en `Pedidos.tsx`.
- **Fase 3**: `generarPDFPedido()` (copiar patrón de `generarPDFRecibo`), envío por email o WhatsApp elegible, unificar `enviar-whatsapp` para usar `lib/whatsapp.ts` en vez de duplicar el fetch a Evolution.
- **Fase 4**: aprender precio del `costo_unitario` real al recibir (`origen='recepcion'`) + endpoint para pegar texto libre de WhatsApp/mail y parsear candidatos a confirmar.

**Definiciones pendientes antes de codear (bloqueantes primero):**
1. ¿El pedido al proveedor debe llevar precios/SKU, o es deliberado que hoy no los lleve (WhatsApp actual solo manda descripción+cantidad)?
2. Pedido consolidado (varios clientes): ¿cómo se prorratea el costo de envío entre operaciones?
3. ¿Se puede cancelar solo el ítem de un cliente dentro de un pedido consolidado, o se cancela el pedido entero?
4. ¿Existen productos con proveedor exclusivo que no deban entrar en la comparación?
5. Conseguir 2-3 listas de precios reales de proveedores distintos (el parser CSV asume 3 columnas fijas y solo UTF-8).
6. Conseguir 3-4 mensajes reales de WhatsApp con precios (para diseñar el parser de texto libre contra formatos reales, no inventados).
7. Volumen real: cuántos proveedores, cuántos SKUs por lista (define si el `LIMIT 500` es urgente).
8. Umbral de "precio desactualizado" (propuesto: 30 días) y de "antigüedad en la cola" (propuesto: ámbar >2 días, rojo >5) — a confirmar.
9. Al aprender del precio pagado, ¿debe pisar un precio que vino de una lista formal, o solo pisar precios manuales/de otra recepción?

**Bugs preexistentes encontrados al relevar** (no son de esta feature, quedan anotados): `POST /pedidos/:id/avisar-recepcion-cliente` es código muerto (su plantilla `recepcion_cliente` no existe en ninguna migración); `GET /pedidos/conteos` y `/reporte-envios` sin consumidor; `PedidoSchema.referencia_nro` nunca se lee; editar un pedido le hace perder `es_reposicion` a sus ítems (`NuevoPedido.tsx:421-428`); cancelar un pedido `recibido` no revierte el stock ingresado (asimétrico con remitos); `proveedores.costo_flete` es un nombre engañoso — se usa como porcentaje.
