import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Dos fallas vistas en producción (2026-11-04): la lista de Presupuestos recortaba en 200 filas y dejaba afuera los
// aprobados recientes, y la búsqueda del panel de Clientes devolvía 500 ("function trueand(boolean) does not exist").
describe.skipIf(!process.env.DATABASE_URL)('lista de presupuestos y búsqueda de clientes', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  let cli = '';

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const operaciones = (await import('../routes/operaciones.js')).default;
    const clientes = (await import('../routes/clientes.js')).default;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'admin', nombre: 'Test' } as never); await next(); });
    app.route('/operaciones', operaciones);
    app.route('/clientes', clientes);
    // Contacto reciente: así sus presupuestos aprobados caen al final del orden (el caso que se perdía)
    cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido, ultima_interaccion) VALUES ('fisica','ZzTestLista','Zzbuscable', now()) RETURNING id`)).rows[0].id;
    await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, fecha_validez) SELECT 'estandar', $1, 'aprobado', CURRENT_DATE + 7 FROM generate_series(1, 230)`, [cli]);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [cli]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [cli]);
    await db.end();
  });

  it('la lista de presupuestos no recorta en 200: aparecen todos los de un cliente con muchos aprobados', async () => {
    const r = await app.request('/operaciones/ventas-panel');
    expect(r.status).toBe(200);
    const j = await r.json() as { presupuestos: { cliente: { id: string } }[] };
    expect(j.presupuestos.filter(p => p.cliente.id === cli).length).toBe(230);
    expect(j.presupuestos.length).toBeGreaterThan(200);
  });

  it('el panel de clientes con búsqueda responde 200 y encuentra al cliente (antes: 500)', async () => {
    const r = await app.request('/clientes/panel?search=Zzbuscable');
    expect(r.status).toBe(200);
    const j = await r.json() as { clientes: { id: string }[] };
    expect(j.clientes.some(c => c.id === cli)).toBe(true);
    // varias palabras (apellido, nombre) también
    expect((await app.request('/clientes/panel?search=Zzbuscable%2C%20ZzTestLista')).status).toBe(200);
  });
});
