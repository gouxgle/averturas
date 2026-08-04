import { Hono } from 'hono';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import {
  VisitaTecnicaCrearSchema, VisitaTecnicaSchema, VisitaTecnicaCobrarSchema,
  VisitaTecnicaBonificarSchema, VisitaTecnicaCostoExternoSchema,
} from '../lib/schemas.js';
import { nextNumeroRecibo, cerrarCompromisosSiSaldado } from './recibos.js';

const visitasTecnicas = new Hono();

type Queryable = { query: typeof db.query };

async function costoVisitaConfigurado(): Promise<number> {
  const { rows } = await db.query(
    `SELECT COALESCE(costo_visita_tecnica, 0)::numeric AS costo FROM empresa ORDER BY updated_at DESC LIMIT 1`
  );
  return Number(rows[0]?.costo ?? 0);
}

// Emite el recibo de una visita técnica. Nace SIN operacion_id: el presupuesto todavía
// no existe. Si después se bonifica, se le setea operacion_id y pasa a contar como
// monto cobrado de esa operación (ver POST /:id/bonificar).
async function emitirReciboVisita(
  client: Queryable,
  visita: { id: string; numero: string; cliente_id: string },
  costo: number,
  pago: { forma_pago: string; referencia_pago?: string | null },
  userId: string | null
): Promise<{ id: string; numero: string; monto_total: number }> {
  const numero = await nextNumeroRecibo(client);
  const { rows: [rec] } = await client.query(`
    INSERT INTO recibos (numero, cliente_id, operacion_id, monto_total, forma_pago,
                         referencia_pago, concepto, monto_lista, monto_descuento, descuento_pct, created_by)
    VALUES ($1, $2, NULL, $3, $4, $5, $6, $3, 0, 0, $7)
    RETURNING id, numero, monto_total
  `, [numero, visita.cliente_id, costo, pago.forma_pago,
      pago.referencia_pago || null, `Visita técnica ${visita.numero}`, userId]);

  await client.query(`
    INSERT INTO recibo_items (recibo_id, descripcion, cantidad, monto, orden)
    VALUES ($1, $2, 1, $3, 0)
  `, [rec.id, `Visita técnica de relevamiento a domicilio — ${visita.numero}`, costo]);

  return rec;
}

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
    (SELECT COUNT(*)::int FROM visita_tecnica_items vti WHERE vti.visita_tecnica_id = vt.id) AS items_total,
    o.numero AS operacion_numero,
    rec.numero AS recibo_numero,
    rec.estado AS recibo_estado,
    rec.monto_total AS recibo_monto
  FROM visitas_tecnicas vt
  JOIN clientes c ON c.id = vt.cliente_id
  LEFT JOIN operaciones o ON o.id = vt.operacion_id
  LEFT JOIN recibos rec ON rec.id = vt.recibo_id
