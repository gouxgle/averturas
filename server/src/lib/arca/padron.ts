import { db } from '../../db.js';
import { urlServicio, type Ambiente } from './endpoints.js';
import { obtenerTicket } from './wsaa.js';
import { llamarSoap, ArcaError, comoArray, escXml } from './soap.js';
import { cuitValido, normalizarCuit } from '../fiscal/cuit.js';
import { COND_IVA } from '../fiscal/calculo.js';
import { claveCondicionIva, type ClaveCondicionIva } from '../fiscal/condicionIva.js';

// Padrón de ARCA: ws_sr_constancia_inscripcion (getPersona_v2). Devuelve nombre o razón
// social, domicilio fiscal y los impuestos inscriptos, de donde sale la condición de IVA.
// Se cachea 24 h en padron_cache.

export interface PersonaArca {
  cuit: string;
  tipo_persona: 'fisica' | 'juridica';
  nombre: string | null;
  apellido: string | null;
  razon_social: string | null;
  nombre_completo: string;
  estado_clave: string | null;             // ACTIVO / INACTIVO
  domicilio: { direccion: string | null; localidad: string | null; cp: string | null; provincia: string | null } | null;
  domicilio_texto: string | null;
  condicion_iva: ClaveCondicionIva;
  condicion_iva_id: number;
  monotributo_categoria: string | null;
  actividad: string | null;
  avisos: string[];                        // errores parciales que informa ARCA
}

type Nodo = Record<string, unknown>;

/** "CARLOS ALBERTO" → "Carlos Alberto" (el padrón devuelve todo en mayúsculas). */
export function tituloPropio(s: string | null | undefined): string | null {
  if (!s) return null;
  return s.toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (_, sep: string, l: string) => sep + l.toUpperCase())
    .replace(/\b(De|Del|La|Las|Los|Y)\b/g, m => m.toLowerCase()).replace(/^./, m => m.toUpperCase());
}

const txt = (v: unknown) => (v === undefined || v === null || v === '' ? null : String(v).trim());

export function normalizarPersona(cuit: string, r: Nodo): PersonaArca {
  const g = (r.datosGenerales ?? {}) as Nodo;
  const errCons = (r.errorConstancia ?? {}) as Nodo;
  const avisos = [
    ...comoArray(errCons.error as string | string[]),
    ...comoArray(((r.errorRegimenGeneral ?? {}) as Nodo).error as string | string[]),
    ...comoArray(((r.errorMonotributo ?? {}) as Nodo).error as string | string[]),
  ].map(String);

  const juridica = String(g.tipoPersona ?? '').toUpperCase() === 'JURIDICA';
  const apellido = txt(g.apellido ?? errCons.apellido);
  const nombre = txt(g.nombre ?? errCons.nombre);
  const razon = txt(g.razonSocial);

  const dom = g.domicilioFiscal as Nodo | undefined;
  const provincia = txt(dom?.descripcionProvincia);
  const localidad = txt(dom?.localidad) ?? (provincia === 'CIUDAD AUTONOMA BUENOS AIRES' ? 'CABA' : null);
  const domicilio = dom ? { direccion: txt(dom.direccion), localidad, cp: txt(dom.codPostal), provincia } : null;

  // Condición de IVA a partir de los impuestos inscriptos.
  const mono = r.datosMonotributo as Nodo | undefined;
  const impuestos = comoArray((r.datosRegimenGeneral as Nodo | undefined)?.impuesto as Nodo | Nodo[])
    .map(i => Number(i.idImpuesto));
  let condId: number = COND_IVA.CONSUMIDOR_FINAL;
  if (mono && comoArray(mono.impuesto as Nodo | Nodo[]).length) condId = COND_IVA.MONOTRIBUTO;
  else if (impuestos.includes(30)) condId = COND_IVA.RESPONSABLE_INSCRIPTO;
  else if (impuestos.includes(32)) condId = COND_IVA.EXENTO;

  const actividades = comoArray((r.datosRegimenGeneral as Nodo | undefined)?.actividad as Nodo | Nodo[]);
  const principal = actividades.find(a => String(a.orden) === '1') ?? actividades[0];

  const nombreCompleto = juridica ? (razon ?? '') : [apellido, nombre].filter(Boolean).join(' ');
  return {
    cuit, tipo_persona: juridica ? 'juridica' : 'fisica',
    nombre: juridica ? null : tituloPropio(nombre), apellido: juridica ? null : tituloPropio(apellido),
    razon_social: juridica ? razon : null, nombre_completo: juridica ? nombreCompleto : tituloPropio(nombreCompleto) ?? '',
    estado_clave: txt(g.estadoClave), domicilio,
    domicilio_texto: domicilio
      ? [domicilio.direccion, tituloPropio(domicilio.localidad), tituloPropio(domicilio.provincia)].filter(Boolean).join(', ')
        + (domicilio.cp ? ` (CP ${domicilio.cp})` : '')
      : null,
    condicion_iva: claveCondicionIva(condId), condicion_iva_id: condId,
    monotributo_categoria: txt(((mono?.categoriaMonotributo ?? {}) as Nodo).descripcionCategoria),
    actividad: txt(principal?.descripcionActividad),
    avisos,
  };
}

