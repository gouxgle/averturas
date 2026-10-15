import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { calcularDevolucion } from '../lib/devoluciones.js';
import { DevolucionSchema } from '../lib/schemas.js';

describe('calcularDevolucion (cuentas del plan)', () => {
  const unaLinea = (precio: number, cantidad = 1) => [{ cantidad, precio_bruto: precio }];
  it('A: debía 40.000 y devuelve 50.000 → baja la deuda y 10.000 quedan a favor', () => {
    const r = calcularDevolucion({ precio_total: 100000, descuentos: 0, saldo_previo: 40000, lineas: unaLinea(50000) });
    expect([r.valor_total, r.aplicado_a_saldo, r.excedente]).toEqual([50000, 40000, 10000]);
  });
  it('B: con 10.000 de bonificación la unidad vale 45.000 y todo es plata a favor (no debía nada)', () => {
    const r = calcularDevolucion({ precio_total: 100000, descuentos: 10000, saldo_previo: 0, lineas: unaLinea(50000) });
    expect(r.factor).toBe(0.1);
    expect([r.lineas[0].precio_neto, r.lineas[0].descuento_unitario]).toEqual([45000, 5000]);
    expect([r.valor_total, r.aplicado_a_saldo, r.excedente]).toEqual([45000, 0, 45000]);
  });
  it('C: debía mucho más de lo que devuelve → todo baja la deuda, nada a favor', () => {
    const r = calcularDevolucion({ precio_total: 100000, descuentos: 0, saldo_previo: 80000, lineas: unaLinea(30000) });
    expect([r.valor_total, r.aplicado_a_saldo, r.excedente]).toEqual([30000, 30000, 0]);
  });
  it('sin deuda ni operación, todo es excedente; una saldo negativo no se aplica', () => {
    expect(calcularDevolucion({ precio_total: 0, descuentos: 0, saldo_previo: 0, lineas: unaLinea(1000, 3) }).excedente).toBe(3000);
    expect(calcularDevolucion({ precio_total: 100, descuentos: 0, saldo_previo: -500, lineas: unaLinea(100) }).aplicado_a_saldo).toBe(0);
  });
  it('redondea el medio centavo hacia arriba como el resto del sistema (10,05 con 50 % → 5,03)', () => {
    const r = calcularDevolucion({ precio_total: 100, descuentos: 50, saldo_previo: 0, lineas: unaLinea(10.05, 3) });
    expect(r.lineas[0].precio_neto).toBe(5.03);
    expect(r.valor_total).toBe(15.09);   // 3 × 5,03: el valor suma unidades ya redondeadas, igual que lo que se guarda
  });
});

