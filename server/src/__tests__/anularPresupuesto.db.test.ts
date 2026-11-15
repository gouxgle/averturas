import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Anular presupuestos (2026-11-14): motivo y detalle guardados, bloqueo con recibos/remitos y la visita de
// relevamiento acreditada vuelve a quedar libre (caso Dorrego: presupuesto armado por fuera de la visita).
describe.skipIf(!process.env.DATABASE_URL)('anular presupuesto', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  let cli = '';
  let n = 0;
  const anular = (id: string, body: unknown) => app.request(`/operaciones/${id}/anular`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const nuevaOp = async (estado = 'enviado') => (await db.query(
    `INSERT INTO operaciones (tipo, cliente_id, estado, fecha_validez) VALUES ('estandar',$1,$2,CURRENT_DATE) RETURNING id`,
    [cli, estado])).rows[0].id as string;
  const recibo = async (op: string | null, monto = 1000) => (await db.query(
    `INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista, forma_pago)
     VALUES ($1,$2,$3,$4,$4,'Contado') RETURNING id`, [`REC-TEST-AN-${++n}`, cli, op, monto])).rows[0].id as string;

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'admin', nombre: 'Test' } as never); await next(); });
    app.route('/operaciones', (await import('../routes/operaciones.js')).default);
    cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','Test','ZzAnular') RETURNING id`)).rows[0].id;
  }, 30000);

  afterAll(async () => {
    await db.query(`DELETE FROM tareas WHERE cliente_id = $1 OR operacion_id IN (SELECT id FROM operaciones WHERE cliente_id = $1)`, [cli]);
    await db.query(`DELETE FROM visitas_tecnicas WHERE cliente_id = $1`, [cli]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = $1`, [cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [cli]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [cli]);
  });

  it('guarda motivo, detalle y estado anterior; no se anula dos veces', async () => {
    const op = await nuevaOp('enviado');
    const r = await anular(op, { motivo: 'cliente_equivocado', detalle: 'Era de Pérez, no de este cliente' });
    expect(r.status).toBe(200);
    const { rows: [o] } = await db.query(`SELECT estado, anulacion_motivo, anulacion_detalle, anulado_desde, anulado_at FROM operaciones WHERE id=$1`, [op]);
    expect(o).toMatchObject({ estado: 'cancelado', anulacion_motivo: 'cliente_equivocado', anulacion_detalle: 'Era de Pérez, no de este cliente', anulado_desde: 'enviado' });
    expect(o.anulado_at).not.toBeNull();
    expect((await anular(op, { motivo: 'duplicado' })).status).toBe(409);
    // Anulado: no vuelve a aprobarse ni se comparte
    const est = await app.request(`/operaciones/${op}/estado`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estado: 'aprobado' }) });
    expect(est.status).toBe(409);
    expect((await app.request(`/operaciones/${op}/generar-link`, { method: 'POST' })).status).toBe(409);
  });

  it('"otro" exige detalle', async () => {
    const op = await nuevaOp();
    expect((await anular(op, { motivo: 'otro' })).status).toBe(400);
    expect((await anular(op, { motivo: 'otro', detalle: 'Se cargó de prueba' })).status).toBe(200);
  });

  it('con un recibo del cliente no se anula', async () => {
    const op = await nuevaOp('aprobado');
    await recibo(op);
    const r = await anular(op, { motivo: 'error_carga' });
    expect(r.status).toBe(409);
    expect((await r.json()).error).toMatch(/recibos REC-TEST-AN-/);
    expect((await db.query(`SELECT estado FROM operaciones WHERE id=$1`, [op])).rows[0].estado).toBe('aprobado');
  });

  it('la visita acreditada se desacredita y queda libre; cierra tareas pendientes', async () => {
    const op = await nuevaOp('aprobado');
    const rec = await recibo(op, 30000);
    const vt = (await db.query(
      `INSERT INTO visitas_tecnicas (numero, cliente_id, operacion_id, estado, cobro_estado, costo_cobrado, recibo_id)
       VALUES ($1,$2,$3,'convertida','bonificada',30000,$4) RETURNING id`, [`VT-TEST-AN-${++n}`, cli, op, rec])).rows[0].id;
    await db.query(`INSERT INTO tareas (cliente_id, operacion_id, descripcion, tipo_accion, vencimiento)
       VALUES ($1,$2,'Recotizar','recotizar',CURRENT_DATE)`, [cli, op]);
    const r = await anular(op, { motivo: 'reemplazado', detalle: 'Se rehace desde la visita' });
    expect(r.status).toBe(200);
    expect((await r.json()).visitas_liberadas).toHaveLength(1);
    const { rows: [v] } = await db.query(`SELECT estado, cobro_estado, operacion_id FROM visitas_tecnicas WHERE id=$1`, [vt]);
    expect(v).toEqual({ estado: 'relevada', cobro_estado: 'cobrada', operacion_id: null });
    expect((await db.query(`SELECT operacion_id FROM recibos WHERE id=$1`, [rec])).rows[0].operacion_id).toBeNull();
    expect((await db.query(`SELECT count(*)::int c FROM tareas WHERE operacion_id=$1 AND NOT completada`, [op])).rows[0].c).toBe(0);
  });
});
