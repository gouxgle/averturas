import { db } from '../db.js';
import { nombreItem } from './nombreItem.js';

type Queryable = { query: typeof db.query };

// Seguimiento post venta: a los N días de una entrega se contacta al cliente por WhatsApp para pedirle su
// opinión. El seguimiento es la fuente de verdad; la tarea de la agenda es su proyección (mismo patrón que
// las oportunidades). Nada corre solo: el operador revisa el mensaje y lo manda con un clic.

const PRIORIDAD = 'normal';

/**
 * Crea el seguimiento de la operación entregada (uno solo por operación: una entrega parcial no lo duplica)
 * con su tarea en la agenda. No hace nada si el cliente no tiene teléfono (no hay a quién escribirle), si es un
 * consumidor sin cliente o si ya hay uno vigente. Se llama dentro de la transacción que entrega.
 */
export async function crearSeguimientoPorEntrega(q: Queryable, remitoId: string): Promise<string | null> {
  // Es accesorio: si algo falla, la entrega no puede fallar con él (savepoint dentro de la transacción de la entrega)
  try {
    await q.query('SAVEPOINT postventa');
    const id = await crearSeguimiento(q, remitoId);
    await q.query('RELEASE SAVEPOINT postventa');
    return id;
  } catch (e) {
    await q.query('ROLLBACK TO SAVEPOINT postventa').catch(() => {});
    console.error('[postventa] no se pudo crear el seguimiento', e);
    return null;
  }
}

async function crearSeguimiento(q: Queryable, remitoId: string): Promise<string | null> {
  const { rows: [r] } = await q.query(`
    SELECT rm.id, rm.operacion_id, rm.cliente_id, COALESCE(rm.fecha_entrega_real, CURRENT_DATE)::text AS entrega,
           cl.telefono, cl.acepta_marketing
      FROM remitos rm JOIN clientes cl ON cl.id = rm.cliente_id
     WHERE rm.id = $1`, [remitoId]);
  if (!r || !r.operacion_id || !r.cliente_id) return null;
  if (!r.telefono?.trim()) return null;
  const { rows: [ya] } = await q.query(
    `SELECT 1 AS si FROM postventa_seguimientos WHERE operacion_id = $1 AND estado <> 'descartado'`, [r.operacion_id]);
  if (ya) return null;
  const { rows: [emp] } = await q.query(`SELECT postventa_dias FROM empresa ORDER BY updated_at DESC LIMIT 1`);
  const dias = Number(emp?.postventa_dias ?? 3);

  const { rows: [s] } = await q.query(`
    INSERT INTO postventa_seguimientos (cliente_id, operacion_id, remito_id, fecha_entrega, fecha_contacto)
    VALUES ($1, $2, $3, $4::date, $4::date + $5::int)
    ON CONFLICT (operacion_id) WHERE estado <> 'descartado' DO NOTHING
    RETURNING id, fecha_contacto::text AS fecha_contacto`,
    [r.cliente_id, r.operacion_id, r.id, r.entrega, dias]);
  if (!s) return null;
  const { rows: [t] } = await q.query(`
    INSERT INTO tareas (cliente_id, operacion_id, descripcion, vencimiento, prioridad, tipo_accion)
    VALUES ($1, $2, $3, $4::date, $5, 'postventa') RETURNING id`,
    [r.cliente_id, r.operacion_id, 'Post venta — consultar si quedó conforme', s.fecha_contacto, PRIORIDAD]);
  await q.query(`UPDATE postventa_seguimientos SET tarea_id = $2 WHERE id = $1`, [s.id, t.id]);
  return s.id as string;
}

/** La operación se canceló (o el remito dejó de estar entregado): ya no hay nada que preguntar. */
export async function descartarSeguimientoDeOperacion(q: Queryable, operacionId: string, motivo: string): Promise<void> {
  const { rows } = await q.query(`
    UPDATE postventa_seguimientos SET estado = 'descartado', motivo_descarte = $2, updated_at = now()
     WHERE operacion_id = $1 AND estado IN ('pendiente', 'enviado') RETURNING tarea_id`, [operacionId, motivo]);
  for (const r of rows) {
    if (r.tarea_id) await q.query(`UPDATE tareas SET completada = true, completada_at = COALESCE(completada_at, now()) WHERE id = $1`, [r.tarea_id]);
  }
}

/** Cierra la tarea de la agenda de un seguimiento (queda de historial, no se borra). */
export async function completarTareaDeSeguimiento(q: Queryable, seguimientoId: string): Promise<void> {
  await q.query(
    `UPDATE tareas SET completada = true, completada_at = COALESCE(completada_at, now())
      WHERE id = (SELECT tarea_id FROM postventa_seguimientos WHERE id = $1)`, [seguimientoId]);
}

/** Alguien completó la tarea desde la agenda: se toma como contacto hecho fuera del sistema. */
export async function sincronizarSeguimientoDesdeTarea(q: Queryable, tareaId: string, completada: boolean): Promise<void> {
  if (completada) {
    await q.query(
      `UPDATE postventa_seguimientos SET estado = 'enviado', enviado_at = COALESCE(enviado_at, now()), updated_at = now()
        WHERE tarea_id = $1 AND estado = 'pendiente'`, [tareaId]);
  }
}

/** Qué se entregó, en una frase: "una ventana, una puerta" (hasta 3, el resto se resume). */
export async function resumenProductos(q: Queryable, operacionId: string): Promise<string> {
  const { rows } = await q.query(`
    SELECT oi.descripcion, cp.codigo, ta.nombre AS tipo
      FROM operacion_items oi
      LEFT JOIN catalogo_productos cp ON cp.id = oi.producto_id
      LEFT JOIN tipos_abertura ta ON ta.id = oi.tipo_abertura_id
     WHERE oi.operacion_id = $1 AND COALESCE(oi.tipo_item, 'estandar') <> 'servicio'
     ORDER BY oi.orden, oi.id`, [operacionId]);
  const nombres = [...new Set(rows.map(r => nombreItem(r.descripcion, r.codigo, r.tipo).toLowerCase()))];
  if (!nombres.length) return 'tu pedido';
  if (nombres.length <= 3) return nombres.join(', ');
  return `${nombres.slice(0, 3).join(', ')} y ${nombres.length - 3} producto${nombres.length - 3 !== 1 ? 's' : ''} más`;
}

export const PLANTILLA_DEFECTO =
  'Hola {{nombre}}, soy de {{empresa}}. Hace unos días te entregamos {{productos}} y queríamos saber cómo te fue: ¿quedaste conforme con el producto y con la atención?\n\nTe pedimos un minuto para contarnos tu opinión acá: {{link}}\n\n¡Muchas gracias!';

/** Reemplaza las variables {{x}} de la plantilla. */
export function armarMensajePostventa(plantilla: string, v: { nombre: string; productos: string; empresa: string; link: string }): string {
  return plantilla
    .replace(/\{\{nombre\}\}/g, v.nombre)
    .replace(/\{\{productos\}\}/g, v.productos)
    .replace(/\{\{empresa\}\}/g, v.empresa)
    .replace(/\{\{link\}\}/g, v.link);
}

/** Nombre de pila para saludar: el nombre de la persona o la razón social. */
export function nombreParaSaludo(c: { tipo_persona?: string | null; nombre?: string | null; razon_social?: string | null }): string {
  return c.tipo_persona === 'juridica' ? (c.razon_social ?? c.nombre ?? '') : (c.nombre ?? c.razon_social ?? '');
}
