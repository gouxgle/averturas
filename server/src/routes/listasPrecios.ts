import { Hono } from 'hono';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { registrarHistorial, motivoCambioRaro, type CambioHistorial } from '../lib/precios.js';
import { registrarActividad } from '../lib/actividad.js';

// Listas de precios de proveedor ya subidas: qué se aplicó, cuáles valores son raros y cómo revertir una
// subida mal cargada. Las subidas hechas antes de que se guardaran (sin cabecera propia) se reconstruyen
// desde el historial de precios agrupando por proveedor, fecha y detalle (archivo).
export const listasPrecios = new Hono();

const TZ = 'America/Argentina/Buenos_Aires';
const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

interface FilaCambio {
  producto_id: string; nombre: string; codigo: string | null; sku: string | null;
  costo_antes: number | null; costo_despues: number | null; precio_antes: number | null; precio_despues: number | null;
  accion: 'actualizar' | 'renovar'; costo_actual: number | null; precio_actual: number | null;
}

function armarFila(r: Record<string, unknown>): FilaCambio & { variacion_costo: number | null; variacion_precio: number | null; raro: string | null; vigente: boolean } {
  const f: FilaCambio = {
    producto_id: r.producto_id as string, nombre: (r.nombre as string) ?? '(producto eliminado)', codigo: (r.codigo as string) ?? null, sku: (r.sku as string) ?? null,
    costo_antes: num(r.costo_antes), costo_despues: num(r.costo_despues), precio_antes: num(r.precio_antes), precio_despues: num(r.precio_despues),
    accion: r.accion as 'actualizar' | 'renovar', costo_actual: num(r.costo_actual), precio_actual: num(r.precio_actual),
  };
  const raro = f.accion === 'actualizar' && f.costo_antes !== null && f.costo_despues !== null && f.precio_antes !== null && f.precio_despues !== null
    ? motivoCambioRaro({ costo_actual: f.costo_antes, costo_nuevo: f.costo_despues, precio_actual: f.precio_antes, precio_nuevo: f.precio_despues }) : null;
  const var_ = (a: number | null, b: number | null) => (a && b !== null ? Math.round((b / a - 1) * 1000) / 10 : null);
  // "vigente" = el producto todavía tiene lo que puso esta lista (si se tocó después, ya no hay nada que revertir)
  const igual = (a: number | null, b: number | null) => a !== null && b !== null && Math.abs(a - b) < 0.005;
  return { ...f, variacion_costo: var_(f.costo_antes, f.costo_despues), variacion_precio: var_(f.precio_antes, f.precio_despues), raro,
    vigente: f.accion === 'actualizar' && igual(f.costo_actual, f.costo_despues) && igual(f.precio_actual, f.precio_despues) };
}