const TTL_MS = 24 * 3600 * 1000;

export interface ContextoPadron { ambiente: Ambiente; cuitEmisor: string; usuarioId?: string | null }

/** Consulta el padrón (con caché de 24 h salvo `forzar`). */
export async function consultarPadron(ctx: ContextoPadron, cuitConsultado: string, forzar = false):
  Promise<{ persona: PersonaArca; desde_cache: boolean; consultado_at: string }> {
  const cuit = normalizarCuit(cuitConsultado);
  if (!cuitValido(cuit)) throw new ArcaError('El CUIT no es válido (revisá el dígito verificador)', ['cuit_invalido']);

  if (!forzar) {
    const { rows: [c] } = await db.query(
      `SELECT datos, consultado_at FROM padron_cache WHERE cuit = $1 AND consultado_at > now() - ($2 || ' milliseconds')::interval`,
      [cuit, String(TTL_MS)]);
    if (c) return { persona: c.datos as PersonaArca, desde_cache: true, consultado_at: new Date(c.consultado_at).toISOString() };
  }

  const t = await obtenerTicket(ctx.ambiente, 'padron', ctx.cuitEmisor);
  let body: Nodo;
  try {
    ({ body } = await llamarSoap({
      ambiente: ctx.ambiente, servicio: 'padron', metodo: 'getPersona_v2', url: urlServicio(ctx.ambiente, 'padron'),
      soapAction: '', namespaces: 'xmlns:a5="http://a5.soap.ws.server.puc.sr/"', usuarioId: ctx.usuarioId, timeoutMs: 20_000,
      cuerpo: `<a5:getPersona_v2><token>${t.token}</token><sign>${t.sign}</sign>` +
        `<cuitRepresentada>${escXml(ctx.cuitEmisor)}</cuitRepresentada><idPersona>${escXml(cuit)}</idPersona></a5:getPersona_v2>`,
    }));
  } catch (e) {
    if (e instanceof ArcaError && /no existe persona/i.test(e.message)) {
      throw new ArcaError('ARCA no tiene ninguna persona con ese CUIT', ['no_existe']);
    }
    throw e;
  }
  const r = ((body.getPersona_v2Response as Nodo | undefined)?.personaReturn ?? {}) as Nodo;
  if (!r.datosGenerales && !(r.errorConstancia as Nodo | undefined)?.apellido) {
    const motivos = comoArray(((r.errorConstancia ?? {}) as Nodo).error as string | string[]).join(' · ');
    throw new ArcaError(motivos || 'ARCA no devolvió datos para ese CUIT', ['sin_datos']);
  }
  const persona = normalizarPersona(cuit, r);
  const { rows: [g] } = await db.query(
    `INSERT INTO padron_cache (cuit, datos, respuesta, ambiente, consultado_at) VALUES ($1,$2,$3,$4,now())
     ON CONFLICT (cuit) DO UPDATE SET datos = EXCLUDED.datos, respuesta = EXCLUDED.respuesta,
       ambiente = EXCLUDED.ambiente, consultado_at = now()
     RETURNING consultado_at`,
    [cuit, JSON.stringify(persona), JSON.stringify(r), ctx.ambiente]);
  return { persona, desde_cache: false, consultado_at: new Date(g.consultado_at).toISOString() };
}
