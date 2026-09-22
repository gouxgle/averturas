# Aberturas — CRM / ERP de gestión para local de aberturas

Local de venta e instalación de aberturas (ventanas, puertas, etc.). Productos estándar (stock
propio), a medida (fabricados por proveedor) y fabricación propia.
Flujo: presupuesto → aprobación → recibo de pago → remito de entrega.

- GitHub `git@github.com:gouxgle/averturas.git`, rama `main`.
- Documentación larga que NO hace falta cada sesión: `docs/backups.md` (cron, rclone y su
  historial de fallos), `docs/compras-plan.md` (plan completo del módulo Compras y
  Proveedores — ver "Pendientes" abajo), `docs/pedidos-rediseno-pendiente.md` (diseño
  anterior de pedidos, superado por `compras-plan.md`; queda por las ideas descartadas),
  `docs/catalogo-web.md` (contrato de datos para el sitio web público).

## Pendientes y estado al 2026-09-22 (leer al empezar una sesión)

- **Módulo "Compras y Proveedores"** — plan completo en `docs/compras-plan.md`. **Etapas 1 y 2
  hechas y en test**: SC → PC → comparativa → OC (etapa 1) y confirmación / seguimiento /
  demora automática / recepción por ítem / reclamos `REC-` (etapa 2). **Falta la Etapa 3**
  (documentos, facturas, control económico, cuenta corriente con `proveedor_cc_movimientos`,
  pagos, cierre por 4 estados; las franjas Finanzas y Documentación de la OC muestran "—"
  hasta entonces). Arrancarla desde el plan; una etapa = un commit deployado a test.
- **Prod atrasado respecto a test**: prod está en `5be8dbd`; en GitHub y test están además
  `bfe0bcd`, `6e18888`, `eeef084` y las etapas 1 y 2 de Compras (migraciones grandes: tablas
  `compras_*` + columnas en `pedidos`/`pedido_items`). Deploy a prod solo cuando el usuario lo
  pida (backup previo + `echo si | bash deploy-env.sh prod`).

## Ambientes

| Ambiente | URL | Notas |
|---|---|---|
| Local | `http://localhost:3000` (contenedor) · `:5173`+`:3001` (nativo) | DB en `127.0.0.1:5434` |
| Test | `http://aberturas.solucionesgps.com.ar` — `149.50.150.131:5889` | HTTP sin HTTPS; 1.9 GB RAM compartidos con ~11 contenedores ajenos; deploy en `/etc/docker/averturas` |
| Prod | `https://aberturas.cesarbritez.com.ar` — `179.43.120.103:5912` | Repo en `/opt/docker/cesarbritez/aberturas`; **el compose real es `/opt/docker/cesarbritez/docker-compose.yml`, fuera del repo** — toda env var nueva para `aberturas-app`/`aberturas-db` va ahí a mano |

- Reverse proxy: test = contenedor `nginx_proxy` (config dentro del contenedor en
  `/etc/nginx/conf.d/aberturas.conf`, reload `docker exec nginx_proxy nginx -s reload`);
  prod = nginx del sistema (`/etc/nginx/sites-enabled/aberturas.conf`, `systemctl reload nginx`).
  Ambos con `client_max_body_size` ≥ 20M. Un "Error al subir imagen" genérico tras una subida
  grande es 413 del proxy, no un bug de la app — mirar el log del proxy, no solo el de la app.
- Timezone: DB y app en `America/Argentina/Buenos_Aires` (migración
  `20260725000003_timezone_argentina.sql` + env `TZ`). En prod `TZ` va en el compose del host.
- `APP_URL` obligatoria en test/prod: arma los links públicos (`/p/:token`) y el badge de
  entorno (`GET /pub/entorno`, que en local no muestra nada).

## Cómo trabajar en este repo (para Claude) — velocidad de iteración

El usuario prioriza bajar los tiempos y **no quiere preguntas de confirmación al cierre**
("¿deployo?"): terminar el ciclo — código → verificación → commit → push → **deploy a test**
→ verificación post-deploy → rebuild del `:3000` local — y reportar. **PROD NUNCA se deploya
automáticamente**: lo hace el usuario cuando decide, después de probar en test (regla del
2026-09-17). El reporte final cierra siempre con el estado: commit · GitHub · test ✅ · prod ⏳
pendiente (`echo si | bash deploy-env.sh prod`, con backup previo). Preguntar solo ante algo
irreversible o ambiguo con impacto real distinto. Ante ambigüedad menor, decidir lo más
consistente con el código y mencionarlo en el resumen.

**Todo corre NATIVO en el host (Node 24). Docker solo para la DB y el chequeo final
pre-deploy.** `node_modules` debe ser del usuario (`sistemas`); si aparece `EACCES` en
`node_modules`, es que volvió a quedar de root: `docker run --rm -v "$PWD":/w alpine chown -R
1000:1000 /w/node_modules /w/server/node_modules` (Docker corre como root, sin sudo).

```bash
npm run typecheck        # tsc -b frontend — 1.4 s incremental
npm run typecheck:all    # + backend
npm run test:all         # vitest front (110) + back (59) — ~8 s
npm run check            # typecheck:all + test:all
npm run test:e2e         # Playwright nativo, Chrome del host, 54 tests en ~65 s
npm run dev:api          # backend nativo en :3001 con recarga (tsx watch)
npm run dev              # Vite en :5173, proxea /api y /uploads a :3001
cd server && npm run migrate   # lee server/.env
```

