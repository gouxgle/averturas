import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { montoEnSaldoFavor, FORMA_PAGO_SALDO_FAVOR } from '../lib/saldoFavor.js';

describe('montoEnSaldoFavor', () => {
  it('medio único: todo el recibo; combinado: solo los renglones "Saldo a favor"', () => {
    expect(montoEnSaldoFavor(FORMA_PAGO_SALDO_FAVOR, null, 5000)).toBe(5000);
    expect(montoEnSaldoFavor('Contado', null, 5000)).toBe(0);
    expect(montoEnSaldoFavor('Pago combinado', [{ forma_pago: 'Saldo a favor', monto: 2000 }, { forma_pago: 'Contado', monto: 3000 }], 5000)).toBe(2000);
    expect(montoEnSaldoFavor('Pago combinado', [{ forma_pago: 'Contado', monto: 3000 }, { forma_pago: 'Transferencia', monto: 2000 }], 5000)).toBe(0);
  });
});

// Rutas reales de recibos con un usuario simulado, contra la base (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('saldo a favor como medio de pago en recibos', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  const ids: { cli?: string; op?: string } = {};

  const post = (body: unknown) => app.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const saldoFavor = async () => Number((await db.query(`SELECT COALESCE((SELECT saldo FROM cliente_saldo_favor WHERE cliente_id = $1), 0) AS s`, [ids.cli])).rows[0].s);
  const cobrado = async () => Number((await db.query(`SELECT cobrado FROM operacion_cobranza WHERE operacion_id = $1`, [ids.op])).rows[0].cobrado);
  const recibo = (extra: Record<string, unknown>) => ({ cliente_id: ids.cli, operacion_id: ids.op, concepto: 'Prueba', ...extra });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const { asentarSaldoFavor } = await import('../lib/saldoFavor.js');
    const recibos = (await import('../routes/recibos.js')).default;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'admin', nombre: 'Test' } as never); await next(); });
    app.route('/', recibos);
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestSF','Zzz') RETURNING id`)).rows[0].id;
    ids.op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'aprobado', 100000) RETURNING id`, [ids.cli])).rows[0].id;
    await asentarSaldoFavor(db, { cliente_id: ids.cli!, tipo: 'credito_devolucion', monto: 30000, descripcion: 'Crédito de prueba' });
  });

  afterAll(async () => {
    await db.query(`DELETE FROM cliente_saldo_favor_movimientos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.query(`DELETE FROM actividad_log WHERE entidad = 'recibo' AND detalle LIKE 'Saldo a favor%'`);
    await db.end();
  });

  let reciboId = '';
  it('pagar con saldo a favor consume el crédito, cuenta como cobrado de la operación y deja el asiento', async () => {
    const r = await post(recibo({ monto_total: 20000, monto_lista: 20000, forma_pago: 'Saldo a favor' }));
    expect(r.status).toBe(201);
    reciboId = ((await r.json()) as { id: string }).id;
    expect(await saldoFavor()).toBe(10000);
    expect(await cobrado()).toBe(20000);
    const { rows: [m] } = await db.query(`SELECT tipo, monto, recibo_id FROM cliente_saldo_favor_movimientos WHERE recibo_id = $1`, [reciboId]);
    expect({ tipo: m.tipo, monto: Number(m.monto) }).toEqual({ tipo: 'consumo_recibo', monto: -20000 });
  });

  it('no deja gastar más crédito del que hay (409) y no crea el recibo', async () => {
    const antes = Number((await db.query(`SELECT count(*) AS n FROM recibos WHERE cliente_id = $1`, [ids.cli])).rows[0].n);
    const r = await post(recibo({ monto_total: 15000, monto_lista: 15000, forma_pago: 'Saldo a favor' }));
    expect(r.status).toBe(409);
    expect(Number((await db.query(`SELECT count(*) AS n FROM recibos WHERE cliente_id = $1`, [ids.cli])).rows[0].n)).toBe(antes);
    expect(await saldoFavor()).toBe(10000);
  });

  it('pago combinado: solo el renglón "Saldo a favor" consume crédito y la vista lo marca aparte de la caja', async () => {
    const r = await post(recibo({
      monto_total: 15000, monto_lista: 15000, forma_pago: 'Contado',
      pagos: [{ forma_pago: 'Saldo a favor', monto: 10000 }, { forma_pago: 'Contado', monto: 5000 }],
    }));
    expect(r.status).toBe(201);
    const id = ((await r.json()) as { id: string }).id;
    expect(await saldoFavor()).toBe(0);
    const { rows } = await db.query(`SELECT forma_pago, monto, es_saldo_favor FROM recibo_pagos_efectivos WHERE recibo_id = $1 ORDER BY orden`, [id]);
    expect(rows.map(x => [x.forma_pago, Number(x.monto), x.es_saldo_favor])).toEqual([['Saldo a favor', 10000, true], ['Contado', 5000, false]]);
    const { rows: [caja] } = await db.query(`
      SELECT COALESCE(SUM(rpe.monto) FILTER (WHERE NOT rpe.es_saldo_favor), 0) AS caja
      FROM recibo_pagos_efectivos rpe JOIN recibos r ON r.id = rpe.recibo_id WHERE r.cliente_id = $1 AND r.estado = 'emitido'`, [ids.cli]);
    expect(Number(caja.caja)).toBe(5000);   // 20.000 + 10.000 de saldo a favor no son caja
  });

  it('un recibo pagado con saldo a favor no se edita', async () => {
    const r = await app.request(`/${reciboId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recibo({ monto_total: 21000, monto_lista: 21000, forma_pago: 'Saldo a favor', fecha: '2026-10-15' })),
    });
    expect(r.status).toBe(409);
  });

  it('anular el recibo devuelve el crédito al cliente, una sola vez', async () => {
    const a1 = await app.request(`/${reciboId}/anular`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo_anulacion: 'Error de carga' }) });
    expect(a1.status).toBe(200);
    expect(await saldoFavor()).toBe(20000);       // 0 + los 20.000 del recibo anulado
    expect(await cobrado()).toBe(15000);          // quedó solo el combinado
    const a2 = await app.request(`/${reciboId}/anular`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo_anulacion: 'otra vez' }) });
    expect(a2.status).toBe(400);
    expect(await saldoFavor()).toBe(20000);
  });
});