`;

// GET / — listado, filtros opcionales por estado y estado de cobro
visitasTecnicas.get('/', async (c) => {
  const estado = c.req.query('estado');
  const cobroEstado = c.req.query('cobro_estado');
  const params: unknown[] = [];
  const conds: string[] = [];
  if (estado) {
    params.push(estado);
    conds.push(`vt.estado = $${params.length}`);
  }
  if (cobroEstado) {
    params.push(cobroEstado);
    conds.push(`vt.cobro_estado = $${params.length}`);
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
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
      `SELECT vti.*, cp.nombre AS producto_nombre, cp.imagenes AS producto_imagenes, cs.nombre AS servicio_nombre,
        ta.nombre AS tipo_abertura_nombre, si.nombre AS sistema_nombre
       FROM visita_tecnica_items vti
       LEFT JOIN catalogo_productos cp ON cp.id = vti.producto_id
       LEFT JOIN catalogo_servicios cs ON cs.id = vti.servicio_id
       LEFT JOIN tipos_abertura ta ON ta.id = vti.tipo_abertura_id
       LEFT JOIN sistemas si ON si.id = vti.sistema_id
       WHERE vti.visita_tecnica_id = $1 ORDER BY vti.orden`,
      [id]
    ),
  ]);
  if (!visita) return c.json({ error: 'Visita técnica no encontrada' }, 404);
  return c.json({ ...visita, items });
});

// POST / — crea la visita (se completa después con lo relevado).
// Si cobrar=true emite además el recibo de la visita, en la misma transacción.
// Si viene operacion_id: la visita cubre ítems FALTANTES de un presupuesto ya
// guardado (el vendedor identificó algunos ítems, pero otros necesitan medirse
// en el sitio) — queda vinculada desde el arranque, no recién al convertirla.
visitasTecnicas.post('/', async (c) => {
  const user = c.get('user');
  const b = await validateBody(c, VisitaTecnicaCrearSchema);
  if (b instanceof Response) return b;

  const costo = await costoVisitaConfigurado();
  if (b.cobrar && costo <= 0) {
    return c.json({ error: 'No hay costo de visita configurado. Cargalo en Configuración → Empresa.' }, 400);
  }

  if (b.operacion_id) {
    const { rows: [op] } = await db.query(
      `SELECT id, cliente_id, estado FROM operaciones WHERE id=$1`, [b.operacion_id]
    );
    if (!op) return c.json({ error: 'Presupuesto no encontrado' }, 404);
    if (op.cliente_id !== b.cliente_id) return c.json({ error: 'El presupuesto es de otro cliente' }, 409);
    if (['aprobado', 'cancelado', 'rechazado'].includes(op.estado)) {
      return c.json({ error: `No se puede relevar ítems faltantes de un presupuesto ${op.estado}` }, 409);
    }
    // Una sola visita pendiente por presupuesto — evita mezclar dos relevamientos activos
    const { rows: [existente] } = await db.query(
      `SELECT numero FROM visitas_tecnicas WHERE operacion_id=$1 AND estado NOT IN ('convertida','cancelada')`,
      [b.operacion_id]
    );
    if (existente) {
      return c.json({ error: `Este presupuesto ya tiene una visita pendiente (${existente.numero})` }, 409);
    }
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const numero = await nextNumero();
    const { rows: [row] } = await client.query(`
      INSERT INTO visitas_tecnicas (numero, cliente_id, created_by, cobro_estado, costo_cobrado, operacion_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [numero, b.cliente_id, user?.id || null, b.cobrar ? 'cobrada' : 'sin_cargo', costo, b.operacion_id || null]);

    let recibo = null;
    if (b.cobrar) {
      recibo = await emitirReciboVisita(
        client, row, costo,
        { forma_pago: b.forma_pago!, referencia_pago: b.referencia_pago },
        user?.id || null
      );
      await client.query(`UPDATE visitas_tecnicas SET recibo_id=$1 WHERE id=$2`, [recibo.id, row.id]);
      row.recibo_id = recibo.id;
    }

    await client.query('COMMIT');
    return c.json({ ...row, recibo }, 201);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /:id/cobrar — cobra una visita que quedó pendiente (o visitas previas a la feature)
visitasTecnicas.patch('/:id/cobrar', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, VisitaTecnicaCobrarSchema);
  if (b instanceof Response) return b;

  const { rows: [visita] } = await db.query(
    `SELECT id, numero, cliente_id, estado, cobro_estado FROM visitas_tecnicas WHERE id=$1`, [id]
  );
  if (!visita) return c.json({ error: 'Visita técnica no encontrada' }, 404);
  if (visita.estado === 'cancelada') return c.json({ error: 'La visita está cancelada' }, 409);
  if (visita.cobro_estado !== 'pendiente') {
    return c.json({ error: `La visita ya está marcada como ${visita.cobro_estado}` }, 409);
  }

  const costo = await costoVisitaConfigurado();
  if (costo <= 0) {
    return c.json({ error: 'No hay costo de visita configurado. Cargalo en Configuración → Empresa.' }, 400);
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const recibo = await emitirReciboVisita(
      client, visita, costo,
      { forma_pago: b.forma_pago, referencia_pago: b.referencia_pago },
      user?.id || null
    );
    const { rows: [row] } = await client.query(`
      UPDATE visitas_tecnicas
      SET cobro_estado='cobrada', costo_cobrado=$1, recibo_id=$2, updated_at=now()
      WHERE id=$3 RETURNING *
    `, [costo, recibo.id, id]);
    await client.query('COMMIT');
    return c.json({ ...row, recibo });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PATCH /:id/sin-cargo — se decide no cobrar la visita (cliente de confianza)
visitasTecnicas.patch('/:id/sin-cargo', async (c) => {
  const { id } = c.req.param();
  const { rows: [visita] } = await db.query(
    `SELECT cobro_estado FROM visitas_tecnicas WHERE id=$1`, [id]
  );
  if (!visita) return c.json({ error: 'Visita técnica no encontrada' }, 404);
  if (visita.cobro_estado !== 'pendiente') {
    return c.json({ error: `La visita ya está marcada como ${visita.cobro_estado}` }, 409);
  }

  const costo = await costoVisitaConfigurado();
  const { rows: [row] } = await db.query(`
    UPDATE visitas_tecnicas
    SET cobro_estado='sin_cargo', costo_cobrado=COALESCE(costo_cobrado, $1), updated_at=now()
    WHERE id=$2 RETURNING *
  `, [costo, id]);
  return c.json(row);
});

// PATCH /:id/costo-externo — lo que se le pagó al técnico o servicio tercerizado
visitasTecnicas.patch('/:id/costo-externo', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, VisitaTecnicaCostoExternoSchema);
  if (b instanceof Response) return b;

  const { rows: [row] } = await db.query(
    `UPDATE visitas_tecnicas SET costo_externo=$1, updated_at=now() WHERE id=$2 RETURNING *`,
    [b.costo_externo, id]
  );
  if (!row) return c.json({ error: 'Visita técnica no encontrada' }, 404);
  return c.json(row);
});

