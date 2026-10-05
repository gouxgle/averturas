// Completar un contacto que ya existe con lo que el operador acaba de escribir al querer
// agendarlo de nuevo. El caso típico: el número ya estaba guardado con un nombre provisorio
// ("Contacto", "Contacto Alcides", el propio número…) y ahora se presenta con su nombre real.
// Regla de oro: solo se agrega lo que falta; lo que ya estaba cargado no se pisa sin avisar.

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const normalizar = (s: string) => sinAcentos(s).toLowerCase().replace(/[^a-z0-9ñ]+/g, ' ').trim();

/** Últimos 10 dígitos de un teléfono: sirve para comparar "+54 9 3704 12-3456" con "3704123456". */
export function ultimos10(tel: string | null | undefined): string {
  return (tel ?? '').replace(/\D/g, '').slice(-10);
}

/**
 * Parte un teléfono guardado en código de área + número para los dos casilleros del formulario.
 * Los números cargados desde la agenda del celular vienen como "+5493624266648" (sin espacio):
 * antes se partía mal (prefijo "+549") y al tocar el número se recortaba. Solo afecta lo que se
 * muestra: el valor guardado no cambia hasta que el operador edita el teléfono.
 */
export function partirTelefono(raw: string | null | undefined): { prefijo: string; numero: string } {
  const texto = (raw ?? '').trim();
  if (!texto) return { prefijo: '', numero: '' };
  // Formato del propio formulario: "3704 322616"
  const i = texto.indexOf(' ');
  if (i > 0 && !texto.startsWith('+')) return { prefijo: texto.slice(0, i).replace(/\D/g, ''), numero: texto.slice(i + 1).replace(/\D/g, '') };
  let d = texto.replace(/\D/g, '');
  const conPais = d.startsWith('54');
  if (conPais) d = d.slice(2);
  // Después del 54, el 9 marca el celular (ningún código de área empieza con 9)
  if (d.startsWith('9') && (conPais || d.length > 10)) d = d.slice(1);
  if (d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) {
    const area = d.startsWith('11') ? 2 : 4;
    return { prefijo: d.slice(0, area), numero: d.slice(area) };
  }
  return { prefijo: d.slice(0, 4), numero: d.slice(4) };
}

const PALABRAS_PROVISORIAS = new Set([
  'contacto', 'contactos', 'sin', 'nombre', 'desconocido', 'desconocida', 'cliente', 'nuevo', 'nueva',
  'lead', 'whatsapp', 'wsp', 'sn', 'anonimo', 'anonima', 'consulta', 'interesado', 'interesada',
]);

/**
 * ¿El nombre guardado es solo un marcador de lugar? Sí si alguna palabra es genérica
 * ("Contacto", "Sin nombre", "Cliente"…) o si hay un número suelto ("10 Patricia"), o si el
 * nombre es el propio teléfono. "Contacto Alcides" cuenta: el nombre real recién llega ahora.
 */
export function esNombreProvisorio(apellido: string | null | undefined, nombre: string | null | undefined, razonSocial?: string | null, telefono?: string | null): boolean {
  const completo = normalizar([apellido, nombre, razonSocial].filter(Boolean).join(' '));
  if (!completo) return true;
  const palabras = completo.split(' ');
  if (palabras.some(p => PALABRAS_PROVISORIAS.has(p) || /^\d+$/.test(p))) return true;
  const tel = ultimos10(telefono);
  return !!tel && completo.replace(/\s/g, '') === tel;
}

export type Resolucion = 'completa' | 'provisorio' | 'conflicto' | 'juntar' | 'igual';
export type Uso = 'nuevo' | 'existente' | 'juntar';

export interface FilaFusion {
  campo: string;
  etiqueta: string;
  existente: string;
  nuevo: string;
  resolucion: Resolucion;
  /** Qué valor queda por defecto; en los conflictos el operador puede cambiarlo. */
  usar: Uso;
}

export const CAMPOS_FUSIONABLES: { campo: string; etiqueta: string }[] = [
  { campo: 'documento_nro', etiqueta: 'DNI / CUIT' },
  { campo: 'email', etiqueta: 'Email' },
  { campo: 'localidad', etiqueta: 'Localidad' },
  { campo: 'direccion', etiqueta: 'Dirección' },
  { campo: 'codigo_postal', etiqueta: 'Código postal' },
  { campo: 'telefono_fijo', etiqueta: 'Teléfono fijo' },
  { campo: 'fecha_nacimiento', etiqueta: 'Fecha de nacimiento' },
  { campo: 'email_alternativo', etiqueta: 'Email alternativo' },
  { campo: 'notas', etiqueta: 'Observaciones' },
];

