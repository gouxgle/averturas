# Aberturas — CRM / ERP de gestión para local de aberturas

## Descripción del negocio
Local de venta e instalación de aberturas (ventanas, puertas, etc.).
Maneja productos estándar (stock propio), productos a medida (fabricados por proveedor) y fabricación propia.
Flujo: presupuesto → aprobación → recibo de pago → remito de entrega.

## Repositorio
- GitHub: `git@github.com:gouxgle/averturas.git`
- Rama principal: `main`

## Ambientes
| Ambiente | URL | IP | Notas |
|---|---|---|---|
| **Local** | `http://localhost:3000` | — | Desarrollo |
| **Test** | `http://aberturas.solucionesgps.com.ar` | `149.50.150.131` | Staging / pruebas — HTTP sin HTTPS |
| **Prod** | `http://aberturas.cesarbritez.com.ar` | `179.43.120.103` | Producción cliente |

- Test (149.50.150.131): HTTP sin HTTPS → `crypto.randomUUID()` necesita fallback
- Compose en test: nombre `aberturas`, contenedor DB `aberturas-db`
- Compose en prod: nombre `cesarbritez`, contenedor DB `aberturas-db`, proyecto en `/opt/docker/cesarbritez/aberturas/`, uploads montados en `/var/lib/docker-data/aberturas/uploads/` → `/app/uploads`

## Stack técnico

### Frontend
- React 19 + TypeScript + Vite
- Tailwind CSS (componentes propios, sin shadcn)
- React Router v7, TanStack Query v5, React Hook Form, Zod
- Sonner (toasts), Recharts (gráficos), Lucide React (íconos)
- `src/lib/api.ts` — cliente HTTP propio (NO axios), retorna `T` directamente (sin wrapper `.data`)
- Alias `@/` apunta a `src/`

### Backend
- Hono v4 sobre Node.js (`@hono/node-server`)
- PostgreSQL con driver `pg` (pool directo, sin ORM)
- JWT + bcryptjs para auth
- Servicio único: sirve API en `/api/` y frontend estático desde `./public/`

### Infraestructura
- Docker Compose multi-stage: frontend-build → server-build → imagen final
- `docker/initdb/01_schema.sh` — ejecuta todas las migraciones en orden al iniciar DB vacía
- Migraciones en `supabase/migrations/` — naming: `YYYYMMDDNNNNNN_descripcion.sql`
- Cada migración hace `INSERT INTO schema_migrations (filename)` al final
- Uploads en `./uploads/` (montado como volumen)
- Env var `APP_URL` requerida en producción para links públicos (ej: `http://149.50.150.131:3000`)

## Estructura de archivos clave

```
Aberturas/
├── src/
│   ├── pages/                        # Una página por sección
│   │   ├── Dashboard.tsx             # 5 indicadores accionables
│   │   ├── Presupuestos.tsx          # Lista + modal detalle + Compartir
│   │   ├── NuevoPresupuesto.tsx      # Crear/editar presupuesto
│   │   ├── Operaciones.tsx           # Tablero kanban — 6 columnas
│   │   ├── Recibos.tsx               # Lista + modal detalle con anulación
│   │   ├── NuevoRecibo.tsx           # Crear/editar recibo (vinculado a op. aprobada)
│   │   ├── Pedidos.tsx               # Lista de pedidos al proveedor (orden: created_at DESC)
│   │   ├── NuevoPedido.tsx           # Crear pedido al proveedor
│   │   ├── VentaRapida.tsx           # Venta rápida de mostrador (galería productos con stock)
│   │   ├── VisitaTecnica.tsx         # Crear visita técnica (cliente + domicilio)
│   │   ├── VisitasTecnicas.tsx       # Listado de visitas técnicas
│   │   ├── CargarVisitaTecnica.tsx   # Cargar relevado (fotos, ítems, detalles) + avanzar a presupuesto
│   │   ├── VistaPublicaPresupuesto.tsx  # Página pública /p/:token (sin auth) — aprobar o respuesta intermedia
│   │   └── print/
│   │       ├── ImprimirPresupuesto.tsx
│   │       ├── ImprimirRecibo.tsx
│   │       └── ImprimirVisitaTecnica.tsx  # PDF A4 formulario visita técnica (?visita_id=)
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppLayout.tsx         # Layout principal con Toaster
│   │   │   └── Sidebar.tsx           # Nav lateral con NotificationBell
│   │   ├── NotificationBell.tsx      # Campanita de notificaciones (polling 30s)
│   │   ├── SectionHero.tsx           # Header de cada sección — responsive flex-col/row (ver Convenciones UI)
│   │   └── CompactStatsBar.tsx       # Barra "Métricas" — scroll horizontal en mobile
│   ├── lib/api.ts                    # Cliente HTTP
│   ├── hooks/useAuth.ts
│   └── App.tsx                       # Rutas React Router
├── server/src/
│   ├── routes/
│   │   ├── pub.ts                    # Rutas PÚBLICAS sin auth (/pub/presupuesto/:token, incl. /responder)
│   │   ├── notificaciones.ts         # GET/PATCH notificaciones de aprobación + respuesta_cliente
│   │   ├── operaciones.ts            # POST /venta-rapida, /:id/generar-link, /:id/resolver-respuesta; tablero incluye pedido_fecha_entrega_est
│   │   ├── visitasTecnicas.ts        # CRUD visitas técnicas + upload-imagen
│   │   ├── pedidos.ts                # GET /tablero, CRUD; lista ordenada por created_at DESC
│   │   ├── recibos.ts
│   │   ├── dashboard.ts              # GET /indicadores (5 KPIs accionables)
│   │   └── ...resto de rutas
│   ├── middleware/auth.ts
│   ├── db.ts
│   └── index.ts                      # Registro de rutas (pub ANTES de authMiddleware)
├── supabase/migrations/
├── docker/initdb/01_schema.sh
├── Dockerfile
└── docker-compose.yml
```

