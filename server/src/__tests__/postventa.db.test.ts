import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Hono } from 'hono';
import { armarMensajePostventa, nombreParaSaludo } from '../lib/postventa.js';

// El envío real de WhatsApp se reemplaza: acá solo importa lo que hace el sistema alrededor.
vi.mock('../lib/whatsapp.js', async (orig) => ({ ...(await orig<typeof import('../lib/whatsapp.js')>()), enviarWhatsapp: vi.fn(async () => ({ ok: true, numero: '5491100000000' })) }));

describe('mensaje de post venta', () => {
  it('reemplaza las variables de la plantilla', () => {
    const m = armarMensajePostventa('Hola {{nombre}}, de {{empresa}}: {{productos}} {{link}}', { nombre: 'Ana', productos: 'una ventana', empresa: 'Aberturas', link: 'http://x/e/1' });
    expect(m).toBe('Hola Ana, de Aberturas: una ventana http://x/e/1');
    expect(nombreParaSaludo({ tipo_persona: 'juridica', nombre: 'x', razon_social: 'ACME SA' })).toBe('ACME SA');
    expect(nombreParaSaludo({ tipo_persona: 'fisica', nombre: 'Ana', razon_social: null })).toBe('Ana');
  });
});

describe.skipIf(!process.env.DATABASE_URL)('seguimiento post venta', () => {
  let db: typeof import('../db.js')['db'];
  let r: typeof import('../lib/remitos.js');
  let app: Hono;
  let rol = 'admin';
  const ids: { cli?: string; sinTel?: string; op?: string; op2?: string; op3?: string; prod?: string } = {};
  let n = 0;

  const call = (path: string, init?: RequestInit) => app.request(path, init);
  const post = (path: string, body: unknown, method = 'POST') => app.request(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  async function entregarNuevoRemito(cliente: string, operacion: string) {
    const { rows: [rem] } = await db.query(`INSERT INTO remitos (numero, cliente_id, operacion_id, estado) VALUES ($1, $2, $3, 'emitido') RETURNING id`, [`R-TEST-PV-${++n}`, cliente, operacion]);
    await db.query(`INSERT INTO remito_items (remito_id, producto_id, descripcion, cantidad) VALUES ($1, $2, 'Ventana test', 1)`, [rem.id, ids.prod]);
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      await r.entregarRemito(client, (await r.cargarRemitoParaTransicion(client, rem.id, true))!, { sin_firma_motivo: 'Cliente ausente' }, null);
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    return rem.id as string;
  }
  const seguimientos = async (op: string) => (await db.query(`SELECT * FROM postventa_seguimientos WHERE operacion_id = $1 ORDER BY created_at`, [op])).rows;

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    r = await import('../lib/remitos.js');
    const { postventa } = await import('../routes/postventa.js');
    const pub = (await import('../routes/pub.js')).default;
    const notificaciones = (await import('../routes/notificaciones.js')).default;
    app = new Hono();
    app.use('*', async (c, next) => { c.set('user' as never, { id: null, rol, nombre: 'Test' } as never); await next(); });
    app.route('/postventa', postventa);
    app.route('/pub', pub);
    app.route('/notificaciones', notificaciones);
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido, telefono) VALUES ('fisica','TestPostventa','Zzz','3704000111') RETURNING id`)).rows[0].id;
    ids.sinTel = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido) VALUES ('fisica','TestPostventaSinTel','Zzz') RETURNING id`)).rows[0].id;
    for (const k of ['op', 'op2', 'op3'] as const) {
      ids[k] = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado) VALUES ('estandar', $1, 'aprobado') RETURNING id`, [k === 'op2' ? ids.sinTel : ids.cli])).rows[0].id;
      await db.query(`INSERT INTO operacion_items (operacion_id, orden, descripcion, cantidad, precio_unitario) VALUES ($1, 0, 'Ventana test', 1, 1000)`, [ids[k]]);
    }
    ids.prod = (await db.query(`INSERT INTO catalogo_productos (nombre, tipo, stock_inicial) VALUES ('Ventana test pv', 'estandar', 50) RETURNING id`)).rows[0].id;
  });

  afterAll(async () => {
    await db.query(`DELETE FROM tareas WHERE cliente_id = ANY($1)`, [[ids.cli, ids.sinTel]]);
    await db.query(`DELETE FROM interacciones WHERE cliente_id = ANY($1)`, [[ids.cli, ids.sinTel]]);
    await db.query(`DELETE FROM postventa_seguimientos WHERE cliente_id = ANY($1)`, [[ids.cli, ids.sinTel]]);
    await db.query(`DELETE FROM stock_movimientos WHERE producto_id = $1`, [ids.prod]);
    await db.query(`DELETE FROM remitos WHERE cliente_id = ANY($1)`, [[ids.cli, ids.sinTel]]);
    await db.query(`DELETE FROM operaciones WHERE cliente_id = ANY($1)`, [[ids.cli, ids.sinTel]]);
    await db.query(`DELETE FROM catalogo_productos WHERE id = $1`, [ids.prod]);
    await db.query(`DELETE FROM clientes WHERE id = ANY($1)`, [[ids.cli, ids.sinTel]]);
    await db.end();
  });

  it('entregar un remito crea un seguimiento con su tarea en la agenda, a los N días', async () => {
    const dias = Number((await db.query(`SELECT postventa_dias FROM empresa ORDER BY updated_at DESC LIMIT 1`)).rows[0]?.postventa_dias ?? 3);
    await entregarNuevoRemito(ids.cli!, ids.op!);
    const [s] = await seguimientos(ids.op!);
    expect(s.estado).toBe('pendiente');
    expect((await db.query(`SELECT (fecha_contacto - fecha_entrega)::int AS d FROM postventa_seguimientos WHERE id = $1`, [s.id])).rows[0].d).toBe(dias);
    const { rows: [t] } = await db.query(`SELECT tipo_accion, completada FROM tareas WHERE id = $1`, [s.tarea_id]);
    expect([t.tipo_accion, t.completada]).toEqual(['postventa', false]);
  });

  it('una segunda entrega (parcial) de la misma operación no lo duplica', async () => {
    await entregarNuevoRemito(ids.cli!, ids.op!);
    expect((await seguimientos(ids.op!)).length).toBe(1);
  });

  it('un cliente sin teléfono no genera seguimiento (no hay a quién escribirle)', async () => {
    await entregarNuevoRemito(ids.sinTel!, ids.op2!);
    expect((await seguimientos(ids.op2!)).length).toBe(0);
  });

  it('GET / lista el seguimiento por pestaña y GET /:id/mensaje arma el mensaje con el link', async () => {
    const [s] = await seguimientos(ids.op!);
    await db.query(`UPDATE postventa_seguimientos SET fecha_contacto = CURRENT_DATE WHERE id = $1`, [s.id]);
    const l = await (await call('/postventa?tab=hoy')).json() as { seguimientos: { id: string; productos: string }[]; conteos: { hoy: number } };
    expect(l.seguimientos.some(x => x.id === s.id)).toBe(true);
    expect(l.seguimientos.find(x => x.id === s.id)!.productos).toContain('ventana test');
    const m = await (await call(`/postventa/${s.id}/mensaje`)).json() as { mensaje: string; telefono: string };
    expect(m.mensaje).toContain(`/e/${s.token}`);
    expect(m.mensaje).toContain('TestPostventa');
  });

  it('la encuesta no abre hasta que se envía el mensaje', async () => {
    const [s] = await seguimientos(ids.op!);
    expect((await call(`/pub/encuesta/${s.token}`)).status).toBe(404);
  });

  it('enviar: exige el link en el mensaje, marca enviado, anota la interacción y cierra la tarea', async () => {
    const [s] = await seguimientos(ids.op!);
    expect((await post(`/postventa/${s.id}/enviar`, { mensaje: 'Hola, ¿cómo te fue con la ventana?' })).status).toBe(422);   // sin link
    const { mensaje } = await (await call(`/postventa/${s.id}/mensaje`)).json() as { mensaje: string };
    rol = 'consulta';
    expect((await post(`/postventa/${s.id}/enviar`, { mensaje })).status).toBe(403);
    rol = 'admin';
    expect((await post(`/postventa/${s.id}/enviar`, { mensaje })).status).toBe(200);
    const [e] = await seguimientos(ids.op!);
    expect(e.estado).toBe('enviado');
    expect(e.enviado_at).not.toBeNull();
    expect((await db.query(`SELECT completada FROM tareas WHERE id = $1`, [e.tarea_id])).rows[0].completada).toBe(true);
    expect((await db.query(`SELECT count(*)::int AS n FROM interacciones WHERE cliente_id = $1 AND descripcion LIKE 'Post venta:%'`, [ids.cli])).rows[0].n).toBe(1);
  });

  it('el cliente responde por el link (una sola vez) y un puntaje bajo avisa como cliente insatisfecho', async () => {
    const [s] = await seguimientos(ids.op!);
    const g = await call(`/pub/encuesta/${s.token}`);
    expect(g.status).toBe(200);
    expect(((await g.json()) as { productos: string[] }).productos.length).toBeGreaterThan(0);
    expect((await post(`/pub/encuesta/${s.token}`, { puntaje_productos: 9, puntaje_entrega: 5, puntaje_atencion: 5 })).status).toBe(400);   // fuera de rango
    const r1 = await post(`/pub/encuesta/${s.token}`, { puntaje_productos: 2, puntaje_entrega: 5, puntaje_atencion: 4, comentario: 'Llegó con un vidrio rayado' });
    expect(((await r1.json()) as { ya_respondida: boolean }).ya_respondida).toBe(false);
    const r2 = await post(`/pub/encuesta/${s.token}`, { puntaje_productos: 5, puntaje_entrega: 5, puntaje_atencion: 5 });
    expect(((await r2.json()) as { ya_respondida: boolean }).ya_respondida).toBe(true);   // no pisa la primera
    const [e] = await seguimientos(ids.op!);
    expect([e.estado, e.puntaje_productos, e.canal_respuesta, e.comentario]).toEqual(['respondido', 2, 'link', 'Llegó con un vidrio rayado']);
    const avisos = await (await call('/notificaciones')).json() as { tipo: string; id: string; detalle: string | null }[];
    expect(avisos.find(a => a.tipo === 'postventa_insatisfecho' && a.id === s.id)?.detalle).toBe('Llegó con un vidrio rayado');
    await post('/notificaciones/vista', { tipo: 'postventa_insatisfecho', id: s.id }, 'PATCH');
    expect(((await (await call('/notificaciones')).json()) as { id: string }[]).some(a => a.id === s.id)).toBe(false);
  });

  it('un puntaje alto no genera aviso; cargar a mano, reprogramar y descartar', async () => {
    await db.query(`UPDATE operaciones SET estado = 'aprobado' WHERE id = $1`, [ids.op3]);
    await entregarNuevoRemito(ids.cli!, ids.op3!);
    const [s] = await seguimientos(ids.op3!);
    expect((await post(`/postventa/${s.id}/reprogramar`, { fecha: '2030-01-15' }, 'PATCH')).status).toBe(200);
    expect((await db.query(`SELECT vencimiento::text AS v FROM tareas WHERE id = $1`, [s.tarea_id])).rows[0].v).toBe('2030-01-15');
    expect((await post(`/postventa/${s.id}/respuesta-manual`, {})).status).toBe(400);
    expect((await post(`/postventa/${s.id}/respuesta-manual`, { puntaje_productos: 5, puntaje_entrega: 4, puntaje_atencion: 5, comentario: 'Todo bien' })).status).toBe(200);
    const [e] = await seguimientos(ids.op3!);
    expect([e.estado, e.canal_respuesta]).toEqual(['respondido', 'manual']);
    expect(((await (await call('/notificaciones')).json()) as { id: string }[]).some(a => a.id === s.id)).toBe(false);
    expect((await post(`/postventa/${s.id}/descartar`, {}, 'PATCH')).status).toBe(409);   // ya respondido
  });

  it('cancelar la operación descarta el seguimiento pendiente', async () => {
    const { descartarSeguimientoDeOperacion } = await import('../lib/postventa.js');
    const op4 = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'aprobado', 1000) RETURNING id`, [ids.cli])).rows[0].id;
    await entregarNuevoRemito(ids.cli!, op4);
    await descartarSeguimientoDeOperacion(db, op4, 'Operación cancelado');
    const [s] = await seguimientos(op4);
    expect([s.estado, s.motivo_descarte]).toEqual(['descartado', 'Operación cancelado']);
    expect((await db.query(`SELECT completada FROM tareas WHERE id = $1`, [s.tarea_id])).rows[0].completada).toBe(true);
    await db.query(`DELETE FROM postventa_seguimientos WHERE operacion_id = $1`, [op4]);
    await db.query(`DELETE FROM tareas WHERE operacion_id = $1`, [op4]);
    await db.query(`DELETE FROM remitos WHERE operacion_id = $1`, [op4]);
    await db.query(`DELETE FROM operaciones WHERE id = $1`, [op4]);
  });
});
