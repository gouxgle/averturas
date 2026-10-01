import { urlServicio, type Ambiente } from './endpoints.js';
import { obtenerTicket } from './wsaa.js';
import { llamarSoap, ArcaError, comoArray, escXml } from './soap.js';

// WSFEv1 (factura electrónica). Métodos de consulta; la emisión (FECAESolicitar) se suma
// en la etapa F2 sobre el mismo `invocar`.

const NS = 'http://ar.gov.afip.dif.FEV1/';

export interface ContextoArca {
  ambiente: Ambiente;
  cuit: string;
  usuarioId?: string | null;
  comprobanteId?: string | null;
  timeoutMs?: number;
}

type Nodo = Record<string, unknown>;
interface ErrArca { Code?: string; Msg?: string }

/** Llama un método de WSFE (con Auth salvo FEDummy) y devuelve el nodo <Metodo>Result. */
export async function invocar(ctx: ContextoArca, metodo: string, params = '', conAuth = true):
  Promise<{ result: Nodo; fechaServidor: Date | null }> {
  let auth = '';
  if (conAuth) {
    const t = await obtenerTicket(ctx.ambiente, 'wsfe', ctx.cuit);
    auth = `<ar:Auth><ar:Token>${t.token}</ar:Token><ar:Sign>${t.sign}</ar:Sign><ar:Cuit>${escXml(ctx.cuit)}</ar:Cuit></ar:Auth>`;
  }
  const { body, fechaServidor } = await llamarSoap({
    ambiente: ctx.ambiente, servicio: 'wsfe', metodo, url: urlServicio(ctx.ambiente, 'wsfe'),
    soapAction: NS + metodo, namespaces: `xmlns:ar="${NS}"`,
    cuerpo: `<ar:${metodo}>${auth}${params}</ar:${metodo}>`,
    usuarioId: ctx.usuarioId, comprobanteId: ctx.comprobanteId, timeoutMs: ctx.timeoutMs,
  });
  const result = ((body[`${metodo}Response`] as Nodo | undefined)?.[`${metodo}Result`] ?? {}) as Nodo;
  return { result, fechaServidor };
}

/** Errores de negocio de WSFE (<Errors><Err>) → ArcaError con los códigos. */
export function erroresDe(result: Nodo): ArcaError | null {
  const errs = comoArray((result.Errors as { Err?: ErrArca | ErrArca[] } | undefined)?.Err);
  if (!errs.length) return null;
  return new ArcaError(errs.map(e => `${e.Code}: ${e.Msg}`).join(' · '), errs.map(e => String(e.Code)));
}

function exigirSinErrores(result: Nodo) {
  const e = erroresDe(result);
  if (e) throw e;
}

export async function feDummy(ctx: ContextoArca) {
  const { result, fechaServidor } = await invocar(ctx, 'FEDummy', '', false);
  return {
    appServer: String(result.AppServer ?? ''), dbServer: String(result.DbServer ?? ''),
    authServer: String(result.AuthServer ?? ''), fechaServidor,
  };
}

export async function ultimoAutorizado(ctx: ContextoArca, ptoVta: number, cbteTipo: number): Promise<number> {
  const { result } = await invocar(ctx, 'FECompUltimoAutorizado',
    `<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo>`);
  exigirSinErrores(result);
  return Number(result.CbteNro ?? 0);
}

export interface PuntoVentaArca { numero: number; emisionTipo: string; bloqueado: boolean; baja: string | null }

export async function puntosDeVenta(ctx: ContextoArca): Promise<PuntoVentaArca[]> {
  const { result } = await invocar(ctx, 'FEParamGetPtosVenta');
  // Sin puntos de venta web service ARCA responde el error 602 ("sin resultados").
  const err = erroresDe(result);
  if (err && !err.codigos.includes('602')) throw err;
  const lista = comoArray((result.ResultGet as { PtoVenta?: Nodo | Nodo[] } | undefined)?.PtoVenta);
  return lista.map(p => ({
    numero: Number(p.Nro), emisionTipo: String(p.EmisionTipo ?? ''),
    bloqueado: String(p.Bloqueado ?? 'N') === 'S',
    baja: p.FchBaja && String(p.FchBaja) !== 'NULL' ? String(p.FchBaja) : null,
  }));
}

export interface ParamArca { id: number; desc: string }

async function paramLista(ctx: ContextoArca, metodo: string, nodo: string, params = ''): Promise<ParamArca[]> {
  const { result } = await invocar(ctx, metodo, params);
  exigirSinErrores(result);
  return comoArray((result.ResultGet as Record<string, Nodo | Nodo[]> | undefined)?.[nodo])
    .map(x => ({ id: Number(x.Id), desc: String(x.Desc ?? '') }));
}