## Base de datos — tablas principales

```
usuarios            — roles: admin | vendedor | consulta
empresa             — datos del local (nombre, CUIT, logo_url, etc.)
tipos_abertura      — catálogo: Ventana, Puerta, etc.
sistemas            — catálogo: PVC, aluminio, etc.
colores             — catálogo de colores
proveedores         — fabricantes, revendedores, importadores
catalogo_productos  — productos (stock_inicial, stock_minimo, imagenes[], video_url)
categorias_cliente
clientes            — personas físicas y jurídicas
interacciones       — historial CRM por cliente
tareas              — seguimiento por cliente
operaciones         — presupuestos/operaciones (ver campos clave abajo)
operacion_items     — líneas de operación (tipo_abertura_id, sistema_id, sin precio_total columna)
estados_historial   — auditoría de cambios de estado
stock_lotes         — lotes de ingreso
stock_movimientos   — movimientos de stock (cantidad signed)
remitos             — remitos de entrega (operacion_id, estado: borrador|emitido|entregado|cancelado)
remito_items        — líneas de remito
recibos             — cobros (vinculados a operacion_id, estado: emitido|anulado)
recibo_items        — líneas de recibo
compromisos_pago    — compromisos de saldo pendiente (fecha_vencimiento, estado: pendiente|cobrado|...)
transportistas      — tabla maestra de empresas de transporte (nombre, activo); seeds: Andreani, OCA, Correo Argentino, transporte propio
pedidos             — pedidos al proveedor (estado: pendiente|enviado|recibido|cancelado; fecha_entrega_est DATE; costo_envio NUMERIC; transportista_id UUID FK; es_stock_propio BOOLEAN → pedido para stock/salón propio, sin cliente ni operación)
pedido_items        — líneas del pedido (descripcion, cantidad, costo_unitario, orden; operacion_item_id UUID nullable FK → vincula ítem con operación origen; es_reposicion BOOLEAN → ítem extra pedido igual habiendo stock)
visitas_tecnicas    — relevamiento in situ (numero, cliente_id, estado: pendiente|relevada|convertida|cancelada, imagenes[], operacion_id nullable FK)
visita_tecnica_items — ítems medidos in situ (ambiente, descripcion, ancho_mm, alto_mm — en MILÍMETROS, no metros)
```

### Campos clave en `operaciones`
```sql
estado            -- presupuesto|enviado|aprobado|en_produccion|listo|instalado|entregado|cancelado
forma_pago        -- texto libre: 'Contado', 'Transferencia', 'Tarjeta de crédito 3 cuotas sin interés', etc.
forma_envio       -- retiro_local|envio_bonificado|envio_destino|envio_empresa
costo_envio       -- numeric (solo aplica si forma_envio = 'envio_empresa')
token_acceso      -- UUID único para link público de aprobación (nullable)
token_acceso_at   -- TIMESTAMPTZ cuando se generó el token
aprobado_online_at -- TIMESTAMPTZ cuando el cliente aprobó desde el link
notif_leida       -- BOOLEAN (false = notificación pendiente de leer en el sistema)
respuesta_cliente     -- mas_tiempo|consulta|llamada|modificar|NULL — respuesta intermedia del link público (no cambia estado)
respuesta_cliente_at  -- TIMESTAMPTZ de la respuesta intermedia
es_venta_rapida       -- BOOLEAN — true si viene de POST /operaciones/venta-rapida (venta de mostrador)
```
`respuesta_cliente_detalle` NO es columna — se calcula en `GET /operaciones/:id` como subquery a la última `interaccion` tipo `respuesta_proforma` de esa operación (tiene el comentario/motivo real que escribió el cliente).

### `operacion_items` — importante
`precio_total` NO es columna directa. Calcularlo siempre:
```sql
precio_unitario * cantidad + CASE WHEN incluye_instalacion THEN precio_instalacion * cantidad ELSE 0 END
```
`tipo_abertura_nombre` y `sistema_nombre` tampoco son columnas — requieren JOIN:
```sql
LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
LEFT JOIN sistemas        si ON si.id = oi.sistema_id
```

### Tipos/enums PostgreSQL
```sql
app_role:         admin | vendedor | consulta
tipo_operacion:   estandar | a_medida_proveedor | fabricacion_propia
estado_operacion: presupuesto | enviado | aprobado | en_produccion | listo | instalado | entregado | cancelado
```

### Stock — fórmula clave
```
stock_actual = catalogo_productos.stock_inicial + SUM(stock_movimientos.cantidad)
```
Tipos de movimiento: `ingreso | egreso_remito | egreso_retiro | devolucion | ajuste`

`en_salon` (BOOLEAN en `catalogo_productos`) = exhibido físicamente en el local y con stock verificado a mano. Validación backend: no se puede marcar `en_salon=true` si `stock_actual < 1` (POST/PUT productos, PATCH toggle-salon). Se auto-limpia (`en_salon=false`) cuando el stock llega a 0 tras una venta rápida o un remito emitido.
**Contexto de negocio (2026-07-22)**: en prod, el stock de catálogo venía de una carga inicial no verificada (default 100 en casi todos). Se hizo un ajuste masivo (movimientos `ajuste`, motivo "Ajuste masivo: stock no verificado") llevando a 0 todo producto `en_salon=false` — el criterio real hoy es: **solo lo marcado `en_salon` tiene stock confiable**, todo lo demás está en 0 hasta que se verifique y cargue de nuevo.

