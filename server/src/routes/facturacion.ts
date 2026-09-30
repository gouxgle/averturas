import { Hono, type Context, type Next } from 'hono';
import { db } from '../db.js';
import { validateBody } from '../lib/validate.js';
import { FiscalConfigSchema, PuntoVentaSchema, CsrSchema, CertificadoSchema, ComprobanteSchema } from '../lib/schemas.js';
import { crearBorrador, emitir, conciliar, analizar, EmisionError } from '../lib/fiscal/emision.js';
import { prepararDesdeRecibo, prepararDesdeOperacion, prepararNotaCredito, excesoSobreOrigen, porFacturar, tablero, receptorDeClienteId } from '../lib/fiscal/origenes.js';
import type { z } from 'zod';
import { ArcaError } from '../lib/arca/soap.js';
import { consultarPadron } from '../lib/arca/padron.js';
import { leerConfig, leerPuntosVenta } from '../lib/fiscal/config.js';
import { diagnosticar, listoParaHabilitar } from '../lib/fiscal/diagnostico.js';
import { cuitValido, normalizarCuit } from '../lib/fiscal/cuit.js';
import { generarClaveYCsr, guardarCertificado, leerCsr } from '../lib/arca/secretos.js';

// /api/facturacion — Facturación electrónica ARCA: configuración (solo admin) y
// comprobantes (admin y vendedores emiten; consulta solo mira).

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

// Configuración: solo admin. (Un use('*') alcanzaría también a /comprobantes.)
const soloAdmin = async (c: Context, next: Next) => {
  if (!esAdmin(c.get('user').rol)) return c.json({ error: 'Solo un administrador puede configurar la facturación' }, 403);
  await next();
};
for (const ruta of ['/config', '/puntos-venta', '/puntos-venta/*', '/certificado', '/certificado/*', '/probar', '/habilitar', '/eventos', '/eventos/*']) {
  facturacion.use(ruta, soloAdmin);
}

// Emitir: admin y vendedores. El rol "consulta" solo mira.
const puedeEmitir = async (c: Context, next: Next) => {
  if (!['admin', 'vendedor'].includes(c.get('user').rol)) return c.json({ error: 'Tu usuario no puede emitir comprobantes' }, 403);
  await next();
};

function responderError(c: Context, e: unknown) {
  if (e instanceof EmisionError) return c.json({ error: e.message, problemas: e.problemas }, e.status as 404 | 409 | 422);
  if (e instanceof ArcaError) return c.json({ error: e.message, codigos: e.codigos }, 502);
  throw e;
}

// ── Padrón de ARCA ───────────────────────────────────────────────────────────
// Funciona aunque la facturación esté apagada: alcanza con CUIT y certificado cargados.
facturacion.get('/padron/:cuit', puedeEmitir, async (c) => {
  const cfg = await leerConfig();
  if (!cuitValido(cfg.cuit) || cfg.cert_estado !== 'activo') {
    return c.json({ error: 'La consulta a ARCA todavía no está configurada (Configuración > Facturación). Cargá los datos a mano.' }, 409);
  }
  try {
    const r = await consultarPadron(
      { ambiente: cfg.ambiente, cuitEmisor: cfg.cuit!, usuarioId: c.get('user').id },
      c.req.param('cuit')!, c.req.query('forzar') === '1');
    return c.json(r);
  } catch (e) {
    if (e instanceof ArcaError) {
      const status = ['cuit_invalido', 'no_existe', 'sin_datos'].some(k => e.codigos.includes(k)) ? 404 : 502;
      return c.json({ error: e.message, codigos: e.codigos }, status);
    }
    throw e;
  }
});

// ── Comprobantes ─────────────────────────────────────────────────────────────
facturacion.get('/comprobantes', async (c) => {
  const q = c.req.query();
  const where: string[] = [];
  const params: unknown[] = [];
  const p = (v: unknown) => { params.push(v); return `$${params.length}`; };
  if (q.estado) where.push(`c.estado = ${p(q.estado)}`);
  if (q.desde) where.push(`c.fecha >= ${p(q.desde)}`);
  if (q.hasta) where.push(`c.fecha <= ${p(q.hasta)}`);
  if (q.cliente_id) where.push(`c.cliente_id = ${p(q.cliente_id)}`);
  if (q.recibo_id) where.push(`c.recibo_id = ${p(q.recibo_id)}`);
  if (q.operacion_id) where.push(`c.operacion_id = ${p(q.operacion_id)}`);
  if (q.tipo_doc) where.push(`c.tipo_doc = ${p(q.tipo_doc)}`);
  if (q.q?.trim()) {
    const t = p(`%${q.q.trim()}%`);
    where.push(`(c.receptor_nombre ILIKE ${t} OR c.receptor_doc_nro ILIKE ${t} OR c.numero::text ILIKE ${t})`);
  }
  const limite = Math.min(Number(q.limite ?? 100) || 100, 500);
  const { rows } = await db.query(
    `SELECT c.id, c.estado, c.tipo_doc, c.clase, c.cbte_tipo, c.punto_venta, c.numero, c.fecha, c.receptor_nombre,
            c.receptor_doc_tipo, c.receptor_doc_nro, c.imp_total, c.cae, c.cae_vto, c.origen, c.operacion_id, c.recibo_id,
            c.cliente_id, c.ambiente, c.errores, c.created_at
       FROM comprobantes c
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY c.created_at DESC LIMIT ${p(limite)}`, params);
  return c.json(rows);
});

