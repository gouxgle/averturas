# Catálogo online — contrato de datos para el sitio web

Este documento es para el proyecto **webcesarbritez** (`cesarbritez.com.ar`). Describe cómo
leer el catálogo público de productos desde la base de aberturas, sin exponer nada del
sistema de gestión.

## Cómo se decide qué se publica

Cada producto tiene un flag `publicado_web` que arranca en **`false`**. Nadie se publica
solo: hay que activarlo a mano desde el sistema (alta/edición de producto, card "Catálogo
online", o el botón "Publicar en web" del detalle). El backend además exige que el producto
tenga al menos una imagen.

Un producto desaparece del catálogo web si se lo despublica **o** si se lo marca como
inactivo (`activo = false`, o sea discontinuado). El sitio no necesita saber nada de eso: la
vista ya lo filtra.

## El único punto de acceso: la vista `catalogo_web`

El sitio **no lee `catalogo_productos`**, ni ninguna otra tabla. Lee una sola vista, que
expone una lista blanca de columnas.

| Columna | Tipo | Qué es |
|---|---|---|
| `id` | uuid | Identificador estable del producto. Sirve para URLs (`/catalogo/<id>`). |
| `titulo` | text | Nombre de cara al cliente. Ya resuelto: es `nombre_web` si se cargó, si no el nombre interno. |
| `descripcion` | text | Descripción comercial larga. Puede ser NULL. |
| `caracteristica_1..4` | text | Bullets de características. Pueden ser NULL. |
| `material` | text | Aluminio / PVC / Acero / Chapa / Madera / MDF… |
| `color` | text | Color del producto. |
| `vidrio` | text | Tipo de vidrio (Transparente, Laminado, DVH…). |
| `premarco` | boolean | Si incluye premarco. |
| `accesorios` | text[] | Accesorios incluidos. |
| `ancho`, `alto` | numeric(8,2) | Medidas en cm. Pueden ser NULL (productos a medida). |
| `imagenes` | jsonb | Array ordenado de rutas. `[0]` es la principal. Ver "Imágenes". |
| `imagen_url` | text | Espejo de `imagenes[0]`, por comodidad. |
| `video_url` | text | YouTube / Vimeo / URL directa. Puede ser NULL. |
| `etiqueta` | varchar(30) | `mas_vendido` \| `recomendado` \| `nuevo` \| NULL. Para badges. |
| `tipo_abertura` | text | Familia: Ventana, Puerta, etc. Ya resuelto el nombre. |
| `sistema` | text | Sistema técnico del perfil. |
| `linea` | text | Línea comercial: Económica / Estándar / Premium / Alta seguridad. |
| `categoria` | text | Nodo del árbol de categorías. |
| `modelo_id` | uuid | Productos con el mismo `modelo_id` son variantes del mismo modelo — sirve para agruparlos en una sola tarjeta con selector. |
| `atributos` | jsonb | Ficha técnica por familia. Lista blanca de claves. Puede ser NULL. |
| `updated_at` | timestamptz | Última modificación. Útil para invalidar cache. |

### Lo que NO está, y no va a estar

`costo_base`, `precio_base`, `precio_por_m2`, `promocion`, `margen_venta`, `margen_tipo`,
`precio_manual`, `proveedor_id`, `proveedor_sku`, `codigo` (SKU interno), `stock_inicial`,
`stock_minimo`, `tipo` (delata qué se revende y qué se fabrica), `precio_actualizado_at`,
`disponibilidad_confirmada_at/_by`, `en_salon`, `activo`.

**Decisión de negocio: el catálogo web no muestra precios.** El sitio muestra la ficha y un
botón de consulta. Por eso ni siquiera se expone el precio: lo que no está en la vista no se
puede filtrar por error.

### Sobre `atributos`

Es un JSONB de forma libre en la tabla original, así que la vista lo recorta por **lista
blanca de claves**. Una clave nueva que alguien agregue en el sistema es invisible para la
web hasta que se la agregue explícitamente a la vista. Es a propósito: evita que un dato
interno termine publicado sin que nadie lo note.

Las claves varían según la familia del producto. Las más útiles: `tipo_puerta`, `uso`,
`config_hojas`, `apertura`, `vidrio_tipo`, `herrajes`, `componentes`, `tipo_ventana`,
`celosia_tipo`, `reja`, `mosquitero`, `tipo_mosquitera`, `tipo_malla`. Los valores son slugs
(`hoja_simple`, `chapa_inyectada`), así que el sitio necesita su propio mapa slug → etiqueta
legible.

## Conexión

```
postgres://web_catalogo:<password>@aberturas-db:5432/postgres
```

En producción los tres contenedores (`cesarbritez-web`, `aberturas-app`, `aberturas-db`) ya
comparten la red `cesarbritez_default`, así que `aberturas-db` resuelve por nombre. **No hace
falta publicar ningún puerto nuevo**: la base sigue escuchando solo en `127.0.0.1` hacia
afuera del Docker.

### El rol `web_catalogo`

Lo crea la migración `20260915000006_catalogo_web_vista_rol.sql`, pero nace **`NOLOGIN` y sin
password**, para no meter un secreto en el repositorio. Hay que habilitarlo una vez por
entorno:

```sql
ALTER ROLE web_catalogo LOGIN PASSWORD '<secreto>';
```

El secreto va al `.env` del proyecto del sitio, nunca a git.

Qué puede hacer este rol, verificado:

- `SELECT` sobre `catalogo_web` ✅
- `SELECT` sobre `catalogo_productos`, `clientes`, `operaciones`, `recibos`, `usuarios`,
  `proveedores`, `empresa` → **permission denied** ✅
- `INSERT` / `UPDATE` / `DELETE` sobre la vista → rechazado ✅
- `CREATE TABLE` → permission denied ✅
- Llamar funciones internas como `proforma_snapshot()` → permission denied ✅

Funciona porque en Postgres una vista se ejecuta con los permisos de **su dueño**, no de
quien consulta: el rol lee la vista sin tener ningún permiso sobre las tablas de abajo.

## Consulta de ejemplo

```sql
SELECT id, titulo, descripcion, imagenes, material, color,
       ancho, alto, tipo_abertura, linea, etiqueta, atributos
FROM catalogo_web
ORDER BY tipo_abertura NULLS LAST, titulo;
```

No hace falta filtrar por publicado ni por activo: la vista ya lo hace.

## Imágenes

`imagenes` guarda **rutas relativas**, tipo `/uploads/productos/<uuid>.webp`. Son archivos
`.webp` ya optimizados (máx. 1600×1600, calidad 82) en el volumen de uploads.

Dos formas de servirlas, en orden de preferencia:

1. **Montar el volumen en el contenedor del sitio, en solo lectura** (recomendado):
   ```yaml
   volumes:
     - /var/lib/docker-data/aberturas/uploads:/usr/share/nginx/html/uploads:ro
   ```
   Las rutas de la base funcionan tal cual, mismo origen, y el sitio público **no depende de
   que la app de gestión esté levantada**.

2. **Apuntar al contenedor de aberturas**: prefijar con
   `https://aberturas.cesarbritez.com.ar`. Funciona hoy (`/uploads/*` se sirve sin
   autenticación, con cache de 7 días) pero acopla la disponibilidad del sitio público a la
   del sistema de gestión.

## Pendiente del lado del sitio

Hoy `webcesarbritez` es **nginx sirviendo HTML estático**, sin backend ni driver de
Postgres — no puede ejecutar SQL. Para consumir esta vista necesita un proceso propio. Dos
caminos razonables:

- Un backend chico (Node + `pg`) que sirva `/api/catalogo` y renderice o entregue JSON.
- Un paso de build que corra la query, escriba un `catalogo.json` estático y lo hornee en la
  imagen (o lo regenere por cron). Cero credenciales en runtime, a costa de que el catálogo
  se actualice cuando corre el build.

La vista y el rol sirven igual para cualquiera de los dos.
