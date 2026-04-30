import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const auth = new Hono();

auth.post('/login', async (c) => {
  const { email, password } = await c.req.json<{ email: string; password: string }>();
  if (!email || !password) {
    return c.json({ error: 'Email y contraseña requeridos' }, 400);
  }

  const { rows } = await db.query(
    `SELECT id, nombre, email, password_hash, rol
     FROM usuarios WHERE email = $1 AND activo = true`,
    [email.toLowerCase().trim()]
  );
  const user = rows[0];

  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return c.json({ error: 'Email o contraseña incorrectos' }, 401);
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, nombre: user.nombre, rol: user.rol },
    process.env.JWT_SECRET!,
    { expiresIn: '24h' }
  );

  return c.json({
    token,
    user: { id: user.id, nombre: user.nombre, email: user.email, rol: user.rol },
  });
});

auth.get('/me', authMiddleware, (c) => {
  return c.json({ user: c.get('user') });
});

export default auth;
