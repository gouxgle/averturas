import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { calcularBonificacion, baseBonificable } from '../lib/bonificacion.js';

describe('calcularBonificacion', () => {
  it('porcentaje sobre productos, redondeado a centavos', () => {
    expect(calcularBonificacion(100000, 'porcentaje', 10)).toBe(10000);
    expect(calcularBonificacion(33333.33, 'porcentaje', 7)).toBe(2333.33);
  });
  it('monto fijo sin pasar de la base; sin tipo o valor no bonifica', () => {
    expect(calcularBonificacion(100000, 'monto', 25000)).toBe(25000);
    expect(calcularBonificacion(20000, 'monto', 25000)).toBe(20000);
    expect(calcularBonificacion(100000, null, 10)).toBe(0);
    expect(calcularBonificacion(100000, 'porcentaje', 0)).toBe(0);
  });
  it('la base son solo productos', () => {
    expect(baseBonificable([{ precio_unitario: 1000, cantidad: 2 }, { precio_unitario: '500', cantidad: '1' }])).toBe(2500);
  });
});

describe.skipIf(!process.env.DATABASE_URL)('bonificación en el presupuesto', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  const ids: { cli?: string; op?: string } = {};
  const post = (body: unknown) => app.request('/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const cobranza = async () => (await db.query(`SELECT cobrado, descuentos, saldo FROM operacion_cobranza WHERE operacion_id = $1`, [ids.op])).rows[0];
  const hash = async () => (await db.query(`SELECT proforma_hash(proforma_snapshot($1)) AS h`, [ids.op])).rows[0].h as string;

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const recibos = (await import('../routes/recibos.js')).default;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'vendedor', nombre: 'Test' } as never); await next(); });
    app.route('/', recibos);
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestBonif','Zzz') RETURNING id`)).rows[0].id;
    ids.op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado) VALUES ('estandar', $1, 'aprobado') RETURNING id`, [ids.cli])).rows[0].id;
    // 2 x 50.000 de producto + 10.000 de instalación = precio_total 110.000 (base bonificable 100.000)
    await db.query(`INSERT INTO operacion_items (operacion_id, orden, descripcion, cantidad, precio_unitario, incluye_instalacion, precio_instalacion)
                    VALUES ($1, 0, 'Ventana', 2, 50000, true, 5000)`, [ids.op]);
  });

  afterAll(async () => {
    await db.query(`DELETE FROM recibo_items WHERE recibo_id IN (SELECT id FROM recibos WHERE cliente_id = $1)`, [ids.cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM actividad_log WHERE entidad = 'presupuesto' AND entidad_id = $1`, [ids.op]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.end();
  });

  it('sin bonificación la vista queda como siempre y el hash no la incluye', async () => {
    const c = await cobranza();
    expect([Number(c.descuentos), Number(c.saldo)]).toEqual([0, 110000]);
  });

  it('con bonificación la deuda baja desde el presupuesto, antes de cualquier recibo, y el hash cambia', async () => {
    const h0 = await hash();
    const { guardarBonificacion } = await import('../lib/bonificacion.js');
    const monto = await guardarBonificacion(db, ids.op!, { bonificacion_tipo: 'porcentaje', bonificacion_valor: 10, bonificacion_motivo: 'Cliente frecuente' });
    expect(monto).toBe(10000);   // 10% de 100.000: la instalación no entra
    const c = await cobranza();
    expect([Number(c.descuentos), Number(c.saldo)]).toEqual([10000, 100000]);
    expect(await hash()).not.toBe(h0);
    const { rows: [snap] } = await db.query(`SELECT proforma_snapshot($1) AS s`, [ids.op]);
    expect(snap.s.bonificacion_monto).toBe(10000);
  });

  it('el primer recibo toma la bonificación entera y el segundo no la repite', async () => {
    const r1 = await post({ cliente_id: ids.cli, operacion_id: ids.op, monto_total: 40000, monto_lista: 50000, monto_descuento: 10000,
      bonificacion_presupuesto_monto: 10000, forma_pago: 'Contado', concepto: 'Seña' });
    expect(r1.status).toBe(201);
    let c = await cobranza();
    expect([Number(c.cobrado), Number(c.descuentos), Number(c.saldo)]).toEqual([40000, 10000, 60000]);

    // un segundo recibo que intenta volver a tomar la bonificación se rechaza
    const r2 = await post({ cliente_id: ids.cli, operacion_id: ids.op, monto_total: 10000, monto_lista: 15000, monto_descuento: 5000,
      bonificacion_presupuesto_monto: 5000, forma_pago: 'Contado', concepto: 'Otra' });
    expect(r2.status).toBe(409);

    const r3 = await post({ cliente_id: ids.cli, operacion_id: ids.op, monto_total: 60000, monto_lista: 60000, forma_pago: 'Contado', concepto: 'Saldo' });
    expect(r3.status).toBe(201);
    c = await cobranza();
    expect([Number(c.cobrado), Number(c.descuentos), Number(c.saldo)]).toEqual([100000, 10000, 0]);
  });

  it('anular un recibo mantiene la bonificación del presupuesto en la deuda', async () => {
    const { rows } = await db.query(`SELECT id FROM recibos WHERE cliente_id = $1 AND bonificacion_presupuesto_monto > 0`, [ids.cli]);
    const a = await app.request(`/${rows[0].id}/anular`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motivo_anulacion: 'Prueba' }) });
    expect(a.status).toBe(200);
    const c = await cobranza();
    // el recibo que tomó la bonificación se anuló: vuelve a estar pendiente, la deuda sigue bonificada
    expect([Number(c.cobrado), Number(c.descuentos), Number(c.saldo)]).toEqual([60000, 10000, 40000]);
  });

  it('quien cobra puede cambiar la bonificación: la operación queda con la nueva', async () => {
    const r = await post({ cliente_id: ids.cli, operacion_id: ids.op, monto_total: 45000, monto_lista: 50000, monto_descuento: 5000,
      bonificacion_presupuesto_monto: 5000, bonificacion_presupuesto: { tipo: 'porcentaje', valor: 5, motivo: 'Ajustada' },
      forma_pago: 'Contado', concepto: 'Cambio de bonificación' });
    expect(r.status).toBe(201);
    const { rows: [op] } = await db.query(`SELECT bonificacion_tipo, bonificacion_valor, bonificacion_monto FROM operaciones WHERE id = $1`, [ids.op]);
    expect([op.bonificacion_tipo, Number(op.bonificacion_valor), Number(op.bonificacion_monto)]).toEqual(['porcentaje', 5, 5000]);
    const c = await cobranza();
    expect([Number(c.descuentos), Number(c.saldo)]).toEqual([5000, 0]);
  });
});