- **Backend nativo**: `server/.env` (ignorado por git; recrear copiando `POSTGRES_PASSWORD` y
  `JWT_SECRET` del `.env` raíz) con `DATABASE_URL=postgres://postgres:...@127.0.0.1:5434/postgres`,
  `PORT=3001`, `CHROMIUM_PATH=/usr/bin/google-chrome`, `LOGIN_RATE_LIMIT=500`, `TZ`. `index.ts`
  carga `dotenv/config` (no-op en el contenedor). `server/uploads` es symlink a `../uploads`
  para que `serveStatic` (cwd=`server/`) sirva las imágenes. PDFs con puppeteer funcionan
  nativos. **Un cambio en `server/` no necesita rebuild para probarse.**
- **Vite**: `API_URL=http://localhost:3000 npm run dev` apunta al contenedor.
- **Playwright**: `channel: 'chrome'`, carga `tests/.env.e2e` solo, login por API con token
  inyectado (`addInitScript`) y **un solo login por corrida** (`tests/global-setup.ts`) —
  varios workers logueándose pisan el rate limit de `/api/auth/*` (10/min) y caen en 429. No
  volver al login por formulario (3-5 s por test y flake del `waitForURL`). Apunta a `:3000`;
  `E2E_BASE_URL=http://localhost:5173` para Vite+nativo. Usuario fijo `e2e@local.test` solo en
  la DB local (ver `tests/README.md`). **Si un test crea recibos/operaciones, borrarlos al
  final**: re-correr sobre la misma operación cambia el escenario.
- **Typecheck frontend = `tsc -b`, NUNCA `tsc --noEmit`**: el `tsconfig.json` raíz tiene
  `files: []` y `--noEmit` revisa cero archivos y sale 0. El `.tsbuildinfo` vive en
  `node_modules/.tmp/`; si no es escribible, `tsc -b` revisa todo cada vez (22 s).
- **El usuario prueba en `:3000` (contenedor local).** Después de cada commit con cambios de
  código, reconstruir esa imagen o va a ver código viejo (pasó 2026-09-17: reportó un
  "bug" sobre una imagen de 34 h atrás). Los builds para test usan otra etiqueta
  (`deploy-test`) y NO actualizan `:3000`. Comando:
  `docker build -t aberturas-app:latest --build-arg SRC_HASH=$(git rev-parse HEAD:src) --build-arg SERVER_HASH=$(git rev-parse HEAD:server/src) --build-arg VITE_SENTRY_DSN="$(grep ^VITE_SENTRY_DSN= .env | cut -d= -f2-)" . && docker compose up -d app`
- **`docker compose build app` solo para el chequeo final pre-deploy.** El Dockerfile recibe
  `SRC_HASH`/`SERVER_HASH` (hash del árbol git) como cache-buster — el deploy los pasa, así
  una `COPY src` nunca queda `CACHED` con código viejo. Si se buildea a mano sin los args y
  algo parece no reflejarse: `--no-cache`.
- El clasificador de seguridad bloquea contraseñas literales en la línea de comandos:
  `curl -d @archivo.json`, nunca `-d '{"password":...}'`.
- No agregar infraestructura nueva (scripts, perfiles de compose, herramientas) sin que se pida.

**Calibrar la verificación al tamaño del cambio** — elegir UN nivel, una sola pasada al final:

| Cambio | Verificación suficiente |
|---|---|
| Texto, label, copy, reordenar JSX, renombrar | `npm run typecheck` |
| UI sin layout nuevo (colores, badges, campos de un form existente) | `npm run typecheck` + `npx vite build` (3 s) |
| Layout / responsive / pantalla nueva / modal anidado | + screenshot Playwright (spec descartable `tests/_verify-*.spec.ts`, borrarlo después); verificar **1366×768** (notebook del usuario) y 375px |
| Query, endpoint, migración, cualquier cosa con plata o stock | + `curl` al backend nativo o `SELECT` en la DB local |

Changelog obligatorio para cambios visibles: `cd server && npm run changelog:add -- "Título"
"Descripción" [feature|fix|mejora]` genera una migración `*_changelog_*.sql`; se aplica con
`npm run migrate` y viaja sola a test/prod. No para refactors internos ni cambios de este archivo.

**Infra / SSH:**
- Comandos para el usuario van en el texto de la respuesta, nunca dentro de un `echo`/tool call.
- Acceso nuevo a un servidor → pedir que agreguen `~/.ssh/id_ed25519.pub`. Nunca automatizar
  login por contraseña (el clasificador lo bloquea).
- Wizards de credenciales/OAuth (`rclone config update/reconnect`) se cuelgan esperando un
  navegador: editar el archivo de config directo.
- **Deploy**: `bash deploy-env.sh test` **buildea la imagen acá y la transfiere** (~440 MB
  gzip, ~2 min): el servidor de test no tiene RAM para buildear. Saltea build si solo
  cambiaron migraciones/tests/docs. `DEPLOY_BUILD_REMOTO=1` fuerza el build viejo en el
  servidor. **Prod solo a pedido explícito del usuario**: `echo si | bash deploy-env.sh prod`
  (su `deploy.sh` sigue buildeando allá). **Prod no hace backup solo**:
  antes, por SSH, `docker exec aberturas-db pg_dump -U postgres -d postgres | gzip >
  /var/lib/docker-data/backups/aberturas_predeploy_$(date +%Y%m%d_%H%M%S).sql.gz`. Si test se
  cuelga durante un build, primero `free -h` / `swapon --show` (swap de 2 GB en `/swapfile`).

## Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind (componentes propios, sin shadcn), React
  Router v7, TanStack Query v5, React Hook Form, Zod, Sonner, Recharts, Lucide. Alias `@/` →
  `src/`. Cliente HTTP propio `src/lib/api.ts` (no axios): `api.get<T>(path)` devuelve `T`
  directo, sin `.data`; query params con `?${new URLSearchParams(...)}`; token en
  `sessionStorage` (`aberturas_token`) y header `Authorization`.
- **Backend**: Hono v4 sobre Node (`@hono/node-server`), PostgreSQL con `pg` (pool directo, sin
  ORM), JWT + bcryptjs, Zod en todos los bodies (`server/src/lib/schemas.ts`, incl.
  `ProductoSchema`). Un solo proceso sirve `/api/*` y el frontend estático desde `./public/`.
  `/uploads/*` se sirve **sin auth** (imágenes de productos, comprobantes, firmas).
  - **CORS** acotado a `APP_URL` + `FRONTEND_URL` + `ORIGENES_EXTRA` (coma-separados; agregar
    ahí el sitio web si algún día llama a la API) y, fuera de producción, localhost. Nada de la
    app es cross-origin, así que esto no afecta al sistema.
  - **Cabeceras de seguridad** con `hono/secure-headers` (X-Frame-Options SAMEORIGIN, nosniff,
    Referrer-Policy). Sin CSP ni COEP/COOP/CORP a propósito (romperían PDFs inline y las
    imágenes cross-origin al sitio); HSTS lo pone nginx en prod.
  - **Links públicos vencen a los 30 días** del envío (`PUB_LINK_DIAS`; decisión de negocio
    2026-09-17), tanto proformas (`operacion_revisiones.enviada_at`) como remitos
    (`token_acceso_at`). Vencido → 404 y la página pública pide que lo vuelvan a enviar.
    Cada apertura del link se registra (`primera_vista_at`/`ultima_vista_at`/`vistas` en
    revisiones, `link_*` en remitos) y se muestra como "Visto hace X" / "Sin abrir" en
    Presupuestos (fila, modal y revisiones) y Remitos.
  - **Regla de cobertura de ítems** (¿está en pedido? ¿hay stock? ¿es servicio?) vive SOLO en
    `server/src/lib/coverage.ts` (`sqlItemsCubiertos`, `sqlItemsPendientes`,
    `sqlStockCubreTodo`, `sqlItemsEnPedidoInclReposicion` — esta última es la variante del
    panel de ventas que sí cuenta reposiciones). No volver a copiar el SQL en las rutas.
- **Infra**: Dockerfile multi-stage (server-build → frontend-build → final con chromium para
  PDFs). `.dockerignore` excluye `uploads/`, `supabase/`, `docker/`, `tests/` (son volúmenes).
  El stage frontend copia solo lo que Vite necesita (no `COPY . .`). `COPY --from=server-build`
  fuerza orden secuencial — no romperlo (test tiene poca RAM).
- **Migraciones** en `supabase/migrations/YYYYMMDDNNNNNN_descripcion.sql`, cada una termina con
  `INSERT INTO schema_migrations (filename) VALUES ('...') ON CONFLICT DO NOTHING;`.
  `docker/initdb/01_schema.sh` las corre todas en una DB vacía (no tocarlo). Runner:
  `npm run migrate` / `migrate:list` / `migrate:dry`, transacción por migración.
- Generación de números correlativos (`OP-`, `REC-`, `REM-`, `PED-`, `VT-`, lotes): siempre
  `MAX(SUBSTRING(numero FROM '(\d+)$')::int) + 1`, **nunca `COUNT(*)`** (regenera números
  borrados → `duplicate key` → rollback silencioso).
- `crypto.randomUUID()` no existe en HTTP (test): usar el fallback con `Math.random`.
- `index.html` lleva `lang="es" translate="no"`: sin eso Chrome Android traduce, muta el DOM y
  React 19 rompe con `insertBefore` (pantalla "Algo salió mal"). No cambiarlo.

## Estructura

```
src/pages/          una página por sección (Dashboard, CRM, Presupuestos, NuevoPresupuesto,
                    Operaciones (kanban), Remitos, Recibos, NuevoRecibo, NuevoPedido (flujo
                    viejo de OC), compras/ (Compras + 5 pestañas + detalles SC/PC/OC/REC +
                    NuevaSolicitud + ModalRecepcion + ModalConsolidar),
                    VentaRapida, VisitaTecnica, VisitasTecnicas, CargarVisitaTecnica, Clientes,
                    ClienteDetalle, Productos, NuevoProducto, Stock, Proveedores, EstadoCuenta,
                    Reportes, Actividad, Novedades, Configuracion, VistaPublicaPresupuesto,
                    VistaPublicaRemito) + print/ (ImprimirPresupuesto → ProformaDocumento,
                    ImprimirPresupuestoPublico, ImprimirRecibo, ImprimirRemito,
                    ImprimirVisitaTecnica, FormularioCliente)
src/components/     Layout/{AppLayout,Sidebar}, NotificationBell, AvisosEmergentes,
                    EntornoBanner, CentroAlertas, AlertaBackups, SectionHero, CompactStatsBar,
                    ComparadorRevisiones, RevisionesEnviadas, VersionesPresupuesto,
                    TarjetaProductoMosaico, catalogo/{ExploradorCatalogo,GridMosaico}, remitos/,
                    oportunidades/, productos/
src/lib/            api.ts, utils.ts, diffProforma.ts, catalogoFiltros.ts, catalogoCascada.ts,
                    atributosPorTipo.ts, apiError.ts
server/src/routes/  una ruta por módulo (ver tabla abajo); pub.ts = público sin auth
server/src/lib/     pdf.ts (PDFs server-side con puppeteer), schemas.ts (Zod), validate.ts, whatsapp.ts,
                    cotizacionDolar.ts, actividad.ts, oportunidades.ts, remitos.ts, compras.ts
                    (numeración SC/PC/OC, estado legacy, totales, autocompletado de ítems)
server/src/scripts/ migrate.ts, add-changelog.ts, optimizar-imagenes.ts
supabase/migrations/ · docker/initdb/ · docs/ · tests/
```

