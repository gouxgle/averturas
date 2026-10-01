import { db } from '../../db.js';
import { hoyAR } from '../fechas.js';
import { ArcaError } from '../arca/soap.js';
import {
  feDummy, solicitarCAEA, informarCAEA, informarCAEASinMovimiento, ultimoAutorizado, type ContextoArca,
} from '../arca/wsfe.js';
import { leerConfig, leerPuntosVenta } from './config.js';
import {
  cargar, snapshotEmisor, datosAsociado, solicitudDe, lockSerie, iso, hashFiscal, EmisionError, type ComprobanteFila,
} from './emision.js';
import { urlQR } from './qr.js';
import { encolar } from '../cola.js';

// Contingencia con CAEA (RG 5782/5852, vigente desde 01/08/2026). El CAEA es SOLO para cuando
// ARCA no da CAE: se pide por quincena con anticipación, se emite en un punto de venta propio
// registrando causa, fecha, hora y usuario, y lo emitido se informa hasta 8 días después del
// fin de la quincena (o "sin movimiento" si no se usó).

const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

export interface Quincena { periodo: number; orden: 1 | 2; desde: string; hasta: string }

export function quincenaDe(fecha: string): Quincena {
  const [y, m, d] = fecha.split('-').map(Number);
  const orden: 1 | 2 = d <= 15 ? 1 : 2;
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return {
    periodo: y * 100 + m, orden,
    desde: `${y}-${mm}-${orden === 1 ? '01' : '16'}`,
    hasta: `${y}-${mm}-${orden === 1 ? '15' : String(ultimo)}`,
  };
}

