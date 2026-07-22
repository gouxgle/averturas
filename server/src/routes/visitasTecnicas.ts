import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '../db.js';

const visitasTecnicas = new Hono();

async function nextNumero(): Promise<string> {
  const ym = new Date().toISOString().slice(0, 7).replace('-', '');
  const { rows } = await db.query(
    `SELECT COALESCE(MAX(SUBSTRING(numero FROM '(\\d+)$')::int), 0) AS n FROM visitas_tecnicas WHERE numero LIKE $1`,
    [`VT-${ym}-%`]
  );
  const n = Number((rows[0] as { n: number }).n) + 1;
  return `VT-${ym}-${String(n).padStart(4, '0')}`;
}

const WITH_CLIENTE = `
  SELECT vt.*,
    json_build_object(
      'id', c.id, 'nombre', c.nombre, 'apellido', c.apellido,
      'razon_social', c.razon_social, 'tipo_persona', c.tipo_persona,
      'telefono', c.telefono, 'direccion', c.direccion, 'localidad', c.localidad
    ) AS cliente,
    (SELECT COUNT(*)::int FROM visita_tecnica_items vti WHERE vti.visita_tecnica_id = vt.id) AS items_total
  FROM visitas_tecnicas vt
  JOIN clientes c ON c.id = vt.cliente_id
`;

// GET / — listado, filtro opcional por estado
visitasTecnicas.get('/', async (c) => {
  const estado = c.req.query('estado');
  const params: unknown[] = [];
  let where = '';
  if (estado) {
    params.push(estado);
    where = `WHERE vt.estado = $${params.length}`;
  }
  const { rows } = await db.query(
    `${WITH_CLIENTE} ${where} ORDER BY vt.created_at DESC LIMIT 200`,
    params
  );
  return c.json(rows);
});

// POST /upload-imagen — foto de referencia del relevamiento (registrar antes de /:id)
visitasTecnicas.post('/upload-imagen', async (c) => {
  const body = await c.req.formData();
  const file = body.get('imagen') as File | null;
  if (!file || !file.size) return c.json({ error: 'No se recibió imagen' }, 400);

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const allowed = ['jpg', 'jpeg', 'png', 'webp'];
  if (!allowed.includes(ext)) return c.json({ error: 'Formato no permitido' }, 400);

  const filename = `${randomUUID()}.webp`;
  const dir = './uploads/visitas-tecnicas';
  await mkdir(dir, { recursive: true });

  const optimizado = await sharp(Buffer.from(await file.arrayBuffer()))
    .rotate()
    .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  await writeFile(`${dir}/${filename}`, optimizado);

  return c.json({ url: `/uploads/visitas-tecnicas/${filename}` });
});

// GET /:id — detalle + ítems
visitasTecnicas.get('/:id', async (c) => {
  const { id } = c.req.param();
  const [{ rows: [visita] }, { rows: items }] = await Promise.all([
    db.query(`${WITH_CLIENTE} WHERE vt.id = $1`, [id]),
    db.query(
      `SELECT * FROM visita_tecnica_items WHERE visita_tecnica_id = $1 ORDER BY orden`,
      [id]
    ),
  ]);
  if (!visita) return c.json({ error: 'Visita técnica no encontrada' }, 404);
  return c.json({ ...visita, items });
});

// POST / — crea la visita (solo cliente_id, se completa después con lo relevado)
visitasTecnicas.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json();

  if (!body.cliente_id) {
    return c.json({ error: 'cliente_id es requerido' }, 400);
  }

  const numero = await nextNumero();
  const { rows: [row] } = await db.query(`
    INSERT INTO visitas_tecnicas (numero, cliente_id, created_by)
    VALUES ($1, $2, $3)
    RETURNING *
  `, [numero, body.cliente_id, user?.id || null]);

  return c.json(row, 201);
});

// PUT /:id — carga de datos relevados en el sitio (fecha, técnico, detalles, ítems)
visitasTecnicas.put('/:id', async (c) => {
  const { id } = c.req.param();
  const body = await c.req.json();

  const { rows: [actual] } = await db.query(`SELECT estado FROM visitas_tecnicas WHERE id=$1`, [id]);
  if (!actual) return c.json({ error: 'Visita técnica no encontrada' }, 404);
  if (actual.estado === 'convertida') {
    return c.json({ error: 'Ya se generó un presupuesto a partir de esta visita' }, 409);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  const estadoNuevo = items.length > 0 ? 'relevada' : actual.estado;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [visita] } = await client.query(`
      UPDATE visitas_tecnicas SET
        fecha_visita      = $1,
        tecnico           = $2,
        color             = $3,
        vidrio            = $4,
        instalacion       = $5,
        abertura_especial = $6,
        observaciones     = $7,
        estado            = $8,
        imagenes          = $9,
        updated_at        = now()
      WHERE id = $10
      RETURNING *
    `, [
      body.fecha_visita || null,
      body.tecnico?.trim() || null,
      body.color ?? [],
      body.vidrio ?? [],
      body.instalacion ?? [],
      body.abertura_especial ?? [],
      body.observaciones?.trim() || null,
      estadoNuevo,
      Array.isArray(body.imagenes) ? body.imagenes : [],
      id,
    ]);

    await client.query(`DELETE FROM visita_tecnica_items WHERE visita_tecnica_id = $1`, [id]);
    for (const [idx, item] of items.entries()) {
      await client.query(`
        INSERT INTO visita_tecnica_items (visita_tecnica_id, orden, ambiente, descripcion, ancho_mm, alto_mm)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        id, idx,
        item.ambiente?.trim() || null,
        item.descripcion?.trim() || null,
        item.ancho_mm || null,
        item.alto_mm || null,
      ]);
    }

    await client.query('COMMIT');
    const { rows: [full] } = await db.query(`${WITH_CLIENTE} WHERE vt.id = $1`, [id]);
    return c.json(full);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// DELETE /:id — solo si no derivó ya en un presupuesto
visitasTecnicas.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [visita] } = await db.query(`SELECT estado FROM visitas_tecnicas WHERE id=$1`, [id]);
  if (!visita) return c.json({ error: 'No encontrada' }, 404);
  if (visita.estado === 'convertida') {
    return c.json({ error: 'No se puede eliminar: ya generó un presupuesto' }, 409);
  }
  await db.query('DELETE FROM visitas_tecnicas WHERE id = $1', [id]);
  return c.json({ ok: true });
});

export default visitasTecnicas;