// GET /?proveedor_id= — subidas guardadas + reconstruidas del historial
listasPrecios.get('/', async (c) => {
  const proveedor = c.req.query('proveedor_id');
  if (proveedor && !/^[0-9a-f-]{36}$/i.test(proveedor)) return c.json({ error: 'Proveedor inválido' }, 422);
  const { rows: guardadas } = await db.query(`
    SELECT l.id, l.proveedor_id, pr.nombre AS proveedor, l.origen, l.archivo, l.detalle, l.filas_leidas, l.actualizados, l.renovados,
           l.estado, l.created_at, u.nombre AS usuario,
           (SELECT count(*)::int FROM lista_precio_import_items i
             WHERE i.lista_id = l.id AND i.accion = 'actualizar'
               AND ((i.costo_antes > 0 AND (i.costo_despues / i.costo_antes > 1.3 OR i.costo_despues < i.costo_antes))
                    OR (i.precio_antes > 0 AND i.precio_despues > 3 * i.precio_antes))) AS sospechosos
      FROM listas_precios_importadas l
      JOIN proveedores pr ON pr.id = l.proveedor_id
      LEFT JOIN usuarios u ON u.id = l.usuario_id
     WHERE ($1::uuid IS NULL OR l.proveedor_id = $1)
     ORDER BY l.created_at DESC LIMIT 300`, [proveedor ?? null]);
  const { rows: previas } = await db.query(`
    SELECT pr.id AS proveedor_id, pr.nombre AS proveedor, h.detalle,
           (h.created_at AT TIME ZONE '${TZ}')::date AS fecha, max(h.created_at) AS created_at,
           count(*) FILTER (WHERE h.tipo <> 'renovacion')::int AS actualizados,
           count(*) FILTER (WHERE h.tipo = 'renovacion')::int AS renovados,
           count(*) FILTER (WHERE h.tipo <> 'renovacion'
             AND ((h.costo_anterior > 0 AND (h.costo_nuevo / h.costo_anterior > 1.3 OR h.costo_nuevo < h.costo_anterior))
                  OR (h.precio_anterior > 0 AND h.precio_nuevo > 3 * h.precio_anterior)))::int AS sospechosos,
           (array_agg(u.nombre ORDER BY h.created_at DESC))[1] AS usuario
      FROM producto_precio_historial h
      JOIN catalogo_productos cp ON cp.id = h.producto_id
      JOIN proveedores pr ON pr.id = cp.proveedor_id
      LEFT JOIN usuarios u ON u.id = h.usuario_id
     WHERE h.origen = 'lista_proveedor' AND h.lista_id IS NULL AND ($1::uuid IS NULL OR pr.id = $1)
     GROUP BY pr.id, pr.nombre, h.detalle, (h.created_at AT TIME ZONE '${TZ}')::date
     ORDER BY max(h.created_at) DESC LIMIT 300`, [proveedor ?? null]);
  const listas = [
    ...guardadas.map(l => ({ ...l, reconstruida: false, clave: l.id })),
    ...previas.map(l => ({
      id: null, proveedor_id: l.proveedor_id, proveedor: l.proveedor, origen: 'archivo', archivo: null, detalle: l.detalle,
      filas_leidas: null, actualizados: l.actualizados, renovados: l.renovados, estado: 'aplicada', created_at: l.created_at,
      usuario: l.usuario, sospechosos: l.sospechosos, reconstruida: true, fecha: l.fecha,
      clave: `h|${l.proveedor_id}|${new Date(l.fecha).toISOString().slice(0, 10)}|${l.detalle ?? ''}`,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return c.json({ listas });
});

const SQL_ITEMS_GUARDADA = `
  SELECT i.producto_id, cp.nombre, cp.codigo, i.sku, i.accion, i.costo_antes, i.costo_despues, i.precio_antes, i.precio_despues,
         cp.costo_base AS costo_actual, cp.precio_base AS precio_actual
    FROM lista_precio_import_items i LEFT JOIN catalogo_productos cp ON cp.id = i.producto_id
   WHERE i.lista_id = $1 ORDER BY cp.nombre`;

// Subida reconstruida: el último cambio de cada producto con ese proveedor/fecha/detalle
const SQL_ITEMS_RECONSTRUIDA = `
  SELECT DISTINCT ON (h.producto_id) h.producto_id, cp.nombre, cp.codigo,
         (SELECT pp.sku FROM proveedor_precios pp WHERE pp.producto_id = h.producto_id AND pp.proveedor_id = $1 LIMIT 1) AS sku,
         CASE WHEN h.tipo = 'renovacion' THEN 'renovar' ELSE 'actualizar' END AS accion,
         h.costo_anterior AS costo_antes, h.costo_nuevo AS costo_despues, h.precio_anterior AS precio_antes, h.precio_nuevo AS precio_despues,
         cp.costo_base AS costo_actual, cp.precio_base AS precio_actual
    FROM producto_precio_historial h
    JOIN catalogo_productos cp ON cp.id = h.producto_id
   WHERE h.origen = 'lista_proveedor' AND h.lista_id IS NULL AND cp.proveedor_id = $1
     AND (h.created_at AT TIME ZONE '${TZ}')::date = $2::date AND h.detalle IS NOT DISTINCT FROM $3
   ORDER BY h.producto_id, h.created_at DESC`;

const ReconstruidaSchema = z.object({
  proveedor_id: z.string().uuid(), fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), detalle: z.string().max(300).nullable().default(null),
});

// GET /reconstruida?proveedor_id=&fecha=&detalle= — filas de una subida anterior al registro propio
listasPrecios.get('/reconstruida', async (c) => {
  const p = ReconstruidaSchema.safeParse({ proveedor_id: c.req.query('proveedor_id'), fecha: c.req.query('fecha'), detalle: c.req.query('detalle') ?? null });
  if (!p.success) return c.json({ error: 'Datos inválidos' }, 422);
  const { rows } = await db.query(SQL_ITEMS_RECONSTRUIDA, [p.data.proveedor_id, p.data.fecha, p.data.detalle]);
  return c.json({ reconstruida: true, items: rows.map(armarFila) });
});

// GET /producto/:id — qué lista del proveedor tiene el producto y las últimas subidas que lo tocaron
listasPrecios.get('/producto/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: 'Producto inválido' }, 422);
  const [{ rows: [vigente] }, { rows: ultimas }] = await Promise.all([
    db.query(`
      SELECT pp.sku, pp.descripcion, pp.precio::float AS precio, pp.updated_at
        FROM catalogo_productos cp
        JOIN proveedor_precios pp ON pp.proveedor_id = cp.proveedor_id
         AND (pp.producto_id = cp.id OR (pp.producto_id IS NULL AND cp.proveedor_sku IS NOT NULL AND upper(trim(pp.sku)) = upper(trim(cp.proveedor_sku))))
       WHERE cp.id = $1 ORDER BY (pp.producto_id = cp.id) DESC NULLS LAST, pp.updated_at DESC LIMIT 1`, [id]),
    db.query(`
      SELECT l.id, l.origen, l.archivo, l.detalle, l.estado, l.created_at, i.sku, i.accion,
             i.precio_leido::float AS precio_leido, i.costo_antes::float AS costo_antes, i.costo_despues::float AS costo_despues,
             i.precio_antes::float AS precio_antes, i.precio_despues::float AS precio_despues
        FROM lista_precio_import_items i JOIN listas_precios_importadas l ON l.id = i.lista_id
       WHERE i.producto_id = $1 ORDER BY l.created_at DESC LIMIT 5`, [id]),
  ]);
  return c.json({ lista_vigente: vigente ?? null, ultimas_subidas: ultimas });
});

// GET /:id — cabecera y filas de una subida guardada
listasPrecios.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: 'Lista inválida' }, 422);
  const { rows: [l] } = await db.query(`
    SELECT l.*, pr.nombre AS proveedor, u.nombre AS usuario FROM listas_precios_importadas l
      JOIN proveedores pr ON pr.id = l.proveedor_id LEFT JOIN usuarios u ON u.id = l.usuario_id WHERE l.id = $1`, [id]);
  if (!l) return c.json({ error: 'Lista no encontrada' }, 404);
  const { rows } = await db.query(SQL_ITEMS_GUARDADA, [id]);
  return c.json({ ...l, items: rows.map(armarFila) });
});

