import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';

// Revisión de la edición de recibos y remitos (2026-11-05). Casos vistos en prod: OP-00231 perdió la bonificación
// al editar el recibo y OP-00143 quedó cobrada de más porque el importe se subió sin ningún control.
describe.skipIf(!process.env.DATABASE_URL)('edición de recibos y remitos', () => {
  let db: typeof import('../db.js')['db'];
  let app: Hono;
  const ids = { cli: '', otroCli: '', op: '', opOtroCli: '', opDos: '', itemOp: '', rec: '', remito: '', tarea: '' };
  let n = 0;

  const send = (method: string, url: string, body: unknown) => app.request(url, {
    method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const reciboBase = (extra: Record<string, unknown> = {}) => ({
    cliente_id: ids.cli, operacion_id: ids.op, forma_pago: 'Contado', monto_total: 40000, fecha: '2026-11-01', items: [],
    monto_descuento: 0, monto_lista: 40000, descuento_pct: 0, ...extra,
  });
  const nuevoRecibo = async (monto: number, descuento = 0, bonif = 0, op = ids.op) => (await db.query(
    `INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, monto_lista, monto_descuento, bonificacion_presupuesto_monto, forma_pago)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'Contado') RETURNING id`,
    [`REC-TEST-ED-${++n}`, ids.cli, op, monto, monto + descuento, descuento, bonif])).rows[0].id as string;
  const remitoBase = (extra: Record<string, unknown> = {}) => ({
    cliente_id: ids.cli, operacion_id: ids.op, medio_envio: 'retiro_local',
    items: [{ descripcion: 'Ventana', cantidad: 1, operacion_item_id: ids.itemOp }], ...extra,
  });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol: 'admin', nombre: 'Test' } as never); await next(); });
    app.route('/recibos', (await import('../routes/recibos.js')).default);
    app.route('/remitos', (await import('../routes/remitos.js')).default);

    const cli = async (ap: string) => (await db.query(
      `INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','Test',$1) RETURNING id`, [ap])).rows[0].id as string;
    ids.cli = await cli('ZzEdicion');
    ids.otroCli = await cli('ZzEdicionOtro');
    const op = async (cliente: string) => (await db.query(
      `INSERT INTO operaciones (tipo, cliente_id, estado, fecha_validez) VALUES ('estandar',$1,'aprobado',CURRENT_DATE) RETURNING id`, [cliente])).rows[0].id as string;
    ids.op = await op(ids.cli);
    ids.opDos = await op(ids.cli);
    ids.opOtroCli = await op(ids.otroCli);
    ids.itemOp = (await db.query(
      `INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, tipo_item)
       VALUES ($1,'Ventana',2,50000,'estandar') RETURNING id`, [ids.op])).rows[0].id;
    await db.query(`INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, tipo_item)
       VALUES ($1,'Puerta',1,100000,'estandar')`, [ids.opDos]);
    await db.query(`UPDATE operaciones SET bonificacion_tipo='monto', bonificacion_valor=10000, bonificacion_monto=10000 WHERE id=$1`, [ids.opDos]);
  }, 30000);

  afterAll(async () => {
    const clis = [ids.cli, ids.otroCli];
    await db.query(`UPDATE remitos SET tarea_id = NULL WHERE cliente_id = ANY($1)`, [clis]);
    await db.query(`DELETE FROM tareas WHERE cliente_id = ANY($1)`, [clis]);
    await db.query(`DELETE FROM remitos WHERE cliente_id = ANY($1)`, [clis]);
    await db.query(`DELETE FROM recibos WHERE cliente_id = ANY($1)`, [clis]);
    await db.query(`DELETE FROM compromisos_pago WHERE cliente_id = ANY($1)`, [clis]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = ANY($1)`, [clis]);
    await db.query(`DELETE FROM clientes WHERE id = ANY($1)`, [clis]);
    await db.end();
  }, 30000);

  describe('recibos', () => {
    it('editar conserva la bonificación y el saldo de la operación, aunque la pantalla mande cero', async () => {
      const rec = await nuevoRecibo(40000, 10000, 10000, ids.opDos);
      const antes = (await db.query(`SELECT saldo FROM operacion_cobranza WHERE operacion_id=$1`, [ids.opDos])).rows[0].saldo;
      const r = await send('PUT', `/recibos/${rec}`, reciboBase({ operacion_id: ids.opDos, notas: 'corregido' }));
      expect(r.status).toBe(200);
      const j = await r.json() as { monto_descuento: string; monto_lista: string; bonificacion_presupuesto_monto: string; notas: string };
      expect(Number(j.monto_descuento)).toBe(10000);
      expect(Number(j.monto_lista)).toBe(50000);
      expect(Number(j.bonificacion_presupuesto_monto)).toBe(10000);
      expect(j.notas).toBe('corregido');
      expect((await db.query(`SELECT saldo FROM operacion_cobranza WHERE operacion_id=$1`, [ids.opDos])).rows[0].saldo).toBe(antes);
    });

    it('no deja pasar a otro presupuesto un recibo con bonificación', async () => {
      const rec = await nuevoRecibo(5000, 500, 500, ids.opDos);
      const r = await send('PUT', `/recibos/${rec}`, reciboBase({ operacion_id: ids.op, monto_total: 5000 }));
      expect(r.status).toBe(409);
      await db.query(`DELETE FROM recibos WHERE id=$1`, [rec]);
    });

    it('subir el importe por encima del saldo se rechaza; hasta el saldo se acepta', async () => {
      // Presupuesto de 100.000: otro recibo cobró 30.000 y este 20.000
      await nuevoRecibo(30000);
      const rec = await nuevoRecibo(20000);
      const excede = await send('PUT', `/recibos/${rec}`, reciboBase({ monto_total: 70000.01 }));
      expect(excede.status).toBe(409);
      expect(Number((await db.query(`SELECT monto_total FROM recibos WHERE id=$1`, [rec])).rows[0].monto_total)).toBe(20000);
      expect((await send('PUT', `/recibos/${rec}`, reciboBase({ monto_total: 70000 }))).status).toBe(200);
      ids.rec = rec;
    });

    it('un recibo ya cobrado de más se puede corregir: cambiar datos o bajar el importe no se bloquea', async () => {
      await db.query(`UPDATE recibos SET monto_total = 90000, monto_lista = 90000 WHERE id=$1`, [ids.rec]);
      expect((await send('PUT', `/recibos/${ids.rec}`, reciboBase({ monto_total: 90000, notas: 'solo la nota' }))).status).toBe(200);
      expect((await send('PUT', `/recibos/${ids.rec}`, reciboBase({ monto_total: 70000 }))).status).toBe(200);
    });

    it('no acepta el presupuesto de otro cliente ni un importe inválido', async () => {
      expect((await send('PUT', `/recibos/${ids.rec}`, reciboBase({ operacion_id: ids.opOtroCli, monto_total: 1000 }))).status).toBe(409);
      expect((await send('PUT', `/recibos/${ids.rec}`, reciboBase({ monto_total: -5 }))).status).toBeGreaterThanOrEqual(400);
    });

    it('editar cierra el compromiso si deja saldada la operación y registra el importe anterior', async () => {
      await db.query(`INSERT INTO compromisos_pago (cliente_id, operacion_id, tipo, monto, fecha_vencimiento) VALUES ($1,$2,'cuota',1000,CURRENT_DATE)`, [ids.cli, ids.op]);
      // 30.000 + 70.000 = 100.000: este recibo ya salda; se lo baja y se lo vuelve a subir
      await send('PUT', `/recibos/${ids.rec}`, reciboBase({ monto_total: 69000 }));
      expect((await db.query(`SELECT estado FROM compromisos_pago WHERE operacion_id=$1`, [ids.op])).rows[0].estado).toBe('pendiente');
      expect((await send('PUT', `/recibos/${ids.rec}`, reciboBase({ monto_total: 70000 }))).status).toBe(200);
      expect((await db.query(`SELECT estado FROM compromisos_pago WHERE operacion_id=$1`, [ids.op])).rows[0].estado).toBe('cobrado');
    });
  });

  describe('remitos', () => {
    it('no permite pedir más de lo que tiene el presupuesto, aunque sea el primer remito', async () => {
      const r = await send('POST', '/remitos', remitoBase({ items: [{ descripcion: 'Ventana', cantidad: 3, operacion_item_id: ids.itemOp }] }));
      expect(r.status).toBe(409);
      // El mismo ítem en dos renglones también suma
      const dos = await send('POST', '/remitos', remitoBase({ items: [
        { descripcion: 'Ventana', cantidad: 2, operacion_item_id: ids.itemOp },
        { descripcion: 'Ventana', cantidad: 1, operacion_item_id: ids.itemOp },
      ] }));
      expect(dos.status).toBe(409);
    });

    it('editar respeta lo que ya tiene y deja cambiar la cantidad dentro del total', async () => {
      const c = await send('POST', '/remitos', remitoBase());
      expect(c.status).toBe(201);
      ids.remito = (await c.json() as { id: string }).id;
      const e = await send('PUT', `/remitos/${ids.remito}`, remitoBase({ items: [{ descripcion: 'Ventana', cantidad: 2, operacion_item_id: ids.itemOp }] }));
      expect(e.status).toBe(200);
      const exc = await send('PUT', `/remitos/${ids.remito}`, remitoBase({ items: [{ descripcion: 'Ventana', cantidad: 3, operacion_item_id: ids.itemOp }] }));
      expect(exc.status).toBe(409);
    });

    it('rechaza la operación de otro cliente y los ítems de otra operación', async () => {
      expect((await send('PUT', `/remitos/${ids.remito}`, remitoBase({ operacion_id: ids.opOtroCli }))).status).toBe(409);
      expect((await send('PUT', `/remitos/${ids.remito}`, remitoBase({ operacion_id: ids.opDos }))).status).toBe(409);
    });

    it('sin operación, los renglones no conservan el vínculo con un ítem', async () => {
      expect((await send('PUT', `/remitos/${ids.remito}`, remitoBase({ operacion_id: null }))).status).toBe(200);
      const { rows } = await db.query(`SELECT operacion_item_id FROM remito_items WHERE remito_id=$1`, [ids.remito]);
      expect(rows[0].operacion_item_id).toBeNull();
    });

    it('cambiar la fecha mueve la tarea de la Agenda y resetea los avisos; quitarla la completa', async () => {
      const body = remitoBase({ fecha_entrega_est: '2030-01-10' });
      expect((await send('PUT', `/remitos/${ids.remito}`, body)).status).toBe(200);
      const prog = await send('PATCH', `/remitos/${ids.remito}/programar-entrega`, { fecha_entrega_est: '2030-01-10', hora_entrega_est: '10:00' });
      expect(prog.status).toBe(200);
      await db.query(`UPDATE remitos SET recordatorio_dia_antes_visto = true WHERE id=$1`, [ids.remito]);

      expect((await send('PUT', `/remitos/${ids.remito}`, remitoBase({ fecha_entrega_est: '2030-02-20' }))).status).toBe(200);
      const { rows: [a] } = await db.query(
        `SELECT t.vencimiento::text AS v, t.completada, r.recordatorio_dia_antes_visto AS visto FROM remitos r JOIN tareas t ON t.id=r.tarea_id WHERE r.id=$1`, [ids.remito]);
      expect(a.v).toBe('2030-02-20');
      expect(a.visto).toBe(false);

      expect((await send('PUT', `/remitos/${ids.remito}`, remitoBase({ fecha_entrega_est: null }))).status).toBe(200);
      const { rows: [b] } = await db.query(`SELECT t.completada FROM remitos r JOIN tareas t ON t.id=r.tarea_id WHERE r.id=$1`, [ids.remito]);
      expect(b.completada).toBe(true);
    });

    it('solo se edita en borrador', async () => {
      await db.query(`UPDATE remitos SET estado='cancelado' WHERE id=$1`, [ids.remito]);
      expect((await send('PUT', `/remitos/${ids.remito}`, remitoBase())).status).toBe(409);
    });
  });
});
