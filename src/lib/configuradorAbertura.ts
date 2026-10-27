// Configurador de aberturas a medida (Compras): qué características tiene cada tipo y tipología,
// sus opciones y cómo se normaliza la ficha. Funciones puras, sin imports.
//
// COPIA IDÉNTICA en server/src/lib/configuradorAbertura.ts (la usa el servidor para validar y para el PDF).
// Si se cambia una, se copia la otra: el test `configurador-espejo` compara los dos archivos byte a byte.
//
// La ficha vive en `especificaciones` (JSONB) con claves fijas (para poder analizar compras después) y
// `esquema_version: 1`. Además deriva las claves viejas (apertura, vidrio, hojas, herrajes, mosquitero,
// premarco) para que los lectores anteriores (resumen de una línea, PDFs, recepción) sigan funcionando.

export interface Opcion { v: string; l: string }
export type Ficha = Record<string, unknown>;

export const OTRO = 'otro';

export const TIPOS_ABERTURA: Opcion[] = [
  { v: 'ventana', l: 'Ventana' }, { v: 'puerta', l: 'Puerta' }, { v: 'puerta_balcon', l: 'Puerta balcón' },
  { v: 'pano_fijo', l: 'Paño fijo' }, { v: 'mosquitero', l: 'Mosquitero' }, { v: 'reja', l: 'Reja' },
  { v: 'celosia', l: 'Celosía' }, { v: OTRO, l: 'Otro' },
];

export const TIPOLOGIAS: Opcion[] = [
  { v: 'corrediza', l: 'Corrediza' }, { v: 'de_abrir', l: 'De abrir' }, { v: 'proyectante', l: 'Proyectante' },
  { v: 'banderola', l: 'Banderola' }, { v: 'ventiluz', l: 'Ventiluz (pivotante)' }, { v: 'oscilobatiente', l: 'Oscilobatiente' },
  { v: 'plegadiza', l: 'Plegadiza' }, { v: 'fijo', l: 'Fijo' }, { v: OTRO, l: 'Otra' },
];

const TIPOLOGIAS_POR_TIPO: Record<string, string[]> = {
  ventana:       ['corrediza', 'de_abrir', 'proyectante', 'banderola', 'ventiluz', 'oscilobatiente', 'fijo'],
  puerta:        ['de_abrir', 'corrediza', 'plegadiza'],
  puerta_balcon: ['corrediza', 'de_abrir', 'oscilobatiente', 'plegadiza'],
  pano_fijo:     ['fijo'],
  mosquitero:    ['corrediza', 'de_abrir', 'fijo'],
  reja:          ['fijo', 'de_abrir'],
  celosia:       ['de_abrir', 'corrediza', 'fijo'],
};

const HOJAS_POR_TIPOLOGIA: Record<string, number[]> = {
  corrediza: [2, 3, 4], de_abrir: [1, 2], oscilobatiente: [1, 2], plegadiza: [2, 3, 4, 5, 6],
};

export const SENTIDOS: Opcion[] = [
  { v: 'izquierda', l: 'Bisagra a la izquierda' }, { v: 'derecha', l: 'Bisagra a la derecha' },
];
export const ABRE_HACIA: Opcion[] = [{ v: 'adentro', l: 'Abre hacia adentro' }, { v: 'afuera', l: 'Abre hacia afuera' }];

export const COMPOSICIONES: Opcion[] = [
  { v: 'vidriado', l: 'Vidriado' }, { v: 'ciego', l: 'Ciego' }, { v: 'combinado', l: 'Combinado (vidrio y ciego)' },
];

