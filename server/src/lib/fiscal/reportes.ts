import { db } from '../../db.js';
import { leerConfig } from './config.js';
import { CBTE_DESC, COND_IVA_DESC } from './calculo.js';
import { iso } from './emision.js';
import { consultarComprobante, ultimoAutorizado, fechaDeArca } from '../arca/wsfe.js';

// Reportes para el contador: Libro IVA Ventas del período y control cruzado contra ARCA
// (lo que el sistema tiene vs lo que ARCA tiene: detecta diferencias con "Mis comprobantes").

const ALICUOTAS = [21, 10.5, 27, 5, 2.5, 0] as const;
const a2 = (n: number) => Math.round(n * 100) / 100;

export interface FilaLibro {
  id: string; fecha: string; tipo: string; cbte_tipo: number; clase: string; punto_venta: number; numero: number;
  receptor: string; doc_tipo: number; doc_nro: string; condicion_iva: string;
  netos: Record<string, number>; ivas: Record<string, number>; exento: number; total: number; cae: string; modo: string;
}

export async function libroIvaVentas(desde: string, hasta: string) {
  const cfg = await leerConfig();
  const { rows } = await db.query(
    `SELECT c.id, c.fecha, c.cbte_tipo, c.clase, c.tipo_doc, c.punto_venta, c.numero, c.receptor_nombre,
            c.receptor_doc_tipo, c.receptor_doc_nro, c.receptor_condicion_iva_id, c.imp_op_ex, c.imp_total, c.cae, c.modo,
            COALESCE(json_agg(json_build_object('a', i.alicuota, 'b', i.base_imp, 'i', i.importe))
                     FILTER (WHERE i.alicuota_id IS NOT NULL), '[]') AS iva
       FROM comprobantes c LEFT JOIN comprobante_iva i ON i.comprobante_id = c.id
      WHERE c.estado IN ('autorizado', 'contingencia') AND c.ambiente = $1 AND c.fecha BETWEEN $2 AND $3
      GROUP BY c.id
      ORDER BY c.fecha, c.punto_venta, c.cbte_tipo, c.numero`, [cfg.ambiente, desde, hasta]);

  const filas: FilaLibro[] = rows.map(r => {
    const signo = r.tipo_doc === 'nota_credito' ? -1 : 1;
    const netos: Record<string, number> = {};
    const ivas: Record<string, number> = {};
    for (const x of r.iva as { a: string; b: string; i: string }[]) {
      const k = String(Number(x.a));
      netos[k] = a2((netos[k] ?? 0) + signo * Number(x.b));
      ivas[k] = a2((ivas[k] ?? 0) + signo * Number(x.i));
    }
    return {
      id: r.id, fecha: iso(r.fecha)!, tipo: CBTE_DESC[r.cbte_tipo] ?? String(r.cbte_tipo), cbte_tipo: r.cbte_tipo, clase: r.clase,
      punto_venta: r.punto_venta, numero: Number(r.numero), receptor: r.receptor_nombre, doc_tipo: r.receptor_doc_tipo,
      doc_nro: r.receptor_doc_nro, condicion_iva: COND_IVA_DESC[r.receptor_condicion_iva_id] ?? '',
      netos, ivas, exento: a2(signo * Number(r.imp_op_ex)), total: a2(signo * Number(r.imp_total)), cae: r.cae, modo: r.modo,
    };
  });

  const totales = { netos: {} as Record<string, number>, ivas: {} as Record<string, number>, exento: 0, total: 0, cantidad: filas.length };
  for (const f of filas) {
    for (const [k, v] of Object.entries(f.netos)) totales.netos[k] = a2((totales.netos[k] ?? 0) + v);
    for (const [k, v] of Object.entries(f.ivas)) totales.ivas[k] = a2((totales.ivas[k] ?? 0) + v);
    totales.exento = a2(totales.exento + f.exento);
    totales.total = a2(totales.total + f.total);
  }
  const alicuotas = ALICUOTAS.map(String).filter(k => k in totales.netos);
  return { desde, hasta, ambiente: cfg.ambiente, filas, totales, alicuotas };
}

/** CSV para Excel en castellano: separador ";", coma decimal y BOM para los acentos. */
export function libroIvaCsv(l: Awaited<ReturnType<typeof libroIvaVentas>>): string {
  const n = (v: number | undefined) => (v ?? 0).toFixed(2).replace('.', ',');
  const q = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const cab = ['Fecha', 'Tipo', 'Punto de venta', 'Número', 'Cliente', 'Tipo doc.', 'Documento', 'Condición IVA',
    ...l.alicuotas.flatMap(a => [`Neto ${a.replace('.', ',')}%`, `IVA ${a.replace('.', ',')}%`]), 'Exento', 'Total', 'CAE/CAEA'];
  const docTipo: Record<number, string> = { 80: 'CUIT', 86: 'CUIL', 96: 'DNI', 99: 'Sin identificar' };
  const lineas = l.filas.map(f => [
    `${f.fecha.slice(8, 10)}/${f.fecha.slice(5, 7)}/${f.fecha.slice(0, 4)}`, q(f.tipo), String(f.punto_venta).padStart(5, '0'),
    String(f.numero).padStart(8, '0'), q(f.receptor), docTipo[f.doc_tipo] ?? f.doc_tipo, q(f.doc_tipo === 99 ? '' : f.doc_nro), q(f.condicion_iva),
    ...l.alicuotas.flatMap(a => [n(f.netos[a]), n(f.ivas[a])]), n(f.exento), n(f.total), q(f.cae),
  ].join(';'));
  const tot = ['TOTAL', '', '', '', q(`${l.totales.cantidad} comprobantes`), '', '', '',
    ...l.alicuotas.flatMap(a => [n(l.totales.netos[a]), n(l.totales.ivas[a])]), n(l.totales.exento), n(l.totales.total), ''].join(';');
  return '﻿' + [cab.map(q).join(';'), ...lineas, tot].join('\r\n') + '\r\n';
}

