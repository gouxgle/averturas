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
│   │   ├── VistaPublicaPresupuesto.tsx  # Página pública /p/:token (sin auth)
│   │   └── print/
│   │       ├── ImprimirPresupuesto.tsx
│   │       └── ImprimirRecibo.tsx
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── AppLayout.tsx         # Layout principal con Toaster
│   │   │   └── Sidebar.tsx           # Nav lateral con NotificationBell
│   │   └── NotificationBell.tsx      # Campanita de notificaciones (polling 30s)
│   ├── lib/api.ts                    # Cliente HTTP
│   ├── hooks/useAuth.ts
│   └── App.tsx                       # Rutas React Router
├── server/src/
│   ├── routes/
│   │   ├── pub.ts                    # Rutas PÚBLICAS sin auth (/pub/presupuesto/:token)
│   │   ├── notificaciones.ts         # GET/PATCH notificaciones de aprobación
│   │   ├── operaciones.ts            # + POST /:id/generar-link; tablero incluye pedido_fecha_entrega_est
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
pedidos             — pedidos al proveedor (estado: pendiente|enviado|recibido|cancelado; fecha_entrega_est DATE; costo_envio NUMERIC; transportista_id UUID FK)
pedido_items        — líneas del pedido (descripcion, cantidad, costo_unitario, orden; operacion_item_id UUID nullable FK → vincula ítem con operación origen)
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
```

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
| `/pub/presupuesto/:token` | routes/pub.ts | **PÚBLICA** — sin auth, GET detalle + POST aprobar |
| `/auth` | routes/auth.ts | Pública — login, me |
| `/clientes` | routes/clientes.ts | `/validar-dni` ANTES de `/:id` |
| `/productos` | routes/productos.ts | CRUD con upload de imagen |
| `/operaciones` | routes/operaciones.ts | `POST /:id/generar-link` ANTES de `GET /:id` |
| `/catalogo` | routes/catalogo.ts | tipos-abertura, sistemas, colores, categorias, proveedores |
| `/dashboard` | routes/dashboard.ts | `GET /indicadores` devuelve 5 arrays accionables |
| `/notificaciones` | routes/notificaciones.ts | `GET /` + `PATCH /marcar-leidas` |
| `/interacciones` | routes/interacciones.ts | |
| `/tareas` | routes/tareas.ts | |
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
/dashboard
/presupuestos                   — lista + modal detalle (click en fila)
/presupuestos/nuevo
/presupuestos/:id/editar
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

## Flujo de aprobación pública (link WhatsApp)

1. Admin abre modal presupuesto → "Compartir" → llama `POST /operaciones/:id/generar-link`
2. Backend genera UUID → guarda en `token_acceso` → devuelve `{ url: APP_URL/p/{token} }`
3. Modal muestra link copiable + botón WhatsApp (`wa.me/?text=...` con mensaje pre-armado)
4. Cliente abre `/p/{token}` → ve resumen → presiona "Aprobar"
5. Frontend llama `POST /api/pub/presupuesto/{token}/aprobar`
6. Backend: `estado='aprobado'`, `aprobado_online_at=now()`, `notif_leida=false`
7. Sistema admin: campanita muestra badge rojo, fila en lista resaltada en verde

## Notificaciones (NotificationBell)

- Poll cada 30s a `GET /notificaciones`
- Devuelve operaciones con `aprobado_online_at IS NOT NULL AND notif_leida = false`
- Badge rojo en campanita sidebar (desktop) y top bar (mobile)
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

**Coverage de ítems** (GET /:id): el detalle incluye `items_total_op` y `items_cubiertos` — calculados con subquery contando `operacion_items` vinculados via `pedido_items.operacion_item_id`. Si `items_cubiertos < items_total_op` → modal muestra botón naranja "Completar pedido faltante" → navega a `/pedidos/nuevo?operacion_id=XXX`.

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
- Posición: entre el h1 de saludo y el p de fecha en el header del Dashboard

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