export interface ContactoExistente {
  apellido: string | null; nombre: string | null; razon_social: string | null; telefono: string | null;
  tipo_persona: 'fisica' | 'juridica';
  [campo: string]: unknown;
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());

/** Nombre como se muestra y se escribe en el formulario ("Apellido, Nombre"). */
export function nombreDeContacto(c: Pick<ContactoExistente, 'apellido' | 'nombre' | 'razon_social' | 'tipo_persona'>): string {
  if (c.tipo_persona === 'juridica') return texto(c.razon_social);
  return [c.apellido, c.nombre].map(texto).filter(Boolean).join(', ');
}

const mismoNombre = (a: string, b: string) => {
  const ta = normalizar(a).split(' ').filter(Boolean).sort().join(' ');
  const tb = normalizar(b).split(' ').filter(Boolean).sort().join(' ');
  return ta === tb;
};

/**
 * Compara lo que ya estaba guardado con lo que se escribió y arma la propuesta fila por fila:
 *  · lo que faltaba se completa;
 *  · un nombre provisorio se reemplaza por el real;
 *  · lo que ya estaba y es distinto queda como estaba (el operador puede elegir el nuevo);
 *  · las observaciones se juntan.
 * Las filas "igual" no necesitan decisión.
 */
export function construirFusion(existente: ContactoExistente, nuevo: Record<string, string>, nombreNuevo: string): FilaFusion[] {
  const filas: FilaFusion[] = [];

  const nombreExistente = nombreDeContacto(existente);
  const nn = nombreNuevo.trim();
  if (nn) {
    const provisorio = esNombreProvisorio(existente.apellido, existente.nombre, existente.razon_social, existente.telefono);
    const etiqueta = existente.tipo_persona === 'juridica' ? 'Razón social' : 'Apellido y nombre';
    if (!nombreExistente || provisorio) {
      filas.push({ campo: 'nombre', etiqueta, existente: nombreExistente, nuevo: nn, resolucion: nombreExistente ? 'provisorio' : 'completa', usar: 'nuevo' });
    } else if (mismoNombre(nombreExistente, nn)) {
      filas.push({ campo: 'nombre', etiqueta, existente: nombreExistente, nuevo: nn, resolucion: 'igual', usar: 'existente' });
    } else {
      filas.push({ campo: 'nombre', etiqueta, existente: nombreExistente, nuevo: nn, resolucion: 'conflicto', usar: 'existente' });
    }
  }

  for (const { campo, etiqueta } of CAMPOS_FUSIONABLES) {
    const n = texto(nuevo[campo]);
    if (!n) continue;
    const e = texto(existente[campo]);
    if (!e) filas.push({ campo, etiqueta, existente: '', nuevo: n, resolucion: 'completa', usar: 'nuevo' });
    else if (normalizar(e) === normalizar(n)) filas.push({ campo, etiqueta, existente: e, nuevo: n, resolucion: 'igual', usar: 'existente' });
    else if (campo === 'notas') filas.push({ campo, etiqueta, existente: e, nuevo: n, resolucion: 'juntar', usar: 'juntar' });
    else filas.push({ campo, etiqueta, existente: e, nuevo: n, resolucion: 'conflicto', usar: 'existente' });
  }
  return filas;
}

export interface ResultadoFusion {
  /** Valores a pisar en el formulario de edición (clave = campo del formulario). */
  valores: Record<string, string>;
  /** Si el nombre cambió, el texto para el casillero "Apellido y nombre". */
  nombreCompleto?: string;
  resumen: { completados: string[]; nombreAnterior?: string; mantenidos: string[] };
}

/** Aplica las decisiones (por defecto las propuestas) y devuelve qué cambiar y qué contar al operador. */
export function aplicarFusion(filas: FilaFusion[]): ResultadoFusion {
  const valores: Record<string, string> = {};
  const resumen: ResultadoFusion['resumen'] = { completados: [], mantenidos: [] };
  let nombreCompleto: string | undefined;
  for (const f of filas) {
    if (f.resolucion === 'igual') continue;
    if (f.usar === 'existente') {
      if (f.resolucion === 'conflicto') resumen.mantenidos.push(f.etiqueta);
      continue;
    }
    if (f.campo === 'nombre') {
      nombreCompleto = f.nuevo;
      if (f.existente) resumen.nombreAnterior = f.existente;
      else resumen.completados.push(f.etiqueta);
      continue;
    }
    valores[f.campo] = f.usar === 'juntar' ? `${f.existente}\n${f.nuevo}` : f.nuevo;
    resumen.completados.push(f.etiqueta);
  }
  return { valores, nombreCompleto, resumen };
}
