import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { siguienteFecha, pasoRepeticion } from '../lib/tareas.js';

// Agenda del día: repetición (puro) + aviso, recordatorios, reprogramar, recotizar y tareas
// internas contra la base local. Marca sus datos con MARCA y los borra al final.
//   DATABASE_URL=… npx vitest run agenda

describe('repetición de tareas', () => {
  it('semanal, cada N días y mensual', () => {
    expect(pasoRepeticion('2026-10-01', 'semanal', null, null)).toBe('2026-10-08');
    expect(pasoRepeticion('2026-10-01', 'dias', 3, null)).toBe('2026-10-04');
    expect(pasoRepeticion('2026-12-10', 'mensual', null, 10)).toBe('2027-01-10');
  });
  it('mensual el 31: cae a fin de mes en los meses cortos y vuelve al 31', () => {
    expect(pasoRepeticion('2026-01-31', 'mensual', null, 31)).toBe('2026-02-28');
    expect(pasoRepeticion('2026-02-28', 'mensual', null, 31)).toBe('2026-03-31');
    expect(pasoRepeticion('2028-01-31', 'mensual', null, 31)).toBe('2028-02-29');
    expect(pasoRepeticion('2026-03-31', 'mensual', null, 31)).toBe('2026-04-30');
  });
  it('completada con atraso: la siguiente cae después de hoy, sin ocurrencias viejas', () => {
    expect(siguienteFecha('2026-09-01', '2026-10-01', 'semanal', null, null)).toBe('2026-10-06');
    expect(siguienteFecha('2026-07-10', '2026-10-01', 'mensual', null, 10)).toBe('2026-10-10');
    expect(siguienteFecha('2026-10-01', '2026-10-01', 'semanal', null, null)).toBe('2026-10-08');
    // Completada antes de tiempo: avanza desde su fecha, no desde hoy
    expect(siguienteFecha('2026-10-20', '2026-10-01', 'mensual', null, 20)).toBe('2026-11-20');
  });
});

const MARCA = '__test_agenda__';