### Remitos — flujo de estados
```
borrador → emitido   (descuenta stock: crea movimientos egreso_remito)
emitido  → entregado (registra fecha_entrega_real)
*        → cancelado (si stock_descontado=true, revierte con movimiento devolucion)
```

### Recibos — reglas de negocio
- Solo se generan sobre operaciones con `estado = 'aprobado'`
- Formas de pago: `'Contado'` | `'Tarjeta de débito/crédito en 1 pago'` | `'Transferencia'` | `'Tarjeta de crédito 3 cuotas sin interés'`
- Pago contado: habilita bonificación sobre precio de productos (no envío ni instalación)
- Pago parcial: genera `compromisos_pago` con fecha de vencimiento
- `cobrado_operacion` = suma de recibos emitidos para esa operación (calculado en GET /:id)

## Rutas del backend (`/api/`)

| Ruta | Archivo | Notas |
|------|---------|-------|
| `/pub/presupuesto/:token` | routes/pub.ts | **PÚBLICA** — sin auth, GET detalle + POST aprobar + POST rechazar + `POST /responder` (respuesta intermedia) |
| `/pub/remito/:token` | routes/pub.ts | **PÚBLICA** — sin auth, GET detalle remito + POST confirmar recepción |
| `/auth` | routes/auth.ts | Pública — login, me |
| `/clientes` | routes/clientes.ts | `/validar-dni` ANTES de `/:id` |
| `/productos` | routes/productos.ts | CRUD con upload de imagen |
| `/operaciones` | routes/operaciones.ts | `POST /venta-rapida` (venta mostrador); `POST /:id/generar-link`, `POST /:id/enviar-whatsapp`, `PATCH /:id/resolver-respuesta` — todas ANTES de `GET /:id` |
| `/visitas-tecnicas` | routes/visitasTecnicas.ts | `POST /upload-imagen` ANTES de `GET /:id`; CRUD + fotos de relevamiento |
| `/catalogo` | routes/catalogo.ts | tipos-abertura, sistemas, colores, categorias, proveedores |
| `/dashboard` | routes/dashboard.ts | `GET /indicadores` devuelve 5 arrays accionables |
| `/notificaciones` | routes/notificaciones.ts | `GET /` + `PATCH /marcar-leidas` — incluye respuesta_cliente además de aprobado_online_at |
| `/interacciones` | routes/interacciones.ts | |
| `/tareas` | routes/tareas.ts | `PATCH /:id/completar` — si tiene `operacion_id`, limpia `respuesta_cliente` de esa operación |
| `/empresa` | routes/empresa.ts | |
| `/usuarios` | routes/usuarios.ts | |
| `/stock` | routes/stock.ts | `/alertas` y `/lotes` ANTES de `/:id` |
| `/remitos` | routes/remitos.ts | `/conteos` ANTES de `/:id` |
| `/recibos` | routes/recibos.ts | `/conteos` ANTES de `/:id` |
| `/pedidos` | routes/pedidos.ts | `/tablero` y `/reporte-envios` ANTES de `/:id` |
| `/transportistas` | routes/transportistas.ts | GET lista activos, POST crear, PATCH activar/desactivar |
| `/estado-cuenta` | routes/estadoCuenta.ts | |

**Crítico — Hono matchea en orden de registro:**
- Rutas específicas (`/validar-dni`, `/conteos`, `/generar-link`, etc.) ANTES de `/:id`
- Rutas públicas (`/pub`, `/auth`) registradas en `api` ANTES del bloque `apiAuth` con authMiddleware

## Rutas frontend (App.tsx)

```
/login                          — pública
/p/:token                       — pública, sin ProtectedRoute → VistaPublicaPresupuesto
/r/:token                       — pública, sin ProtectedRoute → VistaPublicaRemito
/dashboard
/presupuestos                   — lista + modal detalle (click en fila)
/presupuestos/nuevo
/presupuestos/:id/editar
/presupuestos/visita-tecnica          — crear visita técnica (elegir/crear cliente)
/presupuestos/visitas-tecnicas        — listado de visitas técnicas
/presupuestos/visitas-tecnicas/:id    — cargar relevado + avanzar a presupuesto
/ventas/rapida                  — venta rápida de mostrador
/operaciones, /operaciones/:id, /operaciones/nueva
/pedidos, /pedidos/nuevo, /pedidos/:id/editar
/remitos, /remitos/nuevo, /remitos/:id/editar
/recibos, /recibos/nuevo, /recibos/:id/editar
/clientes, /clientes/:id, /clientes/nuevo, /clientes/:id/editar
/productos, /productos/nuevo, /productos/:id
/stock, /proveedores
/estado-cuenta
/imprimir/presupuesto/:id       — sin AppLayout, dentro de ProtectedRoute
/imprimir/remito/:id
/imprimir/recibo/:id
/imprimir/visita-tecnica?visita_id=X  — formulario A4 (en blanco si pendiente, con datos si ya relevada)
```

## Circuito comercial completo — Presupuesto → Cobro → Entrega

### 1. Presupuesto
- Estado flujo: `presupuesto → enviado → aprobado → en_produccion → listo → instalado → entregado | cancelado | rechazado`
- Estado cobro (campo calculado, no columna): `sin_cobrar | seña | cobrado`
  - Se calcula en `GET /operaciones/ventas-panel` (LATERAL join) y `GET /operaciones/:id` (subquery)
  - `cobrado_total` = SUM(recibos.monto_total) WHERE operacion_id = o.id AND estado = 'emitido'
  - Visible en Presupuestos.tsx: badge en fila (aprobados) + sección Cobranza en modal

