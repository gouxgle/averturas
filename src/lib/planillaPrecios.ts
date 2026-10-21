import { api } from '@/lib/api';
import { fechaDiaAR } from '@/lib/utils';
import { parseImporte } from '@/lib/listaPrecios';

// Planilla Excel de precios por proveedor: se exporta con lo que hay cargado, el equipo completa a mano la
// columna "Nuevo precio de lista (costo)" y se vuelve a subir en Revisión de precios → Lista del proveedor
// (el sistema recalcula el precio de venta y muestra la vista previa antes de aplicar).

export const COL_ID = 'ID (no modificar)';
export const COL_NUEVO = 'Nuevo precio de lista (costo)';

export interface FilaPlanilla {
  id: string; codigo: string | null; sku: string | null; nombre: string; descripcion: string | null; familia: string | null;
  activo: boolean; lista_actual: number; venta_actual: number;
}
export interface DatosPlanilla { proveedor: { id: string; nombre: string }; filas: FilaPlanilla[] }

/** Texto "nombre – descripción" sin repetir si la descripción ya está en el nombre. */
export function nombreCompleto(f: Pick<FilaPlanilla, 'nombre' | 'descripcion'>): string {
  const d = (f.descripcion ?? '').trim();
  return d && !f.nombre.toLowerCase().includes(d.toLowerCase()) ? `${f.nombre} – ${d}` : f.nombre;
}

/** Hoja de cálculo (filas de celdas) de la planilla; separada de la descarga para poder probarla. */
export function armarHoja(d: DatosPlanilla, hoy: string): unknown[][] {
  const enc = (value: string) => ({ value, fontWeight: 'bold', backgroundColor: '#E5E7EB', borderColor: '#9CA3AF', wrap: true, alignVertical: 'center' });
  const nuevo = { value: COL_NUEVO, fontWeight: 'bold', backgroundColor: '#FDE68A', borderColor: '#9CA3AF', wrap: true, alignVertical: 'center' };
  const fmt = '#,##0.00';
  return [
    [{ value: `Lista de precios — ${d.proveedor.nombre} — ${hoy.split('-').reverse().join('/')}`, fontWeight: 'bold', fontSize: 14, columnSpan: 7 }, null, null, null, null, null, null],
    [{ value: `Completá solo la columna "${COL_NUEVO}" con el precio de lista del proveedor. Las filas que quedan vacías no se modifican. No cambies la columna "${COL_ID}".`, textColor: '#6B7280', wrap: true, columnSpan: 7, height: 32 }, null, null, null, null, null, null],
    [null],
    [enc(COL_ID), enc('Código'), enc('Código proveedor'), enc('Producto'), enc('Precio de lista actual (costo)'), enc('Precio de venta actual'), nuevo],
    ...d.filas.map(f => [
      { value: f.id, textColor: '#9CA3AF', fontSize: 8 },
      f.codigo ? { value: f.codigo, type: String, format: '@' } : null,
      f.sku ? { value: f.sku, type: String, format: '@' } : null,
      { value: nombreCompleto(f) },
      { value: f.lista_actual, type: Number, format: fmt },
      { value: f.venta_actual, type: Number, format: fmt },
      { value: null, type: Number, backgroundColor: '#FEF9C3', format: fmt, borderColor: '#D1D5DB' },
    ]),
  ];
}

/** Descarga la planilla (.xlsx) de los productos de un proveedor. Devuelve cuántas filas tiene. */
export async function exportarPlanilla(proveedorId: string, opts: { soloActivos?: boolean; familiaId?: string } = {}): Promise<{ filas: number; proveedor: string }> {
  const q = new URLSearchParams({ proveedor_id: proveedorId, solo_activos: String(opts.soloActivos !== false) });
  if (opts.familiaId) q.set('familia_id', opts.familiaId);
  const datos = await api.get<DatosPlanilla>(`/productos/planilla-precios?${q}`);
  if (!datos.filas.length) throw new Error('Ese proveedor no tiene productos para exportar');
  const hoy = fechaDiaAR(new Date());
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  const blob = await writeExcelFile(armarHoja(datos, hoy) as never, {
    sheet: 'Lista de precios', stickyRowsCount: 4,
    columns: [{ width: 8 }, { width: 14 }, { width: 18 }, { width: 52 }, { width: 18 }, { width: 18 }, { width: 22 }],
  }).toBlob();
  const nombre = `lista-precios-${datos.proveedor.nombre.replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${hoy}.xlsx`;
  const url = URL.createObjectURL(blob as Blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { filas: datos.filas.length, proveedor: datos.proveedor.nombre };
}

export interface PlanillaLeida { items: { producto_id: string; precio: number }[]; vacias: number; invalidas: number; filas: number }

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Si la tabla es una planilla exportada por el sistema (tiene la columna ID y la de nuevo precio), la lee; si no, null. */
export function leerPlanilla(tabla: unknown[][]): PlanillaLeida | null {
  const celdas = tabla.map(r => r.map(c => (c === null || c === undefined ? '' : String(c).trim())));
  for (let i = 0; i < Math.min(15, celdas.length); i++) {
    const iId = celdas[i].findIndex(c => /^id\b/i.test(c));
    const iNuevo = celdas[i].findIndex(c => /^nuevo precio/i.test(c));
    if (iId < 0 || iNuevo < 0) continue;
    const items: PlanillaLeida['items'] = [];
    let vacias = 0, invalidas = 0, filas = 0;
    for (let j = i + 1; j < celdas.length; j++) {
      const id = celdas[j][iId] ?? '';
      if (!id) continue;
      filas++;
      if (!RE_UUID.test(id)) { invalidas++; continue; }
      const crudo = celdas[j][iNuevo] ?? '';
      if (!crudo) { vacias++; continue; }
      const precio = parseImporte(tabla[j][iNuevo] ?? '');
      if (precio === null || !(precio > 0)) { invalidas++; continue; }
      items.push({ producto_id: id, precio: Math.round(precio * 100) / 100 });
    }
    return { items, vacias, invalidas, filas };
  }
  return null;
}
