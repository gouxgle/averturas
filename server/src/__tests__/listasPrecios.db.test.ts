import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { motivoCambioRaro } from '../lib/precios.js';

describe('motivoCambioRaro', () => {
  it('avisa subas grandes, bajas, multiplicaciones del precio y márgenes absurdos', () => {
    expect(motivoCambioRaro({ costo_actual: 1000, costo_nuevo: 1100, precio_actual: 1500, precio_nuevo: 1650 })).toBeNull();
    expect(motivoCambioRaro({ costo_actual: 1000, costo_nuevo: 1500, precio_actual: 1500, precio_nuevo: 2250 })).toMatch(/sube 50 %/);
    expect(motivoCambioRaro({ costo_actual: 1000, costo_nuevo: 900, precio_actual: 1500, precio_nuevo: 1350 })).toMatch(/baja 10 %/);
    // costo viejo mal cargado ($1 en vez de $1.000): el precio se multiplicaría
    expect(motivoCambioRaro({ costo_actual: 1, costo_nuevo: 1000, precio_actual: 2, precio_nuevo: 2000 })).toMatch(/sube/);
    expect(motivoCambioRaro({ costo_actual: 1000, costo_nuevo: 1010, precio_actual: 1500, precio_nuevo: 5200 })).toMatch(/multiplicaría|veces el costo/);
    expect(motivoCambioRaro({ costo_actual: 1000, costo_nuevo: 1010, precio_actual: 1100, precio_nuevo: 1100 })).toMatch(/casi igual/);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('listas de precios subidas y reversión', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  let rol = 'admin';
  const ids: { prov?: string; a?: string; b?: string } = {};

  const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const prod = async (id: string) => (await db.query(`SELECT costo_base::float AS costo, precio_base::float AS precio FROM catalogo_productos WHERE id = $1`, [id])).rows[0];

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const catalogo = (await import('../routes/catalogo.js')).default;
    const { listasPrecios } = await import('../routes/listasPrecios.js');
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol, nombre: 'Test' } as never); await next(); });
    app.route('/catalogo', catalogo);
    app.route('/listas-precios', listasPrecios);
    ids.prov = (await db.query(`INSERT INTO proveedores (nombre) VALUES ('TEST-PROV-LISTAS') RETURNING id`)).rows[0].id;
    ids.a = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, costo_base, precio_base, proveedor_id, proveedor_sku) VALUES ('TEST-LISTA-A','estandar',1000,1500,$1,'SKU-A') RETURNING id`, [ids.prov])).rows[0].id;
    ids.b = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, costo_base, precio_base, proveedor_id, proveedor_sku) VALUES ('TEST-LISTA-B','estandar',2000,3000,$1,'SKU-B') RETURNING id`, [ids.prov])).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM producto_precio_historial WHERE producto_id = ANY($1)`, [[ids.a, ids.b]]);
    await db.query(`DELETE FROM listas_precios_importadas WHERE proveedor_id = $1`, [ids.prov]);
    await db.query(`DELETE FROM proveedor_precios WHERE proveedor_id = $1`, [ids.prov]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = ANY($1)`, [[ids.a, ids.b]]);
    await db.query(`DELETE FROM proveedores WHERE id = $1`, [ids.prov]);
    await db.query(`DELETE FROM actividad_log WHERE entidad = 'lista_precios' AND entidad_id = $1`, [ids.prov]);
    await db.end();
  });

  let listaId = '';
  it('analizar: un código repetido usa la última fila y se avisa; un cambio absurdo queda para revisar', async () => {
    const r = await post('/catalogo/proveedor-precios/analizar-lista', { proveedor_id: ids.prov, filas: [
      { sku: 'SKU-A', descripcion: '', precio: 1100 }, { sku: 'sku-a', descripcion: '', precio: 1200 },   // repetido
      { sku: 'SKU-B', descripcion: '', precio: 200000 },                                                 // x100: absurdo
    ] });
    expect(r.status).toBe(200);
    const j = await r.json() as { coincidencias: { sku: string; costo_nuevo: number; revisar: boolean; motivo_revisar: string | null }[]; duplicados: string[] };
    expect(j.duplicados.length).toBe(1);
    expect(j.coincidencias.find(x => x.sku?.toUpperCase() === 'SKU-A')?.costo_nuevo).toBe(1200);
    const b = j.coincidencias.find(x => x.sku === 'SKU-B')!;
    expect(b.revisar).toBe(true);
    expect(b.motivo_revisar).toBeTruthy();
  });

  it('aplicar guarda la subida con su cabecera, filas y el historial enlazado', async () => {
    const r = await post('/catalogo/proveedor-precios/aplicar-lista', {
      proveedor_id: ids.prov, origen: 'archivo', archivo: 'lista.xlsx', detalle: 'Lista de TEST (lista.xlsx)',
      filas: [{ sku: 'SKU-A', descripcion: '', precio: 1200 }, { sku: 'SKU-B', descripcion: '', precio: 2400 }],
      items: [
        { producto_id: ids.a, costo_nuevo: 1200, precio_nuevo: 1800, solo_renovar: false, sku: 'SKU-A' },
        { producto_id: ids.b, costo_nuevo: 2400, precio_nuevo: 3600, solo_renovar: false, sku: 'SKU-B' },
      ],
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { lista_id: string; actualizados: number };
    listaId = j.lista_id;
    expect(j.actualizados).toBe(2);
    const { rows } = await db.query(`SELECT accion, costo_antes::float AS ca, costo_despues::float AS cd, precio_antes::float AS pa, precio_despues::float AS pd FROM lista_precio_import_items WHERE lista_id = $1 ORDER BY costo_antes`, [listaId]);
    expect(rows.map(x => [x.ca, x.cd, x.pa, x.pd])).toEqual([[1000, 1200, 1500, 1800], [2000, 2400, 3000, 3600]]);
    const { rows: [h] } = await db.query(`SELECT count(*)::int AS n FROM producto_precio_historial WHERE lista_id = $1`, [listaId]);
    expect(h.n).toBe(2);
  });

  it('GET / lista la subida y GET /:id trae filas con antes/después', async () => {
    const l = await (await app.request(`/listas-precios?proveedor_id=${ids.prov}`)).json() as { listas: { id: string; actualizados: number; reconstruida: boolean }[] };
    expect(l.listas.find(x => x.id === listaId)?.actualizados).toBe(2);
    const d = await (await app.request(`/listas-precios/${listaId}`)).json() as { items: { nombre: string; variacion_costo: number; vigente: boolean }[] };
    expect(d.items.map(i => [i.nombre, i.variacion_costo, i.vigente])).toEqual([['TEST-LISTA-A', 20, true], ['TEST-LISTA-B', 20, true]]);
  });

  it('revertir: solo un admin; vuelve lo que sigue como lo dejó la lista y respeta lo tocado después', async () => {
    await db.query(`UPDATE catalogo_productos SET precio_base = 4000 WHERE id = $1`, [ids.b]);   // tocado a mano después
    rol = 'vendedor';
    expect((await post(`/listas-precios/${listaId}/revertir`, {})).status).toBe(403);
    rol = 'admin';
    const r = await post(`/listas-precios/${listaId}/revertir`, {});
    expect(r.status).toBe(200);
    const j = await r.json() as { revertidos: number; omitidos: { nombre: string }[] };
    expect(j.revertidos).toBe(1);
    expect(j.omitidos.map(o => o.nombre)).toEqual(['TEST-LISTA-B']);
    expect(await prod(ids.a!)).toEqual({ costo: 1000, precio: 1500 });
    expect(await prod(ids.b!)).toEqual({ costo: 2400, precio: 4000 });   // intacto
    expect((await post(`/listas-precios/${listaId}/revertir`, {})).status).toBe(409);
    const { rows: [e] } = await db.query(`SELECT estado FROM listas_precios_importadas WHERE id = $1`, [listaId]);
    expect(e.estado).toBe('revertida');
  });

  it('una subida anterior al registro se reconstruye del historial y también se puede revertir', async () => {
    await db.query(`UPDATE catalogo_productos SET costo_base = 1300, precio_base = 1950 WHERE id = $1`, [ids.a]);
    await db.query(`INSERT INTO producto_precio_historial (producto_id, tipo, precio_anterior, precio_nuevo, costo_anterior, costo_nuevo, origen, detalle)
                    VALUES ($1, 'cambio_precio', 1500, 1950, 1000, 1300, 'lista_proveedor', 'Lista vieja (vieja.csv)')`, [ids.a]);
    const l = await (await app.request(`/listas-precios?proveedor_id=${ids.prov}`)).json() as { listas: { reconstruida: boolean; detalle: string; fecha: string; actualizados: number }[] };
    const rec = l.listas.find(x => x.reconstruida && x.detalle === 'Lista vieja (vieja.csv)')!;
    expect(rec.actualizados).toBe(1);
    const fecha = new Date(rec.fecha).toISOString().slice(0, 10);
    const r = await post('/listas-precios/reconstruida/revertir', { proveedor_id: ids.prov, fecha, detalle: 'Lista vieja (vieja.csv)' });
    expect(r.status).toBe(200);
    expect((await r.json() as { revertidos: number }).revertidos).toBe(1);
    expect(await prod(ids.a!)).toEqual({ costo: 1000, precio: 1500 });
  });
});