### 2. Recibos (cobro)
- Solo sobre operaciones `estado = 'aprobado'`
- Tipos: `pago total` (toma saldo automático) | `pago parcial` (monto manual)
- Pago contado: habilita bonificación sobre precio de productos (no envío ni instalación)
- `estado_cobro` en el recibo: `cobrado` (cubre total) | `parcial` (saldo pendiente) | `anulado`
- Flujo ágil desde Presupuestos: botón "Registrar cobro" en modal → `/recibos/nuevo` pre-cargado
- Flujo ágil desde Recibos: botón "Cobrar saldo" en filas parciales → `/recibos/nuevo?operacion_id=X&monto=Y&concepto=Cancelación de saldo`

### 3. Compromisos de pago
- Se crean automáticamente al guardar un recibo parcial (si el usuario activa la opción)
- Campo: `compromisos_pago (monto, fecha_vencimiento, tipo, estado: pendiente|cobrado|cancelado)`
- Se auto-cierran cuando `SUM(recibos.monto_total) >= operacion.precio_total`
- **NO aparecen en la lista de Recibos** — solo se ven como indicador informativo en el sidebar de Recibos (Deudas por cliente, Próximos vencimientos) y en el modal del recibo parcial

### 4. Remitos (entrega)
- Solo se crean desde operaciones aprobadas
- Estado: `borrador → emitido → entregado | cancelado`
- Al emitir: descuenta stock (movimientos `egreso_remito`)
- Al cancelar con stock descontado: revierte (movimiento `devolucion`)
- Tienen link público (`/pub/remito/:token`) para que el cliente confirme recepción
- Campo `recepcion_estado`: `conforme | con_observaciones | no_conforme`

### Visibilidad del pago por pantalla

| Pantalla | Dónde ver el pago |
|---|---|
| **Presupuestos** (lista) | Badge `○ Sin cobrar / ◑ Seña $X / ● Cobrado` en filas aprobadas |
| **Presupuestos** (modal) | Sección "Cobranza" con barra de progreso + botón "Registrar cobro" |
| **Recibos** (lista) | Filas con `estado_cobro: cobrado/parcial/anulado` + botón "Cobrar saldo" |
| **Recibos** (modal) | Total cobrado + saldo + fecha compromiso |
| **OperacionDetalle** | Panel lateral con recibos + totalCobrado + saldoPendiente |
| **Remitos** | No muestra estado de pago (solo flujo de entrega) |

---

## Visitas técnicas (relevamiento in situ → presupuesto)

Entidad persistida con ciclo de vida propio, independiente de operaciones hasta que se convierte:

1. **Crear** (`VisitaTecnica.tsx`, ruta `/presupuestos/visita-tecnica`): elegís/creás cliente (con domicilio) → `POST /visitas-tecnicas {cliente_id}` crea con `estado='pendiente'`, numeración `VT-YYYYMM-NNNN`.
2. **Imprimir en blanco**: `/imprimir/visita-tecnica?visita_id=X` → PDF A4 con datos del cliente precargados y el resto en blanco para completar a mano en el sitio (planilla física: ambientes, medidas en mm, color/vidrio/instalación/abertura especial, croquis, observaciones).
3. **Cargar relevado** (`CargarVisitaTecnica.tsx`, ruta `/presupuestos/visitas-tecnicas/:id`): `PUT /visitas-tecnicas/:id` guarda ítems medidos (mm), checkboxes de detalles, observaciones y **fotos de referencia** (subida vía `POST /visitas-tecnicas/upload-imagen`, mismo patrón que productos: sharp → webp 1920px). Al guardar con ≥1 ítem, pasa a `estado='relevada'`. Reimprimir ahora muestra los datos reales, no en blanco.
4. **Avanzar a presupuesto**: botón en `CargarVisitaTecnica.tsx` arma `itemsPrecargados` (conversión **mm → m**, `÷1000`, único punto donde se convierte unidad) y navega a `/presupuestos/nuevo` con `navigate(path, { state: { itemsPrecargados, clienteId, visitaTecnicaId, imagenesVisita } })`. `NuevoPresupuesto.tsx` lee ese `location.state` (solo si `!isEdit`), activa modo "a medida", precarga cliente e ítems, y muestra las fotos de la visita en una barra de referencia arriba del formulario.
5. Al guardar el presupuesto, si vino con `visita_tecnica_id`: `POST /operaciones` hace `UPDATE visitas_tecnicas SET operacion_id=$1, estado='convertida' WHERE estado != 'convertida'` — cierra el link. `DELETE /visitas-tecnicas/:id` y reediciones quedan bloqueadas una vez `convertida`.

**Listado**: `VisitasTecnicas.tsx` (`/presupuestos/visitas-tecnicas`), filtro por estado, entrada propia en Sidebar (sección Comercial). El botón "Visita técnica" en Presupuestos.tsx apunta a este listado, no directo a crear.

## Flujo de aprobación pública (link WhatsApp)

1. Admin abre modal presupuesto → "Compartir" → llama `POST /operaciones/:id/generar-link`
2. Backend genera UUID → guarda en `token_acceso` → devuelve `{ url: APP_URL/p/{token} }`
3. Modal muestra link copiable + botón WhatsApp (`wa.me/?text=...` con mensaje pre-armado)
4. Cliente abre `/p/{token}` → ve resumen → presiona "Aprobar"
5. Frontend llama `POST /api/pub/presupuesto/{token}/aprobar`
6. Backend: `estado='aprobado'`, `aprobado_online_at=now()`, `notif_leida=false`
7. Sistema admin: campanita muestra badge rojo, fila en lista resaltada en verde

### Re-aprobación tras rechazo
Si el cliente rechazó y el admin edita y reenvía:
- `POST /operaciones/:id/generar-link` y `POST /operaciones/:id/enviar-whatsapp`: si `estado='rechazado'` → automáticamente setea `estado='enviado'` junto con el nuevo token
- Así el cliente abre el nuevo link y ve la vista normal de aprobación (no "ya rechazado")
- `POST /pub/presupuesto/:token/aprobar` ya permite `estado='enviado'` → funciona sin cambios adicionales
- `motivo_rechazo` y `comentario_rechazo` quedan en DB como historial (no se borran)