export interface Diferencia { tipo: 'faltante_en_arca' | 'distinto' | 'numeros_ajenos' | 'error'; detalle: string; comprobante_id?: string }

/**
 * Control cruzado con ARCA para un período: cada comprobante autorizado tiene que existir en
 * ARCA con el mismo total, documento, fecha y código de autorización; y en cada serie el último
 * número de ARCA no puede ser mayor que el del sistema (números emitidos por fuera).
 */
export async function controlConArca(desde: string, hasta: string, usuarioId: string | null) {
  const cfg = await leerConfig();
  if (!cfg.cuit) throw new Error('Falta el CUIT del emisor');
  const ctx = { ambiente: cfg.ambiente, cuit: cfg.cuit, usuarioId, timeoutMs: 20_000 };
  const { rows } = await db.query(
    `SELECT id, punto_venta, cbte_tipo, numero, fecha, imp_total, receptor_doc_nro, cae
       FROM comprobantes WHERE estado = 'autorizado' AND ambiente = $1 AND fecha BETWEEN $2 AND $3
      ORDER BY punto_venta, cbte_tipo, numero LIMIT 400`, [cfg.ambiente, desde, hasta]);
  const diferencias: Diferencia[] = [];
  let verificados = 0;
  for (const r of rows) {
    const nombre = `${CBTE_DESC[r.cbte_tipo]} ${String(r.punto_venta).padStart(5, '0')}-${String(r.numero).padStart(8, '0')}`;
    try {
      const a = await consultarComprobante(ctx, r.punto_venta, r.cbte_tipo, Number(r.numero));
      if (!a) { diferencias.push({ tipo: 'faltante_en_arca', detalle: `${nombre}: ARCA no lo tiene registrado`, comprobante_id: r.id }); continue; }
      const dif: string[] = [];
      if (Math.abs(Number(a.ImpTotal) - Number(r.imp_total)) > 0.005) dif.push(`total ARCA ${a.ImpTotal} / sistema ${r.imp_total}`);
      if (String(a.DocNro) !== String(Number(r.receptor_doc_nro))) dif.push(`documento ARCA ${a.DocNro} / sistema ${r.receptor_doc_nro}`);
      if (a.CbteFch && fechaDeArca(String(a.CbteFch)) !== iso(r.fecha)) dif.push(`fecha ARCA ${fechaDeArca(String(a.CbteFch))} / sistema ${iso(r.fecha)}`);
      if (a.CodAutorizacion && String(a.CodAutorizacion) !== String(r.cae)) dif.push(`código ARCA ${a.CodAutorizacion} / sistema ${r.cae}`);
      if (dif.length) diferencias.push({ tipo: 'distinto', detalle: `${nombre}: ${dif.join(' · ')}`, comprobante_id: r.id });
      else verificados++;
    } catch (e) {
      diferencias.push({ tipo: 'error', detalle: `${nombre}: no se pudo consultar (${(e as Error).message})`, comprobante_id: r.id });
    }
  }
  // Series: ¿ARCA tiene números más altos que el sistema?
  const { rows: series } = await db.query(
    `SELECT punto_venta, cbte_tipo, max(numero) AS max FROM comprobantes
      WHERE ambiente = $1 AND numero IS NOT NULL AND estado IN ('autorizado', 'contingencia')
      GROUP BY punto_venta, cbte_tipo`, [cfg.ambiente]);
  for (const s of series) {
    try {
      const ultimo = await ultimoAutorizado(ctx, s.punto_venta, s.cbte_tipo);
      if (ultimo > Number(s.max)) {
        diferencias.push({
          tipo: 'numeros_ajenos',
          detalle: `${CBTE_DESC[s.cbte_tipo]} PV ${String(s.punto_venta).padStart(5, '0')}: ARCA llega al ${ultimo} y el sistema al ${s.max}. ` +
            '¿Se emitieron comprobantes desde otro sistema con este punto de venta?',
        });
      }
    } catch (e) {
      diferencias.push({ tipo: 'error', detalle: `Serie PV ${s.punto_venta} tipo ${s.cbte_tipo}: ${(e as Error).message}` });
    }
  }
  await db.query(
    `INSERT INTO fiscal_eventos (tipo, ok, error_mensaje, usuario_id) VALUES ('control', $1, $2, $3)`,
    [diferencias.length === 0, `Control con ARCA ${desde} a ${hasta}: ${verificados} verificados, ${diferencias.length} diferencias`, usuarioId]);
  return { desde, hasta, revisados: rows.length, verificados, diferencias, limitado: rows.length === 400 };
}
