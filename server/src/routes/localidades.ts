import { Hono } from 'hono';
import { db } from '../db.js';
import { z } from 'zod';

const localidades = new Hono();

const LocalidadSchema = z.object({
  nombre: z.string().min(1).max(200),
  activo: z.boolean().optional().default(true),
  orden:  z.number().int().min(0).optional().default(0),
});

// GET / — lista todas ordenadas
localidades.get('/', async (c) => {
  const { rows } = await db.query(
    `SELECT id, nombre, activo, orden FROM localidades ORDER BY orden, nombre`
  );
  return c.json(rows);
});

// POST / — crear
localidades.post('/', async (c) => {
  const body = await c.req.json();
  const b = LocalidadSchema.parse(body);
  const { rows: [row] } = await db.query(
    `INSERT INTO localidades (nombre, activo, orden)
     VALUES ($1, $2, $3) RETURNING *`,
    [b.nombre.trim(), b.activo, b.orden]
  );
  return c.json(row, 201);
});

// PATCH /:id — editar nombre / activo / orden
localidades.patch('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();
  const b = LocalidadSchema.partial().parse(body);

  const sets: string[] = [];
  const vals: unknown[] = [];
  let n = 1;
  if (b.nombre !== undefined) { sets.push(`nombre=$${n++}`); vals.push(b.nombre.trim()); }
  if (b.activo !== undefined) { sets.push(`activo=$${n++}`); vals.push(b.activo); }
  if (b.orden  !== undefined) { sets.push(`orden=$${n++}`);  vals.push(b.orden); }
  if (!sets.length) return c.json({ error: 'Sin campos' }, 400);

  vals.push(id);
  const { rows: [row] } = await db.query(
    `UPDATE localidades SET ${sets.join(', ')} WHERE id=$${n} RETURNING *`,
    vals
  );
  if (!row) return c.json({ error: 'No encontrada' }, 404);
  return c.json(row);
});

// DELETE /:id — eliminar (solo si no usada)
localidades.delete('/:id', async (c) => {
  const { id } = c.req.param();
  // Verificar si está en uso en clientes
  const { rows } = await db.query(
    `SELECT id FROM clientes
     WHERE localidad = (SELECT nombre FROM localidades WHERE id=$1)
        OR dom_obra_localidad = (SELECT nombre FROM localidades WHERE id=$1)
        OR dom_alternativo_localidad = (SELECT nombre FROM localidades WHERE id=$1)
     LIMIT 1`,
    [id]
  );
  if (rows.length) return c.json({ error: 'Localidad en uso por clientes' }, 409);

  const { rowCount } = await db.query(`DELETE FROM localidades WHERE id=$1`, [id]);
  if (!rowCount) return c.json({ error: 'No encontrada' }, 404);
  return c.json({ ok: true });
});

export default localidades;
