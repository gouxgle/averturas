import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { DevolucionSchema } from '../lib/schemas.js';

describe('DevolucionSchema: cambio', () => {
  const base = { remito_id: '00000000-0000-4000-8000-000000000001', motivo: 'Cambio de medida',
    items: [{ remito_item_id: '00000000-0000-4000-8000-000000000002', cantidad: 1, destino: 'stock' }] };
  const nuevo = { producto_id: '00000000-0000-4000-8000-000000000003', descripcion: 'Ventana', cantidad: 1, precio_unitario: 1000 };
  it('pide al menos un producto con precio, y una forma de pago conocida para la diferencia', () => {
    expect(DevolucionSchema.safeParse({ ...base, cambio: { items: [nuevo] } }).success).toBe(true);
    expect(DevolucionSchema.safeParse({ ...base, cambio: { items: [] } }).success).toBe(false);
    expect(DevolucionSchema.safeParse({ ...base, cambio: { items: [{ ...nuevo, precio_unitario: 0 }] } }).success).toBe(false);
    expect(DevolucionSchema.safeParse({ ...base, cambio: { items: [nuevo], pago_diferencia: { forma_pago: 'Contado' } } }).success).toBe(true);
    expect(DevolucionSchema.safeParse({ ...base, cambio: { items: [nuevo], pago_diferencia: { forma_pago: 'Bitcoin' } } }).success).toBe(false);
  });
});

