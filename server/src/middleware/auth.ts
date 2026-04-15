import { createMiddleware } from 'hono/factory';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  id: string;
  email: string;
  nombre: string;
  rol: string;
}

declare module 'hono' {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const header = c.req.header('Authorization');
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: 'No autorizado' }, 401);
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Token inválido o expirado' }, 401);
  }
});
