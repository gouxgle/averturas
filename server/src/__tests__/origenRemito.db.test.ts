import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Facturar desde un remito y por ítems de un presupuesto, contra la base (se saltea sin DATABASE_URL).
describe.skipIf(!process.env.DATABASE_URL)('origen: remito y facturación por ítems', () => {
  let db: typeof import('../db.js')['db'];
  let o: typeof import('../lib/fiscal/origenes.js');
  const ids: { cli?: string; op?: string; remito?: string; fact?: string } = {};

  // Un comprobante autorizado no se borra ni se modifica (trigger): los de prueba se manejan sin triggers.
  async function sinTriggers(fn: (q: (sql: string, p?: unknown[]) => Promise<{ rows: Record<string, string>[] }>) => Promise<void>) {
    const client = await db.connect();
    try {
      await client.query(`SET session_replication_role = replica`);
      await fn((sql, p) => client.query(sql, p));
    } finally { await client.query(`SET session_replication_role = DEFAULT`); client.release(); }
  }
  const borrarComprobantes = () => sinTriggers(async q => {
    await q(`DELETE FROM comprobantes WHERE cliente_id = $1`, [ids.cli]);
  });

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    o = await import('../lib/fiscal/origenes.js');
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestRemito','Zzz') RETURNING id`)).rows[0].id;
    ids.op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'aprobado', 3000) RETURNING id`, [ids.cli])).rows[0].id;
    await db.query(`INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, orden) VALUES
      ($1,'Ventana A',2,1000,1), ($1,'Puerta B',1,1000,2)`, [ids.op]);
    ids.remito = (await db.query(
      `INSERT INTO remitos (numero, cliente_id, operacion_id, estado) VALUES ('REM-TEST-9999', $1, $2, 'emitido') RETURNING id`, [ids.cli, ids.op])).rows[0].id;
    await db.query(`INSERT INTO remito_items (remito_id, descripcion, cantidad) VALUES ($1,'Ventana A',2), ($1,'Puerta B',1)`, [ids.remito]);
  });

  afterAll(async () => {
    await borrarComprobantes();
    await db.query(`DELETE FROM remitos WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.end();
  });

  it('el remito sin precios toma los del presupuesto', async () => {
    const p = (await o.prepararDesdeRemito(ids.remito!))!;
    expect(p.referencia).toBe('Remito REM-TEST-9999');
    expect(p.comprobante.items.map(i => [i.descripcion, i.cantidad, i.precio_unitario])).toEqual([['Ventana A', 2, 1000], ['Puerta B', 1, 1000]]);
    expect(p.comprobante).toMatchObject({ origen: 'remito', remito_id: ids.remito, operacion_id: ids.op });
    expect([p.total_origen, p.saldo]).toEqual([3000, 3000]);
  });

  it('un remito borrador avisa y un remito sin presupuesto ni precio marca el ítem sin precio', async () => {
    await db.query(`UPDATE remitos SET estado = 'borrador' WHERE id = $1`, [ids.remito]);
    const p = (await o.prepararDesdeRemito(ids.remito!))!;
    expect(p.avisos.join(' ')).toMatch(/borrador/);
    await db.query(`UPDATE remitos SET estado = 'emitido' WHERE id = $1`, [ids.remito]);
  });

  it('lo ya facturado por ítem no se vuelve a proponer y el remito aparece como facturado', async () => {
    const { rows: [it] } = await db.query(`SELECT id FROM operacion_items WHERE operacion_id = $1 AND descripcion = 'Ventana A'`, [ids.op]);
    await sinTriggers(async q => {
      const { rows: [f] } = await q(
        `INSERT INTO comprobantes (ambiente, tipo_doc, clase, cbte_tipo, punto_venta, fecha, concepto, cliente_id, receptor_doc_tipo, receptor_doc_nro,
           receptor_nombre, receptor_condicion_iva_id, origen, operacion_id, remito_id, imp_total, estado, numero, cae, cae_vto, hash_fiscal)
         VALUES ('homologacion','factura','B',6,1,CURRENT_DATE,1,$1,99,'0','X',5,'remito',$2,$3,2000,'autorizado', 999999, '70000000000000', CURRENT_DATE, 'h') RETURNING id`,
        [ids.cli, ids.op, ids.remito]);
      await q(`INSERT INTO comprobante_items (comprobante_id, orden, descripcion, cantidad, precio_unitario, alicuota, alicuota_id, neto, iva, total, operacion_item_id)
        VALUES ($1,0,'Ventana A',2,1000,21,5,1652.89,347.11,2000,$2)`, [f.id, it.id]);
    });
    const p = (await o.prepararDesdeOperacion(ids.op!))!;
    expect(p.comprobante.items.map(i => i.descripcion)).toEqual(['Puerta B']);
    expect(p.avisos.join(' ')).toMatch(/Ya facturados completos.*Ventana A/);
    const r = (await o.prepararDesdeRemito(ids.remito!))!;
    expect(r.facturado).toBe(2000);
    expect((await o.porFacturar()).remitos.some(m => m.id === ids.remito)).toBe(false);
  });
});
