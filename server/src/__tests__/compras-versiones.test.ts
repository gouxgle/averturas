import { describe, it, expect, beforeAll, afterAll } from 'vitest';

// Versiones de la ficha en Compras, contra la base local: SC → PC (foto) → nueva versión → la PC1 conserva lo que
// se pidió → PC2 → adjudicar la V2 → la OC lleva ficha, adjuntos y precios de la V2 y la V1 queda reemplazada.
//   DATABASE_URL=… npx vitest run compras-versiones

const MARCA = '__test_versiones__';

describe.skipIf(!process.env.DATABASE_URL)('compras: versiones de la ficha', () => {
  type Db = typeof import('../db.js')['db'];
  let db: Db;
  let app: import('hono').Hono;
  let usuario: string, proveedor: string, scId = '';
  const req = async (method: string, path: string, body?: unknown) => {
    const r = await app.request(`/compras${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const fichaV1 = {
    esquema_version: 1, tipo_abertura: 'puerta', tipologia: 'de_abrir', ancho_m: 0.9, alto_m: 2.05, hojas: 1,
    sentido: 'izquierda', composicion: 'vidriado', vidrio_color: 'incoloro',
  };

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const { Hono } = await import('hono');
    ({ rows: [{ id: usuario }] } = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Versiones', 'versiones@test.local', 'x', 'admin') RETURNING id`));
    ({ rows: [{ id: proveedor }] } = await db.query(`INSERT INTO proveedores (nombre) VALUES ($1) RETURNING id`, [MARCA]));
    app = new Hono();
    app.use('*', async (c, next) => { (c as unknown as { set: (k: string, v: unknown) => void }).set('user', { id: usuario, rol: 'admin' }); await next(); });
    app.route('/compras', (await import('../routes/compras.js')).default);
  });

  afterAll(async () => {
    const { rows: ocs } = await db.query(`SELECT id FROM pedidos WHERE solicitud_id = $1`, [scId]);
    for (const { id } of ocs) {
      await db.query(`DELETE FROM compras_documentos WHERE pedido_id = $1`, [id]);
      await db.query(`DELETE FROM pedido_items WHERE pedido_id = $1`, [id]);
      await db.query(`DELETE FROM pedidos WHERE id = $1`, [id]);
    }
    await db.query(`DELETE FROM compras_cotizaciones WHERE solicitud_id = $1`, [scId]);
    await db.query(`DELETE FROM compras_solicitudes WHERE id = $1`, [scId]);
    await db.query(`DELETE FROM proveedores WHERE id = $1`, [proveedor]);
    await db.query(`DELETE FROM actividad_log WHERE usuario_id = $1`, [usuario]).catch(() => {});
    await db.query(`DELETE FROM usuarios WHERE id = $1`, [usuario]);
  });

  it('el circuito completo conserva qué se cotizó de cada versión', async () => {
    const sc = await req('POST', '/solicitudes', {
      origen: 'faltante', tipo_producto: 'abertura_medida', observaciones: MARCA,
      items: [{ descripcion: 'Puerta V1', cantidad: 2, especificaciones: fichaV1, adjuntos: ['/uploads/compras/v1.webp'] }],
    });
    expect(sc.status).toBe(201);
    scId = sc.json.id;
    const v1 = (await req('GET', `/solicitudes/${scId}`)).json.items[0];

    const pc1 = await req('POST', '/cotizaciones', { solicitud_id: scId, item_ids: [v1.id], proveedor_ids: [proveedor] });
    expect(pc1.status).toBe(201);

    // Con versiones ya no se edita la SC entera… (todavía no hay; la nueva versión las crea)
    const v2r = await req('POST', `/solicitudes/${scId}/items/${v1.id}/nueva-version`, {
      descripcion: 'Puerta V2', especificaciones: { ...fichaV1, vidrio_color: 'opalino', sentido: 'derecha', tipologia: 'corrediza' },
      adjuntos: ['/uploads/compras/v2.webp'], motivo: 'el cliente cambió el vidrio',
    });
    expect(v2r.status).toBe(201);
    expect(v2r.json).toMatchObject({ version: 2, item_origen_id: v1.id, estado: 'pendiente', cantidad: '2.00' });
    expect(v2r.json.especificaciones.sentido).toBeUndefined();          // normalizada: corrediza no lleva sentido

    // La PC1 sigue mostrando la V1 tal como se pidió
    const pc1d = (await req('GET', `/cotizaciones/${pc1.json.id}`)).json;
    expect(pc1d.items[0]).toMatchObject({ descripcion: 'Puerta V1', version: 1 });
    expect(pc1d.items[0].especificaciones.vidrio_color).toBe('incoloro');

    // Una OC no puede llevar dos versiones del mismo ítem
    const doble = await req('POST', '/ordenes/directa', { solicitud_id: scId, proveedor_id: proveedor, costo_envio: 0,
      items: [{ solicitud_item_id: v1.id }, { solicitud_item_id: v2r.json.id }] });
    expect(doble.status).toBe(409);
    const pc2 = await req('POST', '/cotizaciones', { solicitud_id: scId, item_ids: [v2r.json.id], proveedor_ids: [proveedor] });
    expect(pc2.status).toBe(201);
    // Cambiar el ítem vivo después de cotizar no altera la foto de la PC2
    await db.query(`UPDATE compras_solicitud_items SET descripcion = 'tocada' WHERE id = $1`, [v2r.json.id]);
    const resp = await req('PUT', `/cotizaciones/${pc2.json.id}/proveedores/${proveedor}/respuesta`, {
      items: [{ solicitud_item_id: v2r.json.id, precio_unitario_neto: 150000 }],
    });
    expect(resp.status).toBe(200);
    const adj = await req('POST', `/cotizaciones/${pc2.json.id}/adjudicar`, { proveedor_id: proveedor });
    expect(adj.status).toBe(201);

    const { rows: [pi] } = await db.query(
      `SELECT pi.descripcion, pi.especificaciones, pi.adjuntos, pi.precio_unitario_neto FROM pedido_items pi
         JOIN pedidos p ON p.id = pi.pedido_id WHERE p.solicitud_id = $1`, [scId]);
    expect(pi.descripcion).toBe('Puerta V2');
    expect(pi.especificaciones.vidrio_color).toBe('opalino');
    expect(pi.adjuntos).toEqual(['/uploads/compras/v2.webp']);
    expect(Number(pi.precio_unitario_neto)).toBe(150000);

    const items = (await req('GET', `/solicitudes/${scId}`)).json.items as { id: string; estado: string; reemplazado_por_id: string | null }[];
    expect(items.find(i => i.id === v1.id)).toMatchObject({ estado: 'cancelado', reemplazado_por_id: v2r.json.id });
    expect(items.find(i => i.id === v2r.json.id)?.estado).toBe('comprado');

    // Comprada: no se puede sacar otra versión de la V2 ni editar la SC
    expect((await req('POST', `/solicitudes/${scId}/items/${v2r.json.id}/nueva-version`, { descripcion: 'x', especificaciones: {} })).status).toBe(409);
  });
});
