// Atributos abreviados por tipo de abertura — subconjunto liviano de los atributos
// completos que se cargan en catálogo (ver los componentes *Atributos en NuevoProducto.tsx).
// Se usa en el ítem "a medida" de un presupuesto para no dejar esos datos librados
// solo a la descripción libre, sin llegar a la carga extensa de catálogo.
// Las keys/valores reutilizan el mismo vocabulario que catalogo_productos.atributos
// (jsonb) — no se persisten estructurados acá, se resumen como texto en la descripción.

export type OpcionAtributo = { v: string; l: string };
export type AtributoAbreviado = { key: string; label: string; opciones: OpcionAtributo[] };
export type CategoriaTipoAbertura = 'ventana' | 'puerta' | 'puerta_balcon' | 'mosquitera';

export function detectarCategoriaTipoAbertura(nombreTipo: string): CategoriaTipoAbertura | null {
  const n = nombreTipo.toLowerCase();
  if (n.includes('balc')) return 'puerta_balcon';
  if (n.includes('puerta')) return 'puerta';
  if (n.includes('ventana')) return 'ventana';
  if (n.includes('mosquer') || n.includes('mosquit')) return 'mosquitera';
  return null;
}

export const ATRIBUTOS_ABREVIADOS: Record<CategoriaTipoAbertura, AtributoAbreviado[]> = {
  ventana: [
    { key: 'tipo_ventana', label: 'Tipo', opciones: [
      { v: 'corrediza', l: 'Corrediza' }, { v: 'con_celosia', l: 'Con celosía' }, { v: 'de_abrir', l: 'De abrir' },
      { v: 'banderola', l: 'Banderola' }, { v: 'ventiluz', l: 'Ventiluz' }, { v: 'aireador', l: 'Aireador' }, { v: 'persiana', l: 'Persiana' },
    ] },
    { key: 'config_hojas', label: 'Hojas', opciones: [
      { v: '2_hojas', l: '2 hojas' }, { v: '3_hojas', l: '3 hojas' }, { v: '4_hojas', l: '4 hojas' },
    ] },
    { key: 'linea', label: 'Línea', opciones: [
      { v: 'herrero', l: 'Herrero' }, { v: 'modena', l: 'Módena' }, { v: 'a30', l: 'A30' },
    ] },
  ],
  puerta: [
    { key: 'tipo_puerta', label: 'Tipo', opciones: [
      { v: 'aluminio', l: 'Aluminio' }, { v: 'placa', l: 'Placa' }, { v: 'chapa_simple', l: 'Chapa simple' },
      { v: 'chapa_inyectada', l: 'Chapa inyectada' }, { v: 'plegable_pvc', l: 'Plegable PVC' }, { v: 'granero', l: 'Granero' },
      { v: 'corrediza_oculta', l: 'Paralela' }, { v: 'embutir', l: 'Embutir' },
    ] },
    { key: 'apertura', label: 'Apertura', opciones: [
      { v: 'de_abrir', l: 'De abrir' }, { v: 'corrediza', l: 'Corrediza' }, { v: 'plegable', l: 'Plegable' }, { v: 'embutir', l: 'Embutir' },
    ] },
    { key: 'uso', label: 'Uso', opciones: [
      { v: 'interior', l: 'Interior' }, { v: 'exterior', l: 'Exterior' }, { v: 'ingreso_frente', l: 'Ingreso / Frente' },
    ] },
  ],
  puerta_balcon: [
    { key: 'tipo_ventana', label: 'Tipo de apertura', opciones: [
      { v: 'corrediza', l: 'Corrediza' }, { v: 'con_celosia', l: 'Con celosía' }, { v: 'de_abrir', l: 'De abrir' },
      { v: 'banderola', l: 'Banderola' }, { v: 'ventiluz', l: 'Ventiluz' }, { v: 'aireador', l: 'Aireador' }, { v: 'persiana', l: 'Persiana' },
    ] },
    { key: 'config_hojas', label: 'Hojas', opciones: [
      { v: '2_hojas', l: '2 hojas' }, { v: '3_hojas', l: '3 hojas' }, { v: '4_hojas', l: '4 hojas' },
    ] },
    { key: 'marco_tipo', label: 'Marco', opciones: [
      { v: 'transitable', l: 'Transitable' }, { v: 'no_transitable', l: 'No transitable' },
    ] },
  ],
  mosquitera: [
    { key: 'tipo_mosquitera', label: 'Tipo', opciones: [
      { v: 'fija', l: 'Fija' }, { v: 'enrollable', l: 'Enrollable' }, { v: 'corrediza', l: 'Corrediza' }, { v: 'plisada', l: 'Plisada' },
    ] },
    { key: 'material_marco', label: 'Marco', opciones: [
      { v: 'aluminio', l: 'Aluminio' }, { v: 'pvc', l: 'PVC' },
    ] },
    { key: 'tipo_malla', label: 'Malla', opciones: [
      { v: 'estandar', l: 'Estándar' }, { v: 'ultrafina', l: 'Ultrafina' }, { v: 'reforzada', l: 'Reforzada' }, { v: 'anti_polvo', l: 'Anti-polvo' },
    ] },
  ],
};

// Accesorios reales por tipo (ver COMPONENTES / COMPONENTES_VNT en NuevoProducto.tsx) —
// evita mostrar herrajes de puerta (Manijón, Barral) en una ventana o viceversa.
export const ACCESORIOS_POR_TIPO: Record<CategoriaTipoAbertura, string[]> = {
  ventana:       ['Herrajes completos', 'Felpa / burletes', 'Desagüe en marco', 'Sellado', 'Embalado'],
  puerta:        ['Herrajes completos', 'Burletería / felpa', 'Sellado', 'Embalado'],
  puerta_balcon: ['Herrajes completos', 'Felpa / burletes', 'Desagüe en marco', 'Sellado', 'Embalado'],
  mosquitera:    ['Herrajes completos', 'Sellado', 'Embalado'],
};

// Reemplaza el resumen `[...]` al final de la descripción por el de la selección actual
// (o lo quita si no queda ningún atributo elegido) — mantiene la descripción como único
// campo editable/persistido, sin agregar columnas nuevas.
export function aplicarResumenAtributos(
  descripcionActual: string,
  seleccion: Record<string, string>,
  campos: AtributoAbreviado[]
): string {
  const base = descripcionActual.replace(/\s*\[[^[\]]*\]\s*$/, '').trimEnd();
  const partes = campos
    .map(c => {
      const v = seleccion[c.key];
      if (!v) return null;
      return c.opciones.find(o => o.v === v)?.l ?? null;
    })
    .filter((x): x is string => !!x);
  if (!partes.length) return base;
  return base ? `${base} [${partes.join(' · ')}]` : `[${partes.join(' · ')}]`;
}