describe('DevolucionSchema', () => {
  const base = { remito_id: '00000000-0000-4000-8000-000000000001', motivo: 'No le quedó bien',
    items: [{ remito_item_id: '00000000-0000-4000-8000-000000000002', cantidad: 1, destino: 'stock' }] };
  it('pide remito u operación, motivo e ítems', () => {
    expect(DevolucionSchema.safeParse(base).success).toBe(true);
    expect(DevolucionSchema.safeParse({ ...base, remito_id: undefined }).success).toBe(false);
    expect(DevolucionSchema.safeParse({ ...base, motivo: ' ' }).success).toBe(false);
    expect(DevolucionSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(DevolucionSchema.safeParse({ ...base, items: [{ ...base.items[0], cantidad: 0 }] }).success).toBe(false);
    expect(DevolucionSchema.safeParse({ ...base, items: [{ ...base.items[0], destino: 'regalo' }] }).success).toBe(false);
  });
});

// Contra la base (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('devoluciones: stock, saldo a favor y topes', () => {
  let db: typeof import('../db.js')['db'];
  let dv: typeof import('../lib/devoluciones.js');
  const ids: { cli?: string; prod?: string; prodMedida?: string } = {};
  const ops: string[] = [];
  let n = 0;
  const admin = { id: null, rol: 'admin' };
  const vendedor = { id: null, rol: 'vendedor' };

  // Una operación aprobada con sus ítems, recibos y un remito emitido que los entrega.
  async function escenario(opts: {
    items: { desc: string; cant: number; precio: number; tipo?: string; prod?: string }[];
    precioTotal: number; cobrado: number; descuento?: number; sinOperacion?: boolean;
  }) {
    const op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'aprobado', $2) RETURNING id`,
      [ids.cli, opts.precioTotal])).rows[0].id as string;
    ops.push(op);
    if (opts.cobrado > 0) {
      await db.query(`INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista, monto_descuento) VALUES ($1,$2,$3,$4,$5,$6)`,
        [`REC-TEST-DV-${++n}`, ids.cli, op, opts.cobrado, opts.cobrado + (opts.descuento ?? 0), opts.descuento ?? 0]);
    }
    const rem = (await db.query(`INSERT INTO remitos (numero, cliente_id, operacion_id, estado, stock_descontado) VALUES ($1,$2,$3,'entregado',true) RETURNING id`,
      [`R-TEST-DV-${++n}`, ids.cli, opts.sinOperacion ? null : op])).rows[0].id as string;
    const out: { remito: string; op: string; ri: string[] } = { remito: rem, op, ri: [] };
    let orden = 0;
    for (const it of opts.items) {
      const oi = (await db.query(
        `INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, orden, tipo_item, producto_id) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [op, it.desc, it.cant, it.precio, ++orden, it.tipo ?? 'estandar', it.prod ?? null])).rows[0].id;
      const ri = (await db.query(
        `INSERT INTO remito_items (remito_id, producto_id, descripcion, cantidad, operacion_item_id) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [rem, it.prod ?? null, it.desc, it.cant, oi])).rows[0].id;
      out.ri.push(ri);
    }
    return out;
  }
  async function devolver(e: Awaited<ReturnType<typeof escenario>>, items: Parameters<typeof dv.crearDevolucion>[1]['items'], user = admin) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const r = await dv.crearDevolucion(client, { remito_id: e.remito, motivo: 'Prueba', items }, user);
      await client.query('COMMIT');
      return r;
    } catch (err) { await client.query('ROLLBACK'); throw err; } finally { client.release(); }
  }
  const stock = async (prod: string) => Number((await db.query(
    `SELECT (cp.stock_inicial + COALESCE((SELECT SUM(cantidad) FROM stock_movimientos WHERE producto_id = cp.id), 0))::int AS s FROM catalogo_productos cp WHERE id = $1`, [prod])).rows[0].s);
  const saldoOp = async (op: string) => Number((await db.query(`SELECT saldo FROM operacion_cobranza WHERE operacion_id = $1`, [op])).rows[0].saldo);
  const saldoFavor = async () => Number((await db.query(`SELECT COALESCE((SELECT saldo FROM cliente_saldo_favor WHERE cliente_id = $1), 0) AS s`, [ids.cli])).rows[0].s);

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    dv = await import('../lib/devoluciones.js');
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestDevol','Zzz') RETURNING id`)).rows[0].id;
    ids.prod = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Ventana test devol', 'estandar', 10) RETURNING id`)).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM cliente_saldo_favor_movimientos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM devoluciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = $1`, [ids.prod]);
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = $1`, [ids.prod]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.end();
  });

  it('caso A: vuelve a stock, baja la deuda y el resto queda a favor del cliente', async () => {
    const e = await escenario({ items: [{ desc: 'Ventana A', cant: 2, precio: 50000, prod: ids.prod }], precioTotal: 100000, cobrado: 60000 });
    const s0 = await stock(ids.prod!), f0 = await saldoFavor();
    const r = await devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' }]);
    expect(r).toMatchObject({ valor_total: 50000, aplicado_a_saldo: 40000, credito_monto: 10000, reintegro_monto: 0 });
    expect(r.numero).toMatch(/^DEV-\d{6}-\d{4}$/);
    expect(await stock(ids.prod!)).toBe(s0 + 1);
    expect(await saldoFavor()).toBe(f0 + 10000);
    expect(await saldoOp(e.op)).toBe(0);                      // 100000 − 60000 − 40000
    const { rows: [mov] } = await db.query(`SELECT tipo, cantidad, referencia_nro FROM stock_movimientos WHERE referencia_nro = $1`, [r.numero]);
    expect(mov).toEqual({ tipo: 'devolucion_cliente', cantidad: 1, referencia_nro: r.numero });
  });

  it('caso B: la bonificación no se devuelve (la unidad vale 45.000, no 50.000)', async () => {
    const e = await escenario({ items: [{ desc: 'Ventana B', cant: 1, precio: 100000, prod: ids.prod }], precioTotal: 100000, cobrado: 90000, descuento: 10000 });
    const r = await devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' }]);
    expect(r).toMatchObject({ valor_total: 90000, aplicado_a_saldo: 0, credito_monto: 90000 });
  });

  it('caso C: el cliente debía más de lo devuelto → solo baja la deuda, sigue debiendo el resto', async () => {
    const e = await escenario({ items: [{ desc: 'A', cant: 1, precio: 30000, prod: ids.prod }, { desc: 'B', cant: 1, precio: 70000, prod: ids.prod }], precioTotal: 100000, cobrado: 20000 });
    const f0 = await saldoFavor();
    const r = await devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' }]);
    expect(r).toMatchObject({ valor_total: 30000, aplicado_a_saldo: 30000, credito_monto: 0 });
    expect(await saldoOp(e.op)).toBe(50000);
    expect(await saldoFavor()).toBe(f0);
  });

  it('"no reingresa" no toca el stock pero queda registrado como pérdida con su motivo', async () => {
    const e = await escenario({ items: [{ desc: 'Rota', cant: 1, precio: 10000, prod: ids.prod }], precioTotal: 10000, cobrado: 10000 });
    const s0 = await stock(ids.prod!);
    const r = await devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'no_reingresa', motivo_item: 'Vidrio roto' }]);
    expect(await stock(ids.prod!)).toBe(s0);
    const { rows: [it] } = await db.query(`SELECT destino, motivo_item FROM devolucion_items WHERE devolucion_id = $1`, [r.id]);
    expect(it).toEqual({ destino: 'no_reingresa', motivo_item: 'Vidrio roto' });
    // sin motivo se rechaza
    const e2 = await escenario({ items: [{ desc: 'Rota2', cant: 1, precio: 10000, prod: ids.prod }], precioTotal: 10000, cobrado: 10000 });
    await expect(devolver(e2, [{ remito_item_id: e2.ri[0], cantidad: 1, destino: 'no_reingresa' }])).rejects.toMatchObject({ status: 422 });
  });

  it('no se puede devolver más de lo entregado ni volver a devolver lo ya devuelto (409)', async () => {
    const e = await escenario({ items: [{ desc: 'Dos', cant: 2, precio: 1000, prod: ids.prod }], precioTotal: 2000, cobrado: 2000 });
    await expect(devolver(e, [{ remito_item_id: e.ri[0], cantidad: 3, destino: 'stock' }])).rejects.toMatchObject({ status: 409 });
    await devolver(e, [{ remito_item_id: e.ri[0], cantidad: 2, destino: 'stock' }]);
    await expect(devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' }])).rejects.toMatchObject({ status: 409 });
  });

  it('un ítem a medida solo lo devuelve un admin y nunca vuelve a stock; un servicio no se devuelve', async () => {
    const e = await escenario({ items: [{ desc: 'A medida', cant: 1, precio: 5000, tipo: 'a_medida', prod: ids.prod }, { desc: 'Instalación', cant: 1, precio: 800, tipo: 'servicio' }], precioTotal: 5800, cobrado: 5800 });
    const s0 = await stock(ids.prod!);
    await expect(devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' }], vendedor)).rejects.toMatchObject({ status: 403 });
    await expect(devolver(e, [{ remito_item_id: e.ri[1], cantidad: 1, destino: 'no_reingresa', motivo_item: 'x' }])).rejects.toMatchObject({ status: 422 });
    await devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' }], admin);   // pide "stock" y se fuerza a no reingresar
    expect(await stock(ids.prod!)).toBe(s0);
    const { rows: [it] } = await db.query(`SELECT destino, motivo_item FROM devolucion_items WHERE operacion_item_id IN (SELECT operacion_item_id FROM remito_items WHERE id = $1)`, [e.ri[0]]);
    expect(it).toEqual({ destino: 'no_reingresa', motivo_item: 'Producto a medida' });
  });

  it('todo o nada: si un ítem falla no queda stock movido ni saldo a favor', async () => {
    const e = await escenario({ items: [{ desc: 'Ok', cant: 1, precio: 1000, prod: ids.prod }, { desc: 'Mal', cant: 1, precio: 1000, prod: ids.prod }], precioTotal: 2000, cobrado: 2000 });
    const s0 = await stock(ids.prod!), f0 = await saldoFavor();
    await expect(devolver(e, [
      { remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' },
      { remito_item_id: e.ri[1], cantidad: 5, destino: 'stock' },
    ])).rejects.toMatchObject({ status: 409 });
    expect([await stock(ids.prod!), await saldoFavor()]).toEqual([s0, f0]);
  });

  it('remito sin operación: no hay deuda que bajar, todo queda a favor (precio cargado a mano si falta)', async () => {
    const e = await escenario({ items: [{ desc: 'Suelto', cant: 1, precio: 0, prod: ids.prod }], precioTotal: 0, cobrado: 0, sinOperacion: true });
    await expect(devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' }])).rejects.toMatchObject({ status: 422 });   // sin precio
    const r = await devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock', precio_unitario: 2500 }]);
    expect(r).toMatchObject({ valor_total: 2500, aplicado_a_saldo: 0, credito_monto: 2500, operacion_id: null });
  });

  it('prepararDevolucion informa máximo devolvible, saldo y bloqueos', async () => {
    const e = await escenario({ items: [{ desc: 'Ventana P', cant: 3, precio: 1000, prod: ids.prod }, { desc: 'Serv', cant: 1, precio: 100, tipo: 'servicio' }], precioTotal: 3100, cobrado: 1000 });
    await devolver(e, [{ remito_item_id: e.ri[0], cantidad: 1, destino: 'stock' }]);
    const p = await dv.prepararDevolucion(db, { remito_id: e.remito });
    const v = p.lineas.find(l => l.descripcion === 'Ventana P')!, s = p.lineas.find(l => l.descripcion === 'Serv')!;
    expect([v.entregado, v.devuelto, v.maximo, v.precio_bruto]).toEqual([3, 1, 2, 1000]);
    expect([s.maximo, !!s.bloqueo]).toEqual([0, true]);
    expect(p.operacion).toMatchObject({ saldo: 3100 - 1000 - 1000 });
  });
});
