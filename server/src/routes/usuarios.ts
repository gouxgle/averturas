import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { UsuarioSchema } from '../lib/schemas.js';

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

  const b = await validateBody(c, UsuarioSchema.required({ password: true }));
  if (b instanceof Response) return b;
  const { nombre, email, password, rol } = b;

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

  const b = await validateBody(c, UsuarioSchema);
  if (b instanceof Response) return b;
  const { nombre, email, password, rol, activo } = b;
  const id = c.req.param('id');

  // Can't deactivate yourself
  if (user.id === id && activo === false) {
    return c.json({ error: 'No podés desactivar tu propia cuenta' }, 400);
  }

  // Check email uniqueness (excluding self)
  const dup = await db.query(`SELECT id FROM usuarios WHERE email = $1 AND id != $2`, [email.toLowerCase().trim(), id]);
  if (dup.rows[0]) return c.json({ error: 'Ese email ya pertenece a otro usuario' }, 409);

  if (password) {
    if (password.length < 8) return c.json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
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
