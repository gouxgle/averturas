import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { db } from '../../db.js';
import { hoyAR } from '../fechas.js';
import { ArcaError } from '../arca/soap.js';
import {
  ultimoAutorizado, solicitarCAE, consultarComprobante, fechaDeArca,
  type ContextoArca, type SolicitudCAE, type RespuestaCAE,
} from '../arca/wsfe.js';
import {
  calcularImportes, claseSegunReceptor, tipoComprobante, validarComprobante, tipoDocDeCbte,
  COND_IVA_DESC, type ItemEntrada, type Receptor, type TipoDoc, type Clase,
} from './calculo.js';
import { leerConfig, leerPuntosVenta, type FiscalConfig } from './config.js';
import { urlQR } from './qr.js';
import { encolar } from '../cola.js';

// Emisión de comprobantes con CAE. El punto delicado es que WSFE NO es idempotente: si
// FECAESolicitar no responde, no se sabe si ARCA autorizó. Por eso:
//   1. se toma un lock por (ambiente, punto de venta, tipo): nadie más numera esa serie;
//   2. se guarda el comprobante como `emitiendo` CON su número ANTES de llamar a ARCA;
//   3. si no hay respuesta queda `incierto` y se concilia con FECompConsultar — nunca se
//      vuelve a pedir el mismo número a ciegas.

type Q = Pick<PoolClient, 'query'>;

export interface NuevoComprobante {
  tipo_doc: TipoDoc;
  receptor: Receptor;
  items: ItemEntrada[];
  cliente_id?: string | null;
  fecha?: string | null;
  fch_serv_desde?: string | null;
  fch_serv_hasta?: string | null;
  fch_vto_pago?: string | null;
  punto_venta?: number | null;
  origen?: 'manual' | 'operacion' | 'recibo' | 'remito';
  operacion_id?: string | null;
  recibo_id?: string | null;
  remito_id?: string | null;
  comprobante_asociado_id?: string | null;
  notas?: string | null;
}

export interface ComprobanteFila {
  id: string; estado: string; modo: string; ambiente: 'homologacion' | 'produccion';
  tipo_doc: TipoDoc; clase: Clase; cbte_tipo: number; punto_venta: number; numero: string | null;
  fecha: Date | string; concepto: 1 | 2 | 3;
  fch_serv_desde: Date | string | null; fch_serv_hasta: Date | string | null; fch_vto_pago: Date | string | null;
  cliente_id: string | null; receptor_doc_tipo: number; receptor_doc_nro: string; receptor_nombre: string;
  receptor_domicilio: string | null; receptor_condicion_iva_id: number;
  comprobante_asociado_id: string | null; operacion_id: string | null; recibo_id: string | null; remito_id: string | null; moneda: string; cotizacion: string;
  imp_neto: string; imp_iva: string; imp_op_ex: string; imp_tot_conc: string; imp_trib: string; imp_total: string;
  cae: string | null; cae_vto: Date | string | null; emisor: Record<string, unknown> | null;
  intentos: number; emitiendo_desde: Date | null;
}

export class EmisionError extends Error {
  constructor(message: string, readonly problemas: string[] = [], readonly status = 422) {
    super(message);
    this.name = 'EmisionError';
  }
}

/** DATE de pg → 'AAAA-MM-DD' sin correrse de día (las columnas DATE vuelven como Date local). */
export function iso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const n2 = (v: string | number) => Number(v);

// ── Borrador ─────────────────────────────────────────────────────────────────

export interface Analisis {
  clase: Clase;
  cbte_tipo: number;
  punto_venta: number;
  fecha: string;
  importes: ReturnType<typeof calcularImportes>;
  problemas: string[];
  /** Origen heredado: una nota hereda recibo/operación de la factura que corrige. */
  operacion_id: string | null;
  recibo_id: string | null;
  remito_id: string | null;
}

/**
 * Una nota corrige un comprobante del MISMO cliente, no puede ser anterior a él y no se asocia
 * a otra nota del mismo tipo (una NC corrige una factura o una nota de débito; una ND, una
 * factura o una nota de crédito).
 */
