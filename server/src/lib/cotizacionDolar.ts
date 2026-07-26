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