### Respuesta intermedia del cliente (Fase 1 + Fase 2)
El link público no es binario aceptar/rechazar. "Todavía no / Tengo otra respuesta" (botón amarillo, destacado) despliega 4 opciones: **Necesito más tiempo** / **Tengo una consulta** / **Quiero que me contacten** (antes "me llamen") / **Quiero modificar la propuesta**.

- `POST /pub/presupuesto/:token/responder` — NO cambia `estado`, solo guarda `respuesta_cliente` + `respuesta_cliente_at`, crea una `interaccion` (tipo `respuesta_proforma`, con el motivo/comentario/cambios/horario real que escribió el cliente) y una `tarea` de seguimiento con fecha sugerida (`operacion_id` vinculado).
- **Cierre del loop** (Fase 2) — `respuesta_cliente` se limpia solo (vuelve a NULL) por 3 caminos, cualquiera de los 3 sirve:
  1. Admin reenvía la proforma: `POST /:id/generar-link` o `POST /:id/enviar-whatsapp` (reenviar = ya se hizo cargo del pedido de cambios).
  2. Admin completa la tarea de seguimiento vinculada: `PATCH /tareas/:id/completar` con `operacion_id` seteado.
  3. Admin marca manualmente "atendido": `PATCH /operaciones/:id/resolver-respuesta`.
- Frontend: tab "Seguimiento" en Presupuestos.tsx (`respuesta_cliente IS NOT NULL AND estado NOT IN aprobado/rechazado`), banner celeste en el modal con el texto real del cliente (`respuesta_cliente_detalle`) + botones contextuales (Llamar si `tipo=llamada`, Editar y reenviar si `tipo=modificar`, Marcar atendido siempre).

## Notificaciones (NotificationBell)

- Poll cada 30s a `GET /notificaciones`
- Devuelve operaciones con `(aprobado_online_at IS NOT NULL OR respuesta_cliente_at IS NOT NULL) AND notif_leida = false`, ordenadas por `GREATEST(aprobado_online_at, respuesta_cliente_at)`
- Badge rojo en campanita sidebar (desktop) y top bar (mobile); ícono/color varía según `respuesta_cliente` (ver `RESP_NOTIF` en NotificationBell.tsx)
- `PATCH /notificaciones/marcar-leidas` → setea `notif_leida = true` para todas
- Presupuestos.tsx: filas con `aprobado_online_at` → fondo verde + borde izquierdo emerald + badge "Aprobado online"

## Dashboard — indicadores accionables (`GET /dashboard/indicadores`)

Devuelve 5 arrays:
- `sin_confirmar` — operaciones con estado `presupuesto` o `enviado`
- `sin_pago` — estado `aprobado` sin recibos emitidos vinculados
- `pagados_no_entregados` — cobro total >= precio_total pero sin remito `entregado`
- `compromisos_semana` — `compromisos_pago` pendientes en próximos 7 días
- `stock_bajo` — `stock_actual <= stock_minimo` (solo productos con stock_minimo > 0)

## Sidebar — secciones y rutas

```
Dashboard         /dashboard
Comercial:
  Presupuestos    /presupuestos
  Operaciones     /operaciones
  Remitos         /remitos
  Recibos         /recibos
  Clientes        /clientes
  Estado de Cuenta /estado-cuenta
Catálogo:
  Productos       /productos
  Stock           /stock
  Proveedores     /proveedores
Sistema:
  Reportes        /reportes
  Configuración   /configuracion
```

## Convenciones de UI — diseño visual

### Sistema de contraste (fondo/cards)
- **Fondo app**: `#f0f4fb` (CSS var `--app-bg`) — azul muy claro
- **Cards principales**: `bg-white rounded-2xl border border-gray-200 shadow-md p-4` — borde y sombra marcados para destacar del fondo
- **Sección PRIORIDADES DE HOY**: contenedor `bg-gray-50 border-gray-200 shadow-md`, items internos `bg-white border-gray-200 shadow-sm` — items blancos sobre gris claro
- **KPIs (NÚMEROS CLAVE)**: cada KPI en `bg-gray-50 border border-gray-200 rounded-xl p-3` — recuadro individual por métrica
- **Regla general**: nunca usar `border-gray-100` ni `shadow-sm` solos — quedan invisibles contra `#f0f4fb`. Mínimo `border-gray-200 shadow-md`.

### Responsive mobile — `SectionHero` y `CompactStatsBar`
Estos 2 componentes compartidos se usan en casi todas las secciones (Dashboard, CRM, Presupuestos, Operaciones, Remitos, Pedidos, Recibos, Clientes, Estado de Cuenta, Productos, Stock, Proveedores, Reportes, Configuración). Si se tocan, verificar mobile (viewport ~390px) Y desktop (1366×768) antes de dar por cerrado — un bug ahí rompe visualmente toda la app.
- **`SectionHero`**: estructura `flex flex-col sm:flex-row` — en mobile ícono+título ocupan su fila completa y las acciones (botones) bajan a una fila propia con `flex-wrap` debajo; en `sm:` (640px+) vuelven a la misma fila que el título, como el diseño original. **No** volver a poner icono+texto+acciones en un solo `flex-wrap` sin el `flex-col` — el título se aprieta y los botones se cortan/superponen (bug real detectado 2026-07-22).
- **`CompactStatsBar`**: `overflow-x-auto` para scroll horizontal en mobile + fade a la derecha (`sm:hidden`) como pista visual de que hay más contenido. El div raíz **no** debe llevar `shrink-0` si su padre es un flex row (contradice el scroll).
- **Safety-net global**: `html, body { overflow-x: hidden }` en `index.css` — evita que un overflow puntual futuro arrastre toda la página de costado.
- Listas con tabla ancha (Presupuestos y similares) siguen con scroll horizontal propio en mobile (`overflow-x-auto` en el contenedor de la tabla) — funciona pero no es tarjetas apiladas; pendiente si se pide pulir más.

