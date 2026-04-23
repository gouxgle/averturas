# Aberturas — CRM / ERP de gestión para local de aberturas

## Descripción del negocio
Local de venta e instalación de aberturas (ventanas, puertas, etc.).
Maneja productos estándar (stock propio), productos a medida (fabricados por proveedor) y fabricación propia.
Flujo: presupuesto → operación → remito de entrega / retiro en local.

## Repositorio
- GitHub: `git@github.com:gouxgle/averturas.git`
- Rama principal: `main`
- Deploy local: `http://localhost:3000`
- Deploy VM: `http://149.50.150.131:3000` (HTTP, no HTTPS — importante para crypto APIs)

## Stack técnico

### Frontend
- React 19 + TypeScript + Vite
- Tailwind CSS (sin shadcn puro — componentes propios con Radix primitives)
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
- Cada migración hace `INSERT INTO schema_migrations` al final
- Uploads en `./uploads/` (montado como volumen)

## Estructura de archivos clave

```
Aberturas/
├── src/                        # Frontend React
│   ├── pages/                  # Una página por sección
│   ├── components/Layout/      # AppLayout, Sidebar
│   ├── lib/api.ts              # Cliente HTTP — api.get<T>(), api.post<T>(), etc.
│   ├── hooks/useAuth.ts
│   └── App.tsx                 # Rutas React Router
├── server/src/
│   ├── routes/                 # Un archivo por entidad
│   ├── middleware/auth.ts      # JWT middleware
│   ├── db.ts                   # Pool de PostgreSQL
│   └── index.ts                # Hono app, rutas, serve static
├── supabase/migrations/        # SQL migrations en orden
├── docker/initdb/01_schema.sh  # Script initdb que aplica migrations
├── Dockerfile                  # Multi-stage build
└── docker-compose.yml
```

## Base de datos — tablas principales

```
usuarios            — roles: admin | vendedor | consulta
empresa             — datos del local (nombre, CUIT, etc.)
tipos_abertura      — catálogo: Ventana, Puerta, etc.
sistemas            — catálogo: PVC, aluminio, etc.
colores             — catálogo de colores
proveedores         — fabricantes, revendedores, importadores
catalogo_productos  — productos (tipo: estandar | a_medida | fabricacion_propia)
categorias_cliente
clientes            — personas físicas y jurídicas
interacciones       — historial CRM por cliente
tareas              — seguimiento por cliente
operaciones         — tipo: estandar | a_medida_proveedor | fabricacion_propia
operacion_items     — líneas de operación
estados_historial   — auditoría de cambios de estado en operaciones
stock_lotes         — lotes de ingreso (numero: LOT-YYYYMM-NNNN, proveedor, remito)
stock_movimientos   — todos los movimientos de stock (cantidad signed: + entrada, - salida)
remitos             — remitos de entrega (numero: R-YYYYMM-NNNN)
remito_items        — líneas de remito con estado_producto (nuevo|bueno|con_detalles)
```

### Tipos/enums PostgreSQL
```sql
app_role:        admin | vendedor | consulta
tipo_operacion:  estandar | a_medida_proveedor | fabricacion_propia
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

## Rutas del backend (`/api/`)

| Ruta | Archivo | Notas |
|------|---------|-------|
| `/auth` | routes/auth.ts | Pública — login, me |
| `/clientes` | routes/clientes.ts | `/validar-dni` DEBE ir antes de `/:id` |
| `/productos` | routes/productos.ts | CRUD con upload de imagen |
| `/operaciones` | routes/operaciones.ts | |
| `/catalogo` | routes/catalogo.ts | tipos-abertura, sistemas, colores, categorias, proveedores, productos |
| `/dashboard` | routes/dashboard.ts | |
| `/interacciones` | routes/interacciones.ts | |
| `/tareas` | routes/tareas.ts | |
| `/empresa` | routes/empresa.ts | |
| `/usuarios` | routes/usuarios.ts | |
| `/stock` | routes/stock.ts | `/alertas` y `/lotes` ANTES de `/:id` |
| `/remitos` | routes/remitos.ts | `/conteos` ANTES de `/:id` |

**Crítico — Hono matchea en orden de registro**: rutas específicas (`/validar-dni`, `/alertas`, `/conteos`, `/lotes`) deben registrarse ANTES de `/:id` en cada router.

## Sidebar — secciones y rutas

```
Dashboard         /dashboard
Comercial:
  Presupuestos    /presupuestos
  Operaciones     /operaciones
  Remitos         /remitos
  Clientes        /clientes
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
const data = await api.get<ProductoStock[]>('/stock');
const item = await api.post<{ id: string }>('/remitos', body);

// MAL — api NO retorna { data: T }
const { data } = await api.get('/stock');          // ❌
api.get('/stock', { params: { search } });          // ❌ no acepta segundo arg
// Correcto para query params:
api.get(`/stock?${new URLSearchParams({ search })}`)  // ✅
```

### Selectores con búsqueda (patrón establecido)
Todos los selectores de entidades (cliente, producto) usan autocomplete propio:
- Input con `onFocus`/`onBlur` (setTimeout 150ms para click)
- Dropdown `z-30`, `onMouseDown` (no onClick) para evitar blur race
- Badge de seleccionado con botón X para limpiar

### Validaciones
- DNI: validar en blur Y en save antes de POST/PUT
- TitleCase: aplicar en blur en campos nombre, apellido, razon_social

### Migraciones
Al crear nueva migración:
1. Crear archivo en `supabase/migrations/YYYYMMDDNNNNNN_nombre.sql`
2. Agregar `INSERT INTO schema_migrations` al final del SQL
3. Agregar línea en `docker/initdb/01_schema.sh` (dos lugares: psql + INSERT)
4. Aplicar a DB local: `docker compose exec -T db psql -U postgres -d postgres -f /migrations/archivo.sql`
5. Para VM: aplicar manualmente igual

## Problemas conocidos y soluciones

### crypto.randomUUID() falla en HTTP
VM accedida por HTTP (no HTTPS) → `crypto.randomUUID()` no disponible.
Usar siempre fallback:
```typescript
function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
```

### initdb solo corre en DB vacía
`docker-entrypoint-initdb.d/` solo ejecuta si `data/db/` está vacío.
Para VM con DB existente: aplicar migraciones nuevas manualmente.

### Hono route ordering
Siempre registrar rutas específicas antes que `/:id`. Error silencioso: la ruta específica matchea el param y retorna 404 o datos incorrectos.

## Comandos frecuentes

```bash
# Build y deploy local
docker compose build && docker compose up -d

# Solo rebuild app (sin tocar DB)
docker compose build app && docker compose up -d --force-recreate app

# Aplicar migración a DB local
docker compose exec -T db psql -U postgres -d postgres -f /migrations/ARCHIVO.sql

# Ver logs
docker compose logs app --tail=20

# Conectar a DB
docker compose exec db psql -U postgres -d postgres
```

## VM de producción
- IP: `149.50.150.131`, puerto `3000`
- Acceso HTTP (no HTTPS) — limitación para crypto APIs
- Migraciones nuevas aplicar manualmente (DB no está vacía, initdb no re-corre)
