import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { RemitoEntregaSchema } from '../lib/schemas.js';

describe('RemitoEntregaSchema: firma opcional pero con aviso', () => {
  it('pide la firma o el motivo de entregar sin firma', () => {
    expect(RemitoEntregaSchema.safeParse({}).success).toBe(false);
    expect(RemitoEntregaSchema.safeParse({ sin_firma_motivo: '  ' }).success).toBe(false);
    expect(RemitoEntregaSchema.safeParse({ firma_url: '/uploads/remitos/x.webp' }).success).toBe(true);
    expect(RemitoEntregaSchema.safeParse({ sin_firma_motivo: 'Cliente ausente' }).success).toBe(true);
  });
  it('el DNI va solo con números', () => {
    const base = { firma_url: '/uploads/remitos/x.webp' };
    expect(RemitoEntregaSchema.safeParse({ ...base, recibio_dni: '30.123.456' }).success).toBe(false);
    expect(RemitoEntregaSchema.safeParse({ ...base, recibio_dni: '30123456' }).success).toBe(true);
    expect(RemitoEntregaSchema.safeParse({ ...base, recibio_dni: '' }).success).toBe(true);
  });
});

// Entrega en el lugar contra la base (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('entrega de remitos en el lugar', () => {
  let db: typeof import('../db.js')['db'];
  let r: typeof import('../lib/remitos.js');
  const ids: { cli?: string; op?: string; prod?: string } = {};
  let n = 0;

  async function nuevoRemito(estado: string, cantidad: number) {
    const { rows: [rem] } = await db.query(
      `INSERT INTO remitos (numero, cliente_id, operacion_id, estado) VALUES ($1, $2, $3, $4) RETURNING id`,
      [`R-TEST-ENT-${++n}`, ids.cli, ids.op, estado]);
    await db.query(`INSERT INTO remito_items (remito_id, producto_id, descripcion, cantidad) VALUES ($1, $2, 'Ventana test', $3)`,
      [rem.id, ids.prod, cantidad]);
    return rem.id as string;
  }
  async function stock() {
    const { rows: [s] } = await db.query(
      `SELECT (cp.stock_inicial + COALESCE((SELECT SUM(cantidad) FROM stock_movimientos WHERE producto_id = cp.id), 0))::int AS s
       FROM catalogo_productos cp WHERE id = $1`, [ids.prod]);
    return s.s as number;
  }
  async function entregar(id: string, datos: import('../lib/remitos.js').DatosEntrega) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await r.entregarRemito(client, (await r.cargarRemitoParaTransicion(client, id, true))!, datos, null);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  }

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    r = await import('../lib/remitos.js');
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestEntrega','Zzz') RETURNING id`)).rows[0].id;
    ids.op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'aprobado', 1000) RETURNING id`, [ids.cli])).rows[0].id;
    ids.prod = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Ventana test entrega', 'estandar', 5) RETURNING id`)).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = $1`, [ids.prod]);
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = $1`, [ids.prod]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.end();
  });

  it('un borrador se emite y entrega de una vez: descuenta stock una sola vez y guarda quién recibió', async () => {
    const id = await nuevoRemito('borrador', 2);
    await entregar(id, { firma_url: '/uploads/remitos/f.webp', recibio_nombre: ' Ana Pérez ', recibio_dni: '30123456' });
    const { rows: [rem] } = await db.query(`SELECT * FROM remitos WHERE id = $1`, [id]);
    expect(rem).toMatchObject({ estado: 'entregado', stock_descontado: true, firma_url: '/uploads/remitos/f.webp',
      recibio_nombre: 'Ana Pérez', recibio_dni: '30123456', sin_firma_motivo: null });
    expect(rem.entregado_at).not.toBeNull();
    expect(await stock()).toBe(3);
    const { rows: [op] } = await db.query(`SELECT estado FROM operaciones WHERE id = $1`, [ids.op]);
    expect(op.estado).toBe('entregado');
  });

  it('un emitido no vuelve a descontar stock y sin firma guarda el motivo', async () => {
    const id = await nuevoRemito('borrador', 1);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await r.aplicarTransicionRemito(client, (await r.cargarRemitoParaTransicion(client, id, true))!, 'emitido', {}, null);
      await client.query('COMMIT');
    } finally { client.release(); }
    expect(await stock()).toBe(2);
    await entregar(id, { sin_firma_motivo: 'Cliente ausente' });
    expect(await stock()).toBe(2);
    const { rows: [rem] } = await db.query(`SELECT estado, firma_url, sin_firma_motivo FROM remitos WHERE id = $1`, [id]);
    expect(rem).toEqual({ estado: 'entregado', firma_url: null, sin_firma_motivo: 'Cliente ausente' });
  });

  it('sin stock suficiente no cambia nada (422) y un entregado no se vuelve a entregar (409)', async () => {
    const id = await nuevoRemito('borrador', 50);
    await expect(entregar(id, { sin_firma_motivo: 'x' })).rejects.toMatchObject({ status: 422 });
    const { rows: [rem] } = await db.query(`SELECT estado, stock_descontado FROM remitos WHERE id = $1`, [id]);
    expect(rem).toEqual({ estado: 'borrador', stock_descontado: false });
    expect(await stock()).toBe(2);

    const otro = await nuevoRemito('entregado', 1);
    await expect(entregar(otro, { sin_firma_motivo: 'x' })).rejects.toMatchObject({ status: 409 });
  });
});
