import { Hono } from 'hono';
import { db } from '../db.js';

const empresa = new Hono();

// Always work with the first row (singleton)
empresa.get('/', async (c) => {
  const { rows } = await db.query(`SELECT * FROM empresa ORDER BY updated_at DESC LIMIT 1`);
  return c.json(rows[0] ?? null);
});

// PUT parcial: solo se actualizan las columnas que vienen en el body. Antes pisaba
// todas con lo recibido, y Reportes (que solo manda el objetivo de ventas) dejaba la
// empresa como "Mi Empresa" sin CUIT, teléfono, email ni dirección; el panel de
// Configuración, a su vez, borraba logo_url y el objetivo porque no los manda.
const CAMPOS_TEXTO = ['nombre', 'cuit', 'telefono', 'email', 'direccion', 'logo_url', 'instagram', 'terminos_url'] as const;
const CAMPOS_NUMERO = ['objetivo_ventas_mensual', 'costo_visita_tecnica'] as const;

empresa.put('/', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== 'object') return c.json({ error: 'Body inválido' }, 400);

  const cols: string[] = [];
  const vals: unknown[] = [];
  for (const campo of CAMPOS_TEXTO) {
    if (!(campo in body)) continue;
    const v = typeof body[campo] === 'string' ? body[campo].trim() : body[campo];
    if (campo === 'nombre' && !v) return c.json({ error: 'nombre requerido' }, 400);
    cols.push(campo); vals.push(v || null);
  }
  for (const campo of CAMPOS_NUMERO) {
    if (!(campo in body)) continue;
    const v = body[campo];
    // Vacío = no tocar (el panel manda '' cuando el costo de visita queda en blanco).
    if (v === '' || v === null || v === undefined) continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!Number.isFinite(n) || n < 0) return c.json({ error: `${campo} inválido` }, 400);
    cols.push(campo); vals.push(n);
  }

  const { rows: existing } = await db.query(`SELECT id FROM empresa ORDER BY updated_at DESC LIMIT 1`);

  if (existing[0]) {
    if (cols.length === 0) {
      const { rows } = await db.query(`SELECT * FROM empresa WHERE id = $1`, [existing[0].id]);
      return c.json(rows[0]);
    }
    const sets = cols.map((col, i) => `${col} = $${i + 1}`).join(', ');
    const { rows } = await db.query(
      `UPDATE empresa SET ${sets}, updated_at = now() WHERE id = $${cols.length + 1} RETURNING *`,
      [...vals, existing[0].id]
    );
    return c.json(rows[0]);
  }

  if (!cols.includes('nombre')) return c.json({ error: 'nombre requerido' }, 400);
  const { rows } = await db.query(
    `INSERT INTO empresa (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING *`,
    vals
  );
  return c.json(rows[0]);
});

export default empresa;