// Devuelve costo y precio a lo que había antes, solo en los productos que siguen con lo que puso la lista.
async function revertir(client: PoolClient, proveedorId: string, filas: ReturnType<typeof armarFila>[], detalle: string, usuarioId: string | null, listaId: string | null) {
  const cambios: CambioHistorial[] = [];
  const omitidos: { producto_id: string; nombre: string; motivo: string }[] = [];
  for (const f of filas) {
    if (f.accion !== 'actualizar') continue;
    if (f.costo_antes === null || f.precio_antes === null) { omitidos.push({ producto_id: f.producto_id, nombre: f.nombre, motivo: 'La subida no guardó los valores anteriores' }); continue; }
    const { rows: [p] } = await client.query(
      `SELECT costo_base::float AS costo, precio_base::float AS precio FROM catalogo_productos WHERE id = $1 AND proveedor_id = $2 FOR UPDATE`, [f.producto_id, proveedorId]);
    if (!p) { omitidos.push({ producto_id: f.producto_id, nombre: f.nombre, motivo: 'El producto ya no es de este proveedor' }); continue; }
    if (Math.abs(p.costo - (f.costo_despues ?? NaN)) >= 0.005 || Math.abs(p.precio - (f.precio_despues ?? NaN)) >= 0.005) {
      omitidos.push({ producto_id: f.producto_id, nombre: f.nombre, motivo: 'Se modificó después de la lista: no se toca' }); continue;
    }
    await client.query(`UPDATE catalogo_productos SET costo_base = $2, precio_base = $3 WHERE id = $1`, [f.producto_id, f.costo_antes, f.precio_antes]);
    await client.query(`UPDATE proveedor_precios SET precio = $3, updated_at = now() WHERE proveedor_id = $1 AND producto_id = $2`, [proveedorId, f.producto_id, f.costo_antes]);
    cambios.push({
      producto_id: f.producto_id, tipo: f.precio_antes !== p.precio ? 'cambio_precio' : 'cambio_costo', precio_anterior: p.precio, precio_nuevo: f.precio_antes,
      costo_anterior: p.costo, costo_nuevo: f.costo_antes, origen: 'reversion', criterio: 'reversión de lista', detalle: `Reversión de: ${detalle}`.slice(0, 300), lista_id: listaId,
    });
  }
  await registrarHistorial(client, cambios, usuarioId);
  return { revertidos: cambios.length, omitidos };
}

