import { Hono } from 'hono';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { FiscalConfigSchema, PuntoVentaSchema, CsrSchema, CertificadoSchema } from '../lib/schemas.js';
import { leerConfig, leerPuntosVenta } from '../lib/fiscal/config.js';
import { diagnosticar, listoParaHabilitar } from '../lib/fiscal/diagnostico.js';
import { cuitValido, normalizarCuit } from '../lib/fiscal/cuit.js';
import { generarClaveYCsr, guardarCertificado, leerCsr } from '../lib/arca/secretos.js';

// /api/facturacion — Facturación electrónica ARCA. Etapa F1: configuración, certificado y
// prueba de conexión (solo admin). La emisión llega en F2.

const facturacion = new Hono();

const esAdmin = (rol: string) => rol === 'admin';

async function registrarConfig(usuarioId: string | null, mensaje: string) {
  await db.query(
    `INSERT INTO fiscal_eventos (tipo, ok, error_mensaje, usuario_id) VALUES ('config', true, $1, $2)`,
    [mensaje, usuarioId]);
}

// GET /estado — lo que cualquier usuario necesita saber (¿se puede facturar?).
facturacion.get('/estado', async (c) => {
  const cfg = await leerConfig();
  return c.json({ habilitada: cfg.habilitada, ambiente: cfg.ambiente });
});

// Todo lo demás es configuración: solo admin.
facturacion.use('*', async (c, next) => {
  if (!esAdmin(c.get('user').rol)) return c.json({ error: 'Solo un administrador puede configurar la facturación' }, 403);
  await next();
});

facturacion.get('/config', async (c) => {
  const [config, puntos_venta, checklist] = await Promise.all([leerConfig(), leerPuntosVenta(), diagnosticar(false)]);
  return c.json({ config, puntos_venta, checklist, listo: listoParaHabilitar(checklist) });
});

facturacion.put('/config', async (c) => {
  const b = await validateBody(c, FiscalConfigSchema);
  if (b instanceof Response) return b;
  const actual = await leerConfig();
  if (b.ambiente && b.ambiente !== actual.ambiente && actual.habilitada) {
    return c.json({ error: 'Para cambiar de ambiente primero hay que deshabilitar la facturación' }, 409);
  }
  if (b.cuit != null && !cuitValido(b.cuit)) return c.json({ error: 'El CUIT no es válido (dígito verificador)' }, 422);
  const datos = { ...b, ...(b.cuit != null ? { cuit: normalizarCuit(b.cuit) } : {}) };
  const campos = Object.keys(datos) as (keyof typeof datos)[];
  if (!campos.length) return c.json(actual);
  const sets = campos.map((k, i) => `${k} = $${i + 1}`).join(', ');
  const { rows: [row] } = await db.query(
    `UPDATE fiscal_config SET ${sets}, updated_at = now() WHERE id = 1 RETURNING *`,
    campos.map(k => datos[k] ?? null));
  await registrarConfig(c.get('user').id, `Datos fiscales actualizados: ${campos.join(', ')}`);
  return c.json(row);
});

// ── Puntos de venta ──────────────────────────────────────────────────────────
facturacion.post('/puntos-venta', async (c) => {
  const b = await validateBody(c, PuntoVentaSchema);
  if (b instanceof Response) return b;
  try {
    const { rows: [row] } = await db.query(
      `INSERT INTO fiscal_puntos_venta (numero, modo, domicilio, activo) VALUES ($1,$2,$3,$4) RETURNING *`,
      [b.numero, b.modo, b.domicilio ?? null, b.activo ?? true]);
    await registrarConfig(c.get('user').id, `Punto de venta ${b.numero} (${b.modo}) agregado`);
    return c.json(row, 201);
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return c.json({ error: `El punto de venta ${b.numero} ya está cargado` }, 409);
    throw e;
  }
});

facturacion.put('/puntos-venta/:id', async (c) => {
  const b = await validateBody(c, PuntoVentaSchema.partial());
  if (b instanceof Response) return b;
  const { rows: [row] } = await db.query(
    `UPDATE fiscal_puntos_venta SET
       numero = COALESCE($2, numero), modo = COALESCE($3, modo),
       domicilio = CASE WHEN $4::boolean THEN $5 ELSE domicilio END, activo = COALESCE($6, activo)
     WHERE id = $1 RETURNING *`,
    [c.req.param('id'), b.numero ?? null, b.modo ?? null, 'domicilio' in b, b.domicilio ?? null, b.activo ?? null]);
  if (!row) return c.json({ error: 'Punto de venta no encontrado' }, 404);
  await registrarConfig(c.get('user').id, `Punto de venta ${row.numero} modificado`);
  return c.json(row);
});

facturacion.delete('/puntos-venta/:id', async (c) => {
  // F2: bloquear si ya tiene comprobantes emitidos (queda desactivable, no borrable).
  const { rows: [row] } = await db.query(`DELETE FROM fiscal_puntos_venta WHERE id = $1 RETURNING numero`, [c.req.param('id')]);
  if (!row) return c.json({ error: 'Punto de venta no encontrado' }, 404);
  await registrarConfig(c.get('user').id, `Punto de venta ${row.numero} eliminado`);
  return c.json({ ok: true });
});