export const VIDRIO_ESPESORES: Opcion[] = [
  { v: '3mm', l: '3 mm' }, { v: '4mm', l: '4 mm' }, { v: '5mm', l: '5 mm' }, { v: '3+3', l: 'Laminado 3+3' },
  { v: '4+4', l: 'Laminado 4+4' }, { v: '5+5', l: 'Laminado 5+5' }, { v: 'dvh_4_9_4', l: 'DVH 4/9/4' },
  { v: 'dvh_4_12_4', l: 'DVH 4/12/4' }, { v: OTRO, l: 'Otro' },
];
export const VIDRIO_COLORES: Opcion[] = [
  { v: 'incoloro', l: 'Incoloro' }, { v: 'bronce', l: 'Bronce' }, { v: 'gris', l: 'Gris' }, { v: 'opalino', l: 'Opalino' },
  { v: 'esmerilado', l: 'Esmerilado' }, { v: 'espejado', l: 'Espejado' }, { v: OTRO, l: 'Otro' },
];
export const PANELES: Opcion[] = [
  { v: 'chapa', l: 'Chapa' }, { v: 'aluminio_liso', l: 'Aluminio liso' }, { v: 'machimbre_aluminio', l: 'Machimbre de aluminio' },
  { v: 'pvc', l: 'PVC' }, { v: 'inyectado', l: 'Inyectado' }, { v: OTRO, l: 'Otro' },
];

export const ACCESORIOS: Opcion[] = [
  { v: 'mosquitero', l: 'Mosquitero' }, { v: 'reja', l: 'Reja' }, { v: 'celosia', l: 'Celosía' },
  { v: 'premarco', l: 'Premarco' }, { v: 'contramarco', l: 'Contramarco' }, { v: 'tapajuntas', l: 'Tapajuntas' },
];
const ACCESORIOS_POR_TIPO: Record<string, string[]> = {
  ventana:       ['mosquitero', 'reja', 'celosia', 'premarco', 'contramarco', 'tapajuntas'],
  puerta_balcon: ['mosquitero', 'reja', 'celosia', 'premarco', 'contramarco', 'tapajuntas'],
  puerta:        ['premarco', 'contramarco', 'tapajuntas', 'reja'],
  pano_fijo:     ['premarco', 'contramarco', 'tapajuntas', 'reja'],
};

export const HERRAJES: Opcion[] = [
  { v: 'barral', l: 'Barral' }, { v: 'picaporte', l: 'Picaporte' }, { v: 'medio_picaporte', l: 'Medio picaporte' },
  { v: 'cerradura', l: 'Cerradura' }, { v: 'cerradura_seguridad', l: 'Cerradura de seguridad' }, { v: 'pasadores', l: 'Pasadores' },
  { v: 'cierre_embutido', l: 'Cierre embutido' }, { v: 'manija', l: 'Manija' }, { v: 'falleba', l: 'Falleba' },
  { v: 'brazos_proyectantes', l: 'Brazos de empuje' }, { v: 'bisagras', l: 'Bisagras' },
];

/** Herrajes que tienen sentido según tipología (y tipo, para distinguir puerta de ventana). */
function herrajesPara(tipo: string, tipologia: string): string[] {
  const esPuerta = tipo === 'puerta' || tipo === 'puerta_balcon';
  switch (tipologia) {
    case 'de_abrir': return esPuerta
      ? ['barral', 'picaporte', 'medio_picaporte', 'cerradura', 'cerradura_seguridad', 'pasadores', 'bisagras']
      : ['manija', 'falleba', 'pasadores', 'bisagras'];
    case 'corrediza': return esPuerta ? ['cierre_embutido', 'manija', 'cerradura', 'barral'] : ['cierre_embutido', 'manija'];
    case 'plegadiza': return ['manija', 'cerradura', 'pasadores'];
    case 'oscilobatiente': return ['manija'];
    case 'proyectante': case 'banderola': case 'ventiluz': return ['manija', 'brazos_proyectantes'];
    default: return [];
  }
}

export type Campo = 'hojas' | 'sentido' | 'composicion' | 'vidrio' | 'divisiones' | 'panel' | 'accesorios' | 'herrajes';

const SIN_VIDRIO = ['mosquitero', 'reja', 'celosia'];