## Convenciones de UI — badges y labels

| Badge / label | Contexto | Condición |
|---|---|---|
| `Pago total` | Operaciones tablero, PagoBadge | `cobrado >= precio_total * 0.99` |
| `Señado` | Operaciones tablero, PagoBadge | `cobrado > 0` |
| `Envío total al proveedor` | Presupuestos lista | `items_en_pedido >= items_total` |
| `Env. parcial proveedor` | Presupuestos lista | `items_en_pedido > 0 && < items_total` |
| `llega hoy / llega mañana / llega el DD/MM` | Operaciones tablero col. `con_pedido` | `pedido_fecha_entrega_est` del pedido activo más reciente |
| `Llega hoy` (emerald) / `Mañana` (sky) / `Demorado Xd` (red) | Pedidos lista col. fecha entrega | diff días vs hoy; solo en estados pendiente/enviado |
| `Pendiente de Aprobación` | Presupuestos, Operaciones, Dashboard — ESTADO_LABEL | presupuesto sin aprobar (antes era "Borrador") |

### Convención de ordenamiento en listas
Todos los módulos: `ORDER BY created_at DESC` (más nuevos arriba). Excepción puntual documentada en el código.

### Tablero Operaciones — columna `con_pedido`
`baseSelect` incluye subquery `pedido_fecha_entrega_est` → pedido activo más reciente (excluye cancelado/recibido).
Helper `fmtLlegada()` en Operaciones.tsx: diff ≤0 → "llega hoy", 1 → "llega mañana", N → "llega el DD/MM".

## Patrones de código establecidos

### Generación de `numero` — MAX, nunca COUNT
Todos los generadores de número correlativo (`OP-`, `REC-`, `REM-`, `PED-`, lotes de stock, `VT-`) usan:
```sql
SELECT COALESCE(MAX(SUBSTRING(numero FROM '(\d+)$')::int), 0) AS n FROM <tabla> WHERE numero LIKE $1
```
luego `n + 1`. **Nunca** `SELECT COUNT(*)`: si se borra una fila, `COUNT` sub-cuenta y regenera un número ya usado → `duplicate key` en el constraint único, y la transacción entera hace rollback (bug real: causó que una venta rápida pareciera "no hacer nada" — en realidad fallaba silenciosamente por esto). Ya corregido en `operaciones.ts`, `recibos.ts`, `remitos.ts`, `pedidos.ts`, `stock.ts` (lotes) y `visitasTecnicas.ts`.

### API client (frontend)
```typescript
// CORRECTO — retorna T directamente
const data = await api.get<Recibo[]>('/recibos');
const item = await api.post<{ id: string }>('/recibos', body);
api.patch('/notificaciones/marcar-leidas');   // sin body OK

// MAL
const { data } = await api.get('/recibos');          // ❌ no hay wrapper .data
api.get('/recibos', { params: { search } });          // ❌ no acepta 2do arg
// Query params correctos:
api.get(`/recibos?${new URLSearchParams({ search })}`)  // ✅
```

### Modales de detalle (patrón Presupuestos/Recibos/Productos)
- Lista: filas con `cursor-pointer onClick={() => setDetailId(op.id)}`
- Modal como componente separado, recibe `id` y llama API interna
- Header: número + estado badge + botones Editar/PDF/Compartir + X
- Confirmación destructiva (anular/eliminar): pantalla roja dentro del mismo modal (NO `window.confirm`)

### Selectores con búsqueda
- Input con `onFocus`/`onBlur` (setTimeout 150ms para click)
- Dropdown `z-30`, `onMouseDown` (no onClick) para evitar blur race
- Badge de seleccionado con botón X para limpiar

### Columnas DATE de PostgreSQL — comportamiento del driver `pg`
`pg` v8.x con `pg-types` v2.x retorna columnas `DATE` (OID 1082) como **objetos JavaScript Date** (no strings). Al serializar con `c.json()`, los Date objects → `"YYYY-MMT03:00:00.000Z"` (hora TZ Argentina). Esto afecta TODAS las columnas DATE en todos los módulos.

**Regla:** siempre usar el helper timezone-safe para formatear fechas:
```typescript
// Frontend (React):
new Date(iso.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { ... })

// Backend (PDF server-side, pdf.ts):
const fmtFecha = (iso: string | Date | unknown) => {
  const isoStr = iso instanceof Date ? iso.toISOString() : String(iso);
  return new Date(isoStr.slice(0, 10) + 'T12:00:00').toLocaleDateString('es-AR', { ... });
};
```

**NO hacer:** `String(dateObj).slice(0, 10)` → da `"Thu Jul 10"` → Invalid Date.
**NO hacer:** `new Date(dateStr)` directo sin slice → RangeError o día anterior por TZ offset.

### fecha_validez en operaciones
Viene de PostgreSQL tipo `date` como ISO string completo `"2026-05-22T00:00:00.000Z"`.
Siempre usar `.slice(0, 10) + 'T12:00:00'` antes de formatear — de lo contrario RangeError en Intl.

### Pedidos al proveedor — lógica de costo de envío

Los pedidos son contra-reembolso: el transportista cobra la parte de envío (~10%) directamente al recibir; el proveedor solo recibe el costo de productos.