// ── Certificado ──────────────────────────────────────────────────────────────
facturacion.post('/certificado/csr', async (c) => {
  const b = await validateBody(c, CsrSchema);
  if (b instanceof Response) return b;
  const cfg = await leerConfig();
  if (!cuitValido(cfg.cuit) || !cfg.razon_social?.trim()) {
    return c.json({ error: 'Primero cargá el CUIT y la razón social' }, 422);
  }
  if (cfg.cert_estado === 'activo' && !b.confirmar) {
    return c.json({
      error: 'Ya hay un certificado activo. Generar una clave nueva lo deja inservible: habrá que pedir otro a ARCA.',
      requiere_confirmacion: true,
    }, 409);
  }
  let csr: string;
  try {
    csr = await generarClaveYCsr({ cuit: cfg.cuit!, razonSocial: cfg.razon_social!, alias: b.alias });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 500);
  }
  await db.query(
    `UPDATE fiscal_config SET cert_estado = 'csr_generado', csr_generado_at = now(), cert_ambiente = NULL,
       cert_subject = NULL, cert_vencimiento = NULL, cert_huella = NULL, habilitada = false, updated_at = now()
     WHERE id = 1`);
  await registrarConfig(c.get('user').id, `Clave y solicitud (CSR) generadas, alias ${b.alias}`);
  return c.json({ csr });
});

facturacion.get('/certificado/csr', async (c) => {
  const csr = await leerCsr();
  if (!csr) return c.json({ error: 'Todavía no se generó la solicitud' }, 404);
  c.header('Content-Type', 'application/pkcs10');
  c.header('Content-Disposition', 'attachment; filename="solicitud-arca.csr"');
  return c.body(csr);
});

facturacion.post('/certificado', async (c) => {
  const b = await validateBody(c, CertificadoSchema);
  if (b instanceof Response) return b;
  try {
    const info = await guardarCertificado(b.ambiente, b.pem);
    await db.query(
      `UPDATE fiscal_config SET cert_estado = 'activo', cert_ambiente = $1, cert_subject = $2,
         cert_vencimiento = $3, cert_huella = $4, updated_at = now() WHERE id = 1`,
      [b.ambiente, info.subject, info.vencimiento, info.huella]);
    // El ticket cacheado se firmó con el certificado anterior: se descarta.
    await db.query(`DELETE FROM arca_tokens WHERE ambiente = $1`, [b.ambiente]);
    await registrarConfig(c.get('user').id, `Certificado de ${b.ambiente} cargado (vence ${info.vencimiento.toISOString().slice(0, 10)})`);
    return c.json({ ok: true, ...info });
  } catch (e) {
    return c.json({ error: (e as Error).message }, 422);
  }
});

// ── Prueba y habilitación ───────────────────────────────────────────────────
facturacion.post('/probar', async (c) => {
  const checklist = await diagnosticar(true, c.get('user').id);
  return c.json({ checklist, listo: listoParaHabilitar(checklist) });
});

facturacion.patch('/habilitar', async (c) => {
  const { habilitada } = await c.req.json<{ habilitada?: boolean }>().catch(() => ({ habilitada: undefined }));
  if (typeof habilitada !== 'boolean') return c.json({ error: 'habilitada (true/false) es requerido' }, 400);
  if (habilitada) {
    const cfg = await leerConfig();
    const reciente = cfg.ultima_prueba_at && Date.now() - new Date(cfg.ultima_prueba_at).getTime() < 24 * 3600_000;
    if (!cfg.ultima_prueba_ok || !reciente) {
      return c.json({ error: 'Antes de habilitar, "Probar conexión" tiene que dar todo en verde (en las últimas 24 h)' }, 409);
    }
  }
  await db.query(`UPDATE fiscal_config SET habilitada = $1, updated_at = now() WHERE id = 1`, [habilitada]);
  await registrarConfig(c.get('user').id, habilitada ? 'Facturación HABILITADA' : 'Facturación deshabilitada');
  return c.json({ habilitada });
});

// ── Registro ─────────────────────────────────────────────────────────────────
facturacion.get('/eventos', async (c) => {
  const limite = Math.min(Number(c.req.query('limite') ?? 50) || 50, 200);
  const { rows } = await db.query(
    `SELECT e.id, e.tipo, e.servicio, e.metodo, e.ambiente, e.ok, e.duracion_ms, e.error_codigo,
            e.error_mensaje, e.comprobante_id, e.created_at, u.nombre AS usuario_nombre
       FROM fiscal_eventos e LEFT JOIN usuarios u ON u.id = e.usuario_id
      ORDER BY e.id DESC LIMIT $1`, [limite]);
  return c.json(rows);
});

facturacion.get('/eventos/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.json({ error: 'id inválido' }, 400);
  const { rows: [row] } = await db.query(`SELECT * FROM fiscal_eventos WHERE id = $1`, [id]);
  return row ? c.json(row) : c.json({ error: 'No encontrado' }, 404);
});

export default facturacion;