export function tipologiasDe(tipo: string | null | undefined): Opcion[] {
  if (!tipo) return [];
  const permitidas = TIPOLOGIAS_POR_TIPO[tipo];
  return permitidas ? TIPOLOGIAS.filter(t => permitidas.includes(t.v) || t.v === OTRO) : TIPOLOGIAS;
}

export function hojasDe(tipologia: string | null | undefined): number[] {
  return (tipologia && HOJAS_POR_TIPOLOGIA[tipologia]) || [];
}

export function accesoriosDe(tipo: string | null | undefined): Opcion[] {
  const permitidos = (tipo && ACCESORIOS_POR_TIPO[tipo]) || [];
  return ACCESORIOS.filter(a => permitidos.includes(a.v));
}

export function herrajesDe(tipo: string | null | undefined, tipologia: string | null | undefined): Opcion[] {
  if (!tipo || !tipologia) return [];
  const permitidos = tipo === OTRO || tipologia === OTRO ? HERRAJES.map(h => h.v) : herrajesPara(tipo, tipologia);
  return HERRAJES.filter(h => permitidos.includes(h.v));
}

/** Qué características se muestran para la ficha actual (depende de tipo, tipología y composición). */
export function camposVisibles(f: Ficha): Set<Campo> {
  const tipo = str(f.tipo_abertura);
  const tipologia = str(f.tipologia);
  const campos = new Set<Campo>();
  if (!tipo || !tipologia) return campos;
  if (hojasDe(tipologia).length) campos.add('hojas');
  if (['de_abrir', 'oscilobatiente'].includes(tipologia)) campos.add('sentido');
  if (!SIN_VIDRIO.includes(tipo)) {
    campos.add('composicion');
    if (f.composicion !== 'ciego') campos.add('vidrio');
    if (f.composicion === 'ciego' || f.composicion === 'combinado') campos.add('panel');
    campos.add('divisiones');
  }
  if (accesoriosDe(tipo).length) campos.add('accesorios');
  if (herrajesDe(tipo, tipologia).length) campos.add('herrajes');
  return campos;
}

export interface Division { orientacion: 'horizontal' | 'vertical'; posicion_mm: number }

/** Divisiones válidas: horizontales dentro del alto, verticales dentro del ancho, ordenadas. */
export function divisionesDe(f: Ficha): Division[] {
  const ancho = Number(f.ancho_m) * 1000 || 0;
  const alto = Number(f.alto_m) * 1000 || 0;
  const lista = Array.isArray(f.divisiones) ? f.divisiones as Division[] : [];
  return lista
    .filter(d => d && (d.orientacion === 'horizontal' || d.orientacion === 'vertical') && Number(d.posicion_mm) > 0)
    .filter(d => { const max = d.orientacion === 'horizontal' ? alto : ancho; return !max || Number(d.posicion_mm) < max; })
    .map(d => ({ orientacion: d.orientacion, posicion_mm: Math.round(Number(d.posicion_mm)) }))
    .sort((a, b) => a.orientacion.localeCompare(b.orientacion) || a.posicion_mm - b.posicion_mm);
}

/** Sectores (franjas entre travesaños horizontales, de abajo hacia arriba): vidrio o ciego. */
export function sectoresDe(f: Ficha): ('vidrio' | 'ciego')[] {
  const n = divisionesDe(f).filter(d => d.orientacion === 'horizontal').length + 1;
  if (f.composicion === 'ciego') return Array(n).fill('ciego');
  if (f.composicion !== 'combinado') return Array(n).fill('vidrio');
  const guardados = Array.isArray(f.sectores) ? f.sectores as string[] : [];
  return Array.from({ length: n }, (_, i) => (guardados[i] === 'ciego' ? 'ciego' : 'vidrio'));
}