- `pedidos.costo_envio` = monto que va al transporte (NO al proveedor)
- `pedidos.monto_total` = subtotal_items + costo_envio (total desembolsado)
- Al crear pedido: `costo_envio` se sugiere como 10% editable (estado `costoEnvioManual`)
- Al marcar `recibido`: se registra el transportista real (`transportista_id`) y se puede ajustar `costo_envio_real` → backend recalcula `monto_total`

**`WITH_PROVEEDOR` CTE** en `server/src/routes/pedidos.ts`: constante SQL reutilizada en todos los GET, incluye `LEFT JOIN transportistas t ON t.id = p.transportista_id` y campo `t.nombre AS transportista_nombre`.

**Coverage de ítems — stock-aware** (GET /:id y GET /tablero): `items_total_op` y `items_cubiertos`. Un `operacion_item` cuenta como **cubierto** si (a) tiene un `pedido_item` NO reposición en pedido no cancelado, **O** (b) su producto tiene `stock_actual >= cantidad` (regla del negocio: si hay stock, no se pide, se cumple desde stock vía remito). Si `items_cubiertos < items_total_op` → banner "Completar pedido faltante". La misma lógica stock-aware está en `GET /operaciones-disponibles` (no sugiere operaciones cuyos ítems ya están todos en stock o pedidos).

**Ítems de reposición** (`pedido_items.es_reposicion`): al armar el pedido desde una operación, un ítem con `stock_actual >= cantidad` viene DESmarcado (se cumple de stock). El usuario puede togglear "Pedir igual para reponer" → el ítem se pide como EXTRA para no dejar el salón sin producto (`en_salon`) o reponer stock. Ítem de reposición: `operacion_item_id = NULL` + `producto_id` seteado + `es_reposicion = true`. NO cuenta en coverage ni en el guard anti-duplicado (ambos filtran `es_reposicion = false` y los de reposición ya tienen `operacion_item_id` null). Al recibir el pedido entra a stock (ingreso por `producto_id`, ya cubierto). `stock_actual` por ítem viene de `GET /operaciones/:id` (columna agregada al subquery de items). Frontend: `NuevoPedido.tsx` badges "En stock (N)" (sky) / "Reposición" (violeta) + toggle.

**Pedido para stock propio** (`pedidos.es_stock_propio`): pedido al proveedor que NO viene de un presupuesto — destino es la propia empresa (generar stock o exhibir en salón), sin cliente ni operación. Entrada: botón "Para stock propio" en Pedidos.tsx → `/pedidos/nuevo?destino=stock`. En ese modo `NuevoPedido.tsx` oculta el selector de operación y muestra: (a) buscador rápido de productos (`GET /productos?search=`) y (b) botón "Ver galería" → modal con grid de cards + filtro por tipo de abertura (`GET /catalogo/productos` + `/catalogo/tipos-abertura`), estilo galería de NuevoPresupuesto. Cada producto elegido agrega un ítem con `producto_id` (indispensable: al recibir ingresa a stock). No requiere pago/seña (es interno). Backend fuerza `operacion_id=NULL` cuando `es_stock_propio=true` (POST y PUT). Excluido de `para_preparar` en el tablero. Lista/detalle muestran badge "Stock propio" en lugar del cliente. `WITH_PROVEEDOR` expone la columna vía `p.*`.

**Operación 100% cubierta por stock → lista para entregar sin pedido** (`STOCK_CUBRE_TODO` en operaciones.ts): predicado SQL = todos los `operacion_items` tienen `producto_id` y `stock_actual >= cantidad` (y al menos 1 ítem). Cuando una op `aprobado` cumple esto NO necesita pedido al proveedor: en `GET /tablero` sale de "Confirmadas" y entra a "Lista p/ entregar" (columna 4 amplía su condición: `pedido recibido` OR `aprobado + STOCK_CUBRE_TODO`, siempre sin remito activo ni pedido pendiente). `GET /:id` y el `baseSelect` del tablero exponen `stock_cubre_todo` (boolean). Presupuestos.tsx modal: banner sky "Todo en stock — lista para entregar / no necesitás pedido (hacé uno solo si querés reponer)" + botón "Registrar entrega (remito)" directo a `/remitos/nuevo?operacion_id=...`. El remito se crea desde la op aprobada sin pedido previo (ya soportado).

**`GET /pedidos/reporte-envios`**: agrupa pedidos `recibido` por mes y transportista, devuelve totales. Registrar ANTES de `GET /:id` en el router.

### Migraciones
Al crear nueva migración:
1. Crear `supabase/migrations/YYYYMMDDNNNNNN_nombre.sql` con el SQL
2. Incluir al final: `INSERT INTO schema_migrations (filename) VALUES ('archivo.sql') ON CONFLICT DO NOTHING;`
3. **No tocar `01_schema.sh`** — auto-descubre todos los .sql en orden
4. Aplicar local: `cd server && npm run migrate`
5. VM: `cd server && npm run migrate` (misma DB_URL del .env)

**Comandos del runner:**
```bash
npm run migrate        # aplica pendientes
npm run migrate:list   # muestra estado de todas las migraciones
npm run migrate:dry    # preview sin ejecutar
```

**Cómo funciona:**
- Lee `supabase/migrations/*.sql` en orden cronológico (por nombre)
- Compara contra `schema_migrations` en DB
- Aplica solo las pendientes, dentro de transacción por migración
- Si una falla → rollback de esa sola, las anteriores ya aplicadas quedan

### PDF generado en servidor (WhatsApp) vs PDF del navegador (print)
Hay DOS rutas de generación de PDF para recibos:
1. **Navegador**: `/imprimir/recibo/:id` → `ImprimirRecibo.tsx` → `window.print()` (browser CSS)
2. **Servidor**: `POST /recibos/:id/whatsapp-pdf` → Puppeteer → `server/src/lib/pdf.ts` → `generarPDFRecibo()`

