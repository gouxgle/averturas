import type { Context } from 'hono';
import { db } from '../db.js';

export type EntidadActividad = 'presupuesto' | 'recibo' | 'remito';

interface RegistroActividad {
  entidad: EntidadActividad;
  entidad_id?: string | null;
  entidad_numero?: string | null;
  accion: string;
  detalle?: string | null;
  meta?: unknown;
}

/**
 * Deja constancia de una acción de un operador en `actividad_log`.
 *
 * Fire-and-forget: NO se debe `await` dentro de una transacción ni dejar que su
 * error rompa la request — si el log falla, la operación real ya se hizo igual.
 * Toma el usuario del contexto de auth (`c.get('user')`).
 */
export function registrarActividad(c: Context, r: RegistroActividad): void {
  const user = c.get('user') as { id?: string; nombre?: string } | undefined;
  db.query(
    `INSERT INTO actividad_log
       (usuario_id, usuario_nombre, entidad, entidad_id, entidad_numero, accion, detalle, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      user?.id || null,
      user?.nombre || null,
      r.entidad,
      r.entidad_id || null,
      r.entidad_numero || null,
      r.accion,
      r.detalle || null,
      r.meta != null ? JSON.stringify(r.meta) : null,
    ]
  ).catch(err => console.error('[actividad_log] no se pudo registrar:', err));
}