/**
 * Deja la ficha coherente: borra lo que no aplica al tipo/tipología (por ejemplo, el sentido si pasó a corrediza,
 * o el vidrio si es ciega), recorta listas a las opciones válidas y deriva las claves viejas. Idempotente.
 */
export function normalizarFicha(entrada: Ficha): Ficha {
  const f: Ficha = { ...entrada };
  const tipo = str(f.tipo_abertura);
  if (tipo && f.tipologia && tipo !== OTRO && f.tipologia !== OTRO && !tipologiasDe(tipo).some(t => t.v === f.tipologia)) {
    delete f.tipologia;
  }
  const tipologia = str(f.tipologia);
  const visibles = camposVisibles(f);
  if (!visibles.has('hojas') || !hojasDe(tipologia).includes(Number(f.hojas))) delete f.hojas;
  if (!visibles.has('sentido')) { delete f.sentido; delete f.abre_hacia; }
  if (!visibles.has('composicion')) delete f.composicion;
  if (!visibles.has('vidrio')) { delete f.vidrio_tipo; delete f.vidrio_espesor; delete f.vidrio_color; delete f.vidrio_espesor_otro; delete f.vidrio_color_otro; }
  if (!visibles.has('panel')) { delete f.panel; delete f.panel_otro; }
  if (!visibles.has('divisiones')) { delete f.divisiones; delete f.sectores; }
  else {
    const divs = divisionesDe(f);
    if (divs.length) f.divisiones = divs; else delete f.divisiones;
    if (f.composicion === 'combinado') f.sectores = sectoresDe(f); else delete f.sectores;
  }
  const accesoriosOk = accesoriosDe(tipo).map(a => a.v);
  const accesorios = lista(f.accesorios_lista).filter(a => accesoriosOk.includes(a));
  if (visibles.has('accesorios') && accesorios.length) f.accesorios_lista = accesorios; else delete f.accesorios_lista;
  const herrajesOk = herrajesDe(tipo, tipologia).map(h => h.v);
  const herrajes = lista(f.herrajes_lista).filter(h => herrajesOk.includes(h));
  if (visibles.has('herrajes') && herrajes.length) f.herrajes_lista = herrajes; else delete f.herrajes_lista;
  for (const k of ['tipo_abertura', 'tipologia', 'vidrio_espesor', 'vidrio_color', 'panel'] as const) {
    if (f[k] !== OTRO) delete f[`${k}_otro`];
  }

  // Claves viejas derivadas (resumen de una línea, PDFs y pantallas anteriores)
  f.apertura = tipologia ? etiqueta(TIPOLOGIAS, tipologia, f.tipologia_otro) : undefined;
  f.vidrio = visibles.has('vidrio') ? textoVidrio(f) || undefined : f.composicion === 'ciego' ? 'Ciego' : undefined;
  f.hojas = f.hojas != null ? Number(f.hojas) : undefined;
  f.herrajes = herrajes.length ? herrajes.map(h => etiqueta(HERRAJES, h)).join(', ') : undefined;
  f.mosquitero = accesorios.includes('mosquitero') || undefined;
  f.premarco = accesorios.includes('premarco') || undefined;
  f.esquema_version = 1;
  for (const k of Object.keys(f)) if (f[k] === undefined || f[k] === null || f[k] === '') delete f[k];
  return f;
}

