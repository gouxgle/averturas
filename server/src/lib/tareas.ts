import { db } from '../db.js';
import { sincronizarDesdeTarea } from './oportunidades.js';

type Queryable = { query: typeof db.query };

// Lógica compartida de la agenda (`tareas`): completar (con repetición), tarea espejo de las
// visitas técnicas y recotizaciones. Las rutas /tareas, /crm y /agenda pasan todas por acá
// para que completar una tarea haga lo mismo desde cualquier pantalla.

export type Repetir = 'semanal' | 'mensual' | 'dias';

const diaUTC = (s: string) => new Date(`${s}T00:00:00Z`);
const txt = (d: Date) => d.toISOString().slice(0, 10);
const diasDelMes = (anio: number, mes: number) => new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();

/** Un paso de repetición desde `fecha` (YYYY-MM-DD). Mensual: día `diaMes`, o el último si el mes es corto. */
export function pasoRepeticion(fecha: string, repetir: Repetir, cadaDias: number | null, diaMes: number | null): string {
  const d = diaUTC(fecha);
  if (repetir === 'semanal') { d.setUTCDate(d.getUTCDate() + 7); return txt(d); }
  if (repetir === 'dias') { d.setUTCDate(d.getUTCDate() + Math.max(1, cadaDias ?? 1)); return txt(d); }
  const anio = d.getUTCFullYear() + (d.getUTCMonth() === 11 ? 1 : 0);
  const mes = (d.getUTCMonth() + 1) % 12;
  const dia = Math.min(diaMes ?? d.getUTCDate(), diasDelMes(anio, mes));
  return txt(new Date(Date.UTC(anio, mes, dia)));
}

/**
 * Próxima fecha de una tarea repetitiva al completarla: avanza desde su vencimiento (no desde
 * hoy, así "el 10 de cada mes" sigue siendo el 10) y, si se completó con atraso, saltea las
 * ocurrencias que ya pasaron: la siguiente siempre cae después de hoy.
 */
export function siguienteFecha(vencimiento: string, hoy: string, repetir: Repetir, cadaDias: number | null, diaMes: number | null): string {
  let f = pasoRepeticion(vencimiento, repetir, cadaDias, diaMes);
  for (let i = 0; f <= hoy && i < 1000; i++) f = pasoRepeticion(f, repetir, cadaDias, diaMes);
  return f;
}

/**
 * Marca una tarea hecha (o la reabre) y aplica los efectos: limpia la respuesta del cliente
 * de la proforma, sincroniza la oportunidad espejo, borra los recordatorios y, si se repite,
 * crea la siguiente (una sola vez aunque se complete dos veces: índice único por
 * tarea_anterior_id). Reabrir borra la siguiente si todavía nadie la completó.
 */
export async function completarTarea(q: Queryable, id: string, completada: boolean, usuarioId: string | null) {
  const { rows: [row] } = await q.query(`
    UPDATE tareas SET
      completada    = $1,
      completada_at = CASE WHEN $1 THEN COALESCE(completada_at, now()) ELSE NULL END,
      completada_by = CASE WHEN $1 THEN COALESCE(completada_by, $3) ELSE NULL END
    WHERE id = $2
    RETURNING *, vencimiento::text AS vencimiento_txt`, [completada, id, usuarioId]);
  if (!row) return null;

  if (completada) {
    await q.query('DELETE FROM tarea_recordatorios WHERE tarea_id = $1', [id]);
    // Completar la tarea de seguimiento cierra también el badge de "respuesta pendiente"
    if (row.operacion_id) {
      await q.query(
        `UPDATE operaciones SET respuesta_cliente = NULL, respuesta_cliente_at = NULL
          WHERE id = $1 AND respuesta_cliente IS NOT NULL`, [row.operacion_id]);
    }
    if (row.repetir && row.vencimiento_txt) {
      const { rows: [{ hoy }] } = await q.query(`SELECT CURRENT_DATE::text AS hoy`);
      const prox = siguienteFecha(row.vencimiento_txt, hoy, row.repetir, row.repetir_cada_dias, row.repetir_dia_mes);
      await q.query(`
        INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, hora, created_by,
                            ambito, categoria, proveedor_id, notas, repetir, repetir_cada_dias, repetir_dia_mes, tarea_anterior_id)
        SELECT cliente_id, operacion_id, descripcion, $2::date, prioridad, tipo_accion, hora, created_by,
               ambito, categoria, proveedor_id, notas, repetir, repetir_cada_dias, repetir_dia_mes, id
          FROM tareas WHERE id = $1
        ON CONFLICT (tarea_anterior_id) WHERE tarea_anterior_id IS NOT NULL DO NOTHING`, [id, prox]);
    }
  } else if (row.repetir) {
    await q.query('DELETE FROM tareas WHERE tarea_anterior_id = $1 AND NOT completada', [id]);
  }

  if (row.tipo_accion === 'oportunidad') await sincronizarDesdeTarea(q, row.id, completada);
  delete row.vencimiento_txt;
  return row;
}

