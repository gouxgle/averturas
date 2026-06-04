import { z, ZodSchema } from 'zod';
import type { Context } from 'hono';

/**
 * Parsea y valida el body JSON de la request contra un schema Zod.
 * Devuelve los datos tipados o lanza una Response 400 con los errores.
 */
export async function validateBody<T>(
  c: Context,
  schema: ZodSchema<T>,
): Promise<T | Response> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: 'Body inválido — se esperaba JSON' }, 400) as unknown as Response;
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const errors = result.error.issues.map(i => ({
      campo: i.path.join('.'),
      mensaje: i.message,
    }));
    return c.json({ error: 'Datos inválidos', detalle: errors }, 400) as unknown as Response;
  }

  return result.data;
}

// ── Tipos comunes reutilizables ────────────────────────────────

export const zUUID   = z.string().uuid('ID inválido');
export const zEmail  = z.string().email('Email inválido').optional().nullable();
export const zPhone  = z.string().max(30).optional().nullable();
export const zText   = (max = 255) => z.string().max(max).optional().nullable();
export const zPosNum = z.number().nonnegative('Debe ser mayor o igual a 0');
export const zPct    = z.number().min(0).max(100).optional().nullable();