/** Ficha vieja (texto libre o autocompletada del presupuesto/relevamiento) → claves del configurador. */
export function desdeFichaVieja(vieja: Ficha | null | undefined): Ficha {
  const v = vieja ?? {};
  if (esFichaConfigurada(v)) return v;
  const clave = (x: unknown) => str(x).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '_');
  const tipoTxt = clave(v.tipo_abertura);
  const tipo = tipoTxt.includes('balc') ? 'puerta_balcon' : tipoTxt.includes('puerta') ? 'puerta'
    : tipoTxt.includes('ventana') ? 'ventana' : tipoTxt.includes('mosq') ? 'mosquitero' : tipoTxt.includes('reja') ? 'reja'
    : tipoTxt.includes('celos') ? 'celosia' : tipoTxt.includes('fijo') ? 'pano_fijo' : '';
  const apertura = clave(v.apertura);
  const tipologia = TIPOLOGIAS.find(t => t.v !== OTRO && apertura.includes(t.v))?.v ?? '';
  const hojas = Number(String(v.hojas ?? '').match(/\d+/)?.[0]) || undefined;
  const accesorios = [v.mosquitero === true ? 'mosquitero' : '', v.premarco === true ? 'premarco' : ''].filter(Boolean);
  const nueva: Ficha = {
    ...v,
    tipo_abertura: tipo || (v.tipo_abertura ? OTRO : undefined),
    tipo_abertura_otro: tipo ? undefined : v.tipo_abertura,
    tipologia: tipologia || undefined,
    hojas,
    vidrio_tipo: v.vidrio,
    accesorios_lista: accesorios.length ? accesorios : undefined,
    obs_fabricacion: [v.obs_fabricacion, v.observaciones, v.herrajes ? `Herrajes: ${str(v.herrajes)}` : ''].filter(Boolean).join(' · ') || undefined,
  };
  delete nueva.observaciones;
  return normalizarFicha(nueva);
}

/** Descripción sugerida para el ítem ("Puerta de abrir 900 × 2050 mm"). */
export function descripcionSugerida(f: Ficha): string {
  const tipo = str(f.tipo_abertura) ? etiqueta(TIPOS_ABERTURA, str(f.tipo_abertura), f.tipo_abertura_otro) : '';
  const tipologia = str(f.tipologia) && f.tipologia !== 'fijo' ? etiqueta(TIPOLOGIAS, str(f.tipologia), f.tipologia_otro).toLowerCase() : '';
  const medidas = Number(f.ancho_m) > 0 && Number(f.alto_m) > 0
    ? `${Math.round(Number(f.ancho_m) * 1000)} × ${Math.round(Number(f.alto_m) * 1000)} mm` : '';
  return [tipo, tipologia, medidas].filter(Boolean).join(' ');
}

export function esFichaConfigurada(f: Ficha | null | undefined): boolean {
  return !!f && f.esquema_version === 1;
}

/** Lo que falta para que la ficha sirva para cotizar (vacío = completa). */
export function faltantesFicha(f: Ficha): string[] {
  const falta: string[] = [];
  if (!f.tipo_abertura) falta.push('el tipo de abertura');
  if (!f.tipologia) falta.push('la tipología');
  if (!(Number(f.ancho_m) > 0) || !(Number(f.alto_m) > 0)) falta.push('las medidas');
  const v = camposVisibles(f);
  if (v.has('hojas') && !f.hojas) falta.push('la cantidad de hojas');
  if (v.has('sentido') && !f.sentido) falta.push('el sentido de apertura');
  return falta;
}

export interface FilaFicha { grupo: string; label: string; valor: string }