// Rutas reales con un usuario simulado, contra la base (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('cambio de producto y venta rápida compartida', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  const ids: { cli?: string; usr?: string; viejo?: string; nuevo?: string } = {};
  let n = 0;

  const post = (path: string, body: unknown) =>
    app.request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const stock = async (p: string) => Number((await db.query(
    `SELECT (cp.stock_inicial + COALESCE((SELECT SUM(cantidad) FROM stock_movimientos WHERE producto_id = cp.id), 0))::int AS s FROM catalogo_productos cp WHERE id = $1`, [p])).rows[0].s);
  const saldoFavor = async () => Number((await db.query(`SELECT COALESCE((SELECT saldo FROM cliente_saldo_favor WHERE cliente_id = $1), 0) AS s`, [ids.cli])).rows[0].s);
  const cuenta = async (tabla: string) => Number((await db.query(`SELECT count(*) AS n FROM ${tabla} WHERE ${tabla === 'operaciones' ? 'cliente_id' : 'cliente_id'} = $1`, [ids.cli])).rows[0].n);

  // Operación de 100.000 (2 ventanas de 50.000, cobrado 60.000): devolver 1 deja E = 10.000 a favor del cliente.
  async function escenario() {
    const op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'entregado', 100000) RETURNING id`, [ids.cli])).rows[0].id;
    await db.query(`INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista) VALUES ($1,$2,$3,60000,60000)`, [`REC-TEST-CA-${++n}`, ids.cli, op]);
    const oi = (await db.query(`INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, orden, tipo_item, producto_id) VALUES ($1,'Ventana vieja',2,50000,1,'estandar',$2) RETURNING id`, [op, ids.viejo])).rows[0].id;
    const rem = (await db.query(`INSERT INTO remitos (numero, cliente_id, operacion_id, estado, stock_descontado) VALUES ($1,$2,$3,'entregado',true) RETURNING id`, [`R-TEST-CA-${++n}`, ids.cli, op])).rows[0].id;
    const ri = (await db.query(`INSERT INTO remito_items (remito_id, producto_id, descripcion, cantidad, operacion_item_id) VALUES ($1,$2,'Ventana vieja',2,$3) RETURNING id`, [rem, ids.viejo, oi])).rows[0].id;
    return { op: op as string, remito: rem as string, ri: ri as string };
  }
  const nuevoItem = (precio: number, cantidad = 1) => ({ producto_id: ids.nuevo, descripcion: 'Ventana nueva', cantidad, precio_unitario: precio });
  const cambiar = (e: Awaited<ReturnType<typeof escenario>>, cambio: unknown, extra: Record<string, unknown> = {}) =>
    post('/devoluciones', { remito_id: e.remito, motivo: 'Cambio de modelo', items: [{ remito_item_id: e.ri, cantidad: 1, destino: 'stock' }], cambio, ...extra });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const devoluciones = (await import('../routes/devoluciones.js')).default;
    const operaciones = (await import('../routes/operaciones.js')).default;
    ids.usr = (await db.query(`SELECT id FROM usuarios WHERE activo = true ORDER BY created_at LIMIT 1`)).rows[0].id;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: ids.usr, rol: 'vendedor', nombre: 'Tester' } as never); await next(); });
    app.route('/devoluciones', devoluciones);
    app.route('/operaciones', operaciones);
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestCambio','Zzz') RETURNING id`)).rows[0].id;
    ids.viejo = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Ventana vieja test cambio', 'estandar', 20) RETURNING id`)).rows[0].id;
    ids.nuevo = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Ventana nueva test cambio', 'estandar', 5) RETURNING id`)).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM cliente_saldo_favor_movimientos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM reintegros WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`UPDATE devoluciones SET operacion_cambio_id = NULL WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM devoluciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = ANY($1::uuid[])`, [[ids.viejo, ids.nuevo]]);
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = ANY($1::uuid[])`, [[ids.viejo, ids.nuevo]]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.query(`DELETE FROM actividad_log WHERE entidad IN ('devolucion','presupuesto','recibo','remito') AND created_at > now() - interval '1 hour' AND (detalle LIKE 'Cambio%' OR detalle LIKE 'Devolución por%' OR detalle LIKE 'Venta rápida%')`);
    await db.end();
  });

  it('producto más caro: el crédito de la devolución paga una parte y el cliente paga la diferencia', async () => {
    const e = await escenario();
    const sViejo = await stock(ids.viejo!), sNuevo = await stock(ids.nuevo!);
    const r = await cambiar(e, { items: [nuevoItem(70000)], pago_diferencia: { forma_pago: 'Contado' } });
    expect(r.status).toBe(201);
    const d = (await r.json()) as { id: string; credito_monto: number; cambio: { operacion: { id: string; total: number }; pagado_con_saldo_favor: number; diferencia_cobrada: number; diferencia_pendiente: number; recibos: { forma_pago: string; monto: number }[] } };
    expect(d.cambio).toMatchObject({ pagado_con_saldo_favor: 10000, diferencia_cobrada: 60000, diferencia_pendiente: 0 });
    expect(d.cambio.operacion.total).toBe(70000);
    expect(d.cambio.recibos.map(x => [x.forma_pago, x.monto])).toEqual([['Saldo a favor', 10000], ['Contado', 60000]]);
    // stock: la ventana vieja vuelve, la nueva sale
    expect([await stock(ids.viejo!), await stock(ids.nuevo!)]).toEqual([sViejo + 1, sNuevo - 1]);
    // el crédito de la devolución se creó y se consumió entero: no queda saldo a favor
    expect(await saldoFavor()).toBe(0);
    // la operación nueva: es un cambio, entregada, con su remito entregado y totalmente cobrada
    const { rows: [op] } = await db.query(`SELECT estado, es_cambio, devolucion_origen_id FROM operaciones WHERE id = $1`, [d.cambio.operacion.id]);
    expect(op).toEqual({ estado: 'entregado', es_cambio: true, devolucion_origen_id: d.id });
    const { rows: [rem] } = await db.query(`SELECT estado FROM remitos WHERE operacion_id = $1`, [d.cambio.operacion.id]);
    expect(rem.estado).toBe('entregado');
    const { rows: [cob] } = await db.query(`SELECT cobrado, saldo FROM operacion_cobranza WHERE operacion_id = $1`, [d.cambio.operacion.id]);
    expect([Number(cob.cobrado), Number(cob.saldo)]).toEqual([70000, 0]);
    const { rows: [dv] } = await db.query(`SELECT operacion_cambio_id FROM devoluciones WHERE id = $1`, [d.id]);
    expect(dv.operacion_cambio_id).toBe(d.cambio.operacion.id);
    // el pago con saldo a favor NO es caja
    const { rows: pagos } = await db.query(`SELECT rpe.forma_pago, rpe.es_saldo_favor FROM recibo_pagos_efectivos rpe JOIN recibos r ON r.id = rpe.recibo_id WHERE r.operacion_id = $1 ORDER BY rpe.monto`, [d.cambio.operacion.id]);
    expect(pagos.map(x => [x.forma_pago, x.es_saldo_favor])).toEqual([['Saldo a favor', true], ['Contado', false]]);
  });

  it('producto más barato: lo que sobra queda a favor, o se devuelve en dinero si se pide', async () => {
    const e1 = await escenario();
    const aFavor = await cambiar(e1, { items: [nuevoItem(6000)] });
    expect(aFavor.status).toBe(201);
    const d1 = (await aFavor.json()) as { cambio: { pagado_con_saldo_favor: number; diferencia_cobrada: number; recibos: unknown[] } };
    expect([d1.cambio.pagado_con_saldo_favor, d1.cambio.diferencia_cobrada, d1.cambio.recibos.length]).toEqual([6000, 0, 1]);
    expect(await saldoFavor()).toBe(4000);                      // E 10.000 − 6.000 que pagaron el producto nuevo

    const e2 = await escenario();
    const enDinero = await cambiar(e2, { items: [nuevoItem(6000)] }, { reintegro: { monto: 4000, forma_pago: 'Efectivo' } });
    expect(enDinero.status).toBe(201);
    expect(await saldoFavor()).toBe(4000);                      // el segundo sobrante salió en dinero: no se acreditó
    const { rows: [rei] } = await db.query(`SELECT monto, forma_pago FROM reintegros WHERE cliente_id = $1 ORDER BY created_at DESC LIMIT 1`, [ids.cli]);
    expect([Number(rei.monto), rei.forma_pago]).toEqual([4000, 'Efectivo']);
  });

  it('no se puede devolver en dinero lo que se usa para pagar el producto nuevo (y no queda nada registrado)', async () => {
    const e = await escenario();
    const antes = { dev: await cuenta('devoluciones'), ops: await cuenta('operaciones'), s: [await stock(ids.viejo!), await stock(ids.nuevo!)], f: await saldoFavor() };
    const r = await cambiar(e, { items: [nuevoItem(6000)] }, { reintegro: { monto: 5000, forma_pago: 'Efectivo' } });   // sobran 4.000, no 5.000
    expect(r.status).toBe(422);
    expect({ dev: await cuenta('devoluciones'), ops: await cuenta('operaciones'), s: [await stock(ids.viejo!), await stock(ids.nuevo!)], f: await saldoFavor() }).toEqual(antes);
  });

  it('sin forma de pago para la diferencia, lo que falta queda pendiente de cobro en la operación nueva', async () => {
    const e = await escenario();
    const r = await cambiar(e, { items: [nuevoItem(70000)] });
    const d = (await r.json()) as { cambio: { operacion: { id: string }; diferencia_cobrada: number; diferencia_pendiente: number } };
    expect([d.cambio.diferencia_cobrada, d.cambio.diferencia_pendiente]).toEqual([0, 60000]);
    const { rows: [cob] } = await db.query(`SELECT saldo FROM operacion_cobranza WHERE operacion_id = $1`, [d.cambio.operacion.id]);
    expect(Number(cob.saldo)).toBe(60000);
  });

  it('todo o nada: sin stock del producto nuevo no se registra ni la devolución', async () => {
    const e = await escenario();
    const antes = { dev: await cuenta('devoluciones'), s: await stock(ids.viejo!), f: await saldoFavor() };
    const r = await cambiar(e, { items: [nuevoItem(1000, 999)] });
    expect(r.status).toBe(422);
    expect({ dev: await cuenta('devoluciones'), s: await stock(ids.viejo!), f: await saldoFavor() }).toEqual(antes);
  });

  it('la venta rápida (que comparte stock y remito con el cambio) sigue igual', async () => {
    const venta = (cantidad: number, producto = ids.nuevo) => post('/operaciones/venta-rapida', {
      cliente_id: ids.cli, forma_pago: 'Contado', items: [{ producto_id: producto, descripcion: 'Ventana nueva', cantidad, precio_unitario: 1000 }],
    });
    const s0 = await stock(ids.nuevo!);
    const ok = await venta(1);
    expect(ok.status).toBe(201);
    const v = (await ok.json()) as { operacion_id: string; estado_remito: string };
    expect(v.estado_remito).toBe('entregado');
    expect(await stock(ids.nuevo!)).toBe(s0 - 1);
    const { rows: [op] } = await db.query(`SELECT estado, es_venta_rapida, es_cambio FROM operaciones WHERE id = $1`, [v.operacion_id]);
    expect(op).toEqual({ estado: 'entregado', es_venta_rapida: true, es_cambio: false });
    expect((await venta(9999)).status).toBe(422);
    expect((await venta(1, '00000000-0000-4000-8000-0000000000aa')).status).toBe(404);
    expect(await stock(ids.nuevo!)).toBe(s0 - 1);
  });
});
