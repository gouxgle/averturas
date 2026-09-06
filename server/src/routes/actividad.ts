import { Hono } from 'hono';
import { db } from '../db.js';

const actividad = new Hono();

// GET /actividad/operadores — operadores que tienen actividad registrada (para el filtro).
actividad.get('/operadores', async (c) => {
  const { rows } = await db.query(`
    SELECT a.usuario_id AS id,
           COALESCE(u.nombre, a.usuario_nombre, 'Usuario') AS nombre
    FROM actividad_log a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.usuario_id IS NOT NULL
    GROUP BY a.usuario_id, u.nombre, a.usuario_nombre
    ORDER BY nombre
  `);
  return c.json(rows);
});

// GET /actividad — línea de tiempo de acciones de operadores sobre presupuestos,
// recibos y remitos. Filtros opcionales: usuario_id, entidad, accion, desde, hasta,
// q (busca en número y detalle). Paginado con limit/offset. Devuelve { rows, total }.
actividad.get('/', async (c) => {
  const q          = c.req.query();
  const usuario_id = q.usuario_id?.trim() || null;
  const entidad    = q.entidad?.trim() || null;
  const accion     = q.accion?.trim() || null;
  const desde      = q.desde?.trim() || null;   // 'YYYY-MM-DD'
  const hasta      = q.hasta?.trim() || null;
  const texto      = q.q?.trim() || null;
  const limit  = Math.min(Math.max(parseInt(q.limit ?? '50', 10) || 50, 1), 200);
  const offset = Math.max(parseInt(q.offset ?? '0', 10) || 0, 0);

  const cond: string[] = [];
  const params: unknown[] = [];
  const p = (val: unknown) => { params.push(val); return `$${params.length}`; };

  if (usuario_id) cond.push(`a.usuario_id = ${p(usuario_id)}`);
  if (entidad)    cond.push(`a.entidad = ${p(entidad)}`);
  if (accion)     cond.push(`a.accion = ${p(accion)}`);
  if (desde)      cond.push(`a.created_at >= ${p(desde)}::date`);
  if (hasta)      cond.push(`a.created_at < (${p(hasta)}::date + interval '1 day')`);
  if (texto) {
    const t = p(`%${texto}%`);
    cond.push(`(a.entidad_numero ILIKE ${t} OR a.detalle ILIKE ${t})`);
  }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const { rows: [{ total }] } = await db.query(
    `SELECT COUNT(*)::int AS total FROM actividad_log a ${where}`, params
  );

  const { rows } = await db.query(`
    SELECT
      a.id, a.entidad, a.entidad_id, a.entidad_numero, a.accion, a.detalle,
      a.meta, a.created_at,
      a.usuario_id,
      COALESCE(u.nombre, a.usuario_nombre, 'Usuario') AS usuario_nombre
    FROM actividad_log a
    LEFT JOIN usuarios u ON u.id = a.usuario_id
    ${where}
    ORDER BY a.created_at DESC
    LIMIT ${p(limit)} OFFSET ${p(offset)}
  `, params);

  return c.json({ rows, total });
});

export default actividad;
