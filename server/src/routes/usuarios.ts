import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';

const usuarios = new Hono();

// Only admins can manage users
function requireAdmin(rol: string) {
  return rol === 'admin';
}

usuarios.get('/', async (c) => {
  const user = c.get('user');
  if (!requireAdmin(user.rol)) return c.json({ error: 'Sin permisos' }, 403);

  const { rows } = await db.query(
    `SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY nombre`
  );
  return c.json(rows);
});

usuarios.post('/', async (c) => {
  const user = c.get('user');
  if (!requireAdmin(user.rol)) return c.json({ error: 'Sin permisos' }, 403);

  const { nombre, email, password, rol } = await c.req.json();
  if (!nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);
  if (!email?.trim())  return c.json({ error: 'email requerido' }, 400);
  if (!password)       return c.json({ error: 'contraseña requerida' }, 400);

  const validRoles = ['admin', 'vendedor', 'consulta'];
  if (!validRoles.includes(rol)) return c.json({ error: 'rol inválido' }, 400);

  const existing = await db.query(`SELECT id FROM usuarios WHERE email = $1`, [email.toLowerCase().trim()]);
  if (existing.rows[0]) return c.json({ error: 'Ya existe un usuario con ese email' }, 409);

  const hash = await bcrypt.hash(password, 10);
  const { rows } = await db.query(
    `INSERT INTO usuarios (nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4) RETURNING id, nombre, email, rol, activo, created_at`,
    [nombre.trim(), email.toLowerCase().trim(), hash, rol]
  );
  return c.json(rows[0], 201);
});

usuarios.put('/:id', async (c) => {
  const user = c.get('user');
  if (!requireAdmin(user.rol)) return c.json({ error: 'Sin permisos' }, 403);

  const { nombre, email, password, rol, activo } = await c.req.json();
  const id = c.req.param('id');

  if (!nombre?.trim()) return c.json({ error: 'nombre requerido' }, 400);
  if (!email?.trim())  return c.json({ error: 'email requerido' }, 400);

  const validRoles = ['admin', 'vendedor', 'consulta'];
  if (rol && !validRoles.includes(rol)) return c.json({ error: 'rol inválido' }, 400);

  // Can't deactivate yourself
  if (user.id === id && activo === false) {
    return c.json({ error: 'No podés desactivar tu propia cuenta' }, 400);
  }

  // Check email uniqueness (excluding self)
  const dup = await db.query(`SELECT id FROM usuarios WHERE email = $1 AND id != $2`, [email.toLowerCase().trim(), id]);
  if (dup.rows[0]) return c.json({ error: 'Ese email ya pertenece a otro usuario' }, 409);

  if (password) {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `UPDATE usuarios SET nombre=$1, email=$2, password_hash=$3, rol=$4, activo=$5, updated_at=now()
       WHERE id=$6 RETURNING id, nombre, email, rol, activo`,
      [nombre.trim(), email.toLowerCase().trim(), hash, rol, activo ?? true, id]
    );
    if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
    return c.json(rows[0]);
  } else {
    const { rows } = await db.query(
      `UPDATE usuarios SET nombre=$1, email=$2, rol=$3, activo=$4, updated_at=now()
       WHERE id=$5 RETURNING id, nombre, email, rol, activo`,
      [nombre.trim(), email.toLowerCase().trim(), rol, activo ?? true, id]
    );
    if (!rows[0]) return c.json({ error: 'no encontrado' }, 404);
    return c.json(rows[0]);
  }
});

export default usuarios;
