// Lectura de la lista de precios de un proveedor (CSV o Excel) para la Revisión integral de
// precios. Detecta solo las columnas (SKU / código, descripción, precio) por el encabezado, y
// entiende los importes en formato argentino ("$ 1.234,56") y en formato con punto decimal.

export interface FilaLista { sku: string; descripcion: string; precio: number }

/** Importe desde texto o número: "1.234,56", "1234.56", "$ 12.500", 12500. null si no es un número. */
export function parseImporte(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string') return null;
  let s = v.replace(/[^\d.,-]/g, '');
  if (!/\d/.test(s)) return null;
  const coma = s.lastIndexOf(','), punto = s.lastIndexOf('.');
  if (coma >= 0 && punto >= 0) {
    // El separador que aparece último es el decimal
    s = coma > punto ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (coma >= 0) {
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '');            // "12.500" = doce mil quinientos
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const RE_SKU = /^(sku|c[oó]d|art[ií]culo n|referencia|ref\.?$)/i;
const RE_DESC = /(desc|art[ií]culo|producto|detalle|nombre)/i;
const RE_PRECIO = /(precio|importe|valor|lista|costo|neto|p\.?\s?unit)/i;

/** Filas de la planilla (ya separadas en celdas) → filas de lista. */
export function filasDesdeTabla(tabla: unknown[][]): { filas: FilaLista[]; descartadas: number; columnas: string } {
  const celdas = tabla.map(r => r.map(c => (c === null || c === undefined ? '' : String(c).trim())));
  // Encabezado: la primera fila (de las 10 primeras) que tenga una columna de precio y otra de código
  let cab = -1, iSku = 0, iDesc = 1, iPrecio = 2;
  for (let i = 0; i < Math.min(10, celdas.length); i++) {
    const r = celdas[i];
    const p = r.findIndex(c => RE_PRECIO.test(c));
    const k = r.findIndex(c => RE_SKU.test(c));
    if (p >= 0 && k >= 0) {
      cab = i; iSku = k; iPrecio = p;
      iDesc = r.findIndex((c, j) => j !== k && j !== p && RE_DESC.test(c));
      break;
    }
  }
  if (cab < 0) {
    // Sin encabezado: código, descripción, precio (o el último número de la fila)
    iDesc = 1;
    iPrecio = -1;
  }
  const filas: FilaLista[] = [];
  let descartadas = 0;
  for (let i = cab + 1; i < celdas.length; i++) {
    const r = celdas[i];
    if (r.every(c => !c)) continue;
    const sku = r[iSku] ?? '';
    let precio: number | null;
    if (iPrecio >= 0) precio = parseImporte(tabla[i][iPrecio] ?? '');
    else {
      precio = null;
      for (let j = r.length - 1; j > iSku; j--) { const n = parseImporte(tabla[i][j] ?? ''); if (n !== null && j !== iDesc) { precio = n; break; } }
    }
    if (!sku || precio === null || !(precio > 0)) { descartadas++; continue; }
    filas.push({ sku, descripcion: iDesc >= 0 ? (r[iDesc] ?? '') : '', precio: Math.round(precio * 100) / 100 });
  }
  const columnas = cab >= 0
    ? `Código: "${celdas[cab][iSku]}", precio: "${celdas[cab][iPrecio]}"${iDesc >= 0 ? `, descripción: "${celdas[cab][iDesc]}"` : ''}`
    : 'Sin encabezado: se toma código, descripción y precio en ese orden';
  return { filas, descartadas, columnas };
}

/** Separa un CSV (coma, punto y coma o tabulador, con comillas). */
export function tablaDesdeCsv(texto: string): string[][] {
  const lineas = texto.replace(/^\uFEFF/, '').split(/\r?\n/).filter(l => l.trim());
  if (!lineas.length) return [];
  const muestra = lineas.slice(0, 5).join('\n');
  const sep = [';', '\t', ','].map(s => ({ s, n: muestra.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  return lineas.map(l => {
    const out: string[] = [];
    let cur = '', comillas = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (comillas) {
        if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') comillas = false; else cur += ch;
      } else if (ch === '"') comillas = true;
      else if (ch === sep) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  });
}

/** Lee un archivo .csv/.txt o .xlsx elegido por el usuario. */
export async function leerArchivoLista(file: File): Promise<ReturnType<typeof filasDesdeTabla>> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser');
    const datos = await readSheet(file);
    return filasDesdeTabla(datos as unknown[][]);
  }
  if (/\.xls$/i.test(file.name)) throw new Error('El formato .xls (Excel viejo) no se puede leer: guardalo como .xlsx o .csv');
  return filasDesdeTabla(tablaDesdeCsv(await file.text()));
}
