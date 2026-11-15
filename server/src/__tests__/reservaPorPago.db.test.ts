import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Reserva con el primer pago (2026-11-14): sin seña no se reserva; la reserva no baja el físico;
// se ajusta con remitos parciales y se libera al anular el último recibo.
describe.skipIf(!process.env.DATABASE_URL)('reserva de stock por pago', () => {
  let db: typeof import('../db.js')['db'];
  let sincronizarReserva: typeof import('../lib/reservas.js')['sincronizarReserva'];
  let app: Hono;
  let cli = '', prod = '', op1 = '', op2 = '', item1 = '';
  let n = 0;
  const stock = async () => (await db.query(
    `SELECT stock_fisico($1) f, stock_reservado($1) r, stock_disponible($1) d`, [prod])).rows[0];
  const reservaDe = async (op: string) => Number((await db.query(
    `SELECT COALESCE(-SUM(cantidad),0) r FROM stock_movimientos WHERE operacion_id=$1 AND tipo='reserva'`, [op])).rows[0].r);
  const recibo = async (op: string) => (await db.query(
    `INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista, forma_pago)
     VALUES ($1,$2,$3,1000,1000,'Contado') RETURNING id`, [`REC-TEST-RES-${++n}`, cli, op])).rows[0].id as string;
  const sync = async (op: string) => {
    const c = await db.connect();
    try { await c.query('BEGIN'); const r = await sincronizarReserva(c, op, 'TEST', null); await c.query('COMMIT'); return r; }
    finally { c.release(); }
  };
  const send = (method: string, url: string, body: unknown) => app.request(url, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    ({ sincronizarReserva } = await import('../lib/reservas.js'));
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'admin', nombre: 'Test' } as never); await next(); });
    app.route('/remitos', (await import('../routes/remitos.js')).default);
    app.route('/recibos', (await import('../routes/recibos.js')).default);
    cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','Test','ZzReserva') RETURNING id`)).rows[0].id;
    prod = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial, precio_base, codigo)
      VALUES ('Ventana test reserva','estandar',3,1000,'ZZ-RES-1') RETURNING id`)).rows[0].id;
    const op = async () => (await db.query(
      `INSERT INTO operaciones (tipo, cliente_id, estado, fecha_validez) VALUES ('estandar',$1,'aprobado',CURRENT_DATE) RETURNING id`, [cli])).rows[0].id as string;
    op1 = await op(); op2 = await op();
    item1 = (await db.query(`INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, tipo_item, producto_id)
      VALUES ($1,'Ventana',2,1000,'estandar',$2) RETURNING id`, [op1, prod])).rows[0].id;
    await db.query(`INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, tipo_item, producto_id)
      VALUES ($1,'Ventana',2,1000,'estandar',$2)`, [op2, prod]);
  }, 30000);

  afterAll(async () => {
    await db.query(`DELETE FROM tareas WHERE cliente_id = $1`, [cli]);
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = $1`, [prod]);
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [cli]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = $1`, [prod]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [cli]);
  });

  it('aprobado sin pago no reserva', async () => {
    expect((await sync(op1)).reservado).toBe(0);
    expect(await stock()).toEqual({ f: 3, r: 0, d: 3 });
  });

  it('el primer pago reserva y NO baja el físico; crea la tarea de control', async () => {
    await recibo(op1);
    expect((await sync(op1)).reservado).toBe(2);
    expect(await stock()).toEqual({ f: 3, r: 2, d: 1 });
    await sync(op1); // idempotente
    expect(await reservaDe(op1)).toBe(2);
    expect((await db.query(`SELECT count(*)::int c FROM tareas WHERE operacion_id=$1 AND NOT completada AND descripcion LIKE 'Reserva de stock de %'`, [op1])).rows[0].c).toBe(1);
  });

  it('otra venta señada solo reserva lo disponible y avisa lo que falta', async () => {
    await recibo(op2);
    const r = await sync(op2);
    expect(r.reservado).toBe(1);
    expect(r.sin_stock).toEqual([expect.objectContaining({ faltan: 1 })]);
    expect(await stock()).toEqual({ f: 3, r: 3, d: 0 });
  });

  it('un remito parcial descuenta el físico y deja reservado lo que falta', async () => {
    const res = await send('POST', '/remitos', { cliente_id: cli, operacion_id: op1, medio_envio: 'retiro_local',
      items: [{ descripcion: 'Ventana', cantidad: 1, producto_id: prod, operacion_item_id: item1 }] });
    expect(res.status).toBe(201);
    const rem = await res.json();
    expect((await send('PATCH', `/remitos/${rem.id}/estado`, { estado: 'emitido' })).status).toBe(200);
    expect(await reservaDe(op1)).toBe(1);
    expect(await stock()).toEqual({ f: 2, r: 2, d: 0 });
  });

  it('anular el único recibo libera la reserva y cierra la tarea', async () => {
    const rec = (await db.query(`SELECT id FROM recibos WHERE operacion_id=$1`, [op2])).rows[0].id;
    expect((await send('PATCH', `/recibos/${rec}/anular`, { motivo_anulacion: 'Prueba de anulación' })).status).toBe(200);
    expect(await reservaDe(op2)).toBe(0);
    expect((await db.query(`SELECT count(*)::int c FROM tareas WHERE operacion_id=$1 AND NOT completada AND descripcion LIKE 'Reserva de stock de %'`, [op2])).rows[0].c).toBe(0);
  });
});
