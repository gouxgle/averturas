import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Planilla Excel por proveedor: filas a exportar, análisis por producto y aplicación (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('planilla de precios por proveedor', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  const ids: { prov?: string; otro?: string; a?: string; c?: string; ajeno?: string } = {};

  const get = (path: string) => app.request(path);
  const post = (path: string, body: unknown) => app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const catalogo = (await import('../routes/catalogo.js')).default;
    const productos = (await import('../routes/productos.js')).default;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'admin', nombre: 'Test' } as never); await next(); });
    app.route('/catalogo', catalogo);
    app.route('/productos', productos);
    ids.prov = (await db.query(`INSERT INTO proveedores (nombre) VALUES ('TEST-PROV-PLANILLA') RETURNING id`)).rows[0].id;
    ids.otro = (await db.query(`INSERT INTO proveedores (nombre) VALUES ('TEST-PROV-OTRO') RETURNING id`)).rows[0].id;
    ids.a = (await db.query(`INSERT INTO catalogo_productos (nombre, descripcion, tipo, costo_base, precio_base, proveedor_id, proveedor_sku) VALUES ('TEST-PLAN-A','chica','estandar',1000,1500,$1,'PA') RETURNING id`, [ids.prov])).rows[0].id;
    // Sin código de proveedor ni renglón en su lista: cargado a mano
    ids.c = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, costo_base, precio_base, proveedor_id) VALUES ('TEST-PLAN-C','estandar',2000,3000,$1) RETURNING id`, [ids.prov])).rows[0].id;
    ids.ajeno = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, costo_base, precio_base, proveedor_id) VALUES ('TEST-PLAN-AJENO','estandar',500,800,$1) RETURNING id`, [ids.otro])).rows[0].id;
    await db.query(`INSERT INTO proveedor_precios (proveedor_id, sku, descripcion, precio, producto_id) VALUES ($1,'PA','x',1000,$2)`, [ids.prov, ids.a]);
  });

  afterAll(async () => {
    const ps = [ids.a, ids.c, ids.ajeno];
    await db.query(`DELETE FROM producto_precio_historial WHERE producto_id = ANY($1)`, [ps]);
    await db.query(`DELETE FROM listas_precios_importadas WHERE proveedor_id = ANY($1)`, [[ids.prov, ids.otro]]);
    await db.query(`DELETE FROM proveedor_precios WHERE proveedor_id = ANY($1)`, [[ids.prov, ids.otro]]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = ANY($1)`, [ps]);
    await db.query(`DELETE FROM proveedores WHERE id = ANY($1)`, [[ids.prov, ids.otro]]);
    await db.end();
  });

  it('GET /productos/planilla-precios trae solo los productos del proveedor con su lista y venta actual', async () => {
    const r = await get(`/productos/planilla-precios?proveedor_id=${ids.prov}`);
    expect(r.status).toBe(200);
    const j = await r.json() as { proveedor: { nombre: string }; filas: { id: string; nombre: string; sku: string | null; lista_actual: number; venta_actual: number }[] };
    expect(j.proveedor.nombre).toBe('TEST-PROV-PLANILLA');
    expect(j.filas.map(f => [f.nombre, f.sku, f.lista_actual, f.venta_actual])).toEqual([['TEST-PLAN-A', 'PA', 1000, 1500], ['TEST-PLAN-C', null, 2000, 3000]]);
    expect((await get('/productos/planilla-precios?proveedor_id=nope')).status).toBe(422);
  });

  it('analizar por producto: recalcula el precio de venta con el recargo y descarta los ajenos', async () => {
    const r = await post('/catalogo/proveedor-precios/analizar-lista', {
      proveedor_id: ids.prov,
      por_producto: [{ producto_id: ids.a, precio: 1100 }, { producto_id: ids.c, precio: 2200 }, { producto_id: ids.ajeno, precio: 999 }],
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { coincidencias: { nombre: string; costo_nuevo: number; precio_nuevo: number; variacion: number; revisar: boolean }[]; ignoradas: number };
    expect(j.ignoradas).toBe(1);
    const a = j.coincidencias.find(x => x.nombre === 'TEST-PLAN-A')!;
    expect([a.costo_nuevo, a.precio_nuevo, a.revisar]).toEqual([1100, 1650, false]);   // +10 % de costo → +10 % de precio
    expect(j.coincidencias.find(x => x.nombre === 'TEST-PLAN-C')!.precio_nuevo).toBe(3300);
  });

  it('aplicar como planilla: se registra con origen planilla y el producto sin código queda con renglón propio', async () => {
    const r = await post('/catalogo/proveedor-precios/aplicar-lista', {
      proveedor_id: ids.prov, origen: 'planilla', archivo: 'lista.xlsx', detalle: 'Planilla de TEST (lista.xlsx)',
      items: [
        { producto_id: ids.a, costo_nuevo: 1100, precio_nuevo: 1650, solo_renovar: false, sku: 'PA' },
        { producto_id: ids.c, costo_nuevo: 2200, precio_nuevo: 3300, solo_renovar: false },
      ],
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { actualizados: number; lista_id: string };
    expect(j.actualizados).toBe(2);
    const { rows: [l] } = await db.query(`SELECT origen, filas_leidas FROM listas_precios_importadas WHERE id = $1`, [j.lista_id]);
    expect([l.origen, l.filas_leidas]).toEqual(['planilla', 2]);
    // El producto C ahora tiene su precio de lista en proveedor_precios (con un código propio)
    const { rows: [pp] } = await db.query(`SELECT sku, precio::float AS precio FROM proveedor_precios WHERE proveedor_id = $1 AND producto_id = $2`, [ids.prov, ids.c]);
    expect(pp.precio).toBe(2200);
    expect(pp.sku).toMatch(/^INT-/);
    // y la próxima exportación ya lo trae
    const j2 = await (await get(`/productos/planilla-precios?proveedor_id=${ids.prov}`)).json() as { filas: { nombre: string; lista_actual: number }[] };
    expect(j2.filas.map(f => [f.nombre, f.lista_actual])).toEqual([['TEST-PLAN-A', 1100], ['TEST-PLAN-C', 2200]]);
  });
});