export const tiposComprobante = (ctx: ContextoArca) => paramLista(ctx, 'FEParamGetTiposCbte', 'CbteTipo');
export const condicionesIvaReceptor = (ctx: ContextoArca, claseCmp?: 'A' | 'B' | 'C' | 'M') =>
  paramLista(ctx, 'FEParamGetCondicionIvaReceptor', 'CondicionIvaReceptor',
    claseCmp ? `<ar:ClaseCmp>${claseCmp}</ar:ClaseCmp>` : '');

/** Comprobante ya autorizado en ARCA, o null si no existe (error 602). */
export async function consultarComprobante(ctx: ContextoArca, ptoVta: number, cbteTipo: number, numero: number):
  Promise<Nodo | null> {
  const { result } = await invocar(ctx, 'FECompConsultar',
    `<ar:FeCompConsReq><ar:CbteTipo>${cbteTipo}</ar:CbteTipo><ar:CbteNro>${numero}</ar:CbteNro>` +
    `<ar:PtoVta>${ptoVta}</ar:PtoVta></ar:FeCompConsReq>`);
  const err = erroresDe(result);
  if (err?.codigos.includes('602')) return null;
  if (err) throw err;
  return (result.ResultGet as Nodo | undefined) ?? null;
}

// ── Emisión ──────────────────────────────────────────────────────────────────
export interface SolicitudCAE {
  ptoVta: number; cbteTipo: number; numero: number; concepto: number;
  docTipo: number; docNro: string; fecha: string;             // AAAA-MM-DD
  impTotal: number; impTotConc: number; impNeto: number; impOpEx: number; impTrib: number; impIVA: number;
  fchServDesde?: string | null; fchServHasta?: string | null; fchVtoPago?: string | null;
  monId: string; monCotiz: number; condicionIvaReceptorId: number;
  asociado?: { tipo: number; ptoVta: number; nro: number; cuit: string; fecha: string } | null;
  iva: { id: number; baseImp: number; importe: number }[];
}

export interface RespuestaCAE {
  resultado: 'A' | 'R' | 'P';
  cae: string | null; caeVto: string | null;                 // AAAA-MM-DD
  observaciones: { code: string; msg: string }[];
  errores: { code: string; msg: string }[];
  raw: Record<string, unknown>;
}

const f8 = (iso: string) => iso.replace(/-/g, '');           // AAAA-MM-DD → AAAAMMDD
const de8 = (s: string) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const imp = (n: number) => n.toFixed(2);

/** XML del detalle en el orden exacto del XSD de WSFEv1 (el orden importa). */
export function xmlSolicitudCAE(s: SolicitudCAE): string {
  const e = (t: string, v: string | number) => `<ar:${t}>${escXml(v)}</ar:${t}>`;
  return `<ar:FeCAEReq><ar:FeCabReq>${e('CantReg', 1)}${e('PtoVta', s.ptoVta)}${e('CbteTipo', s.cbteTipo)}</ar:FeCabReq>` +
    `<ar:FeDetReq><ar:FECAEDetRequest>` +
    e('Concepto', s.concepto) + e('DocTipo', s.docTipo) + e('DocNro', s.docNro) +
    e('CbteDesde', s.numero) + e('CbteHasta', s.numero) + e('CbteFch', f8(s.fecha)) +
    e('ImpTotal', imp(s.impTotal)) + e('ImpTotConc', imp(s.impTotConc)) + e('ImpNeto', imp(s.impNeto)) +
    e('ImpOpEx', imp(s.impOpEx)) + e('ImpTrib', imp(s.impTrib)) + e('ImpIVA', imp(s.impIVA)) +
    (s.concepto !== 1
      ? e('FchServDesde', f8(s.fchServDesde!)) + e('FchServHasta', f8(s.fchServHasta!)) + e('FchVtoPago', f8(s.fchVtoPago!))
      : '') +
    e('MonId', s.monId) + e('MonCotiz', s.monCotiz) + e('CondicionIVAReceptorId', s.condicionIvaReceptorId) +
    (s.asociado
      ? `<ar:CbtesAsoc><ar:CbteAsoc>${e('Tipo', s.asociado.tipo)}${e('PtoVta', s.asociado.ptoVta)}${e('Nro', s.asociado.nro)}` +
        `${e('Cuit', s.asociado.cuit)}${e('CbteFch', f8(s.asociado.fecha))}</ar:CbteAsoc></ar:CbtesAsoc>`
      : '') +
    (s.iva.length
      ? `<ar:Iva>${s.iva.map(a => `<ar:AlicIva>${e('Id', a.id)}${e('BaseImp', imp(a.baseImp))}${e('Importe', imp(a.importe))}</ar:AlicIva>`).join('')}</ar:Iva>`
      : '') +
    `</ar:FECAEDetRequest></ar:FeDetReq></ar:FeCAEReq>`;
}

const listaMsgs = (n: unknown, hijo: string) =>
  comoArray((n as Record<string, Nodo | Nodo[]> | undefined)?.[hijo])
    .map(o => ({ code: String(o.Code ?? ''), msg: String(o.Msg ?? '') }));