// ── Visitas técnicas ────────────────────────────────────────────

/**
 * Tarea espejo de la visita de relevamiento (mismo patrón que las entregas en
 * lib/remitos.ts): pendiente con fecha → tarea en la agenda; relevada, convertida o
 * cancelada → tarea completada (queda de historial); sin fecha → se quita de la agenda.
 * Solo reabre la tarea si cambió la fecha: guardar la visita sin moverla no "deshace" un
 * Hecho marcado desde la agenda.
 */
export async function sincronizarTareaVisita(q: Queryable, visitaId: string): Promise<void> {
  const { rows: [v] } = await q.query(
    `SELECT id, numero, cliente_id, operacion_id, tarea_id, fecha_visita::text AS fecha, tecnico, estado, created_by
       FROM visitas_tecnicas WHERE id = $1`, [visitaId]);
  if (!v) return;

  if (v.estado !== 'pendiente') {
    if (v.tarea_id) {
      await q.query(
        `UPDATE tareas SET completada = true, completada_at = COALESCE(completada_at, now()) WHERE id = $1`, [v.tarea_id]);
    }
    return;
  }
  if (!v.fecha) {
    if (v.tarea_id) await q.query('DELETE FROM tareas WHERE id = $1 AND NOT completada', [v.tarea_id]);
    return;
  }

  const descripcion = `Visita de relevamiento ${v.numero}${v.tecnico ? ` — ${v.tecnico}` : ''}`;
  if (v.tarea_id) {
    const { rowCount } = await q.query(`
      UPDATE tareas SET
        descripcion = $1, vencimiento = $2::date,
        completada = CASE WHEN vencimiento IS DISTINCT FROM $2::date THEN false ELSE completada END,
        completada_at = CASE WHEN vencimiento IS DISTINCT FROM $2::date THEN NULL ELSE completada_at END
      WHERE id = $3`, [descripcion, v.fecha, v.tarea_id]);
    if (rowCount) return;
  }
  const { rows: [t] } = await q.query(`
    INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, created_by)
    VALUES ($1, $2, $3, $4, 'normal', 'visita', $5) RETURNING id`,
    [v.cliente_id, v.operacion_id, descripcion, v.fecha, v.created_by]);
  await q.query('UPDATE visitas_tecnicas SET tarea_id = $1 WHERE id = $2', [t.id, visitaId]);
}

// ── Recotizar ───────────────────────────────────────────────────

/**
 * Agenda la revisión de una proforma para adecuarla a lo que pidió el cliente. Hay una sola
 * recotización pendiente por proforma: si ya existe, se actualizan su fecha, hora y nota
 * (y se le borran los recordatorios para que vuelva a avisar) en vez de crear otra.
 */
export async function agendarRecotizacion(q: Queryable, p: {
  operacionId: string; fecha: string; hora?: string | null; nota?: string | null;
  descripcion?: string; prioridad?: 'alta' | 'normal' | 'baja'; usuarioId: string | null;
}): Promise<{ id: string; creada: boolean } | null> {
  const { rows: [op] } = await q.query('SELECT id, numero, cliente_id FROM operaciones WHERE id = $1', [p.operacionId]);
  if (!op) return null;
  const descripcion = p.descripcion ?? `Recotizar proforma ${op.numero}`;

  const { rows: [existente] } = await q.query(
    `SELECT id FROM tareas WHERE operacion_id = $1 AND tipo_accion = 'recotizar' AND NOT completada FOR UPDATE`, [op.id]);
  if (existente) {
    await q.query(`
      UPDATE tareas SET vencimiento = $2::date, hora = $3::time,
        notas = COALESCE($4, notas), descripcion = $5,
        prioridad = COALESCE($6, prioridad)
      WHERE id = $1`, [existente.id, p.fecha, p.hora || null, p.nota || null, descripcion, p.prioridad ?? null]);
    await q.query('DELETE FROM tarea_recordatorios WHERE tarea_id = $1', [existente.id]);
    return { id: existente.id, creada: false };
  }
  const { rows: [t] } = await q.query(`
    INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion, hora, notas, created_by)
    VALUES ($1, $2, $3, $4::date, $5, 'recotizar', $6::time, $7, $8)
    ON CONFLICT (operacion_id) WHERE tipo_accion = 'recotizar' AND NOT completada DO NOTHING
    RETURNING id`,
    [op.cliente_id, op.id, descripcion, p.fecha, p.prioridad ?? 'normal', p.hora || null, p.nota || null, p.usuarioId]);
  if (!t) {
    // Otra petición la creó en el medio: se actualiza esa.
    return agendarRecotizacion(q, p);
  }
  return { id: t.id, creada: true };
}
