import { db } from '../db.js';
// Cotización del dólar blue — usada para mostrar el precio de productos en U$S.
// Fuente: dolarapi.com (API pública gratuita, sin key). Cacheada en memoria para no
// golpear la API en cada request — el valor solo cambia unas pocas veces por día.

interface CotizacionDolar {
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

const CACHE_MS = 20 * 60 * 1000; // 20 minutos
let cache: { data: CotizacionDolar; obtenidoEn: number } | null = null;

export async function getCotizacionDolar(): Promise<CotizacionDolar | null> {
  if (cache && Date.now() - cache.obtenidoEn < CACHE_MS) {
    return cache.data;
  }
  try {
    const resp = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (!resp.ok) throw new Error(`dolarapi respondió ${resp.status}`);
    const data = await resp.json() as CotizacionDolar;
    cache = { data, obtenidoEn: Date.now() };
    return data;
  } catch (err) {
    console.error('[cotizacion-dolar] Error al consultar dolarapi.com:', err);
    // Si falla pero hay un valor viejo en caché, mejor devolver ese que nada
    return cache?.data ?? null;
  }
}

// ── Historial diario sin huecos ─────────────────────────────────
// Antes el historial se sembraba solo con el primer pedido del día (si nadie abría el sistema
// ese día quedaba un hueco). La revisión de precios compara el dólar del día en que se
// actualizó cada precio con el de hoy, así que hace falta la serie completa: se guarda el
// valor de hoy y se completan los días faltantes con el historial público de
// api.argentinadatos.com (la misma fuente que alimenta dolarapi.com).


/** Guarda la cotización de hoy (si todavía no está). */
export async function registrarCotizacionDelDia(): Promise<void> {
  const c = await getCotizacionDolar();
  if (!c) return;
  await db.query(
    `INSERT INTO cotizacion_dolar_historial (fecha, compra, venta) VALUES (CURRENT_DATE, $1, $2)
     ON CONFLICT (fecha) DO NOTHING`, [c.compra, c.venta]);
}

/** Completa los días faltantes de los últimos `dias` días (no pisa lo que ya hay). */
export async function completarHistorialDolar(dias = 400): Promise<number> {
  const resp = await fetch('https://api.argentinadatos.com/v1/cotizaciones/dolares/blue', { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) throw new Error(`argentinadatos respondió ${resp.status}`);
  const filas = (await resp.json()) as { fecha: string; compra: number; venta: number }[];
  const desde = new Date(Date.now() - dias * 86400_000).toISOString().slice(0, 10);
  const recientes = filas.filter(f => f.fecha >= desde && f.compra > 0 && f.venta > 0);
  if (!recientes.length) return 0;
  const { rowCount } = await db.query(
    `INSERT INTO cotizacion_dolar_historial (fecha, compra, venta)
     SELECT * FROM unnest($1::date[], $2::numeric[], $3::numeric[])
     ON CONFLICT (fecha) DO NOTHING`,
    [recientes.map(f => f.fecha), recientes.map(f => f.compra), recientes.map(f => f.venta)]);
  return rowCount ?? 0;
}
