// Carga server/.env cuando el backend corre nativo en el host (npm run dev). En el
// contenedor no existe ese archivo y las env vars vienen del compose — dotenv nunca
// pisa una variable ya definida, así que ahí es un no-op.
import 'dotenv/config';
import './instrument.js'; // Sentry — primer import después de dotenv (lee SENTRY_DSN)
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { readFileSync, existsSync } from 'node:fs';

import pubRoutes              from './routes/pub.js';
import notificacionesRoutes   from './routes/notificaciones.js';
import authRoutes             from './routes/auth.js';
import clientesRoutes     from './routes/clientes.js';
import productosRoutes    from './routes/productos.js';
import operacionesRoutes  from './routes/operaciones.js';
import catalogoRoutes     from './routes/catalogo.js';
import dashboardRoutes    from './routes/dashboard.js';
import interaccionesRoutes from './routes/interacciones.js';
import tareasRoutes        from './routes/tareas.js';
import empresaRoutes       from './routes/empresa.js';
import usuariosRoutes      from './routes/usuarios.js';
import stockRoutes         from './routes/stock.js';
import remitosRoutes       from './routes/remitos.js';
import recibosRoutes       from './routes/recibos.js';
import pedidosRoutes          from './routes/pedidos.js';
import transportistasRoutes   from './routes/transportistas.js';
import estadoCuentaRoutes     from './routes/estadoCuenta.js';
import informesRoutes      from './routes/informes.js';
import crmRoutes           from './routes/crm.js';
import oportunidadesRoutes from './routes/oportunidades.js';
import configuracionRoutes from './routes/configuracion.js';
import localidadesRoutes   from './routes/localidades.js';
import visitasTecnicasRoutes from './routes/visitasTecnicas.js';
import backupsRoutes         from './routes/backups.js';
import comentariosRoutes     from './routes/comentarios.js';
import changelogRoutes       from './routes/changelog.js';
import actividadRoutes       from './routes/actividad.js';
import * as Sentry from '@sentry/node';
import { authMiddleware } from './middleware/auth.js';
import { rateLimit }     from './middleware/rateLimit.js';

const app = new Hono();

// ── CORS ──────────────────────────────────────────────────────
// Antes: origin '*' en TODA la API, incluida la autenticada (FRONTEND_URL nunca se
// definió en ningún ambiente). El frontend se sirve desde el mismo proceso, así
// que ninguna llamada de la app es cross-origin y esto no le cambia nada; solo
// deja de aceptar peticiones desde cualquier sitio ajeno. Orígenes permitidos:
// APP_URL (test/prod), FRONTEND_URL y ORIGENES_EXTRA si se definen (coma-separados,
// p.ej. para el sitio web público), y en desarrollo Vite (:5173) y :3000/:3001.
const origenesPermitidos = [
  process.env.APP_URL,
  process.env.FRONTEND_URL,
  ...(process.env.ORIGENES_EXTRA ?? '').split(','),
  ...(process.env.NODE_ENV === 'production' ? [] : [
    'http://localhost:5173', 'http://localhost:3000', 'http://localhost:3001',
    'http://127.0.0.1:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001',
  ]),
].map(o => (o ?? '').trim().replace(/\/+$/, '')).filter(Boolean);

app.use('*', cors({
  // Con origin como función, Hono devuelve el header solo si el origen coincide;
  // una petición same-origin no trae Origin y no pasa por acá. Si no hay ninguno
  // configurado (local sin .env), se mantiene el comportamiento anterior.
  origin: origenesPermitidos.length === 0
    ? '*'
    : (origin) => (origenesPermitidos.includes(origin) ? origin : null),
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// ── Cabeceras de seguridad ────────────────────────────────────
// Antes no había ninguna (solo las ponía el nginx del sitio web, no el del
// sistema). Se dejan afuera a propósito: CSP (rompería estilos inline, imágenes
// data: de los PDFs y Sentry sin un trabajo aparte), COEP/COOP/CORP (las
// imágenes de /uploads se van a servir cross-origin al sitio web) y HSTS lo pone
// nginx en prod (test es HTTP y el header se ignora igual).
app.use('*', secureHeaders({
  contentSecurityPolicy: undefined,
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  strictTransportSecurity: false,
  xFrameOptions: 'SAMEORIGIN',
  referrerPolicy: 'strict-origin-when-cross-origin',
}));

// ── Rutas públicas ────────────────────────────────────────────
const api = new Hono();
// 60 req/min por IP en rutas públicas (ver presupuesto, aprobar online)
api.use('/pub/*',  rateLimit(60,  60_000, 'pub'));
// 10 intentos/min por IP en login (anti brute-force)
api.use('/auth/*', rateLimit(10,  60_000, 'auth'));
api.route('/pub',  pubRoutes);
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
apiAuth.route('/empresa',       empresaRoutes);
apiAuth.route('/usuarios',      usuariosRoutes);
apiAuth.route('/stock',         stockRoutes);
apiAuth.route('/remitos',       remitosRoutes);
apiAuth.route('/recibos',        recibosRoutes);
apiAuth.route('/pedidos',          pedidosRoutes);
apiAuth.route('/transportistas',   transportistasRoutes);
apiAuth.route('/estado-cuenta',    estadoCuentaRoutes);
apiAuth.route('/notificaciones',  notificacionesRoutes);
apiAuth.route('/informes',        informesRoutes);
apiAuth.route('/crm',             crmRoutes);
apiAuth.route('/oportunidades',   oportunidadesRoutes);
apiAuth.route('/configuracion',   configuracionRoutes);
apiAuth.route('/localidades',     localidadesRoutes);
apiAuth.route('/visitas-tecnicas', visitasTecnicasRoutes);
apiAuth.route('/backups',          backupsRoutes);
apiAuth.route('/comentarios',      comentariosRoutes);
apiAuth.route('/changelog',        changelogRoutes);
apiAuth.route('/actividad',        actividadRoutes);

api.route('/', apiAuth);
app.route('/api', api);

// ── Servir uploads (imágenes productos, etc.) ─────────────────
app.use('/uploads/*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', 'public, max-age=604800'); // 7 días
});
app.use('/uploads/*', serveStatic({ root: '.' }));

// ── Cache headers para assets estáticos ──────────────────────
// Assets con hash (Vite): cache 1 año, inmutable
app.use('/assets/*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
});
// index.html y rutas SPA: nunca cachear
app.use('*', async (c, next) => {
  await next();
  if (!c.res.headers.get('Cache-Control')) {
    c.res.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  }
});

// ── Servir frontend estático ──────────────────────────────────
app.use('*', serveStatic({ root: './public' }));

// Error handler global — reporta a Sentry y evita que excepciones rompan el proceso
app.onError((err, c) => {
  console.error('[error]', err);
  Sentry.captureException(err, {
    extra: {
      url:    c.req.url,
      method: c.req.method,
    },
  });
  return c.json({ error: 'Error interno del servidor' }, 500);
});

// SPA fallback: todas las rutas devuelven index.html
app.get('*', (c) => {
  const indexPath = './public/index.html';
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, 'utf-8');
    c.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    return c.html(html);
  }
  return c.text('Frontend no disponible — ejecutar npm run build', 503);
});

const PORT = parseInt(process.env.PORT ?? '3000');
serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`✓ Aberturas API corriendo en http://0.0.0.0:${PORT}`);
});