## Rutas frontend (App.tsx)

Públicas (sin `ProtectedRoute`): `/login`, `/p/:token` (proforma), `/p/:token/imprimir` (PDF
de la proforma), `/r/:token` (remito).
Autenticadas: `/dashboard`, `/crm`, `/presupuestos[/nuevo|/:id/editar|/visita-tecnica|/visitas-tecnicas[/:id]]`,
`/ventas/rapida`, `/operaciones[/nueva|/:id]`, `/remitos[/nuevo|/:id/editar]`,
`/compras[?tab=solicitudes|cotizaciones|ordenes&sc=|pc=|oc=]`, `/compras/nueva-solicitud`,
`/compras/solicitudes/:id/editar`, `/compras/oc[/nueva|/:id/editar]` (flujo viejo; `/pedidos*`
redirige acá), `/recibos[/nuevo|/:id/editar]`,
`/clientes[/nuevo|/importar|/:id|/:id/editar|/:id/estado-cuenta]`, `/estado-cuenta`,
`/productos[/nuevo|/:id]`, `/stock`, `/proveedores[/:id/precios]`, `/reportes`, `/actividad`,
`/novedades`, `/configuracion`. Impresión (sin AppLayout): `/imprimir/{presupuesto,remito,recibo}/:id`,
`/imprimir/visita-tecnica?visita_id=`, `/imprimir/formulario-cliente`.

Sidebar: Dashboard · **Comercial** (CRM, Venta rápida, Presupuestos, Visitas de Relevamiento
de Datos, Operaciones, Remitos, Compras, Recibos, Clientes, Estado de Cuenta) · **Catálogo**
(Productos, Existencias, Proveedores) · **Sistema** (Reportes, Actividad, Novedades,
Configuración). Configuración tiene paneles para tipos de abertura, sistemas, colores,
materiales, líneas, tipos de vidrio, categorías, modelos, servicios, formas de pago, empresa,
usuarios, plantillas de WhatsApp y Backups (solo admin).

## Rutas backend (`/api/`)

Montaje en `server/src/index.ts`: `/pub` y `/auth` en `api` **antes** de `apiAuth`
(`authMiddleware`); rate limit 60/min en `/pub/*` y 10/min en `/auth/*` (en memoria, por
proceso). **Hono matchea en orden de registro: rutas específicas siempre antes de `/:id`.**

| Ruta | Notas |
|---|---|
| `/pub/presupuesto/:token` | GET (snapshot de la revisión + `empresa` viva), `/revisiones/:n`, POST `/aprobar` (solo última revisión y hash vigente, si no 409), `/rechazar` (setea `rechazado_online_at` + `notif_leida=false`), `/responder` |
| `/pub/remito/:token` | GET + POST `/confirmar` |
| `/pub/entorno` | sin token: `test`/`produccion`/`local` según `APP_URL` |
| `/auth` | login, me |
| `/clientes` | `/validar-dni` antes de `/:id`; `/:id/enviar-estado-cuenta-whatsapp` genera PDF |
| `/productos` | CRUD (sin Zod), `/upload-imagen`, `PATCH /:id/toggle`, `/toggle-salon`, `/toggle-web`, `/disponibilidad`, `/renovar-validez-precios` |
| `/operaciones` | `POST /venta-rapida`, `/:id/generar-link`, `/:id/enviar-whatsapp`, `/:id/enviar-email`, `PATCH /:id/resolver-respuesta`, `GET /:id/revisiones[/:n]`, `/:id/versiones`, `/ventas-panel`, `/tablero` — todo antes de `GET /:id` |
| `/catalogo` | tipos-abertura, sistemas, colores, materiales, lineas, vidrios, categorias, modelos, servicios, formas-pago, proveedores, proveedor-precios; `GET /productos` (solo activos) |
| `/notificaciones` | `GET /` (6 fuentes), `PATCH /vista` (una sola: `{tipo,id}`), `PATCH /marcar-leidas` (todas) |
| `/recibos` | `/conteos`, `/tablero` antes de `/:id`; `POST /:id/enviar-whatsapp` (PDF server-side) |
| `/remitos` | `/conteos`, `/:id/programar-entrega`, `/:id/plantilla-entrega`, `/:id/recordatorio-whatsapp` antes de `/:id` |
| `/pedidos` | flujo viejo de OC: `/tablero`, `/reporte-envios`, `/operaciones-disponibles` antes de `/:id`; `POST /` numera `OC-` y crea la SC implícita; `PATCH /:id/estado` sincroniza `estado_logistica` |
| `/compras` | `/tablero`, `/adjuntos` (upload imagen→webp o PDF a `uploads/compras`), `/solicitudes[/pendientes-desde-operaciones|/items-pendientes|/preparar|/:id|/:id/estado]`, `/cotizaciones[/:id|/:id/pdf|/:id/mensaje|/:id/enviar|/:id/proveedores/:pid/respuesta|/:id/comparativa|/:id/adjudicar|/:id/cerrar]`, `/ordenes[/directa|/consolidar|/:id|/:id/pdf|/:id/mensaje|/:id/enviar|/:id/confirmacion|/:id/estado-logistica|/:id/seguimientos|/:id/recepciones|/:id/demora-vista]`, `/recepciones`, `/incidencias[/:id|/:id/mensaje|/:id/reclamar|/:id/respuesta]` — rutas específicas antes de `/:id` |
| `/visitas-tecnicas` | `/upload-imagen` antes de `/:id`; `PATCH /:id/cobrar`, `/sin-cargo`, `/bonificar`, `/costo-externo` |
| `/oportunidades` | `/resumen`, `/plantilla/:id` antes de `/:id`; `PATCH /:id/posponer`, `/:id/estado`, `POST /:id/contactar` |
| `/tareas` | `PATCH /:id/completar` limpia `respuesta_cliente` de la operación vinculada y sincroniza oportunidad/entrega espejo |
| `/stock` | `/alertas`, `/lotes` antes de `/:id` |
| otros | `/dashboard` (`/resumen`, `/indicadores`), `/interacciones`, `/empresa`, `/usuarios`, `/transportistas`, `/estado-cuenta`, `/informes`, `/crm`, `/configuracion`, `/localidades`, `/backups` (admin), `/comentarios`, `/changelog`, `/actividad` |

