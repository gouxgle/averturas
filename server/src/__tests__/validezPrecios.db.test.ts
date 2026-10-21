import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Rutas reales de productos con un usuario simulado, contra la base (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('validez del precio de un producto', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  let rol = 'admin';
  let id = '';

  const venc = async () => (await db.query(`SELECT precio_actualizado_at FROM catalogo_productos WHERE id = $1`, [id])).rows[0].precio_actualizado_at as Date;
  const vencer = () => db.query(`UPDATE catalogo_productos SET precio_actualizado_at = now() - interval '30 days' WHERE id = $1`, [id]);
  const put = (extra: Record<string, unknown>) => app.request(`/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'TEST-VALIDEZ', tipo: 'estandar', costo_base: 1000, precio_base: 1500, ...extra }),
  });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const productos = (await import('../routes/productos.js')).default;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol, nombre: 'Test' } as never); await next(); });
    app.route('/', productos);
    id = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, costo_base, precio_base) VALUES ('TEST-VALIDEZ','estandar',1000,1500) RETURNING id`)).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM producto_precio_historial WHERE producto_id = $1`, [id]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = $1`, [id]);
    await db.end();
  });

  it('guardar sin cambiar precio ni costo no renueva la validez', async () => {
    await vencer();
    const antes = await venc();
    expect((await put({})).status).toBe(200);
    expect((await venc()).getTime()).toBe(antes.getTime());
  });

  it('cambiar solo el costo renueva la validez', async () => {
    await vencer();
    const antes = await venc();
    expect((await put({ costo_base: 1200 })).status).toBe(200);
    expect((await venc()).getTime()).toBeGreaterThan(antes.getTime() + 29 * 86400000);
  });

  it('cambiar el precio renueva la validez', async () => {
    await vencer();
    expect((await put({ costo_base: 1200, precio_base: 1800 })).status).toBe(200);
    expect(Date.now() - (await venc()).getTime()).toBeLessThan(60000);
  });

  it('renovar validez no toca el precio y devuelve la fecha nueva', async () => {
    await vencer();
    const r = await app.request('/renovar-validez-precios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ producto_ids: [id] }),
    });
    expect(r.status).toBe(200);
    const j = await r.json() as { actualizados: number; precio_actualizado_at: string };
    expect(j.actualizados).toBe(1);
    expect(j.precio_actualizado_at).toBeTruthy();
    const { rows: [p] } = await db.query(`SELECT precio_base::float AS precio FROM catalogo_productos WHERE id = $1`, [id]);
    expect(p.precio).toBe(1800);
  });

  it('el rol consulta no puede renovar (403) y no cambia nada', async () => {
    await vencer();
    const antes = await venc();
    rol = 'consulta';
    const r = await app.request('/renovar-validez-precios', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ producto_ids: [id] }),
    });
    rol = 'admin';
    expect(r.status).toBe(403);
    expect((await venc()).getTime()).toBe(antes.getTime());
  });

  it('config-validez devuelve los días del semáforo', async () => {
    const r = await app.request('/config-validez');
    expect(r.status).toBe(200);
    const j = await r.json() as { dias_al_dia: number; dias_vencido: number };
    expect(j.dias_al_dia).toBeGreaterThan(0);
    expect(j.dias_vencido).toBeGreaterThanOrEqual(j.dias_al_dia);
  });
});
