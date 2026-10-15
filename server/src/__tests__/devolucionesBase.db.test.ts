import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RemitoSchema } from '../lib/schemas.js';

describe('RemitoSchema: estado_producto coincide con la base y la UI', () => {
  const base = { cliente_id: '00000000-0000-4000-8000-000000000001', medio_envio: 'retiro_local' };
  const conEstado = (estado_producto: string) =>
    RemitoSchema.safeParse({ ...base, items: [{ descripcion: 'Ventana', cantidad: 1, estado_producto }] }).success;
  it('acepta nuevo / bueno / con_detalles y rechaza los valores viejos', () => {
    expect(conEstado('nuevo')).toBe(true);
    expect(conEstado('bueno')).toBe(true);
    expect(conEstado('con_detalles')).toBe(true);
    expect(conEstado('usado')).toBe(false);
    expect(conEstado('reparado')).toBe(false);
  });
});

// Reservas y vista de cobranza contra la base (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('Devoluciones etapa 0: reservas y operacion_cobranza', () => {
  let db: typeof import('../db.js')['db'];
  let rs: typeof import('../lib/reservas.js');
  const ids: { cli?: string; op?: string; prod?: string; prod2?: string } = {};

  async function neto(prod: string) {
    const { rows: [r] } = await db.query(
      `SELECT COALESCE(SUM(cantidad), 0)::int AS n FROM stock_movimientos WHERE operacion_id = $1 AND producto_id = $2 AND tipo = 'reserva'`, [ids.op, prod]);
    return r.n as number;
  }
  async function recibo(numero: string, monto: number, descuento: number, estado = 'emitido') {
    await db.query(
      `INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista, monto_descuento, estado) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [numero, ids.cli, ids.op, monto, monto + descuento, descuento, estado]);
  }

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    rs = await import('../lib/reservas.js');
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestReserva','Zzz') RETURNING id`)).rows[0].id;
    ids.op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'aprobado', 100000) RETURNING id`, [ids.cli])).rows[0].id;
    ids.prod = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Prod reserva A', 'estandar', 10) RETURNING id`)).rows[0].id;
    ids.prod2 = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Prod reserva B', 'estandar', 10) RETURNING id`)).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = ANY($1::uuid[])`, [[ids.prod, ids.prod2]]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = ANY($1::uuid[])`, [[ids.prod, ids.prod2]]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.end();
  });

  it('liberarReservas netea a cero cada producto y es idempotente', async () => {
    await db.query(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id) VALUES ($1,'reserva',-2,'Proforma aprobada',$3), ($2,'reserva',-3,'Proforma aprobada',$3)`,
      [ids.prod, ids.prod2, ids.op]);
    expect(await neto(ids.prod!)).toBe(-2);
    expect(await rs.liberarReservas(db, ids.op!, 'test', 'OP-TEST', null)).toBe(2);
    expect([await neto(ids.prod!), await neto(ids.prod2!)]).toEqual([0, 0]);
    // segunda vez: no hay nada que liberar y no duplica
    expect(await rs.liberarReservas(db, ids.op!, 'test', 'OP-TEST', null)).toBe(0);
    expect([await neto(ids.prod!), await neto(ids.prod2!)]).toEqual([0, 0]);
  });

  it('no toca las reservas de otras operaciones', async () => {
    const otraOp = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'aprobado', 1) RETURNING id`, [ids.cli])).rows[0].id;
    await db.query(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo, operacion_id) VALUES ($1,'reserva',-4,'Proforma aprobada',$2)`, [ids.prod, otraOp]);
    await rs.liberarReservas(db, ids.op!, 'test', null, null);
    const { rows: [r] } = await db.query(`SELECT SUM(cantidad)::int AS n FROM stock_movimientos WHERE operacion_id = $1 AND tipo = 'reserva'`, [otraOp]);
    expect(r.n).toBe(-4);
  });

  it('operacion_cobranza: cobrado, descuentos y saldo cuentan solo recibos emitidos', async () => {
    const leer = async () => {
      const r = (await db.query(`SELECT cobrado, descuentos, devuelto_a_saldo, saldo FROM operacion_cobranza WHERE operacion_id = $1`, [ids.op])).rows[0];
      return { cobrado: Number(r.cobrado), descuentos: Number(r.descuentos), devuelto_a_saldo: Number(r.devuelto_a_saldo), saldo: Number(r.saldo) };
    };
    expect(await leer()).toEqual({ cobrado: 0, descuentos: 0, devuelto_a_saldo: 0, saldo: 100000 });
    await recibo('REC-TEST-E0-1', 60000, 0);
    await recibo('REC-TEST-E0-2', 30000, 10000);
    await recibo('REC-TEST-E0-3', 5000, 0, 'anulado');   // anulado: no cuenta
    expect(await leer()).toEqual({ cobrado: 90000, descuentos: 10000, devuelto_a_saldo: 0, saldo: 0 });
  });
});
