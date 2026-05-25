import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const auth = new Hono();

// Rate limiting simple en memoria: máx 5 intentos por IP en 15 minutos
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 15 * 60 * 1000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

auth.post('/login', async (c) => {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return c.json({ error: 'Demasiados intentos. Esperá 15 minutos.' }, 429);
  }

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
