import { Hono } from 'hono';
import { db } from '../db.js';

const empresa = new Hono();

// Always work with the first row (singleton)
empresa.get('/', async (c) => {
  const { rows } = await db.query(`SELECT * FROM empresa ORDER BY updated_at DESC LIMIT 1`);
  return c.json(rows[0] ?? null);
});

empresa.put('/', async (c) => {
  const { nombre, cuit, telefono, email, direccion, logo_url, objetivo_ventas_mensual } = await c.req.json();
  if (!nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);

  const { rows: existing } = await db.query(`SELECT id FROM empresa ORDER BY updated_at DESC LIMIT 1`);

  if (existing[0]) {
    const { rows } = await db.query(
      `UPDATE empresa SET nombre=$1, cuit=$2, telefono=$3, email=$4, direccion=$5, logo_url=$6,
         objetivo_ventas_mensual=$7, updated_at=now()
       WHERE id=$8 RETURNING *`,
      [nombre.trim(), cuit || null, telefono || null, email || null, direccion || null, logo_url || null,
       objetivo_ventas_mensual ? parseFloat(objetivo_ventas_mensual) : 0, existing[0].id]
    );
    return c.json(rows[0]);
  } else {
    const { rows } = await db.query(
      `INSERT INTO empresa (nombre, cuit, telefono, email, direccion, logo_url, objetivo_ventas_mensual)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [nombre.trim(), cuit || null, telefono || null, email || null, direccion || null, logo_url || null,
       objetivo_ventas_mensual ? parseFloat(objetivo_ventas_mensual) : 0]
    );
    return c.json(rows[0]);
  }
});

export default empresa;