Ambas deben mantener el mismo diseño. Si se actualiza el diseño en `ImprimirRecibo.tsx`, replicar los cambios en `pdf.ts`.

`generarPDFRecibo()` recibe: `{ ...r, items, cobrado_operacion, total_descuentos_operacion, compromiso }`.
- `r` incluye columnas directas de `recibos`: `monto_descuento`, `descuento_pct`, `monto_lista`.
- `total_descuentos_operacion`: calculado aparte en la ruta WA (SUM de monto_descuento de todos los recibos emitidos).

### Saldo de operación — fórmula correcta
```
saldo_real = precio_total - cobrado_operacion - total_descuentos_operacion
```
`cobrado_operacion` = SUM(monto_total) de recibos emitidos para esa operación (lo que pagó en efectivo/transferencia).
`total_descuentos_operacion` = SUM(monto_descuento) de recibos emitidos (bonificación = no es deuda).
**NO restar solo `cobrado_operacion`** — la bonificación NO es saldo deudor.

### Flujo pedido → operación → kanban
Cuando un pedido pasa a `recibido` y todos los pedidos de la operación están `recibido/cancelado`:
- Backend (`PATCH /pedidos/:id/estado`): actualiza `operaciones.estado = 'listo'`
- Solo avanza si estado actual no es ya `listo/instalado/entregado/cancelado/rechazado`
- Tablero kanban: `listo` queda en columna `listas_entregar` (query verifica `pedido recibido + sin remito activo`)
- Columna `listas_entregar` muestra botón "Avisar al cliente" → Evolution API

### WhatsApp — Evolution API (no wa.me)
Todos los envíos de WhatsApp usan Evolution API, NO `window.open('https://wa.me/...')`.
Env vars requeridas: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`.
Normalización número Argentina: `549XXXXXXXXXX` (código país 54 + 9 + celular sin 0).

### Kanban Operaciones — colores por columna
Cada columna tiene su propio color (slate/green/amber/teal/blue/red).
Las cards (`TCard`) usan `COL_CARD_BG[col]` para el fondo — mismo color que el header de la columna.
No usar `bg-white` genérico para cards del kanban.

### Dashboard — widget de pronóstico del tiempo
Componente `WeatherWidget` en `Dashboard.tsx`:
- API: Open-Meteo (gratuita, sin API key) — Formosa AR: lat -26.18, lon -58.18
- Muestra: temperatura actual + emoji WMO + descripción (clic para ver semana)
- Posición: columna central del header (`flex-1 flex justify-center`), entre el bloque saludo/fecha y los botones de la derecha — NO debajo del saludo
- Diseño: `border-2 border-sky-300 bg-gradient-to-r from-sky-50 to-blue-50 shadow-md`, emoji `text-3xl`, temp `text-xl font-black text-sky-700`

## Problemas conocidos y soluciones

### crypto.randomUUID() falla en HTTP
VM en HTTP → `crypto.randomUUID()` no disponible. Usar fallback:
```typescript
const token = (typeof crypto !== 'undefined' && crypto.randomUUID)
  ? crypto.randomUUID()
  : `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
```

### initdb solo corre en DB vacía
`docker-entrypoint-initdb.d/` solo ejecuta si `data/db/` está vacío.
VM con DB existente: migraciones nuevas aplicar manualmente.

### Hono route ordering
Rutas específicas ANTES de `/:id`. Error silencioso si no: la específica matchea el param.

### React render crash → pantalla en blanco
React 18 prod: excepción en render sin error boundary → desmonta árbol silenciosamente → pantalla blanca.
Agregar `.catch()` en todos los useEffect que hacen fetch y setear estado de error.

### operacion_items — columnas calculadas vs reales
`precio_total`, `tipo_abertura_nombre`, `sistema_nombre` NO son columnas reales.
En queries SQL de rutas públicas o nuevas: calcular/JOIN explícitamente.

`atributos` tampoco existe en `operacion_items` — está en `catalogo_productos`. Siempre usar `cp.atributos` con JOIN:
```sql
LEFT JOIN catalogo_productos cp ON cp.id = oi.producto_id
-- luego: cp.atributos AS producto_atributos
```

### Google Translate crash en Android — `lang` y `translate`
`index.html` tiene `lang="es" translate="no"`. Crítico: si se cambia a `lang="en"`, Chrome Android ofrece traducir → Google Translate muta text nodes del DOM → React 19 no puede hacer `insertBefore` → ErrorBoundary "Algo salió mal". No revertir este atributo.

## Comandos frecuentes

```bash
# Rebuild solo app (sin tocar DB)
docker compose build app && docker compose up -d --force-recreate app

# Migraciones
cd server && npm run migrate        # aplica pendientes
cd server && npm run migrate:list   # ver estado de todas
cd server && npm run migrate:dry    # preview sin ejecutar

# Ver logs en tiempo real
docker compose logs app -f --tail=30

# Conectar a DB
docker compose exec db psql -U postgres -d postgres

# Tests
cd server && npm test     # backend (schemas, rate limiter)
npm test                  # frontend (utils)
```

## VM de producción — deploy

```bash
git pull origin main
# Aplicar migraciones nuevas manualmente
docker compose exec -T db psql -U postgres -d postgres -f /migrations/ARCHIVO.sql
# Rebuild
docker compose build app && docker compose up -d --force-recreate app
```

Variables de entorno requeridas en `.env`:
```
POSTGRES_PASSWORD=...
JWT_SECRET=...
APP_URL=http://149.50.150.131:3000   # o dominio público — usado en links de aprobación
APP_PORT=3000
```