facturacion.get('/comprobantes/:id', async (c) => {
  const id = c.req.param('id');
  const { rows: [cbte] } = await db.query(
    `SELECT c.*, a.clase AS asociado_clase, a.cbte_tipo AS asociado_cbte_tipo, a.punto_venta AS asociado_punto_venta,
            a.numero AS asociado_numero, u.nombre AS creado_por
       FROM comprobantes c
       LEFT JOIN comprobantes a ON a.id = c.comprobante_asociado_id
       LEFT JOIN usuarios u ON u.id = c.created_by
      WHERE c.id = $1`, [id]).catch(() => ({ rows: [] }));
  if (!cbte) return c.json({ error: 'Comprobante no encontrado' }, 404);
  const [{ rows: items }, { rows: iva }, { rows: eventos }] = await Promise.all([
    db.query(`SELECT * FROM comprobante_items WHERE comprobante_id = $1 ORDER BY orden`, [id]),
    db.query(`SELECT * FROM comprobante_iva WHERE comprobante_id = $1 ORDER BY alicuota_id`, [id]),
    db.query(
      `SELECT id, tipo, metodo, ok, duracion_ms, error_codigo, error_mensaje, created_at
         FROM fiscal_eventos WHERE comprobante_id = $1 ORDER BY id`, [id]),
  ]);
  return c.json({ ...cbte, items, iva, eventos });
});

// Tablero, pendientes y propuestas (antes de /comprobantes/:id por el orden de Hono).
facturacion.get('/tablero', async (c) => {
  const [t, cfg] = await Promise.all([tablero(), leerConfig()]);
  return c.json({ ...t, habilitada: cfg.habilitada, ambiente: cfg.ambiente });
});

facturacion.get('/por-facturar', async (c) => c.json(await porFacturar()));

facturacion.get('/preparar', async (c) => {
  const { recibo_id, operacion_id, factura_id } = c.req.query();
  const p = recibo_id ? await prepararDesdeRecibo(recibo_id)
    : operacion_id ? await prepararDesdeOperacion(operacion_id)
      : factura_id ? await prepararNotaCredito(factura_id)
        : null;
  if (!p) return c.json({ error: 'No se encontró el origen a facturar' }, 404);
  return c.json(p);
});

facturacion.get('/receptor/:clienteId', async (c) => {
  const r = await receptorDeClienteId(c.req.param('clienteId')!);
  return r ? c.json(r) : c.json({ error: 'Cliente no encontrado' }, 404);
});

async function analisisCompleto(b: z.infer<typeof ComprobanteSchema>) {
  const a = await analizar(b);
  const exceso = await excesoSobreOrigen(b, a.importes.imp_total);
  return { ...a, exceso };
}

facturacion.post('/comprobantes/previsualizar', puedeEmitir, async (c) => {
  const b = await validateBody(c, ComprobanteSchema);
  if (b instanceof Response) return b;
  try {
    return c.json(await analisisCompleto(b));
  } catch (e) {
    if (e instanceof Error && /Alícuota/.test(e.message)) return c.json({ error: e.message }, 422);
    return responderError(c, e);
  }
});

facturacion.post('/comprobantes', puedeEmitir, async (c) => {
  const b = await validateBody(c, ComprobanteSchema);
  if (b instanceof Response) return b;
  try {
    const { exceso } = await analisisCompleto(b);
    if (exceso && exceso.exceso > 0 && !b.confirmar_exceso) {
      return c.json({
        error: `Supera en $ ${exceso.exceso.toLocaleString('es-AR')} lo que queda por ${b.tipo_doc === 'nota_credito' ? 'acreditar' : 'facturar'} ${exceso.referencia}`,
        requiere_confirmacion: true,
      }, 409);
    }
    const r = await crearBorrador(b, c.get('user').id);
    return c.json(r, 201);
  } catch (e) {
    if (e instanceof Error && /Alícuota/.test(e.message)) return c.json({ error: e.message }, 422);
    return responderError(c, e);
  }
});

facturacion.post('/comprobantes/:id/emitir', puedeEmitir, async (c) => {
  try {
    return c.json(await emitir(c.req.param('id')!, c.get('user').id));
  } catch (e) {
    return responderError(c, e);
  }
});

facturacion.post('/comprobantes/:id/conciliar', puedeEmitir, async (c) => {
  try {
    return c.json({ resultado: await conciliar(c.req.param('id')!, c.get('user').id) });
  } catch (e) {
    return responderError(c, e);
  }
});

facturacion.delete('/comprobantes/:id', puedeEmitir, async (c) => {
  const { rows: [row] } = await db.query(
    `DELETE FROM comprobantes WHERE id = $1 AND estado IN ('borrador', 'rechazado') AND numero IS NULL RETURNING id`,
    [c.req.param('id')]);
  if (!row) return c.json({ error: 'Solo se pueden borrar borradores o rechazados que no llegaron a ARCA' }, 409);
  return c.json({ ok: true });
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
  // Con comprobantes emitidos no se borra: queda desactivable.
  const { rows: [usado] } = await db.query(
    `SELECT 1 FROM comprobantes c JOIN fiscal_puntos_venta p ON p.numero = c.punto_venta WHERE p.id = $1 LIMIT 1`,
    [c.req.param('id')]);
  if (usado) return c.json({ error: 'Ese punto de venta ya tiene comprobantes: se puede desactivar pero no borrar' }, 409);
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