// POST /:id/bonificar — acredita el recibo de la visita al presupuesto (pago a cuenta).
// El recibo pasa a tener operacion_id, con lo cual cuenta como monto ya cobrado.
visitasTecnicas.post('/:id/bonificar', async (c) => {
  const { id } = c.req.param();
  const user = c.get('user');
  const b = await validateBody(c, VisitaTecnicaBonificarSchema);
  if (b instanceof Response) return b;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // FOR UPDATE: bloquea la fila para que dos bonificaciones simultáneas no pasen las dos
    const { rows: [visita] } = await client.query(
      `SELECT id, numero, cliente_id, cobro_estado, recibo_id, operacion_id
       FROM visitas_tecnicas WHERE id=$1 FOR UPDATE`, [id]
    );
    if (!visita) { await client.query('ROLLBACK'); return c.json({ error: 'Visita técnica no encontrada' }, 404); }

    if (visita.cobro_estado === 'bonificada') {
      await client.query('ROLLBACK');
      return c.json({ error: 'La visita ya fue acreditada a un presupuesto' }, 409);
    }
    if (visita.cobro_estado !== 'cobrada' || !visita.recibo_id) {
      await client.query('ROLLBACK');
      return c.json({ error: 'La visita no fue cobrada, no hay importe para acreditar' }, 409);
    }

    const { rows: [rec] } = await client.query(
      `SELECT id, numero, estado, operacion_id, monto_total FROM recibos WHERE id=$1`, [visita.recibo_id]
    );
    if (!rec || rec.estado !== 'emitido') {
      await client.query('ROLLBACK');
      return c.json({ error: 'El recibo de la visita fue anulado' }, 409);
    }
    if (rec.operacion_id) {
      await client.query('ROLLBACK');
      return c.json({ error: 'El recibo ya está acreditado a otro presupuesto' }, 409);
    }

    const { rows: [op] } = await client.query(
      `SELECT id, numero, cliente_id, estado FROM operaciones WHERE id=$1`, [b.operacion_id]
    );
    if (!op) { await client.query('ROLLBACK'); return c.json({ error: 'Presupuesto no encontrado' }, 404); }
    if (['cancelado', 'rechazado'].includes(op.estado)) {
      await client.query('ROLLBACK');
      return c.json({ error: `No se puede acreditar a un presupuesto ${op.estado}` }, 409);
    }
    // Evita mover plata entre clientes distintos
    if (op.cliente_id !== visita.cliente_id) {
      await client.query('ROLLBACK');
      return c.json({ error: 'El presupuesto es de otro cliente' }, 409);
    }
    if (visita.operacion_id !== op.id) {
      await client.query('ROLLBACK');
      return c.json({ error: 'Esta visita no derivó en ese presupuesto' }, 409);
    }

    await client.query(
      `UPDATE recibos SET operacion_id=$1, updated_at=now()
       WHERE id=$2 AND estado='emitido' AND operacion_id IS NULL`,
      [op.id, rec.id]
    );
    const { rows: [row] } = await client.query(`
      UPDATE visitas_tecnicas
      SET cobro_estado='bonificada', bonificada_at=now(), bonificada_por=$1, updated_at=now()
      WHERE id=$2 RETURNING *
    `, [user?.id || null, id]);

    await client.query('COMMIT');

    // La acreditación puede haber saldado la operación
    await cerrarCompromisosSiSaldado(op.id);

    return c.json({ visita: row, recibo: rec });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// POST /:id/desbonificar — revierte la acreditación (ej. el presupuesto se cayó después)
visitasTecnicas.post('/:id/desbonificar', async (c) => {
  const { id } = c.req.param();

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [visita] } = await client.query(
      `SELECT id, cobro_estado, recibo_id FROM visitas_tecnicas WHERE id=$1 FOR UPDATE`, [id]
    );
    if (!visita) { await client.query('ROLLBACK'); return c.json({ error: 'Visita técnica no encontrada' }, 404); }
    if (visita.cobro_estado !== 'bonificada') {
      await client.query('ROLLBACK');
      return c.json({ error: 'La visita no está acreditada' }, 409);
    }

    if (visita.recibo_id) {
      await client.query(`UPDATE recibos SET operacion_id=NULL, updated_at=now() WHERE id=$1`, [visita.recibo_id]);
    }
    const { rows: [row] } = await client.query(`
      UPDATE visitas_tecnicas
      SET cobro_estado='cobrada', bonificada_at=NULL, bonificada_por=NULL, updated_at=now()
      WHERE id=$1 RETURNING *
    `, [id]);

    await client.query('COMMIT');
    return c.json(row);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// PUT /:id — carga de datos relevados en el sitio (fecha, técnico, detalles, ítems)
visitasTecnicas.put('/:id', async (c) => {
  const { id } = c.req.param();
  const b = await validateBody(c, VisitaTecnicaSchema);
  if (b instanceof Response) return b;

  const { rows: [actual] } = await db.query(`SELECT estado FROM visitas_tecnicas WHERE id=$1`, [id]);
  if (!actual) return c.json({ error: 'Visita técnica no encontrada' }, 404);
  if (actual.estado === 'convertida') {
    return c.json({ error: 'Ya se generó un presupuesto a partir de esta visita' }, 409);
  }
  if (actual.estado === 'cancelada') {
    return c.json({ error: 'La visita está cancelada' }, 409);
  }

  const items = b.items;
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
      b.fecha_visita || null,
      b.tecnico?.trim() || null,
      b.color,
      b.vidrio,
      b.instalacion,
      b.abertura_especial,
      b.observaciones?.trim() || null,
      estadoNuevo,
      b.imagenes,
      id,
    ]);

    await client.query(`DELETE FROM visita_tecnica_items WHERE visita_tecnica_id = $1`, [id]);
    for (const [idx, item] of items.entries()) {
      const esAMedida = (item.tipo_item ?? 'a_medida') === 'a_medida';
      await client.query(`
        INSERT INTO visita_tecnica_items (
          visita_tecnica_id, orden, ambiente, descripcion, ancho_mm, alto_mm, tipo_item, producto_id, servicio_id,
          tipo_abertura_id, sistema_id, vidrio, premarco, accesorios, color, calculo_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      `, [
        id, idx,
        item.ambiente?.trim() || null,
        item.descripcion?.trim() || null,
        item.ancho_mm || null,
        item.alto_mm || null,
        item.tipo_item === 'servicio' ? 'servicio' : item.tipo_item === 'estandar' ? 'estandar' : 'a_medida',
        item.tipo_item === 'estandar' ? (item.producto_id || null) : null,
        item.tipo_item === 'servicio' ? (item.servicio_id || null) : null,
        esAMedida ? (item.tipo_abertura_id || null) : null,
        esAMedida ? (item.sistema_id || null) : null,
        esAMedida ? (item.vidrio?.trim() || null) : null,
        esAMedida ? (item.premarco ?? false) : false,
        esAMedida ? item.accesorios : [],
        esAMedida ? (item.color?.trim() || null) : null,
        esAMedida ? (item.calculo_url || null) : null,
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

// PATCH /:id/cancelar — cancela la visita (no aplica si ya generó presupuesto ni si tiene recibo vivo)
visitasTecnicas.patch('/:id/cancelar', async (c) => {
  const { id } = c.req.param();
  const { rows: [visita] } = await db.query(`
    SELECT vt.estado, vt.cobro_estado, rec.numero AS recibo_numero
    FROM visitas_tecnicas vt LEFT JOIN recibos rec ON rec.id = vt.recibo_id
    WHERE vt.id=$1
  `, [id]);
  if (!visita) return c.json({ error: 'Visita técnica no encontrada' }, 404);
  if (visita.estado === 'convertida') {
    return c.json({ error: 'No se puede cancelar: ya generó un presupuesto' }, 409);
  }
  // Evita el estado inconsistente "cancelada pero cobrada"
  if (['cobrada', 'bonificada'].includes(visita.cobro_estado)) {
    return c.json({ error: `No se puede cancelar: anulá primero el recibo ${visita.recibo_numero ?? ''}`.trim() }, 409);
  }
  const { rows: [row] } = await db.query(
    `UPDATE visitas_tecnicas SET estado='cancelada', updated_at=now() WHERE id=$1 RETURNING *`,
    [id]
  );
  return c.json(row);
});

// DELETE /:id — solo si no derivó ya en un presupuesto ni tiene recibo emitido
visitasTecnicas.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const { rows: [visita] } = await db.query(
    `SELECT estado, recibo_id FROM visitas_tecnicas WHERE id=$1`, [id]
  );
  if (!visita) return c.json({ error: 'No encontrada' }, 404);
  if (visita.estado === 'convertida') {
    return c.json({ error: 'No se puede eliminar: ya generó un presupuesto' }, 409);
  }
  // Sin esto quedaría un recibo huérfano cuyo concepto referencia un VT inexistente
  if (visita.recibo_id) {
    return c.json({ error: 'No se puede eliminar: tiene un recibo emitido' }, 409);
  }
  await db.query('DELETE FROM visitas_tecnicas WHERE id = $1', [id]);
  return c.json({ ok: true });
});

export default visitasTecnicas;