describe.skipIf(!process.env.DATABASE_URL)('agenda del día contra la base', () => {
  type Db = typeof import('../db.js')['db'];
  let db: Db;
  let app: import('hono').Hono;
  let T: typeof import('../lib/tareas.js');
  let u1: string, u2: string, clienteId: string, operacionId: string;
  let usuarioActual: { id: string; rol: string };

  const req = async (method: string, path: string, body?: unknown) => {
    const r = await app.request(path, {
      method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const tarea = async (vencimientoSql: string, extra: Record<string, unknown> = {}) => {
    const campos = { cliente_id: clienteId, descripcion: `${MARCA} tarea`, tipo_accion: 'llamada', ...extra };
    const keys = Object.keys(campos);
    const { rows: [t] } = await db.query(
      `INSERT INTO tareas (${keys.join(', ')}, vencimiento) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')}, ${vencimientoSql}) RETURNING id`,
      Object.values(campos));
    return t.id as string;
  };
  const hoy = async () => (await req('GET', '/agenda/hoy')).json.tareas as { id: string; debe_mostrarse: boolean; atrasada: boolean }[];
  const deHoy = async (id: string) => (await hoy()).find(t => t.id === id);

  beforeAll(async () => {
    ({ db } = await import('../db.js'));
    T = await import('../lib/tareas.js');
    const { Hono } = await import('hono');
    app = new Hono();
    app.use('*', async (c, next) => { (c as unknown as { set: (k: string, v: unknown) => void }).set('user', usuarioActual); await next(); });
    app.route('/agenda', (await import('../routes/agenda.js')).default);
    app.route('/tareas', (await import('../routes/tareas.js')).default);
    app.route('/crm', (await import('../routes/crm.js')).default);
    app.route('/dashboard', (await import('../routes/dashboard.js')).default);
    ({ rows: [{ id: u1 }] } = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Agenda Uno', 'agenda1@test.local', 'x', 'admin') RETURNING id`));
    ({ rows: [{ id: u2 }] } = await db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol) VALUES ('Agenda Dos', 'agenda2@test.local', 'x', 'vendedor') RETURNING id`));
    usuarioActual = { id: u1, rol: 'admin' };
    ({ rows: [{ id: clienteId }] } = await db.query(
      `INSERT INTO clientes (nombre, apellido, notas) VALUES ('Agenda', 'Test', $1) RETURNING id`, [MARCA]));
    ({ rows: [{ id: operacionId }] } = await db.query(
      `INSERT INTO operaciones (tipo, estado, cliente_id, notas) VALUES ('estandar', 'enviado', $1, $2) RETURNING id`, [clienteId, MARCA]));
  });

  afterAll(async () => {
    await db.query(`DELETE FROM visitas_tecnicas WHERE cliente_id = $1`, [clienteId]);
    await db.query(`DELETE FROM oportunidades WHERE cliente_id = $1`, [clienteId]);
    await db.query(`DELETE FROM tareas WHERE cliente_id = $1 OR descripcion LIKE $2`, [clienteId, `${MARCA}%`]);
    await db.query(`DELETE FROM interacciones WHERE cliente_id = $1`, [clienteId]);
    await db.query(`DELETE FROM operaciones WHERE id = $1`, [operacionId]);
    await db.query(`DELETE FROM clientes WHERE id = $1`, [clienteId]);
    await db.query(`DELETE FROM usuarios WHERE id = ANY($1)`, [[u1, u2]]);
  });

  it('el aviso trae lo de hoy y lo atrasado, no lo hecho ni lo futuro', async () => {
    const atrasada = await tarea(`CURRENT_DATE - 3`);
    const deHoyId = await tarea(`CURRENT_DATE`);
    const futura = await tarea(`CURRENT_DATE + 1`);
    const hecha = await tarea(`CURRENT_DATE`, { completada: true });
    const lista = await hoy();
    const ids = lista.map(t => t.id);
    expect(ids).toEqual(expect.arrayContaining([atrasada, deHoyId]));
    expect(ids).not.toContain(futura);
    expect(ids).not.toContain(hecha);
    expect(lista.find(t => t.id === atrasada)).toMatchObject({ atrasada: true, debe_mostrarse: true });
    // La atrasada viene antes que la de hoy
    expect(ids.indexOf(atrasada)).toBeLessThan(ids.indexOf(deHoyId));
  });

  it('recordar: 1 h por defecto, cada usuario con su ritmo, y vuelve cuando vence', async () => {
    const id = await tarea(`CURRENT_DATE`);
    expect((await req('POST', '/agenda/recordar', { tarea_ids: [id] })).status).toBe(200);
    expect((await deHoy(id))!.debe_mostrarse).toBe(false);
    const { rows: [r] } = await db.query(
      `SELECT round(extract(epoch FROM mostrar_desde - now()) / 60) AS min FROM tarea_recordatorios WHERE tarea_id = $1 AND usuario_id = $2`, [id, u1]);
    expect(Number(r.min)).toBe(60);
    // El otro usuario todavía la tiene que ver
    usuarioActual = { id: u2, rol: 'vendedor' };
    expect((await deHoy(id))!.debe_mostrarse).toBe(true);
    usuarioActual = { id: u1, rol: 'admin' };
    // Se venció el recordatorio (simulado): vuelve a aparecer
    await db.query(`UPDATE tarea_recordatorios SET mostrar_desde = now() - interval '1 minute' WHERE tarea_id = $1`, [id]);
    expect((await deHoy(id))!.debe_mostrarse).toBe(true);
  });

  it('abrir horas después: con varios recordatorios vencidos la tarea aparece una sola vez', async () => {
    const id = await tarea(`CURRENT_DATE`);
    for (const min of [5, 10, 15]) await req('POST', '/agenda/recordar', { tarea_ids: [id], en_minutos: min });
    // Simula que el sistema se abre a las 8 con los avisos de la madrugada vencidos
    await db.query(`UPDATE tarea_recordatorios SET mostrar_desde = now() - interval '6 hours', visto_at = now() - interval '8 hours' WHERE tarea_id = $1`, [id]);
    const lista = (await hoy()).filter(t => t.id === id);
    expect(lista).toHaveLength(1);
    expect(lista[0].debe_mostrarse).toBe(true);
  });

  it('recordar a una hora exacta: si ya pasó, queda para mañana; al cerrar no adelanta lo pospuesto', async () => {
    const id = await tarea(`CURRENT_DATE`);
    const { rows: [{ pasada, futura, puede }] } = await db.query(
      `SELECT to_char(localtime - interval '1 minute', 'HH24:MI') AS pasada, to_char(localtime + interval '2 hours', 'HH24:MI') AS futura,
              localtime BETWEEN '00:02' AND '21:50' AS puede`);
    if (!puede) return;   // cerca de medianoche "hoy/mañana" se mezcla: no es un caso a probar
    await req('POST', '/agenda/recordar', { tarea_ids: [id], a_las: pasada });
    const fecha = async () => (await db.query(
      `SELECT (mostrar_desde AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - CURRENT_DATE AS dias, to_char(mostrar_desde AT TIME ZONE 'America/Argentina/Buenos_Aires', 'HH24:MI') AS hora
         FROM tarea_recordatorios WHERE tarea_id = $1 AND usuario_id = $2`, [id, u1])).rows[0];
    expect(await fecha()).toEqual({ dias: 1, hora: pasada });
    await req('POST', '/agenda/recordar', { tarea_ids: [id], a_las: futura });
    expect(await fecha()).toEqual({ dias: 0, hora: futura });
    // "Seguir trabajando": 1 h, pero respetando el "a las" que ya eligió (más tarde)
    await req('POST', '/agenda/recordar', { tarea_ids: [id], en_minutos: 60, respetar_posterior: true });
    expect(await fecha()).toEqual({ dias: 0, hora: futura });
  });

  it('15 minutos antes de la hora de la tarea vuelve a avisar aunque esté pospuesta', async () => {
    const { rows: [{ puede }] } = await db.query(`SELECT localtime BETWEEN '00:30' AND '23:30' AS puede`);
    if (!puede) return;
    const id = await tarea(`CURRENT_DATE`, { hora: null });
    await db.query(`UPDATE tareas SET hora = (localtime + interval '10 minutes')::time WHERE id = $1`, [id]);
    await db.query(
      `INSERT INTO tarea_recordatorios (tarea_id, usuario_id, mostrar_desde, visto_at) VALUES ($1, $2, now() + interval '3 hours', now() - interval '1 hour')`, [id, u1]);
    expect((await deHoy(id))!.debe_mostrarse).toBe(true);
    // Una vez visto ese aviso, no insiste hasta lo que eligió el usuario
    await req('POST', '/agenda/recordar', { tarea_ids: [id], en_minutos: 120 });
    expect((await deHoy(id))!.debe_mostrarse).toBe(false);
  });

  it('completar: deja de avisar para todos; repetir el clic no falla', async () => {
    const id = await tarea(`CURRENT_DATE`);
    await req('POST', '/agenda/recordar', { tarea_ids: [id] });
    expect((await req('PATCH', `/tareas/${id}/completar`, { completada: true })).status).toBe(200);
    expect((await req('PATCH', `/tareas/${id}/completar`, { completada: true })).status).toBe(200);
    expect(await deHoy(id)).toBeUndefined();
    const { rows } = await db.query(`SELECT 1 FROM tarea_recordatorios WHERE tarea_id = $1`, [id]);
    expect(rows).toHaveLength(0);
    const { rows: [t] } = await db.query(`SELECT completada_by FROM tareas WHERE id = $1`, [id]);
    expect(t.completada_by).toBe(u1);
  });

  it('reprogramar una oportunidad mueve su fecha de recontacto y borra los recordatorios', async () => {
    const { rows: [op] } = await db.query(
      `INSERT INTO oportunidades (cliente_id, motivo, fecha_recontacto) VALUES ($1, 'Cocina nueva', CURRENT_DATE) RETURNING id`, [clienteId]);
    const { sincronizarTarea } = await import('../lib/oportunidades.js');
    await sincronizarTarea(db, op.id);
    const { rows: [{ tarea_id }] } = await db.query(`SELECT tarea_id FROM oportunidades WHERE id = $1`, [op.id]);
    await req('POST', '/agenda/recordar', { tarea_ids: [tarea_id] });
    const { rows: [{ manana }] } = await db.query(`SELECT (CURRENT_DATE + 1)::text AS manana`);
    expect((await req('PATCH', '/agenda/reprogramar', { tarea_ids: [tarea_id], fecha: manana, hora: '10:30' })).status).toBe(200);
    const { rows: [o] } = await db.query(`SELECT fecha_recontacto::text AS f, veces_pospuesta FROM oportunidades WHERE id = $1`, [op.id]);
    expect(o).toEqual({ f: manana, veces_pospuesta: 1 });
    const { rows: [t] } = await db.query(`SELECT vencimiento::text AS v, hora::text AS h FROM tareas WHERE id = $1`, [tarea_id]);
    expect(t).toEqual({ v: manana, h: '10:30:00' });
    expect((await db.query(`SELECT 1 FROM tarea_recordatorios WHERE tarea_id = $1`, [tarea_id])).rows).toHaveLength(0);
    // No se reprograma al pasado
    expect((await req('PATCH', '/agenda/reprogramar', { tarea_ids: [tarea_id], fecha: '2020-01-01' })).status).toBe(400);
  });

  it('visita técnica con fecha: aparece en la agenda, se reprograma y al relevarse queda hecha', async () => {
    const { rows: [vt] } = await db.query(
      `INSERT INTO visitas_tecnicas (numero, cliente_id, fecha_visita) VALUES ('VT-TEST-AGENDA', $1, CURRENT_DATE) RETURNING id`, [clienteId]);
    await T.sincronizarTareaVisita(db, vt.id);
    const { rows: [{ tarea_id }] } = await db.query(`SELECT tarea_id FROM visitas_tecnicas WHERE id = $1`, [vt.id]);
    expect((await deHoy(tarea_id))).toBeDefined();
    const { rows: [{ pasado }] } = await db.query(`SELECT (CURRENT_DATE + 2)::text AS pasado`);
    await req('PATCH', '/agenda/reprogramar', { tarea_ids: [tarea_id], fecha: pasado });
    const { rows: [v] } = await db.query(`SELECT fecha_visita::text AS f FROM visitas_tecnicas WHERE id = $1`, [vt.id]);
    expect(v.f).toBe(pasado);
    await db.query(`UPDATE visitas_tecnicas SET estado = 'relevada' WHERE id = $1`, [vt.id]);
    await T.sincronizarTareaVisita(db, vt.id);
    const { rows: [t] } = await db.query(`SELECT completada FROM tareas WHERE id = $1`, [tarea_id]);
    expect(t.completada).toBe(true);
  });

  it('recotizar: una sola pendiente por proforma aunque el cliente pida cambios dos veces', async () => {
    const { rows: [{ f }] } = await db.query(`SELECT (CURRENT_DATE + 2)::text AS f`);
    const a = await T.agendarRecotizacion(db, { operacionId: operacionId, fecha: f, nota: 'Cambiar color', usuarioId: null, prioridad: 'alta' });
    const b = await T.agendarRecotizacion(db, { operacionId: operacionId, fecha: f, nota: 'Y el vidrio', usuarioId: null });
    expect(a!.creada).toBe(true);
    expect(b).toEqual({ id: a!.id, creada: false });
    const { rows } = await db.query(
      `SELECT notas, prioridad FROM tareas WHERE operacion_id = $1 AND tipo_accion = 'recotizar' AND NOT completada`, [operacionId]);
    expect(rows).toEqual([{ notas: 'Y el vidrio', prioridad: 'alta' }]);
    expect((await req('GET', `/agenda/recotizar/${operacionId}`)).json).toMatchObject({ id: a!.id, tipo_accion: 'recotizar' });
    // Sin proforma no se puede
    await expect(db.query(`INSERT INTO tareas (cliente_id, descripcion, tipo_accion) VALUES ($1, $2, 'recotizar')`, [clienteId, MARCA]))
      .rejects.toThrow(/tareas_recotizar_proforma_check/);
  });

  it('tarea interna: sin cliente, con categoría; la de cliente no puede ser interna', async () => {
    const { rows: [{ f }] } = await db.query(`SELECT CURRENT_DATE::text AS f`);
    const r = await req('POST', '/agenda/tareas', { descripcion: `${MARCA} comprar burletes`, vencimiento: f, categoria: 'compras' });
    expect(r.status).toBe(201);
    const t = await deHoy(r.json.id);
    expect(t).toMatchObject({ ambito: 'interna', categoria: 'compras', cliente_id: null });
    await expect(db.query(`INSERT INTO tareas (cliente_id, descripcion, ambito, categoria) VALUES ($1, $2, 'interna', 'otro')`, [clienteId, MARCA]))
      .rejects.toThrow(/tareas_ambito_cliente_check/);
    // El rol consulta no crea tareas
    usuarioActual = { id: u2, rol: 'consulta' };
    expect((await req('POST', '/agenda/tareas', { descripcion: `${MARCA} x`, vencimiento: f, categoria: 'otro' })).status).toBe(403);
    usuarioActual = { id: u1, rol: 'admin' };
  });

  it('tarea mensual: al completarla se crea la siguiente una sola vez; reabrirla la quita', async () => {
    const { rows: [{ f }] } = await db.query(`SELECT CURRENT_DATE::text AS f`);
    const { json: { id } } = await req('POST', '/agenda/tareas', {
      descripcion: `${MARCA} pagar alquiler`, vencimiento: f, categoria: 'pagos', repetir: 'mensual' });
    await Promise.all([T.completarTarea(db, id, true, u1), T.completarTarea(db, id, true, u1)]);
    const siguientes = async () => (await db.query(`SELECT vencimiento::text AS v, repetir FROM tareas WHERE tarea_anterior_id = $1`, [id])).rows;
    const esperado = siguienteFecha(f, f, 'mensual', null, Number(f.slice(8, 10)));
    expect(await siguientes()).toEqual([{ v: esperado, repetir: 'mensual' }]);
    await T.completarTarea(db, id, false, u1);
    expect(await siguientes()).toEqual([]);
  });

  it('las tareas internas no rompen el CRM, el dashboard ni la agenda comercial', async () => {
    expect((await req('GET', '/crm/tablero')).status).toBe(200);
    expect((await req('GET', '/dashboard/resumen')).status).toBe(200);
    const todo = (await req('GET', '/tareas/agenda')).json;
    const comercial = (await req('GET', '/tareas/agenda?ambito=cliente')).json;
    const internas = (x: { hoy: { ambito: string }[] }) => x.hoy.filter(t => t.ambito === 'interna').length;
    expect(internas(todo)).toBeGreaterThan(0);
    expect(internas(comercial)).toBe(0);
    for (const vista of ['proximas', 'internas', 'hechas']) {
      expect((await req('GET', `/agenda/tareas?vista=${vista}`)).status).toBe(200);
    }
  });
});