function validarAsociado(input: NuevoComprobante, a: {
  tipo_doc: TipoDoc; fecha: Date | string; receptor_doc_tipo: number; receptor_doc_nro: string;
}): string[] {
  const p: string[] = [];
  if (a.tipo_doc === input.tipo_doc) {
    p.push(input.tipo_doc === 'nota_credito'
      ? 'Una nota de crédito no se puede asociar a otra nota de crédito: asociala a la factura'
      : 'Una nota de débito no se puede asociar a otra nota de débito: asociala a la factura');
  }
  if (Number(a.receptor_doc_tipo) !== input.receptor.doc_tipo || String(a.receptor_doc_nro) !== String(input.receptor.doc_nro)) {
    p.push('La nota tiene que ser para el mismo cliente (mismo documento) que el comprobante que corrige');
  }
  const fechaNota = input.fecha ?? hoyAR();
  if (iso(a.fecha)! > fechaNota) p.push(`La nota no puede tener fecha anterior al comprobante que corrige (${iso(a.fecha)})`);
  return p;
}

/** No se factura un recibo anulado ni un presupuesto que no esté aprobado (o más adelante). */
async function validarOrigen(input: NuevoComprobante, operacionId: string | null, reciboId: string | null, remitoId: string | null = null): Promise<string[]> {
  if (input.tipo_doc !== 'factura') return [];
  const p: string[] = [];
  if (remitoId) {
    const { rows: [m] } = await db.query(`SELECT numero, estado FROM remitos WHERE id = $1`, [remitoId]);
    if (!m) p.push('El remito de origen no existe');
    else if (!['emitido', 'entregado'].includes(m.estado)) p.push(`El remito ${m.numero} está ${m.estado}: solo se factura un remito emitido o entregado`);
  } else if (reciboId) {
    const { rows: [r] } = await db.query(`SELECT numero, estado FROM recibos WHERE id = $1`, [reciboId]);
    if (!r) p.push('El recibo de origen no existe');
    else if (r.estado !== 'emitido') p.push(`El recibo ${r.numero} está ${r.estado}: no se puede facturar`);
  } else if (operacionId) {
    const { rows: [o] } = await db.query(`SELECT estado FROM operaciones WHERE id = $1`, [operacionId]);
    if (!o) p.push('El presupuesto de origen no existe');
    else if (!['aprobado', 'en_produccion', 'listo', 'instalado', 'entregado'].includes(o.estado)) {
      p.push(`El presupuesto está ${o.estado}: solo se factura desde que está aprobado`);
    }
  }
  return p;
}

/** Letra, tipo, importes y validaciones de un comprobante, sin guardar nada (vista previa). */
export async function analizar(input: NuevoComprobante): Promise<Analisis> {
  const cfg = await leerConfig();
  const importes = calcularImportes(input.items);
  const extra: string[] = [];

  let clase: Clase;
  let asociado: { cbte_tipo: number; numero: number | null; clase: Clase; punto_venta: number } | null = null;
  let operacionId = input.operacion_id ?? null;
  let reciboId = input.recibo_id ?? null;
  let remitoId = input.remito_id ?? null;
  if (input.tipo_doc === 'factura') {
    clase = claseSegunReceptor(input.receptor.condicion_iva_id);
  } else {
    if (!input.comprobante_asociado_id) throw new EmisionError('Falta la factura asociada a la nota');
    const { rows: [a] } = await db.query(
      `SELECT cbte_tipo, numero, clase, punto_venta, estado, operacion_id, recibo_id, remito_id, tipo_doc, fecha,
              receptor_doc_tipo, receptor_doc_nro
         FROM comprobantes WHERE id = $1`,
      [input.comprobante_asociado_id]);
    if (!a) throw new EmisionError('La factura asociada no existe', [], 404);
    extra.push(...validarAsociado(input, a));
    clase = a.clase;
    asociado = { cbte_tipo: a.cbte_tipo, numero: a.estado === 'autorizado' ? Number(a.numero) : null, clase: a.clase, punto_venta: a.punto_venta };
    operacionId = operacionId ?? a.operacion_id;
    reciboId = reciboId ?? a.recibo_id;
    remitoId = remitoId ?? a.remito_id;
  }

  const pvs = (await leerPuntosVenta()).filter(p => p.activo && p.modo === 'CAE');
  const puntoVenta = input.punto_venta ?? asociado?.punto_venta ?? pvs[0]?.numero ?? 0;
  const fecha = input.fecha ?? hoyAR();
  const problemas = validarComprobante({
    tipo: input.tipo_doc, clase, receptor: input.receptor, importes, fecha, hoy: hoyAR(),
    cuit_emisor: cfg.cuit ?? '', fch_serv_desde: input.fch_serv_desde, fch_serv_hasta: input.fch_serv_hasta,
    fch_vto_pago: input.fch_vto_pago, asociado,
  });
  problemas.push(...extra, ...await validarOrigen(input, operacionId, reciboId, remitoId));
  if (!puntoVenta) problemas.push('No hay un punto de venta activo para emisión online (Configuración > Facturación)');
  else if (!pvs.some(p => p.numero === puntoVenta)) problemas.push(`El punto de venta ${puntoVenta} no está activo para emisión online`);
  return {
    clase, cbte_tipo: tipoComprobante(clase, input.tipo_doc), punto_venta: puntoVenta, fecha, importes, problemas,
    operacion_id: operacionId, recibo_id: reciboId, remito_id: remitoId,
  };
}

