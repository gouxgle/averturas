import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync } from 'node:fs';

// El PDF necesita un Chrome/Chromium: el del host si no hay CHROMIUM_PATH (server/.env lo trae para el backend nativo).
const CHROME = process.env.CHROMIUM_PATH ?? ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'].find(p => existsSync(p));
if (CHROME) process.env.CHROMIUM_PATH = CHROME;

// Garantías y servicios técnicos contra la base local: alta desde un seguimiento de post venta, programación con
// tarea espejo en la agenda, reprogramar desde la agenda, completar la visita, estados y permisos.
//   DATABASE_URL=… npx vitest run servicios

describe.skipIf(!process.env.DATABASE_URL)('servicios técnicos', () => {
  type Db = typeof import('../db.js')['db'];
  let db: Db;
  let app: import('hono').Hono;
  let rol = 'admin';
  const ids: Record<string, string> = {};
  const servicios: string[] = [];

  const req = async (method: string, path: string, body?: unknown) => {
    const r = await app.request(`/api${path}`, {
      method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    const { Hono } = await import('hono');
    ids.usr = (await db.query(`INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Técnico Test', 'servicios@test.local', 'x', 'admin') RETURNING id`)).rows[0].id;
    ids.cli = (await db.query(`INSERT INTO clientes (tipo_persona, nombre, apellido, telefono) VALUES ('fisica','Servicio','Zzz','3794000000') RETURNING id`)).rows[0].id;
    ids.op = (await db.query(`INSERT INTO operaciones (tipo, cliente_id, estado, precio_total) VALUES ('estandar', $1, 'entregado', 100000) RETURNING id`, [ids.cli])).rows[0].id;
    ids.oi = (await db.query(`INSERT INTO operacion_items (operacion_id, descripcion, cantidad, precio_unitario, orden, tipo_item) VALUES ($1, 'Ventana corrediza 150x110', 1, 100000, 0, 'a_medida') RETURNING id`, [ids.op])).rows[0].id;
    ids.rem = (await db.query(`INSERT INTO remitos (numero, cliente_id, operacion_id, estado, fecha_entrega_real) VALUES ('R-TEST-SERV', $1, $2, 'entregado', CURRENT_DATE - 60) RETURNING id`, [ids.cli, ids.op])).rows[0].id;
    ids.ri = (await db.query(`INSERT INTO remito_items (remito_id, descripcion, cantidad, operacion_item_id) VALUES ($1, 'Ventana corrediza 150x110', 1, $2) RETURNING id`, [ids.rem, ids.oi])).rows[0].id;
    ids.pv = (await db.query(`INSERT INTO postventa_seguimientos (cliente_id, operacion_id, remito_id, fecha_entrega, fecha_contacto, estado, puntaje_productos, comentario)
      VALUES ($1, $2, $3, CURRENT_DATE - 60, CURRENT_DATE - 57, 'respondido', 2, 'La hoja se traba') RETURNING id`, [ids.cli, ids.op, ids.rem])).rows[0].id;
    app = new Hono();
    app.use('*', async (c, next) => { (c as unknown as { set: (k: string, v: unknown) => void }).set('user', { id: ids.usr, rol, nombre: 'Técnico Test' }); await next(); });
    app.route('/api/servicios-tecnicos', (await import('../routes/serviciosTecnicos.js')).serviciosTecnicos);
    app.route('/api/agenda', (await import('../routes/agenda.js')).default);
    app.route('/api/tareas', (await import('../routes/tareas.js')).default);
  });

  afterAll(async () => {
    const { rows } = await db.query(`SELECT id, tarea_id, recontacto_tarea_id FROM servicios_tecnicos WHERE cliente_id = $1`, [ids.cli]);
    for (const s of rows) {
      await db.query(`DELETE FROM servicios_tecnicos WHERE id = $1`, [s.id]);
      for (const t of [s.tarea_id, s.recontacto_tarea_id].filter(Boolean)) await db.query(`DELETE FROM tareas WHERE id = $1`, [t]);
    }
    await db.query(`DELETE FROM tareas WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM interacciones WHERE cliente_id = $1`, [ids.cli]);
    await db.query(`DELETE FROM postventa_seguimientos WHERE id = $1`, [ids.pv]);
    await db.query(`DELETE FROM remito_items WHERE remito_id = $1`, [ids.rem]);
    await db.query(`DELETE FROM remitos WHERE id = $1`, [ids.rem]);
    await db.query(`DELETE FROM operacion_items WHERE operacion_id = $1`, [ids.op]);
    await db.query(`DELETE FROM operaciones WHERE id = $1`, [ids.op]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [ids.cli]);
    await db.query(`DELETE FROM actividad_log WHERE usuario_id = $1`, [ids.usr]).catch(() => {});
    await db.query(`DELETE FROM usuarios WHERE id = $1`, [ids.usr]);
  });

  it('desde post venta: precarga, programa, va a la agenda, se reprograma y se completa', async () => {
    const prep = await req('GET', `/servicios-tecnicos/preparar?postventa_id=${ids.pv}`);
    expect(prep.status).toBe(200);
    expect(prep.json).toMatchObject({ origen: 'postventa', operacion_id: ids.op, remito_id: ids.rem, problema: 'La hoja se traba' });
    expect(prep.json.cliente.id).toBe(ids.cli);

    const prods = await req('GET', `/servicios-tecnicos/productos-cliente?cliente_id=${ids.cli}&operacion_id=${ids.op}`);
    expect(prods.json.productos).toHaveLength(1);
    expect(prods.json.productos[0]).toMatchObject({ remito_item_id: ids.ri, remito_numero: 'R-TEST-SERV', servicios_previos: 0 });

    const alta = await req('POST', '/servicios-tecnicos', {
      cliente_id: ids.cli, tipo: 'garantia', problema: 'La hoja se traba', fecha_reclamo: '2026-10-27',
      remito_item_id: ids.ri, origen: 'postventa', postventa_seguimiento_id: ids.pv, adjuntos: ['/uploads/servicios/x.mp4'],
    });
    expect(alta.status).toBe(201);
    expect(alta.json.numero).toMatch(/^ST-\d{6}-\d{4}$/);
    const id = alta.json.id;
    servicios.push(id);

    let d = (await req('GET', `/servicios-tecnicos/${id}`)).json;
    expect(d).toMatchObject({ estado: 'pendiente_coordinar', operacion_id: ids.op, remito_id: ids.rem, operacion_item_id: ids.oi,
      producto_descripcion: 'Ventana corrediza 150x110', remito_numero: 'R-TEST-SERV' });
    const { rows: inter } = await db.query(`SELECT tipo FROM interacciones WHERE cliente_id = $1`, [ids.cli]);
    expect(inter.map(i => i.tipo)).toContain('garantia');

    // Programar → tarea espejo en la agenda con el responsable
    const prog = await req('PATCH', `/servicios-tecnicos/${id}/programar`, { responsable_nombre: 'Carlos (externo)', fecha_visita: '2099-01-10', hora_visita: '10:30' });
    expect(prog.json.estado).toBe('visita_programada');
    d = (await req('GET', `/servicios-tecnicos/${id}`)).json;
    const { rows: [t] } = await db.query(`SELECT tipo_accion, vencimiento::text AS v, hora::text AS h, descripcion FROM tareas WHERE id = $1`, [d.tarea_id]);
    expect(t).toMatchObject({ tipo_accion: 'servicio', v: '2099-01-10', h: '10:30:00' });
    expect(t.descripcion).toContain('Carlos (externo)');

    // Reprogramar desde la agenda mueve la visita del servicio
    expect((await req('PATCH', '/agenda/reprogramar', { tarea_ids: [d.tarea_id], fecha: '2099-01-12', hora: '09:00' })).status).toBe(200);
    d = (await req('GET', `/servicios-tecnicos/${id}`)).json;
    expect(d).toMatchObject({ fecha_visita: '2099-01-12', hora_visita: '09:00', estado: 'visita_programada' });

    // Completar la visita desde la agenda → en proceso
    expect((await req('PATCH', `/tareas/${d.tarea_id}/completar`, { completada: true })).status).toBe(200);
    d = (await req('GET', `/servicios-tecnicos/${id}`)).json;
    expect(d.estado).toBe('en_proceso');

    // El segundo producto del mismo ítem ve el historial
    const otro = await req('POST', '/servicios-tecnicos', { cliente_id: ids.cli, tipo: 'mantenimiento', problema: 'Ajuste anual', fecha_reclamo: '2026-10-27', remito_item_id: ids.ri });
    servicios.push(otro.json.id);
    const d2 = (await req('GET', `/servicios-tecnicos/${otro.json.id}`)).json;
    expect(d2.otros_servicios.map((o: { id: string }) => o.id)).toEqual([id]);
    expect((await req('GET', `/servicios-tecnicos/productos-cliente?cliente_id=${ids.cli}`)).json.productos[0].servicios_previos).toBe(2);

    // Lista por cliente y por pestaña
    const porCliente = (await req('GET', `/servicios-tecnicos?cliente_id=${ids.cli}`)).json;
    expect(porCliente.servicios).toHaveLength(2);
    const enProceso = (await req('GET', `/servicios-tecnicos?tab=en_proceso&q=Servicio`)).json;
    expect(enProceso.servicios.some((s: { id: string }) => s.id === id)).toBe(true);
  });

  it('estados: transiciones válidas, cancelar con motivo, reabrir y quitar la fecha', async () => {
    const id = servicios[1];
    expect((await req('PATCH', `/servicios-tecnicos/${id}/estado`, { estado: 'visita_programada' })).status).toBe(409);
    expect((await req('PATCH', `/servicios-tecnicos/${id}/programar`, { fecha_visita: '2099-02-01' })).json.estado).toBe('visita_programada');
    expect((await req('PATCH', `/servicios-tecnicos/${id}/programar`, { fecha_visita: null })).json.estado).toBe('pendiente_coordinar');
    const { rows: [s] } = await db.query(`SELECT tarea_id FROM servicios_tecnicos WHERE id = $1`, [id]);
    expect(s.tarea_id).toBeNull();
    expect((await req('PATCH', `/servicios-tecnicos/${id}/cancelar`, { motivo: '' })).status).toBe(400);
    expect((await req('PATCH', `/servicios-tecnicos/${id}/cancelar`, { motivo: 'Lo resolvió el cliente' })).status).toBe(200);
    expect((await req('PATCH', `/servicios-tecnicos/${id}/cancelar`, { motivo: 'Otra vez' })).status).toBe(409);
    expect((await req('PATCH', `/servicios-tecnicos/${id}/programar`, { fecha_visita: '2099-02-01' })).status).toBe(409);
    expect((await req('PATCH', `/servicios-tecnicos/${id}/estado`, { estado: 'finalizado' })).status).toBe(409);
    expect((await req('PATCH', `/servicios-tecnicos/${id}/estado`, { estado: 'pendiente_coordinar' })).status).toBe(200);
  });

  it('visitas: nueva visita, segunda visita resuelta, firma, inmutable y PDF', async () => {
    const id = servicios[0];   // en proceso
    const visita = (extra: object) => ({ fecha: '2026-10-27', tecnico_nombre: 'Carlos', trabajo_tipo: 'ajuste',
      trabajo_detalle: 'Se ajustaron las ruedas', con_cargo: false, resultado: 'resuelto', ...extra });

    const v1 = await req('POST', `/servicios-tecnicos/${id}/intervenciones`, visita({ resultado: 'pendiente_repuesto', pendientes: 'Cambiar la rueda' }));
    expect(v1.status).toBe(201);
    expect(v1.json.orden).toBe(1);
    expect((await req('GET', `/servicios-tecnicos/${id}`)).json.estado).toBe('pendiente_repuesto');

    // Programar otra visita crea una tarea nueva (la anterior quedó hecha)
    await req('PATCH', `/servicios-tecnicos/${id}/programar`, { fecha_visita: '2099-03-01' });
    const tarea2 = (await req('GET', `/servicios-tecnicos/${id}`)).json.tarea_id;
    expect(tarea2).toBeTruthy();

    const v2 = await req('POST', `/servicios-tecnicos/${id}/intervenciones`, visita({ trabajo_tipo: 'cambio_pieza',
      materiales: [{ descripcion: 'Rueda corrediza', cantidad: 2 }], fotos_antes: ['/uploads/servicios/a.webp'] }));
    expect(v2.json.orden).toBe(2);
    let d = (await req('GET', `/servicios-tecnicos/${id}`)).json;
    expect(d).toMatchObject({ estado: 'en_proceso', tarea_id: null, fecha_visita: null });
    expect((await db.query(`SELECT completada FROM tareas WHERE id = $1`, [tarea2])).rows[0].completada).toBe(true);
    expect(d.intervenciones.map((i: { orden: number }) => i.orden)).toEqual([1, 2]);

    // Sin firma ni motivo → 400; con observaciones exige el texto
    expect((await req('POST', `/servicios-tecnicos/${id}/intervenciones/${v2.json.id}/firmar`, { recibio_nombre: 'Juan', conformidad: 'conforme' })).status).toBe(400);
    expect((await req('POST', `/servicios-tecnicos/${id}/intervenciones/${v2.json.id}/firmar`,
      { recibio_nombre: 'Juan', conformidad: 'con_observaciones', firma_url: '/uploads/servicios/f.webp' })).status).toBe(400);
    // No se puede enviar sin firmar
    expect((await req('POST', `/servicios-tecnicos/${id}/intervenciones/${v2.json.id}/enviar-whatsapp`, {})).status).toBe(409);

    const f = await req('POST', `/servicios-tecnicos/${id}/intervenciones/${v2.json.id}/firmar`,
      { recibio_nombre: 'Juan Pérez', recibio_dni: '30111222', conformidad: 'con_observaciones', conformidad_obs: 'Quedó un leve ruido', firma_url: '/uploads/servicios/f.webp' });
    expect(f.json).toMatchObject({ ok: true, finalizado: true });
    d = (await req('GET', `/servicios-tecnicos/${id}`)).json;
    expect(d.estado).toBe('finalizado');

    // Firmada: no se edita ni se borra
    expect((await req('PUT', `/servicios-tecnicos/${id}/intervenciones/${v2.json.id}`, visita({}))).status).toBe(409);
    expect((await req('DELETE', `/servicios-tecnicos/${id}/intervenciones/${v2.json.id}`)).status).toBe(409);
    // La primera (sin firmar) no se borra porque no es la última
    expect((await req('DELETE', `/servicios-tecnicos/${id}/intervenciones/${v1.json.id}`)).status).toBe(409);

    if (!CHROME) return;   // sin navegador no hay PDF que probar
    const pdf = await app.request(`/api/servicios-tecnicos/${id}/intervenciones/${v2.json.id}/pdf`);
    expect(pdf.status).toBe(200);
    const bytes = Buffer.from(await pdf.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  }, 60_000);

  it('valida el producto y el rol consulta solo lee', async () => {
    const ajeno = (await db.query(`INSERT INTO clientes (tipo_persona, nombre) VALUES ('fisica','Ajeno Zzz') RETURNING id`)).rows[0].id;
    try {
      const r = await req('POST', '/servicios-tecnicos', { cliente_id: ajeno, tipo: 'reparacion', problema: 'xxx', fecha_reclamo: '2026-10-27', remito_item_id: ids.ri });
      expect(r.status).toBe(422);
    } finally {
      await db.query(`DELETE FROM clientes WHERE id = $1`, [ajeno]);
    }
    rol = 'consulta';
    try {
      expect((await req('GET', `/servicios-tecnicos/${servicios[0]}`)).status).toBe(200);
      expect((await req('POST', '/servicios-tecnicos', { cliente_id: ids.cli, tipo: 'reparacion', problema: 'xxx', fecha_reclamo: '2026-10-27' })).status).toBe(403);
      expect((await req('PATCH', `/servicios-tecnicos/${servicios[0]}/estado`, { estado: 'finalizado' })).status).toBe(403);
    } finally {
      rol = 'admin';
    }
  });
});
