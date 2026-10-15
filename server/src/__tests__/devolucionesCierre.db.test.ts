import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Etapa 5 contra la base y las rutas reales (se saltea sin DATABASE_URL): anular, nota de crédito, avisos e informes.
describe.skipIf(!process.env.DATABASE_URL)('devoluciones: anulación, nota de crédito, avisos e informes', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  let rol = 'admin';
  let uid: string | null = null;
  const ids: { cli?: string; viejo?: string; nuevo?: string; usrAdmin?: string; usrVend?: string } = {};
  let n = 0;
  const comprobantesCreados: string[] = [];

  const req = (path: string, method: string, body?: unknown) =>
    app.request(path, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const stock = async (p: string) => Number((await db.query(
    `SELECT (cp.stock_inicial + COALESCE((SELECT SUM(cantidad) FROM stock_movimientos WHERE producto_id = cp.id), 0))::int AS s FROM catalogo_productos cp WHERE id = $1`, [p])).rows[0].s);
  const saldoFavor = async () => Number((await db.query(`SELECT COALESCE((SELECT saldo FROM cliente_saldo_favor WHERE cliente_id = $1), 0) AS s`, [ids.cli])).rows[0].s);
  const saldoOp = async (op: string) => Number((await db.query(`SELECT saldo FROM operacion_cobranza WHERE operacion_id = $1`, [op])).rows[0].saldo);

  // Operación de 100.000 (2 ventanas de 50.000, cobrado 60.000): devolver 1 → baja la deuda 40.000 y sobran 10.000.
  async function escenario() {
    const op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'entregado', 100000) RETURNING id`, [ids.cli])).rows[0].id;
    await db.query(`INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista) VALUES ($1,$2,$3,60000,60000)`, [`REC-TEST-CI-${++n}`, ids.cli, op]);
    const oi = (await db.query(`INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, orden, tipo_item, producto_id) VALUES ($1,'Ventana vieja',2,50000,1,'estandar',$2) RETURNING id`, [op, ids.viejo])).rows[0].id;
    const rem = (await db.query(`INSERT INTO remitos (numero, cliente_id, operacion_id, estado, stock_descontado) VALUES ($1,$2,$3,'entregado',true) RETURNING id`, [`R-TEST-CI-${++n}`, ids.cli, op])).rows[0].id;
    const ri = (await db.query(`INSERT INTO remito_items (remito_id, producto_id, descripcion, cantidad, operacion_item_id) VALUES ($1,$2,'Ventana vieja',2,$3) RETURNING id`, [rem, ids.viejo, oi])).rows[0].id;
    return { op: op as string, remito: rem as string, ri: ri as string, oi: oi as string };
  }
  const devolver = async (e: Awaited<ReturnType<typeof escenario>>, extra: Record<string, unknown> = {}) => {
    const r = await req('/devoluciones', 'POST', { remito_id: e.remito, motivo: 'Prueba', items: [{ remito_item_id: e.ri, cantidad: 1, destino: 'stock' }], ...extra });
    expect(r.status).toBe(201);
    return (await r.json()) as { id: string; numero: string; credito_monto: number; reintegro_numero: string | null; cambio?: { operacion: { id: string } } };
  };
  const anular = (id: string, motivo = 'Se cargó mal') => req(`/devoluciones/${id}/anular`, 'POST', { motivo_anulacion: motivo });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const devoluciones = (await import('../routes/devoluciones.js')).default;
    const reintegros = (await import('../routes/reintegros.js')).default;
    const notificaciones = (await import('../routes/notificaciones.js')).default;
    ids.usrAdmin = (await db.query(`SELECT id FROM usuarios WHERE rol = 'admin' AND activo = true ORDER BY created_at LIMIT 1`)).rows[0].id;
    ids.usrVend = (await db.query(`INSERT INTO usuarios (email, password_hash, nombre, rol, activo) VALUES ('vend-test-ci@local.test', 'x', 'Vendedor Test', 'vendedor', true) ON CONFLICT (email) DO UPDATE SET activo = true RETURNING id`)).rows[0].id;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: uid ?? ids.usrAdmin, rol, nombre: 'Tester' } as never); await next(); });
    app.route('/devoluciones', devoluciones);
    app.route('/reintegros', reintegros);
    app.route('/notificaciones', notificaciones);
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestCierre','Zzz') RETURNING id`)).rows[0].id;
    ids.viejo = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial, costo_base) VALUES ('Ventana vieja test cierre', 'estandar', 20, 30000) RETURNING id`)).rows[0].id;
    ids.nuevo = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Ventana nueva test cierre', 'estandar', 5) RETURNING id`)).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM cliente_saldo_favor_movimientos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM reintegros WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`UPDATE devoluciones SET operacion_cambio_id = NULL WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM devoluciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = ANY($1::uuid[])`, [[ids.viejo, ids.nuevo]]);
    const client = await db.connect();
    try {
      await client.query(`SET session_replication_role = replica`);
      await client.query(`DELETE FROM comprobantes WHERE cliente_id = $1`, [ids.cli]);
    } finally { await client.query(`SET session_replication_role = DEFAULT`); client.release(); }
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = ANY($1::uuid[])`, [[ids.viejo, ids.nuevo]]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.query(`DELETE FROM usuarios WHERE id = $1`, [ids.usrVend]);
    await db.query(`DELETE FROM actividad_log WHERE entidad = 'devolucion' AND created_at > now() - interval '1 hour'`);
    await db.end();
    void comprobantesCreados;
  });

  it('anular una devolución revierte stock y saldo a favor, devuelve la deuda y libera lo devuelto; solo un admin, una sola vez', async () => {
    const e = await escenario();
    const s0 = await stock(ids.viejo!), f0 = await saldoFavor();
    const d = await devolver(e);
    expect([await stock(ids.viejo!), await saldoFavor(), await saldoOp(e.op)]).toEqual([s0 + 1, f0 + 10000, 0]);

    rol = 'vendedor';
    expect((await anular(d.id)).status).toBe(403);
    rol = 'admin';
    expect((await anular(d.id, ' ')).status).toBe(400);
    expect((await anular(d.id)).status).toBe(200);
    expect([await stock(ids.viejo!), await saldoFavor(), await saldoOp(e.op)]).toEqual([s0, f0, 40000]);
    const { rows: [dv] } = await db.query(`SELECT estado, anulada_motivo FROM devoluciones WHERE id = $1`, [d.id]);
    expect(dv).toEqual({ estado: 'anulada', anulada_motivo: 'Se cargó mal' });
    expect((await anular(d.id)).status).toBe(409);
    // lo anulado vuelve a poder devolverse
    expect((await devolver(e)).id).toBeTruthy();
  });

  it('no se anula si el saldo a favor ya se usó, si salió dinero, si fue un cambio o si ya se retiró parte del crédito', async () => {
    // 1) el crédito ya se gastó en un recibo
    const e1 = await escenario();
    const d1 = await devolver(e1);
    const rec = (await db.query(`INSERT INTO recibos (numero, cliente_id, monto_total, forma_pago, monto_lista) VALUES ($1,$2,4000,'Saldo a favor',4000) RETURNING id`, [`REC-TEST-CI-${++n}`, ids.cli])).rows[0].id;
    await db.query(`INSERT INTO cliente_saldo_favor_movimientos (cliente_id, tipo, monto, recibo_id, devolucion_id) VALUES ($1,'consumo_recibo',-4000,$2,$3)`, [ids.cli, rec, d1.id]);
    const r1 = await anular(d1.id);
    expect(r1.status).toBe(409);
    expect(((await r1.json()) as { error: string }).error).toMatch(/ya se usó en un recibo/);

    // 2) salió dinero de caja por esa devolución
    const e2 = await escenario();
    const d2 = await devolver(e2, { reintegro: { monto: 10000, forma_pago: 'Efectivo' } });
    const r2 = await anular(d2.id);
    expect(r2.status).toBe(409);
    expect(((await r2.json()) as { error: string }).error).toMatch(/anulá el reintegro/);
    // anulado el reintegro, el dinero vuelve a quedar a favor y recién ahí se puede anular la devolución
    const { rows: [rei] } = await db.query(`SELECT id FROM reintegros WHERE numero = $1`, [d2.reintegro_numero]);
    expect((await req(`/reintegros/${rei.id}/anular`, 'POST', { motivo_anulacion: 'Error' })).status).toBe(200);
    const f0 = await saldoFavor();
    expect((await anular(d2.id)).status).toBe(200);
    expect(await saldoFavor()).toBe(f0 - 10000);

    // 3) fue un cambio: el producto nuevo ya se entregó
    const e3 = await escenario();
    const d3 = await devolver(e3, { cambio: { items: [{ producto_id: ids.nuevo, descripcion: 'Ventana nueva', cantidad: 1, precio_unitario: 70000 }], pago_diferencia: { forma_pago: 'Contado' } } });
    const r3 = await anular(d3.id);
    expect(r3.status).toBe(409);
    expect(((await r3.json()) as { error: string }).error).toMatch(/fue un cambio/);

    // 4) el cliente ya retiró parte del saldo a favor
    const e4 = await escenario();
    const d4 = await devolver(e4);
    await db.query(`INSERT INTO cliente_saldo_favor_movimientos (cliente_id, tipo, monto) VALUES ($1,'ajuste',$2)`, [ids.cli, -(await saldoFavor()) + 3000]);   // deja solo 3.000
    const r4 = await anular(d4.id);
    expect(r4.status).toBe(409);
    expect(((await r4.json()) as { error: string }).error).toMatch(/ya retiró parte/);
  });

  it('no se anula si lo que volvió a stock ya se vendió (el stock quedaría en negativo)', async () => {
    const e = await escenario();
    const d = await devolver(e);
    await db.query(`INSERT INTO stock_movimientos (producto_id, tipo, cantidad, motivo) VALUES ($1,'ajuste',$2,'Se vendió todo')`, [ids.viejo, -(await stock(ids.viejo!))]);
    const r = await anular(d.id);
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error: string }).error).toMatch(/No se puede revertir el stock/);
    expect(await stock(ids.viejo!)).toBe(0);
  });

  it('la devolución de un ítem facturado avisa que falta la nota de crédito, hasta que se emite una', async () => {
    const e = await escenario();
    const cliente = ids.cli;
    const client = await db.connect();
    try {
      await client.query(`SET session_replication_role = replica`);
      const { rows: [f] } = await client.query(
        `INSERT INTO comprobantes (ambiente, tipo_doc, clase, cbte_tipo, punto_venta, fecha, concepto, cliente_id, receptor_doc_tipo, receptor_doc_nro,
           receptor_nombre, receptor_condicion_iva_id, origen, operacion_id, imp_total, estado, numero, cae, cae_vto, hash_fiscal)
         VALUES ('homologacion','factura','B',6,1,CURRENT_DATE,1,$1,99,'0','X',5,'operacion',$2,100000,'autorizado', 880001, '70000000000000', CURRENT_DATE, 'h') RETURNING id`, [cliente, e.op]);
      await client.query(`INSERT INTO comprobante_items (comprobante_id, orden, descripcion, cantidad, precio_unitario, alicuota, alicuota_id, neto, iva, total, operacion_item_id)
        VALUES ($1,0,'Ventana vieja',2,50000,21,5,82644.63,17355.37,100000,$2)`, [f.id, e.oi]);
    } finally { await client.query(`SET session_replication_role = DEFAULT`); client.release(); }

    const d = await devolver(e);
    const det = async () => (await (await req(`/devoluciones/${d.id}`, 'GET')).json()) as { requiere_nc: boolean; nc_pendiente: boolean };
    expect(await det()).toMatchObject({ requiere_nc: true, nc_pendiente: true });
    const facturas = (await (await req(`/devoluciones/${d.id}/facturas`, 'GET')).json()) as { numero: number; imp_total: string }[];
    expect(facturas.map(x => [Number(x.numero), Number(x.imp_total)])).toEqual([[880001, 100000]]);

    // se emite la nota de crédito sobre esa operación → ya no está pendiente
    const c2 = await db.connect();
    try {
      await c2.query(`SET session_replication_role = replica`);
      await c2.query(
        `INSERT INTO comprobantes (ambiente, tipo_doc, clase, cbte_tipo, punto_venta, fecha, concepto, cliente_id, receptor_doc_tipo, receptor_doc_nro,
           receptor_nombre, receptor_condicion_iva_id, origen, operacion_id, imp_total, estado, numero, cae, cae_vto, hash_fiscal)
         VALUES ('homologacion','nota_credito','B',8,1,CURRENT_DATE,1,$1,99,'0','X',5,'operacion',$2,50000,'autorizado', 880002, '70000000000001', CURRENT_DATE, 'h')`, [cliente, e.op]);
    } finally { await c2.query(`SET session_replication_role = DEFAULT`); c2.release(); }
    expect(await det()).toMatchObject({ requiere_nc: true, nc_pendiente: false });
  });

  it('avisa al admin cuando devuelve un vendedor (no cuando devuelve un admin) y solo un admin lo marca leído', async () => {
    const e = await escenario();
    uid = ids.usrVend!; rol = 'vendedor';
    const d = await devolver(e);
    // un vendedor no ve el aviso
    expect(((await (await req('/notificaciones', 'GET')).json()) as { tipo: string }[]).some(x => x.tipo === 'devolucion')).toBe(false);
    uid = null; rol = 'admin';
    const avisos = ((await (await req('/notificaciones', 'GET')).json()) as { tipo: string; id: string; numero: string; data: { por: string } }[]).filter(x => x.tipo === 'devolucion');
    expect(avisos.some(x => x.id === d.id && x.data.por === 'Vendedor Test')).toBe(true);
    // lo que hace un admin no avisa
    const e2 = await escenario();
    const d2 = await devolver(e2);
    expect(((await (await req('/notificaciones', 'GET')).json()) as { id: string }[]).some(x => x.id === d2.id)).toBe(false);
    // aceptar el aviso
    await req('/notificaciones/vista', 'PATCH', { tipo: 'devolucion', id: d.id });
    expect(((await (await req('/notificaciones', 'GET')).json()) as { id: string }[]).some(x => x.id === d.id)).toBe(false);
  });

  it('las devoluciones restan de las ventas netas y la mercadería que no reingresa figura como pérdida al costo', async () => {
    const { rows: [antes] } = await db.query(`SELECT COALESCE(SUM(valor_total),0) AS v FROM devoluciones WHERE estado = 'emitida' AND fecha = CURRENT_DATE`);
    const e = await escenario();
    await req('/devoluciones', 'POST', { remito_id: e.remito, motivo: 'Rota', items: [{ remito_item_id: e.ri, cantidad: 1, destino: 'no_reingresa', motivo_item: 'Vidrio roto' }] });
    const { rows: [d] } = await db.query(`
      SELECT (SELECT COALESCE(SUM(valor_total),0) FROM devoluciones WHERE estado = 'emitida' AND fecha = CURRENT_DATE)::numeric AS v,
             (SELECT COALESCE(SUM(di.cantidad * COALESCE(cp.costo_base,0)),0) FROM devolucion_items di JOIN devoluciones dv ON dv.id = di.devolucion_id
                LEFT JOIN catalogo_productos cp ON cp.id = di.producto_id
               WHERE dv.estado = 'emitida' AND dv.cliente_id = $1 AND di.destino = 'no_reingresa')::numeric AS perdida`, [ids.cli]);
    expect(Number(d.v) - Number(antes.v)).toBe(50000);
    expect(Number(d.perdida)).toBe(30000);                         // 1 unidad × costo 30.000
  });
});