/** Ficha completa, agrupada y legible (detalle en pantalla y PDF al proveedor). */
export function detalleFicha(f: Ficha): FilaFicha[] {
  const filas: FilaFicha[] = [];
  const add = (grupo: string, label: string, valor: string | null | undefined) => { if (valor) filas.push({ grupo, label, valor }); };
  const tipo = str(f.tipo_abertura);
  add('Abertura', 'Tipo', tipo ? etiqueta(TIPOS_ABERTURA, tipo, f.tipo_abertura_otro) : null);
  add('Abertura', 'Tipología', str(f.tipologia) ? etiqueta(TIPOLOGIAS, str(f.tipologia), f.tipologia_otro) : null);
  if (Number(f.ancho_m) > 0 && Number(f.alto_m) > 0) {
    add('Abertura', 'Medidas', `${Math.round(Number(f.ancho_m) * 1000)} × ${Math.round(Number(f.alto_m) * 1000)} mm (ancho × alto)`);
  }
  add('Abertura', 'Hojas', f.hojas ? String(f.hojas) : null);
  if (f.sentido) {
    add('Abertura', 'Sentido', [etiqueta(SENTIDOS, str(f.sentido)), f.abre_hacia ? etiqueta(ABRE_HACIA, str(f.abre_hacia)).toLowerCase() : '']
      .filter(Boolean).join(', ') + ' (visto desde adentro)');
  }
  add('Carpintería', 'Sistema', str(f.sistema) || null);
  add('Carpintería', 'Color de perfilería', str(f.color) || null);
  add('Carpintería', 'Composición', f.composicion ? etiqueta(COMPOSICIONES, str(f.composicion)) : null);
  add('Vidrio', 'Vidrio', textoVidrio(f) || null);
  add('Paneles', 'Revestimiento / panel', f.panel ? etiqueta(PANELES, str(f.panel), f.panel_otro) : null);
  const divs = divisionesDe(f);
  if (divs.length) {
    add('Divisiones', 'Travesaños', divs.map(d => `${d.orientacion === 'horizontal' ? 'horizontal a' : 'vertical a'} ${d.posicion_mm} mm ${d.orientacion === 'horizontal' ? 'del piso del marco' : 'del lado izquierdo'}`).join(' · '));
  }
  if (f.composicion === 'combinado') {
    add('Divisiones', 'Sectores (de abajo hacia arriba)', sectoresDe(f).map((s, i) => `${i + 1}: ${s}`).join(' · '));
  }
  add('Accesorios', 'Accesorios', lista(f.accesorios_lista).map(a => etiqueta(ACCESORIOS, a)).join(', ') || null);
  add('Herrajes', 'Herrajes', lista(f.herrajes_lista).map(h => etiqueta(HERRAJES, h)).join(', ') || str(f.herrajes) || null);
  add('Observaciones', 'Fabricación', str(f.obs_fabricacion) || null);
  return filas;
}

export interface CambioFicha { label: string; antes: string; despues: string }

/** Qué cambió entre dos versiones de una ficha ("Vidrio: Incoloro → Opalino"), por característica legible. */
export function diferenciasFicha(antes: Ficha, despues: Ficha): CambioFicha[] {
  const a = new Map(detalleFicha(desdeFichaVieja(antes)).map(f => [f.label, f.valor]));
  const b = new Map(detalleFicha(desdeFichaVieja(despues)).map(f => [f.label, f.valor]));
  const labels = [...new Set([...a.keys(), ...b.keys()])];
  return labels
    .filter(l => (a.get(l) ?? '') !== (b.get(l) ?? ''))
    .map(l => ({ label: l, antes: a.get(l) ?? '—', despues: b.get(l) ?? '—' }));
}

function textoVidrio(f: Ficha): string {
  const espesor = f.vidrio_espesor ? etiqueta(VIDRIO_ESPESORES, str(f.vidrio_espesor), f.vidrio_espesor_otro) : '';
  const tipo = str(f.vidrio_tipo);
  // "Laminado" + "Laminado 3+3" / "DVH" + "DVH 4/9/4": el tipo ya está dicho en el espesor
  const tipoRepetido = !!tipo && espesor.toLowerCase().startsWith(tipo.toLowerCase());
  return [
    tipoRepetido ? '' : tipo,
    espesor,
    f.vidrio_color ? etiqueta(VIDRIO_COLORES, str(f.vidrio_color), f.vidrio_color_otro).toLowerCase() : '',
  ].filter(Boolean).join(' ');
}

export function etiqueta(opciones: Opcion[], v: string, otro?: unknown): string {
  if (v === OTRO) return str(otro) || 'Otro';
  return opciones.find(o => o.v === v)?.l ?? v.replace(/_/g, ' ');
}

function str(v: unknown): string { return typeof v === 'string' ? v.trim() : ''; }
function lista(v: unknown): string[] { return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; }
