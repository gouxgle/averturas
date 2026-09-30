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