## Base de datos

Tablas: `usuarios` (roles `admin|vendedor|consulta`), `empresa` (**siempre `ORDER BY
updated_at DESC LIMIT 1`** — hay más de una fila en prod), `tipos_abertura`, `sistemas`,
`colores`, `materiales`, `lineas`, `vidrios`, `categorias`, `catalogo_modelos`, `proveedores`,
`proveedor_precios`, `catalogo_productos`, `clientes`, `interacciones`, `tareas`, `operaciones`,
`operacion_items`, `operacion_formas_pago`, `operacion_versiones`, `operacion_revisiones`,
`estados_historial`, `stock_lotes`, `stock_movimientos`, `remitos`, `remito_items`, `recibos`,
`recibo_items`, `recibo_pagos`, `compromisos_pago`, `transportistas`, `pedidos` (= OC), `pedido_items`,
`compras_solicitudes`, `compras_solicitud_items`, `compras_cotizaciones`, `compras_cotizacion_items`,
`compras_cotizacion_proveedores`, `compras_cotizacion_respuesta_items`, `compras_seguimientos`,
`compras_recepciones`, `compras_recepcion_items`, `compras_incidencias`,
`visitas_tecnicas`, `visita_tecnica_items`, `catalogo_servicios`, `oportunidades`,
`mensajes_plantilla`, `changelog_cambios`, `schema_migrations`. Vista `catalogo_web` + rol
`web_catalogo` (ver `docs/catalogo-web.md`).

Enums: `app_role`, `tipo_operacion` (`estandar|a_medida_proveedor|fabricacion_propia`),
`estado_operacion` (`presupuesto|enviado|aprobado|en_produccion|listo|instalado|entregado|cancelado`;
`rechazado` también existe como valor).

**`operaciones`** — campos clave: `estado`, `forma_pago` (texto libre), `forma_envio`
(`retiro_local|envio_bonificado|envio_destino|envio_empresa`), `costo_envio`, `token_acceso`
(espejo del token de la última revisión), `aprobado_online_at`, `rechazado_online_at`,
`respuesta_cliente` (`mas_tiempo|consulta|llamada|modificar`) + `respuesta_cliente_at`,
`notif_leida`, `motivo_rechazo`, `comentario_rechazo`, `es_venta_rapida`, `fecha_validez`.
`respuesta_cliente_detalle` no es columna: subquery a la última `interaccion` tipo
`respuesta_proforma`.

**`operacion_items`** — `precio_total`, `tipo_abertura_nombre`, `sistema_nombre`, `atributos`
**no son columnas**: calcular `precio_unitario*cantidad + CASE WHEN incluye_instalacion THEN
precio_instalacion*cantidad ELSE 0 END`, JOIN a `tipos_abertura`/`sistemas`, y `atributos`
viene de `catalogo_productos` (JOIN por `producto_id`). `tipo_item`: `estandar` (con
`producto_id`) | `a_medida` (medidas a mano, `calculo_url` como imagen ilustrativa) |
`servicio` (opcional `servicio_id`). **Los servicios nunca requieren pedido al proveedor**
(excluidos en `STOCK_CUBRE_TODO`, `items_cubiertos`, `/operaciones-disponibles`). Miniatura de
ítem en proformas: `producto_imagen_url || calculo_url`.

