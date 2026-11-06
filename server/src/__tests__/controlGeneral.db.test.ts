import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Hallazgos del control general de prod (2026-11-05): saldos que ignoraban los descuentos, listas recortadas
// sin aviso y ventas marcadas entregadas sin remito.
describe.skipIf(!process.env.DATABASE_URL)('control general: saldos, listas y entrega', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  const ids = { cli: '', prov: '', saldada: '', conSaldo: '', rec: '', recConSaldo: '', sinRemito: '', conRemito: '' };
  const NOMBRE = 'ZzControlGeneral';

  const op = async (estado: string, precio: number) => (await db.query(
    `INSERT INTO operaciones (tipo, cliente_id, estado, precio_total, fecha_validez)
     VALUES ('estandar', $1, $2, $3, CURRENT_DATE) RETURNING id`, [ids.cli, estado, precio])).rows[0].id as string;

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'admin', nombre: 'Test' } as never); await next(); });
    app.route('/operaciones', (await import('../routes/operaciones.js')).default);
    app.route('/clientes', (await import('../routes/clientes.js')).default);
    app.route('/recibos', (await import('../routes/recibos.js')).default);
    app.route('/remitos', (await import('../routes/remitos.js')).default);

    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica', 'Test', $1) RETURNING id`, [NOMBRE])).rows[0].id;
    ids.prov = (await db.query(`INSERT INTO proveedores (nombre) VALUES ($1) RETURNING id`, [NOMBRE])).rows[0].id;

    // Saldada con descuento: cobró 90.000 de un precio de lista de 100.000
    ids.saldada = await op('aprobado', 100000);
    ids.rec = (await db.query(`INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista, monto_descuento)
      VALUES ('REC-TEST-CG-1', $1, $2, 90000, 100000, 10000) RETURNING id`, [ids.cli, ids.saldada])).rows[0].id;
    await db.query(`INSERT INTO pedidos (numero, proveedor_id, operacion_id, estado) VALUES ('OC-TEST-CG', $1, $2, 'recibido')`, [ids.prov, ids.saldada]);

    // Con saldo de verdad: cobró 90.000 de 100.000 sin descuento
    ids.conSaldo = await op('aprobado', 100000);
    ids.recConSaldo = (await db.query(`INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista)
      VALUES ('REC-TEST-CG-2', $1, $2, 90000, 90000) RETURNING id`, [ids.cli, ids.conSaldo])).rows[0].id;

    ids.sinRemito = await op('listo', 1000);
    ids.conRemito = await op('listo', 1000);
    await db.query(`INSERT INTO remitos (numero, cliente_id, operacion_id, estado, stock_descontado) VALUES ('REM-TEST-CG', $1, $2, 'entregado', true)`, [ids.cli, ids.conRemito]);

    // Más filas que los topes viejos: 60 presupuestos (tablero: 50) y 510 clientes (panel: 500)
    await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, fecha_validez)
      SELECT 'estandar', $1, 'presupuesto', CURRENT_DATE FROM generate_series(1, 60)`, [ids.cli]);
    await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido, created_at)
      SELECT 'fisica', 'Lote', $1, now() - interval '400 days' FROM generate_series(1, 510)`, [`${NOMBRE}Lote`]);
  }, 30000);

  afterAll(async () => {
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM pedidos WHERE proveedor_id = $1`, [ids.prov]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM clientes WHERE id = $1 OR apellido = $2`, [ids.cli, `${NOMBRE}Lote`]);
    await db.query(`DELETE FROM proveedores WHERE id = $1`, [ids.prov]);
    await db.end();
  }, 30000);

  it('Recibos: una venta saldada con descuento figura cobrada, sin saldo; una con deuda sigue parcial', async () => {
    const j = await (await app.request('/recibos/tablero')).json() as { recibos: { id: string; estado_cobro: string; saldo_pendiente: number }[] };
    const saldada = j.recibos.find(r => r.id === ids.rec)!;
    expect(saldada.estado_cobro).toBe('cobrado');
    expect(Number(saldada.saldo_pendiente)).toBe(0);
    const conSaldo = j.recibos.find(r => r.id === ids.recConSaldo)!;
    expect(conSaldo.estado_cobro).toBe('parcial');
    expect(Number(conSaldo.saldo_pendiente)).toBe(10000);
  });

  it('Listos para enviar: incluye la venta saldada con descuento y no la que tiene saldo', async () => {
    const rows = await (await app.request('/remitos/listos-para-enviar')).json() as { id: string }[];
    expect(rows.some(r => r.id === ids.saldada)).toBe(true);
    expect(rows.some(r => r.id === ids.conSaldo)).toBe(false);
  });

  it('GET /operaciones devuelve el saldo real, que usa el selector del recibo nuevo', async () => {
    const rows = await (await app.request(`/operaciones?cliente_id=${ids.cli}&estado=aprobado`)).json() as { id: string; saldo: number }[];
    expect(Number(rows.find(r => r.id === ids.saldada)!.saldo)).toBe(0);
    expect(Number(rows.find(r => r.id === ids.conSaldo)!.saldo)).toBe(10000);
  });

  it('Tablero de Operaciones: no recorta en 50 y trae el saldo', async () => {
    const j = await (await app.request('/operaciones/tablero')).json() as { kanban: Record<string, { id: string; cliente: { id: string }; saldo: number }[]> };
    expect(j.kanban.sin_confirmar.filter(o => o.cliente.id === ids.cli).length).toBe(60);
    const saldada = j.kanban.confirmadas.find(o => o.id === ids.saldada);
    if (saldada) expect(Number(saldada.saldo)).toBe(0);
  });

  it('Panel de Clientes: no recorta en 500', async () => {
    const j = await (await app.request('/clientes/panel')).json() as { clientes: { apellido: string }[] };
    expect(j.clientes.filter(c => c.apellido === `${NOMBRE}Lote`).length).toBe(510);
  });

  it('una venta no pasa a entregada sin remito entregado', async () => {
    const patch = (id: string) => app.request(`/operaciones/${id}/estado`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'entregado' }),
    });
    const sin = await patch(ids.sinRemito);
    expect(sin.status).toBe(409);
    expect((await db.query(`SELECT estado FROM operaciones WHERE id = $1`, [ids.sinRemito])).rows[0].estado).toBe('listo');

    expect((await patch(ids.conRemito)).status).toBe(200);
  });
});
