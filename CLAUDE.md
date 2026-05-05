# Aberturas — CRM / ERP de gestión para local de aberturas

## Descripción del negocio
Local de venta e instalación de aberturas (ventanas, puertas, etc.).
Maneja productos estándar (stock propio), productos a medida (fabricados por proveedor) y fabricación propia.
Flujo: presupuesto → aprobación → recibo de pago → remito de entrega.

## Repositorio
- GitHub: `git@github.com:gouxgle/averturas.git`
- Rama principal: `main`
- Deploy local: `http://localhost:3000`
- Deploy VM: `http://149.50.150.131:3000` (HTTP, no HTTPS — importante para crypto APIs)

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
│   │   ├── Recibos.tsx               # Lista + modal detalle con anulación
│   │   ├── NuevoRecibo.tsx           # Crear/editar recibo (vinculado a op. aprobada)
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
│   │   ├── operaciones.ts            # + POST /:id/generar-link
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

### fecha_validez en operaciones
Viene de PostgreSQL tipo `date` como ISO string completo `"2026-05-22T00:00:00.000Z"`.
Siempre usar `.slice(0, 10) + 'T12:00:00'` antes de formatear — de lo contrario RangeError en Intl.

### Migraciones
Al crear nueva migración:
1. Crear `supabase/migrations/YYYYMMDDNNNNNN_nombre.sql`
2. `INSERT INTO schema_migrations (filename) VALUES ('...') ON CONFLICT DO NOTHING;` al final
3. Agregar en `docker/initdb/01_schema.sh` (2 lugares: línea `psql` + línea en INSERT)
4. Aplicar local: `docker compose exec -T db psql -U postgres -d postgres -f /migrations/archivo.sql`
5. VM: aplicar manualmente igual (initdb no re-corre con DB existente)

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

# Aplicar migración a DB local
docker compose exec -T db psql -U postgres -d postgres -f /migrations/ARCHIVO.sql

# Ver logs en tiempo real
docker compose logs app -f --tail=30

# Conectar a DB
docker compose exec db psql -U postgres -d postgres
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
