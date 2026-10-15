import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { DevolucionSchema } from '../lib/schemas.js';

describe('DevolucionSchema: reintegro', () => {
  const base = { remito_id: '00000000-0000-4000-8000-000000000001', motivo: 'No le gustó',
    items: [{ remito_item_id: '00000000-0000-4000-8000-000000000002', cantidad: 1, destino: 'stock' }] };
  it('acepta un reintegro con forma de pago válida y rechaza monto 0 o forma desconocida', () => {
    expect(DevolucionSchema.safeParse({ ...base, reintegro: { monto: 100, forma_pago: 'Efectivo' } }).success).toBe(true);
    expect(DevolucionSchema.safeParse({ ...base, reintegro: { monto: 0, forma_pago: 'Efectivo' } }).success).toBe(false);
    expect(DevolucionSchema.safeParse({ ...base, reintegro: { monto: 100, forma_pago: 'Bitcoin' } }).success).toBe(false);
    expect(DevolucionSchema.safeParse(base).success).toBe(true);
  });
});

// Rutas reales con un usuario simulado, contra la base (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('reintegros: dinero que sale de caja', () => {
  let db: typeof import('../db.js')['db'];
  let rol = 'vendedor';
  let app: Hono;
  const ids: { cli?: string; prod?: string } = {};
  let n = 0;

  const req = (path: string, method: string, body?: unknown) =>
    app.request(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const saldoFavor = async () => Number((await db.query(`SELECT COALESCE((SELECT saldo FROM cliente_saldo_favor WHERE cliente_id = $1), 0) AS s`, [ids.cli])).rows[0].s);

  // Operación con 2 ventanas de 50.000 (cobrado 60.000 → al devolver 1 quedan 10.000 de excedente) y su remito entregado.
  async function escenario() {
    const op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'aprobado', 100000) RETURNING id`, [ids.cli])).rows[0].id;
    await db.query(`INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista) VALUES ($1,$2,$3,60000,60000)`, [`REC-TEST-RE-${++n}`, ids.cli, op]);
    const oi = (await db.query(`INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, orden, tipo_item, producto_id) VALUES ($1,'Ventana R',2,50000,1,'estandar',$2) RETURNING id`, [op, ids.prod])).rows[0].id;
    const rem = (await db.query(`INSERT INTO remitos (numero, cliente_id, operacion_id, estado, stock_descontado) VALUES ($1,$2,$3,'entregado',true) RETURNING id`, [`R-TEST-RE-${++n}`, ids.cli, op])).rows[0].id;
    const ri = (await db.query(`INSERT INTO remito_items (remito_id, producto_id, descripcion, cantidad, operacion_item_id) VALUES ($1,$2,'Ventana R',2,$3) RETURNING id`, [rem, ids.prod, oi])).rows[0].id;
    return { remito: rem as string, ri: ri as string };
  }
  const devolver = (e: Awaited<ReturnType<typeof escenario>>, extra: Record<string, unknown> = {}) =>
    req('/devoluciones', 'POST', { remito_id: e.remito, motivo: 'Prueba', items: [{ remito_item_id: e.ri, cantidad: 1, destino: 'stock' }], ...extra });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const devoluciones = (await import('../routes/devoluciones.js')).default;
    const reintegros = (await import('../routes/reintegros.js')).default;
    const clientes = (await import('../routes/clientes.js')).default;
    const notificaciones = (await import('../routes/notificaciones.js')).default;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol, nombre: 'Tester' } as never); await next(); });
    app.route('/devoluciones', devoluciones);
    app.route('/reintegros', reintegros);
    app.route('/clientes', clientes);
    app.route('/notificaciones', notificaciones);
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestRei','Zzz') RETURNING id`)).rows[0].id;
    ids.prod = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Ventana reintegro test', 'estandar', 20) RETURNING id`)).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM cliente_saldo_favor_movimientos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM reintegros WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM devoluciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = $1`, [ids.prod]);
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = $1`, [ids.prod]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.query(`DELETE FROM actividad_log WHERE entidad = 'devolucion'`);
    await db.end();
  });

  it('un vendedor devuelve todo el excedente en dinero: sale de caja y no queda saldo a favor', async () => {
    const e = await escenario();
    const r = await devolver(e, { reintegro: { monto: 10000, forma_pago: 'Efectivo' } });
    expect(r.status).toBe(201);
    const d = (await r.json()) as { id: string; reintegro_monto: number; credito_monto: number; reintegro_numero: string };
    expect([d.reintegro_monto, d.credito_monto]).toEqual([10000, 0]);
    expect(d.reintegro_numero).toMatch(/^REI-\d{6}-\d{4}$/);
    expect(await saldoFavor()).toBe(0);                       // nunca se acreditó: salió en dinero
    const { rows: [rei] } = await db.query(`SELECT monto, forma_pago, estado, notif_leida, devolucion_id FROM reintegros WHERE numero = $1`, [d.reintegro_numero]);
    expect({ monto: Number(rei.monto), forma: rei.forma_pago, estado: rei.estado, leida: rei.notif_leida }).toEqual({ monto: 10000, forma: 'Efectivo', estado: 'emitido', leida: false });
    expect(rei.devolucion_id).toBe(d.id);
  });

  it('mixto: parte en dinero y parte a favor; más que el excedente (o sin excedente) se rechaza', async () => {
    const e = await escenario();
    const mixto = await devolver(e, { reintegro: { monto: 4000, forma_pago: 'Transferencia', referencia: 'CBU 123' } });
    expect(mixto.status).toBe(201);
    const d = (await mixto.json()) as { reintegro_monto: number; credito_monto: number };
    expect([d.reintegro_monto, d.credito_monto]).toEqual([4000, 6000]);
    expect(await saldoFavor()).toBe(6000);                    // solo lo que queda a favor entra al libro

    const e2 = await escenario();
    expect((await devolver(e2, { reintegro: { monto: 10000.01, forma_pago: 'Efectivo' } })).status).toBe(422);
    // sin excedente: el cliente debía más de lo que devuelve → no hay dinero para devolver
    const e3 = await escenario();
    await db.query(`UPDATE recibos SET monto_total = 1000, monto_lista = 1000 WHERE numero = (SELECT numero FROM recibos WHERE cliente_id = $1 ORDER BY created_at DESC LIMIT 1)`, [ids.cli]);
    expect((await devolver(e3, { reintegro: { monto: 1, forma_pago: 'Efectivo' } })).status).toBe(422);
  });

  it('devolver en dinero un saldo a favor que ya tenía: valida que alcance y lo consume', async () => {
    expect(await saldoFavor()).toBe(6000);
    const mucho = await req(`/clientes/${ids.cli}/saldo-favor/reintegrar`, 'POST', { monto: 6000.5, forma_pago: 'Efectivo', motivo: 'Se lo devolvemos' });
    expect(mucho.status).toBe(409);
    const ok = await req(`/clientes/${ids.cli}/saldo-favor/reintegrar`, 'POST', { monto: 6000, forma_pago: 'Efectivo', motivo: 'Se lo devolvemos' });
    expect(ok.status).toBe(201);
    expect(await saldoFavor()).toBe(0);
    const { rows: [m] } = await db.query(`SELECT tipo, monto, reintegro_id FROM cliente_saldo_favor_movimientos WHERE tipo = 'reintegro' AND cliente_id = $1`, [ids.cli]);
    expect([m.tipo, Number(m.monto)]).toEqual(['reintegro', -6000]);
    expect(m.reintegro_id).toBeTruthy();
    rol = 'consulta';
    expect((await req(`/clientes/${ids.cli}/saldo-favor/reintegrar`, 'POST', { monto: 1, forma_pago: 'Efectivo', motivo: 'xxx' })).status).toBe(403);
    rol = 'vendedor';
  });

  it('avisa a los administradores cada reintegro; el vendedor no ve el aviso y solo un admin lo marca leído', async () => {
    rol = 'vendedor';
    const comoVendedor = (await (await req('/notificaciones', 'GET')).json()) as { tipo: string }[];
    expect(comoVendedor.some(n => n.tipo === 'reintegro')).toBe(false);
    rol = 'admin';
    const comoAdmin = (await (await req('/notificaciones', 'GET')).json()) as { tipo: string; id: string; precio_total: number; data: { por: string; forma_pago: string } }[];
    const avisos = comoAdmin.filter(n => n.tipo === 'reintegro');
    expect(avisos.length).toBeGreaterThanOrEqual(3);          // los tres de este archivo
    expect(avisos[0].data).toMatchObject({ por: null });      // usuario simulado sin fila en usuarios
    // un vendedor que toca "marcar leídas" no se las borra al admin
    rol = 'vendedor';
    await req('/notificaciones/marcar-leidas', 'PATCH');
    rol = 'admin';
    expect(((await (await req('/notificaciones', 'GET')).json()) as { tipo: string }[]).filter(n => n.tipo === 'reintegro').length).toBe(avisos.length);
    // aceptar uno lo saca solo a ese
    await req('/notificaciones/vista', 'PATCH', { tipo: 'reintegro', id: avisos[0].id });
    expect(((await (await req('/notificaciones', 'GET')).json()) as { tipo: string }[]).filter(n => n.tipo === 'reintegro').length).toBe(avisos.length - 1);
    await req('/notificaciones/marcar-leidas', 'PATCH');
    expect(((await (await req('/notificaciones', 'GET')).json()) as { tipo: string }[]).filter(n => n.tipo === 'reintegro').length).toBe(0);
    rol = 'vendedor';
  });

  it('anular un reintegro (solo admin) vuelve a dejar el dinero a favor del cliente, una sola vez', async () => {
    const e = await escenario();
    const d = (await (await devolver(e, { reintegro: { monto: 10000, forma_pago: 'Efectivo' } })).json()) as { id: string; reintegro_numero: string };
    const { rows: [rei] } = await db.query(`SELECT id FROM reintegros WHERE numero = $1`, [d.reintegro_numero]);
    const f0 = await saldoFavor();

    rol = 'vendedor';
    expect((await req(`/reintegros/${rei.id}/anular`, 'POST', { motivo_anulacion: 'Error' })).status).toBe(403);
    rol = 'admin';
    expect((await req(`/reintegros/${rei.id}/anular`, 'POST', { motivo_anulacion: '' })).status).toBe(400);
    expect((await req(`/reintegros/${rei.id}/anular`, 'POST', { motivo_anulacion: 'Se cargó mal' })).status).toBe(200);
    expect(await saldoFavor()).toBe(f0 + 10000);
    const { rows: [dv] } = await db.query(`SELECT valor_total, aplicado_a_saldo, reintegro_monto, credito_monto FROM devoluciones WHERE id = $1`, [d.id]);
    expect([Number(dv.reintegro_monto), Number(dv.credito_monto)]).toEqual([0, 10000]);   // el reparto sigue cerrando (CHECK)
    expect((await req(`/reintegros/${rei.id}/anular`, 'POST', { motivo_anulacion: 'otra vez' })).status).toBe(409);
    expect(await saldoFavor()).toBe(f0 + 10000);
    rol = 'vendedor';
  });

  it('anular un reintegro de saldo a favor existente restituye el crédito', async () => {
    await req(`/clientes/${ids.cli}/saldo-favor/reintegrar`, 'POST', { monto: 10000, forma_pago: 'Transferencia', motivo: 'Retira el saldo' });
    const f1 = await saldoFavor();
    const { rows: [rei] } = await db.query(`SELECT id FROM reintegros WHERE cliente_id = $1 AND devolucion_id IS NULL AND estado = 'emitido' ORDER BY created_at DESC LIMIT 1`, [ids.cli]);
    rol = 'admin';
    expect((await req(`/reintegros/${rei.id}/anular`, 'POST', { motivo_anulacion: 'No lo retiró' })).status).toBe(200);
    expect(await saldoFavor()).toBe(f1 + 10000);
    rol = 'vendedor';
  });

  it('el listado muestra los reintegros con su origen', async () => {
    const lista = (await (await req('/reintegros', 'GET')).json()) as { numero: string; estado: string; devolucion_numero: string | null }[];
    expect(lista.filter(x => x.estado === 'anulado').length).toBeGreaterThanOrEqual(2);
    expect(lista.some(x => x.devolucion_numero)).toBe(true);
    expect(lista.some(x => !x.devolucion_numero)).toBe(true);
  });
});