**`catalogo_productos`** — mezcla datos públicos con críticos (`costo_base`, `margen_venta`,
`margen_tipo`, `precio_manual`, `proveedor_id`, `proveedor_sku`, `codigo`, `stock_*`). Flags:
`activo` (no discontinuado, DEFAULT true), `en_salon` (exhibido con stock verificado; backend
rechaza `true` con `stock_actual < 1` y lo auto-limpia al llegar a 0), `publicado_web` (opt-in
al catálogo del sitio, DEFAULT false, exige imagen) + `nombre_web`. `atributos` JSONB por
familia (puerta / ventana / puerta-balcón / mosquitera, detectada por nombre); `imagenes[]`
(la [0] es la principal, `imagen_url` la espeja), `promocion` JSONB, `etiqueta`
(`mas_vendido|recomendado|nuevo`), `material`/`vidrio`/`color` texto libre alimentado por las
tablas de catálogo (sin FK), `linea_id` (FK). Stock: `stock_actual = stock_inicial +
SUM(stock_movimientos.cantidad)`; tipos `ingreso|egreso_remito|egreso_retiro|devolucion|ajuste`.
Contexto real: solo lo `en_salon` tiene stock confiable, el resto está en 0 desde un ajuste
masivo (2026-07).

**Fechas**: `pg` devuelve columnas `DATE` como `Date` → serializan `"YYYY-MM-DDT03:00:00.000Z"`.
Formatear siempre con `new Date(iso.slice(0,10)+'T12:00:00')`; nunca `String(d).slice(0,10)`
ni `new Date(iso)` directo.

## Circuito comercial

**Presupuesto** (`operaciones`). Estado de cobro calculado (`sin_cobrar|seña|cobrado`) en
`GET /operaciones/ventas-panel` y `GET /:id`; `cobrado_total = SUM(recibos.monto_total)
emitidos`. Cada edición (`PUT`, solo si no está aprobado) guarda el estado **anterior** en
`operacion_versiones` (auditoría interna, con costos). Cada **envío** (link/WhatsApp/email)
congela una **revisión** en `operacion_revisiones` con token propio y snapshot **sin costos**
(`proforma_snapshot()`/`proforma_hash()` en SQL); se reutiliza si el contenido no cambió,
`rechazado` + reenvío fuerza revisión nueva y vuelve el estado a `enviado`. El cliente solo
puede aprobar/rechazar/responder la última revisión y solo si coincide con el estado vivo (409
si no). Links viejos siguen abiertos con aviso de "hay una más nueva" y comparador
(`src/lib/diffProforma.ts`). PDF de cualquier revisión: `/imprimir/presupuesto/:id?revision=N`.
La proforma numera como `PRO-` (reemplazo visual de `OP-`). Si la visita de relevamiento
vinculada quedó `sin_cargo`, la proforma lo aclara como bonificada.

**Respuesta intermedia** del link (`POST /pub/.../responder`): no cambia `estado`, guarda
`respuesta_cliente`, crea `interaccion` + `tarea` de seguimiento. Se limpia al reenviar, al
completar la tarea (`PATCH /tareas/:id/completar`) o con `PATCH /operaciones/:id/resolver-respuesta`.
Tab "Seguimiento" en Presupuestos.

**Recibos** — solo sobre operaciones `aprobado`. `total` (toma el saldo) o `parcial` (monto a
mano); **sin preselección**: el formulario obliga a elegir (antes "total" venía marcado y los
recibos salían por el saldo completo por olvido). Enviar por WhatsApp = siempre
`POST /recibos/:id/enviar-whatsapp` (PDF adjunto): desde el diálogo al crear, desde el modal
de detalle y desde la lista — nunca `/clientes/:id/enviar-mensaje-whatsapp` (texto solo). **Medios combinados**: filas en `recibo_pagos` solo cuando hay ≥2 medios (deben sumar
`monto_total`, 422 si no); `recibos.forma_pago` queda `"Pago combinado"`; los informes de caja
leen la vista `recibo_pagos_efectivos`, nunca `forma_pago`. En parcial + combinado el total ES
la suma de los medios. Bonificación: `descuento_pct` sobre productos (no instalación ni
envío); `monto_lista - monto_descuento = monto_total`. **Saldo real = precio_total -
cobrado - total_descuentos** (la bonificación no es deuda). Parcial genera `compromisos_pago`
(se auto-cierran en `cerrarCompromisosSiSaldado`). El PDF del recibo no lista productos: solo
"Detalle de proforma PRO-xxxxx — Rev. N". Concepto sugerido usa `PRO-` y, en parcial, incluye saldo y compromiso. **Comprobantes**: `recibos.comprobantes` JSONB (array de URLs, varios por recibo — uno por cada pago combinado); `comprobante_url` espeja el `[0]`, como `imagenes`/`imagen_url` en productos.

**Remitos** — `borrador → emitido` (descuenta stock: `egreso_remito`) `→ entregado |
cancelado` (revierte con `devolucion`). Link público para confirmar recepción
(`recepcion_estado: conforme|con_observaciones|no_conforme`). Programación de entrega
(`fecha/hora_entrega_est`, tarea espejo `tipo_accion='entrega'`, recordatorios día antes /
hora antes evaluados en cada poll, `recordatorio_*_visto` se resetea al reprogramar).
Entregas parciales soportadas.

**Pedidos a proveedor** — contra-reembolso: `costo_envio` va al transporte, `monto_total =
items + costo_envio`. Coverage stock-aware (`items_cubiertos`): un ítem está cubierto si tiene
`pedido_item` no-reposición en pedido no cancelado **o** hay stock ≥ cantidad. `es_reposicion`
= pedir igual habiendo stock (no cuenta en coverage). `es_stock_propio` = pedido sin cliente
(`operacion_id=NULL`). Al marcar `recibido` y no quedar pedidos activos → `operaciones.estado='listo'`.
Operación 100% en stock (`STOCK_CUBRE_TODO`) va directo a "Lista p/ entregar" sin pedido.

