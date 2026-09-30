import http from 'node:http';
import https from 'node:https';
import { XMLParser } from 'fast-xml-parser';
import { db } from '../../db.js';
import type { Ambiente } from './endpoints.js';

// Cliente SOAP mínimo para ARCA (sin la librería `soap`, que es pesada): el XML se arma
// con plantillas y la respuesta se lee con fast-xml-parser. Cada llamada queda en
// fiscal_eventos con el XML de ida y vuelta (Token/Sign enmascarados).

// Los servidores de ARCA (servicios1.afip.gov.ar) negocian claves DH débiles que
// OpenSSL 3 / Node 18+ rechazan por defecto: se baja el nivel SOLO para este agente.
const agenteArca = new https.Agent({ keepAlive: true, maxSockets: 4, ciphers: 'DEFAULT@SECLEVEL=1' });

export class ArcaError extends Error {
  constructor(
    message: string,
    /** Códigos de error de ARCA (p. ej. ['10016']) o 'red' / 'timeout' / 'soap'. */
    readonly codigos: string[],
    /** true si no se sabe si ARCA procesó el pedido (timeout, corte de red). */
    readonly incierto = false,
  ) {
    super(message);
    this.name = 'ArcaError';
  }
}

export interface LlamadaSoap {
  ambiente: Ambiente;
  servicio: 'wsaa' | 'wsfe' | 'padron';
  metodo: string;
  url: string;
  soapAction: string;
  cuerpo: string;          // contenido de <soap:Body>
  namespaces: string;      // atributos xmlns extra del Envelope
  timeoutMs?: number;
  comprobanteId?: string | null;
  usuarioId?: string | null;
}

export interface RespuestaSoap {
  body: Record<string, unknown>;  // contenido de Body ya parseado, sin prefijos de namespace
  raw: string;
  fechaServidor: Date | null;     // header Date: sirve para detectar reloj desfasado
}

const parser = new XMLParser({
  removeNSPrefix: true,
  ignoreAttributes: true,
  parseTagValue: false,   // todo como string: CUITs, CAE y números de comprobante no pierden dígitos
  trimValues: true,
});

export const escXml = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const enmascarar = (xml: string) => xml
  .replace(/<(\w+:)?(Token|token)>[^<]*</g, '<$1$2>***<')
  .replace(/<(\w+:)?(Sign|sign)>[^<]*</g, '<$1$2>***<');

function post(url: string, headers: Record<string, string>, data: string, timeoutMs: number) {
  return new Promise<{ status: number; body: string; date: string | undefined }>((resolve, reject) => {
    const u = new URL(url);
    const esHttps = u.protocol === 'https:';
    const req = (esHttps ? https : http).request(u, {
      method: 'POST',
      headers: { ...headers, 'Content-Length': Buffer.byteLength(data) },
      agent: esHttps ? agenteArca : undefined,
      timeout: timeoutMs,
    }, res => {
      const partes: Buffer[] = [];
      res.on('data', c => partes.push(c));
      res.on('end', () => resolve({
        status: res.statusCode ?? 0,
        body: Buffer.concat(partes).toString('utf8'),
        date: res.headers.date,
      }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end(data);
  });
}

async function registrar(ev: {
  l: LlamadaSoap; ok: boolean; ms: number; request: string; response: string | null;
  codigo?: string; mensaje?: string;
}) {
  await db.query(
    `INSERT INTO fiscal_eventos
       (tipo, servicio, metodo, ambiente, ok, duracion_ms, error_codigo, error_mensaje,
        request, response, comprobante_id, usuario_id)
     VALUES ('arca_llamada',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [ev.l.servicio, ev.l.metodo, ev.l.ambiente, ev.ok, ev.ms, ev.codigo ?? null, ev.mensaje ?? null,
     enmascarar(ev.request), ev.response ? enmascarar(ev.response) : null,
     ev.l.comprobanteId ?? null, ev.l.usuarioId ?? null],
  ).catch(() => { /* el registro nunca debe tumbar una emisión */ });
}

export async function llamarSoap(l: LlamadaSoap): Promise<RespuestaSoap> {
  const envelope =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" ${l.namespaces}>` +
    `<soap:Header/><soap:Body>${l.cuerpo}</soap:Body></soap:Envelope>`;
  const inicio = Date.now();
  let res: { status: number; body: string; date: string | undefined };
  try {
    res = await post(l.url, {
      'Content-Type': 'text/xml; charset=utf-8',
      SOAPAction: `"${l.soapAction}"`,
    }, envelope, l.timeoutMs ?? 30_000);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    const timeout = err.code === 'ETIMEDOUT' || err.message === 'timeout';
    // Si la conexión ni se estableció, ARCA seguro no recibió nada; si se cortó después, no se sabe.
    const noLlego = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'EHOSTUNREACH'].includes(err.code ?? '');
    const msg = timeout ? 'ARCA no respondió a tiempo' : `No se pudo conectar con ARCA (${err.code ?? err.message})`;
    await registrar({ l, ok: false, ms: Date.now() - inicio, request: envelope, response: null,
      codigo: timeout ? 'timeout' : 'red', mensaje: msg });
    throw new ArcaError(msg, [timeout ? 'timeout' : 'red'], !noLlego);
  }
  const ms = Date.now() - inicio;

  let parsed: Record<string, unknown>;
  try {
    parsed = parser.parse(res.body) as Record<string, unknown>;
  } catch {
    await registrar({ l, ok: false, ms, request: envelope, response: res.body, codigo: 'soap', mensaje: `HTTP ${res.status}: respuesta no XML` });
    throw new ArcaError(`ARCA devolvió una respuesta inválida (HTTP ${res.status})`, ['soap'], res.status >= 500);
  }
  const body = ((parsed.Envelope as Record<string, unknown> | undefined)?.Body ?? {}) as Record<string, unknown>;
  const fault = body.Fault as Record<string, unknown> | undefined;
  if (fault) {
    const codigo = String(fault.faultcode ?? 'soap').replace(/^.*:/, '');
    const mensaje = String(fault.faultstring ?? 'Error SOAP');
    await registrar({ l, ok: false, ms, request: envelope, response: res.body, codigo, mensaje });
    throw new ArcaError(mensaje, [codigo]);
  }
  await registrar({ l, ok: true, ms, request: envelope, response: res.body });
  return { body, raw: res.body, fechaServidor: res.date ? new Date(res.date) : null };
}

/** Normaliza nodos que ARCA devuelve como objeto si hay uno y como array si hay varios. */
export function comoArray<T>(v: T | T[] | undefined | null | ''): T[] {
  if (v === undefined || v === null || v === '') return [];
  return Array.isArray(v) ? v : [v];
}
