import type { Context, Next } from 'hono';

interface Bucket { count: number; resetAt: number }

const store = new Map<string, Bucket>();

// Limpiar entradas expiradas cada 5 minutos
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of store) {
    if (bucket.resetAt < now) store.delete(key);
  }
}, 5 * 60 * 1000);

function getIp(c: Context): string {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  );
}

/**
 * Rate limiter de ventana fija.
 * @param max   Requests permitidos en la ventana
 * @param windowMs  Duración de la ventana en ms
 * @param keyPrefix  Prefijo para separar distintos límites
 */
export function rateLimit(max: number, windowMs: number, keyPrefix: string) {
  return async (c: Context, next: Next) => {
    const ip  = getIp(c);
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    let bucket = store.get(key);
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs };
      store.set(key, bucket);
    }

    bucket.count++;

    const remaining = Math.max(0, max - bucket.count);
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

    c.header('X-RateLimit-Limit',     String(max));
    c.header('X-RateLimit-Remaining', String(remaining));
    c.header('X-RateLimit-Reset',     String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > max) {
      c.header('Retry-After', String(retryAfter));
      return c.json(
        { error: 'Demasiadas solicitudes. Intentá de nuevo en unos segundos.' },
        429,
      );
    }

    await next();
  };
}