const soloAdmin = (c: { get: (k: 'user') => { rol?: string } | undefined }) => c.get('user')?.rol === 'admin';

// POST /reconstruida/revertir — revertir una subida anterior al registro propio
listasPrecios.post('/reconstruida/revertir', async (c) => {
  if (!soloAdmin(c)) return c.json({ error: 'Solo un administrador puede revertir una lista' }, 403);
  const b = await validateBody(c, ReconstruidaSchema);
  if (b instanceof Response) return b;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(SQL_ITEMS_RECONSTRUIDA, [b.proveedor_id, b.fecha, b.detalle]);
    const r = await revertir(client, b.proveedor_id, rows.map(armarFila), b.detalle ?? `lista del ${b.fecha}`, c.get('user')?.id ?? null, null);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'lista_precios', entidad_id: b.proveedor_id, entidad_numero: null, accion: 'editar',
      detalle: `Reversión de lista de proveedor (${b.detalle ?? b.fecha}): ${r.revertidos} productos` });
    return c.json(r);
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
});

// POST /:id/revertir — revertir una subida guardada
listasPrecios.post('/:id/revertir', async (c) => {
  if (!soloAdmin(c)) return c.json({ error: 'Solo un administrador puede revertir una lista' }, 403);
  const id = c.req.param('id');
  if (!/^[0-9a-f-]{36}$/i.test(id)) return c.json({ error: 'Lista inválida' }, 422);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [l] } = await client.query(`SELECT * FROM listas_precios_importadas WHERE id = $1 FOR UPDATE`, [id]);
    if (!l) { await client.query('ROLLBACK'); return c.json({ error: 'Lista no encontrada' }, 404); }
    if (l.estado === 'revertida') { await client.query('ROLLBACK'); return c.json({ error: 'Esta lista ya fue revertida' }, 409); }
    const { rows } = await client.query(SQL_ITEMS_GUARDADA, [id]);
    const nombre = l.detalle || l.archivo || `lista del ${new Date(l.created_at).toLocaleDateString('es-AR')}`;
    const r = await revertir(client, l.proveedor_id, rows.map(armarFila), nombre, c.get('user')?.id ?? null, id);
    await client.query(`UPDATE listas_precios_importadas SET estado = 'revertida', revertida_at = now(), revertida_por = $2 WHERE id = $1`, [id, c.get('user')?.id ?? null]);
    await client.query('COMMIT');
    registrarActividad(c, { entidad: 'lista_precios', entidad_id: l.proveedor_id, entidad_numero: null, accion: 'editar',
      detalle: `Reversión de lista de proveedor (${nombre}): ${r.revertidos} productos` });
    return c.json(r);
  } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
});