**Compras (Etapas 1 y 2, 2026-09-22)** — `docs/compras-plan.md`. La **OC es la tabla
`pedidos` extendida** (las nuevas se numeran `OC-`, las viejas `PED-` quedan intactas):
`estado` legacy lo escribe SOLO `sincronizarEstadoLegacy()` (`lib/compras.ts`) a partir de
`estado_logistica` (borrador→pendiente, enviada…recibida_parcial→enviado, recibida/cerrada→
recibido, cancelada→cancelado); el flujo viejo (`PATCH /pedidos/:id/estado`) hace la inversa.
`monto_total` es espejo de `total` y `costo_unitario` de `precio_unitario_neto` (los PED-
históricos tienen `iva_pct = 0`).

Circuito: **SC** (`compras_solicitudes`, ítems con `especificaciones` JSONB autocompletadas
desde `operacion_items`+`catalogo_productos.atributos`, `visita_tecnica_items` o el catálogo —
`armarItemDesde()`) → **PC** opcional (`compras_cotizaciones` + `compras_cotizacion_proveedores`,
respuesta por total o por ítem, comparativa por **total final** = neto − desc + IVA + flete) →
**OC** (`crearOrden()`: directa, adjudicada o consolidada de varias SC/clientes con
`es_consolidada` y `operacion_id = NULL`; flete prorrateado por neto al leer, no se guarda) →
**seguimiento** (`compras_seguimientos`: confirmación, cambios de `estado_logistica` con la
tabla `TRANSICIONES_LOGISTICA`, llamados al proveedor; una fecha nueva saca la OC de
`demorado`) → **recepción por ítem** → **reclamos**.

**Recepción — regla central**: `crearRecepcion()` en `lib/compras.ts` es el **único camino de
ingreso a stock** (lo usan `/compras/ordenes/:id/recepciones` y el flujo viejo `PATCH
/pedidos/:id/estado recibido`, que registra una recepción completa todo-conforme). Ingresa a
`stock_movimientos` **solo la cantidad conforme** (antes entraba la cantidad pedida entera al
marcar "recibido"), valida que lo recibido acumulado no supere lo pedido y que conforme +
problema = recibido, y abre una incidencia `abierta` por cada ítem con problema. `cantidad` de
`stock_movimientos` es INT: un ítem con `producto_id` y cantidad conforme decimal se rechaza
con 422 en vez de redondear en silencio. `recalcularRecepcionOC()` decide `recibida` vs
`recibida_parcial` y el `estado_item` de cada línea contando como saldado lo que cubre un
**reclamo cerrado** (reposición recibida, descuento, nota de crédito, rechazo) — sin eso el
ítem que llegó roto quedaba "parcial" para siempre. Cancelar una OC con recepciones devuelve
el stock (`revertirStockDeRecepciones`, movimientos `devolucion`).

**Reclamos** (`compras_incidencias`, `REC-`): nacen solos en la recepción; se mandan al
proveedor por WhatsApp (texto + una imagen por request) o email; la respuesta con solución de
mercadería crea un `pedido_item` de reposición en la misma OC (precio 0,
`es_reposicion_reclamo = true`, no cuenta para decidir si la OC está completa) y el reclamo se
cierra solo cuando esa reposición llega conforme. `estado_calidad` de la OC lo mantiene
`recalcularEstadoCalidad()`.

Precios neto + IVA % por línea (`calcularTotales()`), IVA ∈ {0, 10.5, 21, 27}. `POST /pedidos`
(flujo viejo) sigue funcionando y crea la SC implícita `con_oc`. PDFs `generarPDFCompra()`
(`renderPDF()` compartido en `pdf.ts`); envío con `enviarWhatsappPdf()` / `enviarImagenWhatsapp()` /
`sendCompra()` / `sendReclamo()`; plantillas `compra_cotizacion`, `compra_orden`,
`compra_reclamo`. Frontend en `src/pages/compras/` (`tipos.ts` + `ui.tsx` compartidos; modales
por query param `?sc=|pc=|oc=|rec=`). Las franjas **Finanzas y Documentación** de la OC
muestran "—" hasta la etapa 3.

**Visitas de relevamiento** — `VT-YYYYMM-NNNN`, `pendiente → relevada → convertida |
cancelada`. Al crear se elige cobrar o no: `cobro_estado` `cobrada` (recibo emitido) |
`sin_cargo` | `pendiente` (solo tras anular el recibo) | `bonificada` (el recibo se acreditó al
presupuesto como pago a cuenta). Ítems en **milímetros**; se convierten a metros (÷1000) solo
al "Avanzar a presupuesto" (`navigate` con `state`). Al guardar el presupuesto queda `convertida`.

**Venta rápida** (`POST /operaciones/venta-rapida`) — mostrador, galería con stock.

**Oportunidades futuras** — intención postergada; tarea espejo `tipo_accion='oportunidad'`
sincronizada en ambos sentidos (`server/src/lib/oportunidades.ts`). Sin cron: la agenda ya
filtra por vencimiento. Entradas: ficha de cliente, presupuesto rechazado/vencido, CRM, y
"necesito más tiempo" del link público.

## Notificaciones y avisos