export function siguienteQuincena(q: Quincena): Quincena {
  const dia = new Date(`${q.hasta}T12:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() + 1);
  return quincenaDe(ymd(dia));
}

const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400_000);

async function ctxActual(usuarioId: string | null = null): Promise<{ ctx: ContextoArca; cuit: string; ambiente: 'homologacion' | 'produccion' } | null> {
  const cfg = await leerConfig();
  if (!cfg.habilitada || !cfg.cuit) return null;
  return { ctx: { ambiente: cfg.ambiente, cuit: cfg.cuit, usuarioId, timeoutMs: 20_000 }, cuit: cfg.cuit, ambiente: cfg.ambiente };
}

/** Obtiene (y guarda) el CAEA de una quincena. Idempotente. */
export async function obtenerCaea(q: Quincena, usuarioId: string | null = null) {
  const a = await ctxActual(usuarioId);
  if (!a) throw new EmisionError('La facturación está deshabilitada', [], 409);
  const { rows: [ya] } = await db.query(
    `SELECT * FROM caea_periodos WHERE ambiente = $1 AND cuit = $2 AND periodo = $3 AND orden = $4`, [a.ambiente, a.cuit, q.periodo, q.orden]);
  if (ya) return ya;
  const c = await solicitarCAEA(a.ctx, q.periodo, q.orden);
  const { rows: [row] } = await db.query(
    `INSERT INTO caea_periodos (ambiente, cuit, periodo, orden, caea, fch_vig_desde, fch_vig_hasta, fch_tope_inf, respuesta)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (ambiente, cuit, periodo, orden) DO UPDATE SET caea = EXCLUDED.caea
     RETURNING *`,
    [a.ambiente, a.cuit, c.periodo, c.orden, c.caea, c.vigDesde, c.vigHasta, c.topeInf, JSON.stringify(c)]);
  return row;
}

async function registrar(tipo: string, ok: boolean, mensaje: string, cbteId: string | null, usuarioId: string | null) {
  await db.query(
    `INSERT INTO fiscal_eventos (tipo, ok, error_mensaje, comprobante_id, usuario_id) VALUES ($1,$2,$3,$4,$5)`,
    [tipo, ok, mensaje, cbteId, usuarioId]);
}

/**
 * ¿ARCA está en contingencia? Sí si FEDummy falla ahora o si hubo fallas de WSFE en los
 * últimos 30 minutos. Con ARCA funcionando, la RG 5852 no permite usar el CAEA.
 */
async function hayContingencia(ctx: ContextoArca): Promise<string | null> {
  const { rows: [f] } = await db.query(
    `SELECT error_mensaje, created_at FROM fiscal_eventos
      WHERE tipo = 'arca_llamada' AND servicio = 'wsfe' AND ok = false AND ambiente = $1
        AND created_at > now() - interval '30 minutes'
      ORDER BY id DESC LIMIT 1`, [ctx.ambiente]);
  try {
    const d = await feDummy({ ...ctx, timeoutMs: 8_000 });
    if ([d.appServer, d.dbServer, d.authServer].every(v => v === 'OK')) return f ? `Falla reciente de ARCA: ${f.error_mensaje}` : null;
    return `ARCA informa servicio degradado (app ${d.appServer}, base ${d.dbServer}, auth ${d.authServer})`;
  } catch (e) {
    return `ARCA no responde: ${(e as Error).message}`;
  }
}

/** Emite un borrador/rechazado con CAEA en el punto de venta de contingencia. */
export async function emitirContingencia(id: string, causa: string, usuarioId: string | null) {
  if (!causa || causa.trim().length < 10) throw new EmisionError('Describí la causa de la contingencia (mínimo 10 caracteres)');
  const a = await ctxActual(usuarioId);
  if (!a) throw new EmisionError('La facturación está deshabilitada (Configuración > Facturación)', [], 409);
  const cfg = await leerConfig();
  const pv = (await leerPuntosVenta()).find(p => p.activo && p.modo === 'CAEA');
  if (!pv) throw new EmisionError('No hay un punto de venta de contingencia (CAEA) configurado', [], 409);

  const evidencia = await hayContingencia(a.ctx);
  if (!evidencia) throw new EmisionError('ARCA está respondiendo con normalidad: emití el comprobante en forma online (CAE). El CAEA es solo para contingencias.', [], 409);

  const hoy = hoyAR();
  const q = quincenaDe(hoy);
  const { rows: [caea] } = await db.query(
    `SELECT * FROM caea_periodos WHERE ambiente = $1 AND cuit = $2 AND fch_vig_desde <= $3 AND fch_vig_hasta >= $3`,
    [a.ambiente, a.cuit, hoy]);
  if (!caea) {
    throw new EmisionError(`No hay CAEA para la quincena ${q.orden} de ${String(q.periodo).slice(4)}/${String(q.periodo).slice(0, 4)}. ` +
      'Se pide automáticamente con anticipación; si ARCA ya está caído no se puede obtener ahora.', [], 409);
  }

  const client = await db.connect();
  let serie: string | null = null;
  try {
    const d0 = await cargar(client, id);
    if (!d0) throw new EmisionError('Comprobante no encontrado', [], 404);
    if (!['borrador', 'rechazado'].includes(d0.c.estado)) throw new EmisionError(`El comprobante está ${d0.c.estado}: no se puede emitir en contingencia`, [], 409);
    if (iso(d0.c.fecha) !== hoy) throw new EmisionError('En contingencia el comprobante tiene que tener la fecha de hoy');
    serie = lockSerie({ ambiente: a.ambiente, punto_venta: pv.numero, cbte_tipo: d0.c.cbte_tipo });
    await client.query(`SELECT pg_advisory_lock(hashtext($1))`, [serie]);

    // Número: el punto de venta CAEA lo usa solo este sistema; ARCA se consulta si responde.
    const { rows: [{ max }] } = await client.query(
      `SELECT COALESCE(max(numero), 0) AS max FROM comprobantes WHERE ambiente = $1 AND punto_venta = $2 AND cbte_tipo = $3 AND numero IS NOT NULL`,
      [a.ambiente, pv.numero, d0.c.cbte_tipo]);
    let ultimo = Number(max);
    try { ultimo = Math.max(ultimo, await ultimoAutorizado({ ...a.ctx, timeoutMs: 5_000 }, pv.numero, d0.c.cbte_tipo)); } catch { /* caído */ }
    const numero = ultimo + 1;

    const emisor = snapshotEmisor(cfg);
    const c = { ...d0.c, punto_venta: pv.numero, numero: String(numero), emisor, ambiente: a.ambiente } as ComprobanteFila;
    const asociado = await datosAsociado(client, c.comprobante_asociado_id, cfg.cuit!);
    const solicitud = solicitudDe(c, d0.iva, numero, asociado);
    const qr = urlQR({
      fecha: hoy, cuit: cfg.cuit!, ptoVta: pv.numero, tipoCmp: c.cbte_tipo, nroCmp: numero, importe: Number(c.imp_total),
      moneda: c.moneda, ctz: Number(c.cotizacion), tipoDocRec: c.receptor_doc_tipo, nroDocRec: c.receptor_doc_nro,
      tipoCodAut: 'A', codAut: caea.caea,
    });
    const caeaVto = iso(caea.fch_vig_hasta)!;
    const hash = hashFiscal(c, numero, caea.caea, caeaVto, d0.items);
    await client.query(
      `UPDATE comprobantes SET estado = 'contingencia', modo = 'CAEA', punto_venta = $2, numero = $3, emisor = $4,
         request_json = $5, cae = $6, cae_vto = $7, caea_id = $8, cbte_fch_hs_gen = now(), contingencia_causa = $9,
         qr_url = $10, hash_fiscal = $11, emitido_at = now(), errores = NULL, ambiente = $12
       WHERE id = $1`,
      [id, pv.numero, numero, JSON.stringify(emisor), JSON.stringify(solicitud), caea.caea, caeaVto, caea.id,
       `${causa.trim()} — ${evidencia}`, qr, hash, a.ambiente]);
    await registrar('contingencia', true, `Emitido con CAEA ${caea.caea} (PV ${pv.numero} N° ${numero}). Causa: ${causa.trim()}. ${evidencia}`, id, usuarioId);
    await encolar('informar_caea', {}, { enSegundos: 300 });
    return { estado: 'contingencia' as const, numero, punto_venta: pv.numero, caea: caea.caea };
  } finally {
    if (serie) await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [serie]).catch(() => {});
    client.release();
  }
}

/**
 * Informa a ARCA lo emitido con CAEA, en orden de número por punto de venta y tipo (ARCA
 * exige el orden). Si un comprobante falla, se corta esa serie y se reintenta después.
 */
export async function informarPendientes(): Promise<{ informados: number; pendientes: number; errores: string[] }> {
  const a = await ctxActual();
  if (!a) return { informados: 0, pendientes: 0, errores: [] };
  const { rows } = await db.query(
    `SELECT c.id, c.punto_venta, c.cbte_tipo, c.numero, c.cbte_fch_hs_gen, p.caea
       FROM comprobantes c JOIN caea_periodos p ON p.id = c.caea_id
      WHERE c.estado = 'contingencia' AND c.ambiente = $1
      ORDER BY c.punto_venta, c.cbte_tipo, c.numero`, [a.ambiente]);
  let informados = 0;
  const errores: string[] = [];
  const cortadas = new Set<string>();
  for (const r of rows) {
    const serie = `${r.punto_venta}-${r.cbte_tipo}`;
    if (cortadas.has(serie)) continue;
    const d = (await cargar(db, r.id))!;
    try {
      const asociado = await datosAsociado(db, d.c.comprobante_asociado_id, a.cuit).catch(() => null);
      const res = await informarCAEA({ ...a.ctx, comprobanteId: r.id }, solicitudDe(d.c, d.iva, Number(r.numero), asociado), r.caea, new Date(r.cbte_fch_hs_gen));
      if (res.resultado === 'A') {
        await db.query(
          `UPDATE comprobantes SET estado = 'autorizado', informado_at = now(), response_json = $2, observaciones = $3 WHERE id = $1`,
          [r.id, JSON.stringify(res.raw), JSON.stringify(res.observaciones)]);
        informados++;
      } else {
        const msg = [...res.errores, ...res.observaciones].map(o => `${o.code}: ${o.msg}`).join(' · ') || 'Rechazado';
        await db.query(`UPDATE comprobantes SET errores = $2 WHERE id = $1`, [r.id, JSON.stringify([...res.errores, ...res.observaciones])]);
        await registrar('contingencia', false, `ARCA rechazó el informe del CAEA: ${msg}`, r.id, null);
        errores.push(`PV ${r.punto_venta} N° ${r.numero}: ${msg}`);
        cortadas.add(serie);
      }
    } catch (e) {
      errores.push(`PV ${r.punto_venta} N° ${r.numero}: ${(e as Error).message}`);
      cortadas.add(serie);
    }
  }
  return { informados, pendientes: rows.length - informados, errores };
}

/**
 * Tareas periódicas del CAEA (idempotentes, corren cada hora):
 *  1. tener el CAEA de la quincena actual y, desde 5 días antes, el de la próxima;
 *  2. informar lo emitido en contingencia;
 *  3. cerradas las quincenas, informar "sin movimiento" los puntos de venta sin uso.
 */
export async function tareasCaea(): Promise<void> {
  const a = await ctxActual();
  if (!a) return;
  if (!(await leerPuntosVenta()).some(p => p.activo && p.modo === 'CAEA')) return;
  const hoy = hoyAR();
  const actual = quincenaDe(hoy);
  const prox = siguienteQuincena(actual);
  for (const q of [actual, ...(diasEntre(hoy, prox.desde) <= 5 ? [prox] : [])]) {
    try { await obtenerCaea(q); } catch (e) {
      await registrar('contingencia', false, `No se pudo obtener el CAEA ${q.orden}/${q.periodo}: ${(e as Error).message}`, null, null);
    }
  }

  await informarPendientes();

  const pvs = (await leerPuntosVenta()).filter(p => p.modo === 'CAEA');
  const { rows: cerrados } = await db.query(
    `SELECT * FROM caea_periodos WHERE ambiente = $1 AND cuit = $2 AND estado <> 'informado' AND fch_vig_hasta < $3`,
    [a.ambiente, a.cuit, hoy]);
  for (const p of cerrados) {
    let completo = true;
    for (const pv of pvs) {
      const { rows: [inf] } = await db.query(`SELECT informado_at FROM caea_informes WHERE caea_id = $1 AND punto_venta = $2`, [p.id, pv.numero]);
      if (inf?.informado_at) continue;
      const { rows: [uso] } = await db.query(
        `SELECT count(*) FILTER (WHERE estado = 'contingencia') AS pend, count(*) AS total
           FROM comprobantes WHERE caea_id = $1 AND punto_venta = $2`, [p.id, pv.numero]);
      if (Number(uso.total) > 0) {
        if (Number(uso.pend) > 0) { completo = false; continue; }
        await db.query(
          `INSERT INTO caea_informes (caea_id, punto_venta, sin_movimiento, informado_at, resultado) VALUES ($1,$2,false,now(),'A')
           ON CONFLICT (caea_id, punto_venta) DO UPDATE SET informado_at = now(), resultado = 'A', error = NULL`, [p.id, pv.numero]);
        continue;
      }
      try {
        await informarCAEASinMovimiento(a.ctx, pv.numero, p.caea);
        await db.query(
          `INSERT INTO caea_informes (caea_id, punto_venta, sin_movimiento, informado_at, resultado) VALUES ($1,$2,true,now(),'A')
           ON CONFLICT (caea_id, punto_venta) DO UPDATE SET informado_at = now(), resultado = 'A', error = NULL`, [p.id, pv.numero]);
      } catch (e) {
        completo = false;
        await db.query(
          `INSERT INTO caea_informes (caea_id, punto_venta, sin_movimiento, error) VALUES ($1,$2,true,$3)
           ON CONFLICT (caea_id, punto_venta) DO UPDATE SET error = EXCLUDED.error`, [p.id, pv.numero, (e as Error).message]);
      }
    }
    await db.query(`UPDATE caea_periodos SET estado = $2 WHERE id = $1`, [p.id, completo ? 'informado' : 'cerrado']);
  }
}

/** Estado para la pestaña Contingencia y las alertas. */
export async function estadoContingencia() {
  const cfg = await leerConfig();
  const hoy = hoyAR();
  const { rows: caeas } = await db.query(
    `SELECT p.*, (SELECT count(*) FROM comprobantes c WHERE c.caea_id = p.id) AS usados,
            (SELECT count(*) FROM comprobantes c WHERE c.caea_id = p.id AND c.estado = 'contingencia') AS sin_informar,
            COALESCE((SELECT json_agg(i ORDER BY i.punto_venta) FROM caea_informes i WHERE i.caea_id = p.id), '[]') AS informes
       FROM caea_periodos p WHERE p.ambiente = $1 ORDER BY p.periodo DESC, p.orden DESC LIMIT 8`, [cfg.ambiente]);
  const { rows: pendientes } = await db.query(
    `SELECT id, cbte_tipo, clase, punto_venta, numero, fecha, receptor_nombre, imp_total, contingencia_causa, errores, cbte_fch_hs_gen
       FROM comprobantes WHERE estado = 'contingencia' AND ambiente = $1 ORDER BY punto_venta, cbte_tipo, numero`, [cfg.ambiente]);
  const vigente = caeas.find(c => iso(c.fch_vig_desde)! <= hoy && iso(c.fch_vig_hasta)! >= hoy) ?? null;
  const alertas: string[] = [];
  const pvCaea = (await leerPuntosVenta()).some(p => p.activo && p.modo === 'CAEA');
  if (cfg.habilitada && pvCaea && !vigente) alertas.push('No hay CAEA para la quincena actual: si ARCA se cae no se va a poder facturar.');
  for (const c of caeas) {
    if (c.estado !== 'informado' && iso(c.fch_vig_hasta)! < hoy) {
      const dias = diasEntre(hoy, iso(c.fch_tope_inf)!);
      alertas.push(dias >= 0
        ? `Falta informar el CAEA ${c.caea} (quincena ${c.orden} de ${String(c.periodo).slice(4)}/${String(c.periodo).slice(0, 4)}): vence en ${dias} día${dias === 1 ? '' : 's'}.`
        : `El CAEA ${c.caea} quedó sin informar fuera de término (vencía el ${iso(c.fch_tope_inf)}). Consultá al contador.`);
    }
  }
  return { vigente, caeas, pendientes, alertas, pv_caea: pvCaea };
}

