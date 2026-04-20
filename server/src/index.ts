import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { readFileSync, existsSync } from 'node:fs';

import authRoutes         from './routes/auth.js';
import clientesRoutes     from './routes/clientes.js';
import productosRoutes    from './routes/productos.js';
import operacionesRoutes  from './routes/operaciones.js';
import catalogoRoutes     from './routes/catalogo.js';
import dashboardRoutes    from './routes/dashboard.js';
import interaccionesRoutes from './routes/interacciones.js';
import tareasRoutes        from './routes/tareas.js';
import { authMiddleware } from './middleware/auth.js';

const app = new Hono();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ── Rutas públicas ────────────────────────────────────────────
const api = new Hono();
api.route('/auth', authRoutes);

// ── Rutas protegidas ──────────────────────────────────────────
const apiAuth = new Hono();
apiAuth.use('*', authMiddleware);
apiAuth.route('/clientes',      clientesRoutes);
apiAuth.route('/productos',     productosRoutes);
apiAuth.route('/operaciones',   operacionesRoutes);
apiAuth.route('/catalogo',      catalogoRoutes);
apiAuth.route('/dashboard',     dashboardRoutes);
apiAuth.route('/interacciones', interaccionesRoutes);
apiAuth.route('/tareas',        tareasRoutes);

api.route('/', apiAuth);
app.route('/api', api);

// ── Servir frontend estático ──────────────────────────────────
app.use('*', serveStatic({ root: './public' }));

// SPA fallback: todas las rutas devuelven index.html
app.get('*', (c) => {
  const indexPath = './public/index.html';
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8');
    return c.html(html);
  }
  return c.text('Frontend no disponible — ejecutar npm run build', 503);
});

const PORT = parseInt(process.env.PORT ?? '3000');
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`✓ Aberturas API corriendo en http://0.0.0.0:${PORT}`);
});