- `GET /notificaciones`: UNION de 6 fuentes no leídas — `presupuesto` (aprobación online,
  **rechazo online**, respuesta del cliente), `remito` (recepción con observaciones/no
  conforme), `oportunidad` (fecha de recontacto vencida), `entrega_dia_antes`,
  `entrega_hora_antes`, `compra_demorada` (OC con `fecha_prometida` vencida y logística no
  terminal; flag `pedidos.demora_notif_leida`, que se resetea al pactar una fecha nueva —
  sin cron: la demora se calcula al leer). `data` JSONB lleva `{telefono, direccion_entrega}` en entregas y
  `{rechazado_online_at, comentario_rechazo}` en rechazos.
- `NotificationBell` (header, poll cada **10 s** + al volver al tab + evento
  `notificaciones:cambiaron`): contador, panel, "marcar leídas" (todas).
- `AvisosEmergentes` (mismo poll): tarjeta abajo a la derecha **que no se va sola** hasta
  "Aceptar" (marca esa sola vía `PATCH /notificaciones/vista`) o "Ver". No bloquea
  (`pointer-events-none` en el contenedor). Emergen presupuesto, remito, entrega-hora-antes y
  compra-demorada (**de a una por vez**: cada OC vencida es un aviso y apilados tapan los
  botones de cualquier modal abierto — el contenedor está en `z-[10000]`); oportunidad y
  entrega-mañana solo como toast. No duplicar con toasts.
- `EntornoBanner`: franja + badge `TEST`/`PRODUCCIÓN` en `top-2 right-14` (a la izquierda de
  la campanita; en `right-2` la tapaba).
- Dashboard: `CentroAlertas` (agenda `GET /tareas/agenda`), tarjetas "Prioridades de hoy"
  (`GET /dashboard/resumen`), `entregas_hoy` como card aparte (no dentro del grid de 6 — wrap
  a 1366×768), `AlertaBackups` (admin, si el último backup exitoso tiene ≥2 días).
- WhatsApp: siempre Evolution API (`EVOLUTION_API_URL/KEY/INSTANCE`), nunca `wa.me`;
  números `549XXXXXXXXXX`. Plantillas editables en `mensajes_plantilla`.
- PDFs: dos implementaciones que deben mantenerse iguales — navegador (`src/pages/print/*`,
  `window.print()`) y servidor (`server/src/lib/pdf.ts`, puppeteer, para WhatsApp). Para
  verificar el server-side sin enviar nada: llamar `generarPDF*()` directo con `tsx`. Firma
  digital: 56px en recibo, 49px en remito. Ante dudas de paginación, contar `/Type /Pages
  ... /Count N` en los bytes del PDF, no medir el DOM.

## Convenciones de UI

- Fondo app `#b8ccdf` (`--app-bg`). Card de sección canónica: `bg-white rounded-2xl border
  border-gray-400 shadow-lg p-4`. Nunca `border-gray-100`/`shadow-sm` solos (invisibles);
  `border-gray-200` está bien para ítems dentro de una lista.
- **`data-section="<clave>"` obligatorio en el `<div>` raíz de cada página de sección**
  (tinte de fondo y franja bajo `SectionHero`); claves = `SECTION_COLORS` en `SectionHero.tsx`
  y tokens `--accent-<clave>` en `index.css`, deben coincidir.
- `SectionHero`: `flex flex-col sm:flex-row` (acciones bajan a fila propia en mobile).
  `CompactStatsBar`: `overflow-x-auto`, sin `shrink-0`. Si se tocan, verificar 390px y 1366×768.
- Mobile-first Tailwind: sin anchos fijos, grillas `grid-cols-1 sm:grid-cols-2 lg:...`, tablas
  como tarjetas en mobile y `<table>` en desktop **en el mismo componente**, botones `h-11`,
  inputs `text-base`, modales `w-full sm:max-w-lg max-h-[90dvh]` (`dvh`, nunca `vh`).
  Prohibido crear vistas "mobile" paralelas.
- Estados en Presupuestos: `aprobado`/`rechazado` en sólido (`emerald-600`/`red-600` con
  texto blanco), fondo `-100`, franja lateral 7px — los pastel no se ven a 1366×768.
- Labels: `Pendiente de Aprobación` (no "Borrador"); `Pago total` si `cobrado >= 99%`,
  `Señado` si `> 0`; `Envío total/parcial al proveedor`; `llega hoy/mañana/el DD/MM`.
- Modales de detalle: componente aparte que recibe `id`, header con número + estado + acciones
  + X, confirmación destructiva como pantalla roja dentro del modal (no `window.confirm`).
- Selectores con búsqueda: `onMouseDown` en el dropdown (no `onClick`) para evitar el race con
  `onBlur`.
- Kanban Operaciones: cada columna con su color, cards con `COL_CARD_BG[col]`.
- Color de proveedor: hex libre (`<input type="color">`) o clave de la paleta vieja; los
  estilos (badge tenue / banda sólida) se calculan del hex en `coloresProveedor.ts`
  (`badgeStyle`/`solidStyle`, por `style`, nunca clases Tailwind dinámicas).
- Listas: `ORDER BY created_at DESC` salvo excepción documentada en el código.
- Errores en render sin boundary → pantalla en blanco: todo `useEffect` con fetch lleva `.catch()`.

## Comandos frecuentes

```bash
docker compose exec db psql -U postgres -d postgres          # DB local
docker compose logs app -f --tail=30                          # logs del contenedor
docker compose build app && docker compose up -d --force-recreate app   # solo pre-deploy
bash deploy-env.sh test    /    echo si | bash deploy-env.sh prod
```