/**
 * FECAESolicitar. Si ARCA no responde lanza ArcaError con `incierto`: el llamador NO debe
 * reintentar sin antes consultar con FECompConsultar (WSFE no es idempotente).
 */
export async function solicitarCAE(ctx: ContextoArca, s: SolicitudCAE): Promise<RespuestaCAE> {
  const { result } = await invocar(ctx, 'FECAESolicitar', xmlSolicitudCAE(s));
  const det = (result.FeDetResp as { FECAEDetResponse?: Nodo | Nodo[] } | undefined)?.FECAEDetResponse;
  const d = comoArray(det)[0] ?? {};
  const cab = (result.FeCabResp ?? {}) as Nodo;
  const errores = listaMsgs(result.Errors, 'Err');
  const resultado = String(d.Resultado ?? cab.Resultado ?? (errores.length ? 'R' : '')) as 'A' | 'R' | 'P';
  const cae = d.CAE && String(d.CAE) !== '' ? String(d.CAE) : null;
  const vto = d.CAEFchVto ? String(d.CAEFchVto) : '';
  return {
    resultado, cae, caeVto: /^\d{8}$/.test(vto) ? de8(vto) : null,
    observaciones: listaMsgs(d.Observaciones, 'Obs'),
    errores, raw: result,
  };
}

export { de8 as fechaDeArca };

// ── CAEA (contingencia, RG 5852) ─────────────────────────────────────────────
export interface CaeaArca { caea: string; periodo: number; orden: number; vigDesde: string; vigHasta: string; topeInf: string }

function caeaDe(r: Nodo): CaeaArca | null {
  const g = (r.ResultGet ?? {}) as Nodo;
  if (!g.CAEA) return null;
  return {
    caea: String(g.CAEA), periodo: Number(g.Periodo), orden: Number(g.Orden),
    vigDesde: de8(String(g.FchVigDesde)), vigHasta: de8(String(g.FchVigHasta)), topeInf: de8(String(g.FchTopeInf)),
  };
}

/** Pide el CAEA de una quincena; si ya estaba otorgado lo consulta (15008 = ya existe). */
export async function solicitarCAEA(ctx: ContextoArca, periodo: number, orden: 1 | 2): Promise<CaeaArca> {
  const params = `<ar:Periodo>${periodo}</ar:Periodo><ar:Orden>${orden}</ar:Orden>`;
  const { result } = await invocar(ctx, 'FECAEASolicitar', params);
  const ok = caeaDe(result);
  if (ok) return ok;
  const err = erroresDe(result);
  if (err && !err.codigos.some(c => ['15008', '15006'].includes(c))) throw err;
  const { result: r2 } = await invocar(ctx, 'FECAEAConsultar', params);
  const c = caeaDe(r2);
  if (!c) throw erroresDe(r2) ?? new ArcaError('ARCA no devolvió el CAEA', ['sin_caea']);
  return c;
}

/** Informa a ARCA un comprobante emitido con CAEA (CbteFchHsGen = fecha y hora de generación). */
export async function informarCAEA(ctx: ContextoArca, s: SolicitudCAE, caea: string, generadoAt: Date): Promise<RespuestaCAE> {
  const hs = new Date(generadoAt.getTime() - 3 * 3600_000).toISOString().replace(/\D/g, '').slice(0, 14); // hora AR
  const detalle = xmlSolicitudCAE(s)
    .replace('<ar:FeCAEReq>', '<ar:FeCAEARegInfReq>').replace('</ar:FeCAEReq>', '</ar:FeCAEARegInfReq>')
    .replace(/FECAEDetRequest>/g, 'FECAEADetRequest>')
    .replace('</ar:FECAEADetRequest>', `<ar:CAEA>${escXml(caea)}</ar:CAEA><ar:CbteFchHsGen>${hs}</ar:CbteFchHsGen></ar:FECAEADetRequest>`);
  const { result } = await invocar(ctx, 'FECAEARegInformativo', detalle);
  const d = comoArray((result.FeDetResp as { FECAEADetResponse?: Nodo | Nodo[] } | undefined)?.FECAEADetResponse)[0] ?? {};
  const errores = listaMsgs(result.Errors, 'Err');
  return {
    resultado: String(d.Resultado ?? ((result.FeCabResp ?? {}) as Nodo).Resultado ?? (errores.length ? 'R' : '')) as 'A' | 'R' | 'P',
    cae: d.CAEA ? String(d.CAEA) : caea, caeVto: null,
    observaciones: listaMsgs(d.Observaciones, 'Obs'), errores, raw: result,
  };
}

export async function informarCAEASinMovimiento(ctx: ContextoArca, ptoVta: number, caea: string): Promise<void> {
  const { result } = await invocar(ctx, 'FECAEASinMovimientoInformar',
    `<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CAEA>${escXml(caea)}</ar:CAEA>`);
  const err = erroresDe(result);
  // Ya informado antes = listo (idempotente).
  if (err && !/informad/i.test(err.message)) throw err;
}