/** Crea el borrador (importes calculados y guardados). Devuelve id y problemas pendientes. */
export async function crearBorrador(input: NuevoComprobante, usuarioId: string | null): Promise<{ id: string; problemas: string[] }> {
  const cfg = await leerConfig();
  const a = await analizar(input);
  if (!a.punto_venta) throw new EmisionError('No hay un punto de venta activo para emisión online (Configuración > Facturación)');
  const { clase, importes, problemas, fecha } = a;
  const puntoVenta = a.punto_venta;

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const r = input.receptor;
    const { rows: [c] } = await client.query(
      `INSERT INTO comprobantes
         (ambiente, tipo_doc, clase, cbte_tipo, punto_venta, fecha, concepto, fch_serv_desde, fch_serv_hasta, fch_vto_pago,
          cliente_id, receptor_doc_tipo, receptor_doc_nro, receptor_nombre, receptor_domicilio, receptor_condicion_iva_id,
          origen, operacion_id, recibo_id, remito_id, comprobante_asociado_id,
          imp_neto, imp_iva, imp_op_ex, imp_tot_conc, imp_trib, imp_total, notas, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29)
       RETURNING id`,
      [cfg.ambiente, input.tipo_doc, clase, a.cbte_tipo, puntoVenta, fecha, importes.concepto,
       importes.concepto !== 1 ? input.fch_serv_desde ?? null : null,
       importes.concepto !== 1 ? input.fch_serv_hasta ?? null : null,
       importes.concepto !== 1 ? input.fch_vto_pago ?? null : null,
       input.cliente_id ?? null, r.doc_tipo, r.doc_nro, r.nombre.trim(), r.domicilio ?? null, r.condicion_iva_id,
       input.origen ?? 'manual', a.operacion_id, a.recibo_id, a.remito_id, input.comprobante_asociado_id ?? null,
       importes.imp_neto, importes.imp_iva, importes.imp_op_ex, importes.imp_tot_conc, importes.imp_trib, importes.imp_total,
       input.notas ?? null, usuarioId]);
    for (const [i, it] of importes.items.entries()) {
      await client.query(
        `INSERT INTO comprobante_items
           (comprobante_id, orden, descripcion, cantidad, unidad, precio_unitario, bonificacion, alicuota, alicuota_id,
            exento, es_servicio, neto, iva, total, producto_id, operacion_item_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [c.id, i, it.descripcion, it.cantidad, it.unidad, it.precio_unitario, it.bonificacion, it.alicuota, it.alicuota_id,
         it.exento, it.es_servicio, it.neto, it.iva, it.total, it.producto_id, it.operacion_item_id]);
    }
    for (const a of importes.alicuotas) {
      await client.query(
        `INSERT INTO comprobante_iva (comprobante_id, alicuota_id, alicuota, base_imp, importe) VALUES ($1,$2,$3,$4,$5)`,
        [c.id, a.alicuota_id, a.alicuota, a.base_imp, a.importe]);
    }
    await client.query('COMMIT');
    return { id: c.id, problemas };
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

// ── Helpers de emisión ───────────────────────────────────────────────────────

export async function cargar(q: Q, id: string) {
  const { rows: [c] } = await q.query(`SELECT * FROM comprobantes WHERE id = $1`, [id]);
  if (!c) return null;
  const { rows: items } = await q.query(`SELECT * FROM comprobante_items WHERE comprobante_id = $1 ORDER BY orden`, [id]);
  const { rows: iva } = await q.query(`SELECT * FROM comprobante_iva WHERE comprobante_id = $1 ORDER BY alicuota_id`, [id]);
  return { c: c as ComprobanteFila, items, iva };
}

export function snapshotEmisor(cfg: FiscalConfig) {
  return {
    cuit: cfg.cuit, razon_social: cfg.razon_social, domicilio_fiscal: cfg.domicilio_fiscal, iibb: cfg.iibb,
    inicio_actividades: iso(cfg.inicio_actividades), condicion_iva: 'IVA Responsable Inscripto', leyenda_pie: cfg.leyenda_pie,
  };
}

export async function datosAsociado(q: Q, id: string | null, cuitEmisor: string) {
  if (!id) return null;
  const { rows: [a] } = await q.query(`SELECT cbte_tipo, punto_venta, numero, fecha, estado FROM comprobantes WHERE id = $1`, [id]);
  if (!a || a.estado !== 'autorizado') throw new EmisionError('La factura asociada no está autorizada por ARCA');
  return { tipo: a.cbte_tipo, ptoVta: a.punto_venta, nro: Number(a.numero), cuit: cuitEmisor, fecha: iso(a.fecha)! };
}

export function solicitudDe(c: ComprobanteFila, iva: { alicuota_id: number; base_imp: string; importe: string }[],
  numero: number, asociado: SolicitudCAE['asociado']): SolicitudCAE {
  return {
    ptoVta: c.punto_venta, cbteTipo: c.cbte_tipo, numero, concepto: c.concepto,
    docTipo: c.receptor_doc_tipo, docNro: c.receptor_doc_nro, fecha: iso(c.fecha)!,
    impTotal: n2(c.imp_total), impTotConc: n2(c.imp_tot_conc), impNeto: n2(c.imp_neto), impOpEx: n2(c.imp_op_ex),
    impTrib: n2(c.imp_trib), impIVA: n2(c.imp_iva),
    fchServDesde: iso(c.fch_serv_desde), fchServHasta: iso(c.fch_serv_hasta), fchVtoPago: iso(c.fch_vto_pago),
    monId: c.moneda, monCotiz: n2(c.cotizacion), condicionIvaReceptorId: c.receptor_condicion_iva_id, asociado,
    iva: iva.map(a => ({ id: a.alicuota_id, baseImp: n2(a.base_imp), importe: n2(a.importe) })),
  };
}

/** Hash del contenido fiscal: si algo de esto cambiara, el comprobante ya no es el autorizado. */
export function hashFiscal(c: ComprobanteFila, numero: number, cae: string, caeVto: string,
  items: { descripcion: string; cantidad: string; precio_unitario: string; total: string }[]): string {
  const canon = JSON.stringify({
    emisor: (c.emisor as { cuit?: string } | null)?.cuit, tipo: c.cbte_tipo, pv: c.punto_venta, numero, fecha: iso(c.fecha),
    receptor: [c.receptor_doc_tipo, c.receptor_doc_nro, c.receptor_condicion_iva_id],
    importes: [c.imp_neto, c.imp_iva, c.imp_op_ex, c.imp_tot_conc, c.imp_trib, c.imp_total].map(Number),
    items: items.map(i => [i.descripcion, Number(i.cantidad), Number(i.precio_unitario), Number(i.total)]),
    cae, caeVto,
  });
  return crypto.createHash('sha256').update(canon).digest('hex');
}

async function marcarAutorizado(q: Q, c: ComprobanteFila, numero: number, cae: string, caeVto: string,
  response: unknown, observaciones: unknown) {
  const { rows: items } = await q.query(
    `SELECT descripcion, cantidad, precio_unitario, total FROM comprobante_items WHERE comprobante_id = $1 ORDER BY orden`, [c.id]);
  const emisor = c.emisor as { cuit: string };
  const qr = urlQR({
    fecha: iso(c.fecha)!, cuit: emisor.cuit, ptoVta: c.punto_venta, tipoCmp: c.cbte_tipo, nroCmp: numero,
    importe: n2(c.imp_total), moneda: c.moneda, ctz: n2(c.cotizacion), tipoDocRec: c.receptor_doc_tipo,
    nroDocRec: c.receptor_doc_nro, tipoCodAut: 'E', codAut: cae,
  });
  await q.query(
    `UPDATE comprobantes SET estado = 'autorizado', numero = $2, cae = $3, cae_vto = $4, response_json = $5,
       observaciones = $6, errores = NULL, qr_url = $7, hash_fiscal = $8, emitido_at = now(), emitiendo_desde = NULL
     WHERE id = $1`,
    [c.id, numero, cae, caeVto, JSON.stringify(response), JSON.stringify(observaciones ?? []), qr,
     hashFiscal(c, numero, cae, caeVto, items)]);
}

async function volverABorrador(q: Q, id: string, estado: 'borrador' | 'rechazado', errores: { code: string; msg: string }[], response?: unknown) {
  await q.query(
    `UPDATE comprobantes SET estado = $2, numero = NULL, errores = $3, response_json = COALESCE($4, response_json),
       emitiendo_desde = NULL
     WHERE id = $1`,
    [id, estado, JSON.stringify(errores), response === undefined ? null : JSON.stringify(response)]);
}

export const lockSerie = (c: { ambiente: string; punto_venta: number; cbte_tipo: number }) =>
  `cbte:${c.ambiente}:${c.punto_venta}:${c.cbte_tipo}`;

// ── Conciliación ─────────────────────────────────────────────────────────────

export const ESPERA_NO_RECIBIDO_MS = 3 * 60 * 1000;

export type ResultadoConciliacion = 'autorizado' | 'no_emitido' | 'pendiente' | 'numero_ajeno';

/**
 * Averigua qué pasó con un comprobante `emitiendo`/`incierto`: si ARCA lo tiene con los
 * mismos datos se adopta el CAE; si ARCA nunca lo recibió vuelve a borrador para reemitir.
 * Se llama con el lock de la serie tomado (o desde la cola, que lo toma).
 */
async function conciliarSinLock(q: Q, c: ComprobanteFila, ctx: ContextoArca): Promise<ResultadoConciliacion> {
  const numero = Number(c.numero);
  if (!numero) {
    await volverABorrador(q, c.id, 'borrador', [{ code: 'sin_numero', msg: 'La emisión se interrumpió antes de asignar número' }]);
    return 'no_emitido';
  }
  let enArca: Record<string, unknown> | null;
  try {
    enArca = await consultarComprobante({ ...ctx, comprobanteId: c.id }, c.punto_venta, c.cbte_tipo, numero);
  } catch {
    return 'pendiente';
  }
  if (enArca) {
    const coincide = Math.abs(Number(enArca.ImpTotal) - n2(c.imp_total)) < 0.005
      && String(enArca.DocNro) === String(Number(c.receptor_doc_nro))
      && String(enArca.CbteFch) === iso(c.fecha)!.replace(/-/g, '');
    if (coincide && enArca.CodAutorizacion) {
      await marcarAutorizado(q, c, numero, String(enArca.CodAutorizacion), fechaDeArca(String(enArca.FchVto)),
        { conciliado_con: 'FECompConsultar', resultado: enArca }, []);
      return 'autorizado';
    }
    await volverABorrador(q, c.id, 'borrador', [{
      code: 'numero_ajeno',
      msg: `El número ${numero} quedó usado en ARCA por otro comprobante con datos distintos. Se puede volver a emitir.`,
    }]);
    return 'numero_ajeno';
  }
  // No existe (todavía). Un pedido cortado por timeout puede seguir en viaje y ARCA
  // autorizarlo segundos después: recién pasado ESPERA_NO_RECIBIDO_MS sin rastro se da por
  // no recibido. Antes de eso, concluirlo y reemitir podría duplicar la factura.
  const desde = c.emitiendo_desde ? new Date(c.emitiendo_desde).getTime() : 0;
  if (Date.now() - desde < ESPERA_NO_RECIBIDO_MS) return 'pendiente';
  // ¿ARCA ya pasó ese número? Si el último autorizado es menor, nunca lo recibió.
  try {
    const ultimo = await ultimoAutorizado(ctx, c.punto_venta, c.cbte_tipo);
    if (ultimo < numero) {
      await volverABorrador(q, c.id, 'borrador', [{ code: 'no_recibido', msg: 'ARCA no llegó a recibir el comprobante. Se puede volver a emitir.' }]);
      return 'no_emitido';
    }
  } catch {
    /* sin ARCA no se puede decidir */
  }
  return 'pendiente';
}

export async function contextoDe(c: { ambiente: 'homologacion' | 'produccion' }, usuarioId: string | null): Promise<ContextoArca> {
  const cfg = await leerConfig();
  if (!cfg.cuit) throw new EmisionError('Falta el CUIT del emisor en Configuración > Facturación');
  return { ambiente: c.ambiente, cuit: cfg.cuit, usuarioId, timeoutMs: Number(process.env.ARCA_TIMEOUT_MS) || 30_000 };
}

export async function conciliar(id: string, usuarioId: string | null = null): Promise<ResultadoConciliacion> {
  const client = await db.connect();
  try {
    const d = await cargar(client, id);
    if (!d) throw new EmisionError('Comprobante no encontrado', [], 404);
    if (!['emitiendo', 'incierto'].includes(d.c.estado)) return d.c.estado === 'autorizado' ? 'autorizado' : 'no_emitido';
    await client.query(`SELECT pg_advisory_lock(hashtext($1))`, [lockSerie(d.c)]);
    try {
      const fresco = (await cargar(client, id))!.c;
      if (!['emitiendo', 'incierto'].includes(fresco.estado)) return fresco.estado === 'autorizado' ? 'autorizado' : 'no_emitido';
      return await conciliarSinLock(client, fresco, await contextoDe(fresco, usuarioId));
    } finally {
      await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [lockSerie(d.c)]);
    }
  } finally {
    client.release();
  }
}

// ── Emisión ──────────────────────────────────────────────────────────────────

export interface ResultadoEmision {
  estado: 'autorizado' | 'rechazado' | 'incierto' | 'borrador';
  numero: number | null;
  cae: string | null;
  mensajes: string[];
}

const codigosDe = (r: RespuestaCAE) => [...r.errores, ...r.observaciones].map(o => o.code);

export async function emitir(id: string, usuarioId: string | null): Promise<ResultadoEmision> {
  const cfg = await leerConfig();
  if (!cfg.habilitada) throw new EmisionError('La facturación está deshabilitada (Configuración > Facturación)', [], 409);

  const client = await db.connect();
  let serie: string | null = null;
  try {
    const d0 = await cargar(client, id);
    if (!d0) throw new EmisionError('Comprobante no encontrado', [], 404);
    if (!['borrador', 'rechazado'].includes(d0.c.estado)) {
      throw new EmisionError(`El comprobante está ${d0.c.estado}: no se puede emitir de nuevo`, [], 409);
    }
    // El ambiente vale el de la configuración al momento de emitir (un borrador no tiene número).
    if (d0.c.ambiente !== cfg.ambiente) {
      await client.query(`UPDATE comprobantes SET ambiente = $2 WHERE id = $1`, [id, cfg.ambiente]);
      d0.c.ambiente = cfg.ambiente;
    }

    serie = lockSerie(d0.c);
    await client.query(`SELECT pg_advisory_lock(hashtext($1))`, [serie]);
    const ctx = await contextoDe(d0.c, usuarioId);

    // Un comprobante anterior de la serie sin confirmar bloquea la numeración: se concilia primero.
    const { rows: colgados } = await client.query(
      `SELECT id FROM comprobantes
        WHERE ambiente = $1 AND punto_venta = $2 AND cbte_tipo = $3 AND id <> $4 AND estado IN ('emitiendo', 'incierto')`,
      [d0.c.ambiente, d0.c.punto_venta, d0.c.cbte_tipo, id]);
    for (const { id: otro } of colgados) {
      const r = await conciliarSinLock(client, (await cargar(client, otro))!.c, ctx);
      if (r === 'pendiente') {
        throw new EmisionError('Hay un comprobante anterior de esta serie esperando confirmación de ARCA. Reintentá en unos minutos.', [], 409);
      }
    }

    const d = (await cargar(client, id))!;
    if (!['borrador', 'rechazado'].includes(d.c.estado)) {
      throw new EmisionError(`El comprobante está ${d.c.estado}: no se puede emitir de nuevo`, [], 409);
    }
    const c = d.c;
    const importes = {
      items: d.items.map(i => ({ ...i, cantidad: n2(i.cantidad), total: n2(i.total), descripcion: i.descripcion })),
      alicuotas: [], imp_neto: n2(c.imp_neto), imp_iva: n2(c.imp_iva), imp_op_ex: n2(c.imp_op_ex),
      imp_tot_conc: n2(c.imp_tot_conc), imp_trib: n2(c.imp_trib), imp_total: n2(c.imp_total), concepto: c.concepto,
    };
    const asocFila = c.comprobante_asociado_id
      ? (await client.query(
          `SELECT cbte_tipo, numero, clase, estado, tipo_doc, fecha, receptor_doc_tipo, receptor_doc_nro FROM comprobantes WHERE id = $1`,
          [c.comprobante_asociado_id])).rows[0]
      : null;
    const problemas = validarComprobante({
      tipo: c.tipo_doc, clase: c.clase,
      receptor: { doc_tipo: c.receptor_doc_tipo, doc_nro: c.receptor_doc_nro, nombre: c.receptor_nombre, condicion_iva_id: c.receptor_condicion_iva_id },
      importes: importes as never, fecha: iso(c.fecha)!, hoy: hoyAR(), cuit_emisor: cfg.cuit ?? '',
      fch_serv_desde: iso(c.fch_serv_desde), fch_serv_hasta: iso(c.fch_serv_hasta), fch_vto_pago: iso(c.fch_vto_pago),
      asociado: asocFila ? { cbte_tipo: asocFila.cbte_tipo, numero: asocFila.estado === 'autorizado' ? Number(asocFila.numero) : null, clase: asocFila.clase } : null,
    });
    // Lo que pudo cambiar desde que se guardó el borrador: recibo anulado, presupuesto cancelado…
    const comoInput = {
      tipo_doc: c.tipo_doc, fecha: iso(c.fecha), items: [],
      receptor: { doc_tipo: c.receptor_doc_tipo, doc_nro: c.receptor_doc_nro, nombre: c.receptor_nombre, condicion_iva_id: c.receptor_condicion_iva_id },
    } as unknown as NuevoComprobante;
    problemas.push(...await validarOrigen(comoInput, c.operacion_id, c.recibo_id, c.remito_id));
    if (asocFila) problemas.push(...validarAsociado(comoInput, asocFila));
    if (problemas.length) throw new EmisionError('El comprobante tiene datos a corregir', problemas);

    // ARCA rechaza una fecha anterior a la del último comprobante autorizado de la serie.
    const { rows: [ultimaLocal] } = await client.query(
      `SELECT max(fecha) AS f FROM comprobantes WHERE ambiente = $1 AND punto_venta = $2 AND cbte_tipo = $3 AND estado = 'autorizado'`,
      [c.ambiente, c.punto_venta, c.cbte_tipo]);
    if (ultimaLocal?.f && iso(ultimaLocal.f)! > iso(c.fecha)!) {
      throw new EmisionError(`La fecha no puede ser anterior a la del último comprobante de esta serie (${iso(ultimaLocal.f)})`);
    }

    const asociado = await datosAsociado(client, c.comprobante_asociado_id, cfg.cuit!);
    // Próximo número: el mayor entre lo que dice ARCA y lo que ya autorizó este sistema. Si no
    // coinciden algo anda mal (ARCA desactualizado, otro ambiente): queda registrado.
    // Si ARCA falla acá todavía no se mandó nada: el error queda en el borrador (y la UI ofrece
    // la contingencia con CAEA si ARCA no responde).
    let ultimoArca: number;
    try {
      ultimoArca = await ultimoAutorizado(ctx, c.punto_venta, c.cbte_tipo);
    } catch (e) {
      if (!(e instanceof ArcaError)) throw e;
      const err = { code: e.codigos[0] ?? 'arca', msg: e.message };
      await client.query(`UPDATE comprobantes SET errores = $2 WHERE id = $1`, [id, JSON.stringify([err])]);
      return { estado: 'borrador', numero: null, cae: null, mensajes: [e.message] };
    }
    const { rows: [{ max: maxLocal }] } = await client.query(
      `SELECT COALESCE(max(numero), 0) AS max FROM comprobantes
        WHERE ambiente = $1 AND punto_venta = $2 AND cbte_tipo = $3 AND numero IS NOT NULL AND id <> $4`,
      [c.ambiente, c.punto_venta, c.cbte_tipo, id]);
    if (Number(maxLocal) > ultimoArca) {
      await client.query(
        `INSERT INTO fiscal_eventos (tipo, ok, error_codigo, error_mensaje, comprobante_id, usuario_id)
         VALUES ('alerta', false, 'numeracion', $1, $2, $3)`,
        [`ARCA informa último ${ultimoArca} pero el sistema ya tiene el ${maxLocal} (PV ${c.punto_venta}, tipo ${c.cbte_tipo})`, id, usuarioId]);
    }
    let numero = Math.max(ultimoArca, Number(maxLocal)) + 1;
    const emisor = snapshotEmisor(cfg);

    for (let intento = 1; ; intento++) {
      const solicitud = solicitudDe(c, d.iva, numero, asociado);
      // Queda registrado ANTES de llamar: si el proceso se cae, la cola sabe qué conciliar.
      await client.query(
        `UPDATE comprobantes SET estado = 'emitiendo', numero = $2, emisor = $3, request_json = $4, errores = NULL,
           intentos = intentos + 1, emitiendo_desde = now()
         WHERE id = $1`,
        [id, numero, JSON.stringify(emisor), JSON.stringify(solicitud)]);
      const actual = { ...c, emisor, numero: String(numero) } as ComprobanteFila;

      let r: RespuestaCAE;
      try {
        r = await solicitarCAE({ ...ctx, comprobanteId: id }, solicitud);
      } catch (e) {
        if (e instanceof ArcaError && e.incierto) {
          await client.query(`UPDATE comprobantes SET estado = 'incierto', errores = $2 WHERE id = $1`,
            [id, JSON.stringify([{ code: e.codigos[0], msg: e.message }])]);
          // Primer intento de conciliar en el acto (adopta el CAE si ARCA ya lo tiene); si no,
          // queda en la cola hasta poder decidir.
          const conc = await conciliarSinLock(client, (await cargar(client, id))!.c, ctx);
          if (conc === 'autorizado') {
            const fin = (await cargar(client, id))!.c;
            return { estado: 'autorizado', numero, cae: fin.cae, mensajes: ['ARCA tardó en responder, pero el comprobante quedó autorizado'] };
          }
          if (conc === 'pendiente') {
            await encolar('conciliar_comprobante', { id }, { enSegundos: 60 });
            return { estado: 'incierto', numero, cae: null, mensajes: [`${e.message}. El sistema va a confirmar con ARCA automáticamente; no lo vuelvas a emitir.`] };
          }
          return { estado: 'borrador', numero: null, cae: null, mensajes: ['ARCA no recibió el comprobante: se puede volver a emitir'] };
        }
        const msg = e instanceof Error ? e.message : String(e);
        await volverABorrador(client, id, 'borrador', [{ code: e instanceof ArcaError ? e.codigos.join(',') : 'error', msg }]);
        return { estado: 'borrador', numero: null, cae: null, mensajes: [msg] };
      }

      if (r.resultado === 'A' && r.cae && r.caeVto) {
        await marcarAutorizado(client, actual, numero, r.cae, r.caeVto, r.raw, r.observaciones);
        return { estado: 'autorizado', numero, cae: r.cae, mensajes: r.observaciones.map(o => `${o.code}: ${o.msg}`) };
      }

      // 10016 = el número no es el próximo (alguien numeró esa serie por fuera). Un reintento.
      if (intento === 1 && codigosDe(r).includes('10016')) {
        const ultimo = await ultimoAutorizado(ctx, c.punto_venta, c.cbte_tipo);
        if (ultimo + 1 > numero) { numero = ultimo + 1; continue; }
      }
      const motivos = [...r.errores, ...r.observaciones];
      await volverABorrador(client, id, 'rechazado', motivos, r.raw);
      return { estado: 'rechazado', numero: null, cae: null, mensajes: motivos.map(o => `${o.code}: ${o.msg}`) };
    }
  } finally {
    if (serie) await client.query(`SELECT pg_advisory_unlock(hashtext($1))`, [serie]).catch(() => {});
    client.release();
  }
}

export const descripcionCondIva = (id: number) => COND_IVA_DESC[id] ?? `Condición ${id}`;
export { tipoDocDeCbte };
