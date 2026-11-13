import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Prod 2026-11-12 (Morel Sergio, R-202611-0003): la entrega con firma se rechazó 7 veces en el domicilio por
// "stock insuficiente" de un producto que estaba en 0 por un ajuste masivo. Ahora: se avisa al armar el remito,
// se puede entregar igual y queda un recordatorio de prioridad alta para revisar el stock.
describe.skipIf(!process.env.DATABASE_URL)('entrega sin stock registrado', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  const ids = { cli: '', op: '', prod: '', prodOk: '' };
  const NOMBRE = 'ZzSinStock';
  const firma = { firma_url: '/uploads/remitos/test.webp', recibio_nombre: 'Test' };

  const send = (method: string, url: string, body: unknown) => app.request(url, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const stock = async (id: string) => Number((await db.query(
    `SELECT stock_inicial + COALESCE((SELECT SUM(cantidad) FROM stock_movimientos WHERE producto_id = $1), 0) AS s
     FROM catalogo_productos WHERE id = $1`, [id])).rows[0].s);
  const remito = async (prod: string, cantidad = 1) => {
    const r = await send('POST', '/remitos', {
      cliente_id: ids.cli, operacion_id: ids.op, medio_envio: 'retiro_local',
      items: [{ descripcion: 'Ventana', cantidad, producto_id: prod }],
    });
    expect(r.status).toBe(201);
    return (await r.json() as { id: string; numero: string });
  };
  const tareas = async (numero: string) => (await db.query(
    `SELECT prioridad, ambito, descripcion, completada FROM tareas WHERE descripcion LIKE $1`, [`%${numero}%`])).rows;

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'admin', nombre: 'Test' } as never); await next(); });
    app.route('/remitos', (await import('../routes/remitos.js')).default);
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','Test',$1) RETURNING id`, [NOMBRE])).rows[0].id;
    ids.op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, fecha_validez) VALUES ('estandar',$1,'aprobado',CURRENT_DATE) RETURNING id`, [ids.cli])).rows[0].id;
    ids.prod = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ($1, 'estandar', 0) RETURNING id`, [`${NOMBRE} sin stock`])).rows[0].id;
    ids.prodOk = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ($1, 'estandar', 5) RETURNING id`, [`${NOMBRE} con stock`])).rows[0].id;
  }, 30000);

  afterAll(async () => {
    await db.query(`DELETE FROM tareas WHERE descripcion LIKE $1`, [`%${NOMBRE}%`]);
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = ANY($1)`, [[ids.prod, ids.prodOk]]);
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = ANY($1)`, [[ids.prod, ids.prodOk]]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.end();
  }, 30000);

  it('verificar-stock avisa lo que falta y cuenta como disponible la reserva de la misma operación', async () => {
    const pedir = (prod: string, cantidad: number) =>
      send('POST', '/remitos/verificar-stock', { operacion_id: ids.op, items: [{ producto_id: prod, cantidad }] });
    let j = await (await pedir(ids.prod, 1)).json() as { faltantes: { producto_id: string; disponible: number; pedido: number }[] };
    expect(j.faltantes).toEqual([expect.objectContaining({ producto_id: ids.prod, disponible: 0, pedido: 1 })]);
    j = await (await pedir(ids.prodOk, 5)).json() as typeof j;
    expect(j.faltantes).toEqual([]);
    // Reserva de esta operación: deja el stock en 4, pero para este remito siguen disponibles 5
    await db.query(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, operacion_id) VALUES ($1,'reserva',-1,$2)`, [ids.prodOk, ids.op]);
    j = await (await pedir(ids.prodOk, 5)).json() as typeof j;
    expect(j.faltantes).toEqual([]);
  });

  it('sin forzar, la entrega se rechaza con los faltantes y no cambia nada', async () => {
    const r = await remito(ids.prod);
    const res = await send('POST', `/remitos/${r.id}/entregar`, firma);
    expect(res.status).toBe(422);
    const j = await res.json() as { codigo: string; faltantes: unknown[] };
    expect(j.codigo).toBe('stock_insuficiente');
    expect(j.faltantes).toHaveLength(1);
    expect((await db.query(`SELECT estado FROM remitos WHERE id=$1`, [r.id])).rows[0].estado).toBe('borrador');
    expect(await stock(ids.prod)).toBe(0);
    expect(await tareas(r.numero)).toEqual([]);
  });

  it('"Entregar igual" entrega, deja el stock en negativo y crea un recordatorio de prioridad alta', async () => {
    const r = await remito(ids.prod, 2);
    const res = await send('POST', `/remitos/${r.id}/entregar`, { ...firma, forzar_sin_stock: true });
    expect(res.status).toBe(200);
    expect((await db.query(`SELECT estado FROM remitos WHERE id=$1`, [r.id])).rows[0].estado).toBe('entregado');
    expect(await stock(ids.prod)).toBe(-2);
    const t = await tareas(r.numero);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ prioridad: 'alta', ambito: 'interna', completada: false });
    expect(t[0].descripcion).toMatch(/MUY IMPORTANTE.*Revisar stock/);
  });

  it('con stock no crea recordatorio aunque se mande forzar', async () => {
    const r = await remito(ids.prodOk, 1);
    expect((await send('POST', `/remitos/${r.id}/entregar`, { ...firma, forzar_sin_stock: true })).status).toBe(200);
    expect(await tareas(r.numero)).toEqual([]);
  });

  it('emitir desde el cambio de estado también se puede forzar', async () => {
    const r = await remito(ids.prod);
    expect((await send('PATCH', `/remitos/${r.id}/estado`, { estado: 'emitido' })).status).toBe(422);
    expect((await send('PATCH', `/remitos/${r.id}/estado`, { estado: 'emitido', forzar_sin_stock: true })).status).toBe(200);
    expect(await tareas(r.numero)).toHaveLength(1);
  });
});
