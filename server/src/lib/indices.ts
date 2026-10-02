import { db } from '../db.js';
import { registrarCotizacionDelDia, completarHistorialDolar } from './cotizacionDolar.js';

// Índices económicos de referencia para la revisión de precios: dólar blue diario e inflación
// mensual (IPC INDEC). Se actualizan solos al arrancar y cada 6 horas; si la fuente no
// responde, se reintenta en la próxima vuelta (nunca rompe nada: son datos de consulta).

/** Inflación mensual desde api.argentinadatos.com (variación % del IPC). */
export async function actualizarIpc(): Promise<number> {
  const resp = await fetch('https://api.argentinadatos.com/v1/finanzas/indices/inflacion', { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) throw new Error(`argentinadatos respondió ${resp.status}`);
  const filas = ((await resp.json()) as { fecha: string; valor: number }[])
    .filter(f => /^\d{4}-\d{2}-\d{2}$/.test(f.fecha) && f.fecha >= '2015-01-01' && Number.isFinite(f.valor));
  if (!filas.length) return 0;
  const { rowCount } = await db.query(
    `INSERT INTO indice_ipc (mes, variacion)
     SELECT * FROM unnest($1::date[], $2::numeric[])
     ON CONFLICT (mes) DO UPDATE SET variacion = EXCLUDED.variacion, updated_at = now()
       WHERE indice_ipc.variacion IS DISTINCT FROM EXCLUDED.variacion`,
    [filas.map(f => f.fecha), filas.map(f => f.valor)]);
  return rowCount ?? 0;
}

async function actualizarTodo() {
  await registrarCotizacionDelDia().catch(e => console.error('[indices] dólar del día:', e.message));
  await completarHistorialDolar().catch(e => console.error('[indices] historial del dólar:', e.message));
  await actualizarIpc().catch(e => console.error('[indices] IPC:', e.message));
}

let iniciado = false;
export function iniciarIndicesEconomicos() {
  if (iniciado || process.env.NODE_ENV === 'test') return;
  iniciado = true;
  setTimeout(() => { actualizarTodo(); }, 20_000).unref();
  setInterval(() => { actualizarTodo(); }, 6 * 3600_000).unref();
}
