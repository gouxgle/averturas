import { db } from '../../db.js';
import { cuitValido, normalizarCuit } from './cuit.js';
import { CONDICIONES_IVA } from './condicionIva.js';
import type { PersonaArca } from '../arca/padron.js';

// Completar la ficha de un cliente con lo que informa el padrón de ARCA al facturarle.
// Regla: ARCA manda en lo fiscal (condición de IVA, domicilio fiscal, CUIT); en lo demás solo
// se completa lo que falta. Un nombre real cargado por el operador no se pisa, salvo que sea
// un nombre provisorio ("Contacto", "Sin nombre"…): ahí ARCA da el nombre verdadero.

export interface ClienteFiscal {
  id: string; tipo_persona: string; nombre: string | null; apellido: string | null; razon_social: string | null;
  documento_nro: string | null; telefono: string | null; cuit: string | null; condicion_iva: string | null;
  domicilio_fiscal: string | null; direccion: string | null; localidad: string | null; codigo_postal: string | null;
}

export const COLS_CLIENTE_FISCAL = `id, tipo_persona, nombre, apellido, razon_social, documento_nro, telefono, cuit,
  condicion_iva, domicilio_fiscal, direccion, localidad, codigo_postal`;

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const PROVISORIAS = new Set(['contacto', 'contactos', 'sin', 'nombre', 'desconocido', 'desconocida', 'cliente', 'nuevo', 'nueva',
  'lead', 'whatsapp', 'wsp', 'sn', 'anonimo', 'anonima', 'consulta', 'interesado', 'interesada']);

export function nombreProvisorio(c: Pick<ClienteFiscal, 'apellido' | 'nombre' | 'razon_social' | 'telefono'>): boolean {
  const completo = sinAcentos([c.apellido, c.nombre, c.razon_social].filter(Boolean).join(' ')).toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();
  if (!completo) return true;
  if (completo.split(' ').some(p => PROVISORIAS.has(p) || /^\d+$/.test(p))) return true;
  const tel = (c.telefono ?? '').replace(/\D/g, '').slice(-10);
  return !!tel && completo.replace(/\s/g, '') === tel;
}

/** CUIT que ya se conoce de la ficha: el campo propio o un DNI/CUIT cargado en "documento". */
export function cuitDeCliente(c: Pick<ClienteFiscal, 'cuit' | 'documento_nro'>): string | null {
  for (const v of [c.cuit, c.documento_nro]) {
    const n = normalizarCuit(v);
    if (cuitValido(n)) return n;
  }
  return null;
}

export type DatoFaltante = 'cuit' | 'condicion_iva' | 'domicilio' | 'nombre';

/** Qué le falta a la ficha para facturar sin sorpresas. */
export function faltantesParaFacturar(c: ClienteFiscal): DatoFaltante[] {
  const f: DatoFaltante[] = [];
  if (!cuitDeCliente(c) && !/^\d{6,8}$/.test((c.documento_nro ?? '').replace(/\D/g, ''))) f.push('cuit');
  if (!(c.condicion_iva ?? '').trim()) f.push('condicion_iva');
  if (!(c.domicilio_fiscal ?? '').trim() && !(c.direccion ?? '').trim()) f.push('domicilio');
  if (nombreProvisorio(c)) f.push('nombre');
  return f;
}

export interface CambioFicha { campo: string; etiqueta: string; antes: string | null; despues: string }

const etiquetaCond = (clave: string | null) => CONDICIONES_IVA.find(x => x.clave === clave)?.etiqueta ?? (clave || null);

/** Decide qué columnas de la ficha cambian con lo que informa ARCA. Función pura. */
export function planCompletar(c: ClienteFiscal, p: PersonaArca): { columnas: Record<string, string>; cambios: CambioFicha[] } {
  const columnas: Record<string, string> = {};
  const cambios: CambioFicha[] = [];
  const poner = (campo: string, etiqueta: string, antes: string | null, despues: string | null | undefined) => {
    if (!despues || despues === (antes ?? '')) return;
    columnas[campo] = despues;
    cambios.push({ campo, etiqueta, antes: antes || null, despues });
  };
  const vacio = (v: string | null) => !(v ?? '').trim();

  if (vacio(c.cuit)) poner('cuit', 'CUIT', null, p.cuit);
  // Si ARCA no devolvió impuestos (sin datos) no se baja a consumidor final a quien ya estaba cargado.
  if (vacio(c.condicion_iva) || !(p.avisos.length && p.condicion_iva === 'consumidor_final')) {
    if (c.condicion_iva !== p.condicion_iva) poner('condicion_iva', 'Condición frente al IVA', etiquetaCond(c.condicion_iva), p.condicion_iva);
    if (columnas.condicion_iva) cambios[cambios.length - 1].despues = etiquetaCond(p.condicion_iva) ?? p.condicion_iva;
  }
  if (p.domicilio_texto) poner('domicilio_fiscal', 'Domicilio fiscal', c.domicilio_fiscal, p.domicilio_texto);
  if (vacio(c.direccion)) poner('direccion', 'Dirección', null, tituloDom(p.domicilio?.direccion));
  if (vacio(c.localidad)) poner('localidad', 'Localidad', null, tituloDom(p.domicilio?.localidad));
  if (vacio(c.codigo_postal)) poner('codigo_postal', 'Código postal', null, p.domicilio?.cp);

  if (nombreProvisorio(c)) {
    const nombreActual = [c.apellido, c.nombre, c.razon_social].filter(Boolean).join(' ');
    if (p.tipo_persona === 'juridica' && p.razon_social) {
      poner('razon_social', 'Razón social', nombreActual || null, p.razon_social);
      if (c.tipo_persona !== 'juridica') poner('tipo_persona', 'Tipo de persona', c.tipo_persona, 'juridica');
    } else if (p.apellido || p.nombre) {
      poner('apellido', 'Apellido', nombreActual || null, p.apellido);
      poner('nombre', 'Nombre', null, p.nombre);
      if (c.tipo_persona !== 'fisica') poner('tipo_persona', 'Tipo de persona', c.tipo_persona, 'fisica');
    }
  }
  if (p.tipo_persona === 'fisica' && vacio(c.documento_nro)) poner('documento_nro', 'DNI', null, String(Number(p.cuit.slice(2, 10))));
  return { columnas, cambios };
}

const tituloDom = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/(^|[\s.'-])(\p{L})/gu, (_, a: string, l: string) => a + l.toUpperCase()) || null;

const COLUMNAS_PERMITIDAS = new Set(['cuit', 'condicion_iva', 'domicilio_fiscal', 'direccion', 'localidad', 'codigo_postal',
  'razon_social', 'tipo_persona', 'apellido', 'nombre', 'documento_nro']);

/** Guarda en la ficha lo decidido por planCompletar y deja la copia cruda del padrón. */
export async function guardarCompletado(id: string, columnas: Record<string, string>, cuit: string): Promise<void> {
  const claves = Object.keys(columnas).filter(k => COLUMNAS_PERMITIDAS.has(k));
  const sets = claves.map((k, i) => `${k} = $${i + 3}`);
  await db.query(
    `UPDATE clientes c SET ${[...sets, 'padron_json = p.respuesta', 'padron_actualizado_at = p.consultado_at'].join(', ')}
       FROM padron_cache p WHERE c.id = $1 AND p.cuit = $2`,
    [id, cuit, ...claves.map(k => columnas[k])]);
}
