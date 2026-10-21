import { useMemo, useRef, useState } from 'react';
import { Upload, Percent, Loader2, FileSpreadsheet, AlertTriangle, Link2, PackageX, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { leerArchivoLista, filasDesdeTabla, type FilaLista, type ColumnasLista } from '@/lib/listaPrecios';
import { type Revision, fmt$, fmtPct, fmtFecha } from './tipos';

interface Coincidencia {
  producto_id: string; nombre: string; codigo: string | null; familia: string | null; sku: string | null; descripcion_lista: string | null;
  costo_actual: number; costo_lista_anterior: number | null; costo_nuevo: number; variacion: number | null;
  precio_actual: number; recargo_referencia: number; precio_nuevo: number; precio_manual: boolean; precio_actualizado_at: string;
  estado: 'sube' | 'baja' | 'igual' | 'sin_costo'; revisar: boolean; motivo_revisar: string | null;
}
interface Resultado {
  proveedor: { id: string; nombre: string };
  umbral_pct: number;
  productos_del_proveedor: number;
  coincidencias: Coincidencia[];
  sin_enlazar: FilaLista[];
  faltantes: { producto_id: string; nombre: string; codigo: string | null; sku: string | null; costo_actual: number }[];
  duplicados?: string[];
}

interface ArchivoLeido {
  nombre: string; filas: FilaLista[]; descartadas: number; columnas: string; tabla: unknown[][];
  detectadas: ColumnasLista; elegidas: ColumnasLista; encabezados: string[]; ejemplos: FilaLista[]; duplicados: string[]; conEncabezado: boolean;
}
type Accion = 'actualizar' | 'renovar' | 'nada';

const ESTADO: Record<Coincidencia['estado'], { l: string; cls: string }> = {
  sube: { l: 'Sube', cls: 'bg-orange-100 text-orange-800' },
  baja: { l: 'Baja', cls: 'bg-sky-100 text-sky-800' },
  igual: { l: 'Sin cambio', cls: 'bg-emerald-100 text-emerald-800' },
  sin_costo: { l: 'Sin costo', cls: 'bg-gray-100 text-gray-700' },
};

// Pestaña 3: lista de precios de UN proveedor. Se carga su lista (Excel/CSV) o un porcentaje y
// se analizan solo los productos de ese proveedor: qué sube, qué baja, qué no cambió (se
// renueva la validez), SKUs que no están en el catálogo y productos que no vinieron.
export function TabListaProveedor({ revision, soloLectura, proveedorInicial, onCambio }: {
  revision: Revision; soloLectura: boolean; proveedorInicial: string | null; onCambio: () => void;
}) {
  const proveedores = useMemo(() => {
    const m = new Map<string, { nombre: string; n: number }>();
    for (const p of revision.productos) if (p.proveedor_id) m.set(p.proveedor_id, { nombre: p.proveedor ?? '—', n: (m.get(p.proveedor_id)?.n ?? 0) + 1 });
    return [...m.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre));
  }, [revision]);
  const [proveedorId, setProveedorId] = useState(proveedorInicial && proveedores.some(([k]) => k === proveedorInicial) ? proveedorInicial : '');
  const [modo, setModo] = useState<'archivo' | 'porcentaje'>('archivo');
  const [archivo, setArchivo] = useState<ArchivoLeido | null>(null);
  const [cambiandoColumnas, setCambiandoColumnas] = useState(false);
  const [pct, setPct] = useState(5);
  const [res, setRes] = useState<Resultado | null>(null);
  const [acciones, setAcciones] = useState<Record<string, Accion>>({});
  const [actualizarVenta, setActualizarVenta] = useState(true);
  const [enlaces, setEnlaces] = useState<Record<string, string>>({});
  const [cargando, setCargando] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reiniciar = () => { setRes(null); setAcciones({}); setEnlaces({}); };

  async function elegirArchivo(f: File) {
    try {
      const r = await leerArchivoLista(f);
      if (!r.filas.length) { toast.error('No se encontraron filas con código y precio en el archivo'); return; }
      setArchivo({ nombre: f.name, ...r, elegidas: r.detectadas });
      setCambiandoColumnas(!r.conEncabezado);
      reiniciar();
    } catch (e) {
      toast.error('No se pudo leer el archivo', { description: (e as Error).message });
    }
  }

  // Volver a leer la planilla con otras columnas (si el sistema detectó mal cuál es el precio o el código)
  function elegirColumnas(c: Partial<ColumnasLista>) {
    if (!archivo) return;
    const elegidas = { ...archivo.elegidas, ...c };
    const r = filasDesdeTabla(archivo.tabla, elegidas);
    setArchivo({ ...archivo, ...r, elegidas, tabla: archivo.tabla, nombre: archivo.nombre });
    reiniciar();
  }

  async function analizar(enl = enlaces) {
    if (!proveedorId) return;
    setCargando(true);
    try {
      const body = modo === 'archivo'
        ? { proveedor_id: proveedorId, filas: archivo?.filas ?? [], enlaces: Object.entries(enl).filter(([, v]) => v).map(([sku, producto_id]) => ({ sku, producto_id })) }
        : { proveedor_id: proveedorId, pct };
      const r = await api.post<Resultado>('/catalogo/proveedor-precios/analizar-lista', body);
      setRes(r);
      // Propuesta: lo que sube se actualiza, lo que no cambió se renueva; bajas y raros, a decidir
      setAcciones(Object.fromEntries(r.coincidencias.map(c => [c.producto_id,
        c.estado === 'igual' ? 'renovar' : c.estado === 'sube' && !c.revisar ? 'actualizar' : 'nada'])));
      // Códigos repetidos en el archivo: gana la última fila
      if (r.duplicados?.length) toast.warning(`${r.duplicados.length} código(s) repetidos en el archivo: se usa la última fila de cada uno`);
    } catch (e) {
      toast.error('No se pudo analizar la lista', { description: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }

  const cuenta = (a: Accion) => Object.values(acciones).filter(x => x === a).length;

  async function aplicar() {
    if (!res || cargando) return;
    setCargando(true);
    try {
      const items = res.coincidencias.filter(c => acciones[c.producto_id] && acciones[c.producto_id] !== 'nada').map(c => ({
        producto_id: c.producto_id, costo_nuevo: c.costo_nuevo,
        precio_nuevo: actualizarVenta ? c.precio_nuevo : null, solo_renovar: acciones[c.producto_id] === 'renovar', sku: c.sku,
      }));
      const r = await api.post<{ actualizados: number; renovados: number; lista: number }>('/catalogo/proveedor-precios/aplicar-lista', {
        proveedor_id: proveedorId,
        filas: modo === 'archivo' ? archivo?.filas : undefined,
        enlaces: Object.entries(enlaces).filter(([, v]) => v).map(([sku, producto_id]) => ({ sku, producto_id })),
        items,
        origen: modo === 'archivo' ? 'archivo' : 'porcentaje',
        archivo: modo === 'archivo' ? archivo?.nombre : undefined,
        detalle: modo === 'archivo' ? `Lista de ${res.proveedor.nombre} (${archivo?.nombre})` : `${res.proveedor.nombre} ${fmtPct(pct)}`,
      });
      toast.success(`Listo: ${r.actualizados} actualizados, ${r.renovados} con validez renovada${r.lista ? ` · lista de ${r.lista} códigos guardada` : ''}`);
      reiniciar();
      setArchivo(null);
      onCambio();
    } catch (e) {
      toast.error('No se pudo aplicar', { description: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }

  const sel = 'h-10 px-2 rounded-lg border border-gray-300 bg-white text-sm';
  const prov = proveedores.find(([k]) => k === proveedorId);
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-gray-300 bg-white p-4 space-y-3">
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <label className="text-xs font-bold text-gray-800">1. Proveedor
            <select value={proveedorId} onChange={e => { setProveedorId(e.target.value); reiniciar(); }} className={cn(sel, 'w-full mt-1 font-normal')}>
              <option value="">Elegí un proveedor…</option>
              {proveedores.map(([k, v]) => <option key={k} value={k}>{v.nombre} ({v.n} productos)</option>)}
            </select>
          </label>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl" role="tablist">
            {([['archivo', 'Lista en archivo', FileSpreadsheet], ['porcentaje', 'Porcentaje', Percent]] as const).map(([v, l, I]) => (
              <button key={v} type="button" role="tab" aria-selected={modo === v} onClick={() => { setModo(v); reiniciar(); }}
                className={cn('h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5', modo === v ? 'bg-white shadow-sm text-orange-700' : 'text-gray-600')}>
                <I size={14} /> {l}
              </button>
            ))}
          </div>
        </div>

        {proveedorId && (modo === 'archivo' ? (
          <div className="space-y-1.5">
            <p className="text-xs font-bold text-gray-800">2. Lista del proveedor (Excel .xlsx o CSV, con código y precio)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input ref={input} type="file" accept=".xlsx,.csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) elegirArchivo(f); e.target.value = ''; }} />
              <button type="button" onClick={() => input.current?.click()}
                className="h-10 px-4 rounded-lg border-2 border-dashed border-orange-300 text-sm font-semibold text-orange-800 hover:bg-orange-50 inline-flex items-center gap-2">
                <Upload size={15} /> {archivo ? 'Cambiar archivo' : 'Elegir archivo'}
              </button>
              {archivo && (
                <p className="text-xs text-gray-700">
                  <b>{archivo.nombre}</b>: {archivo.filas.length} códigos con precio{archivo.descartadas ? `, ${archivo.descartadas} filas sin código o precio descartadas` : ''}.
                  <span className="block text-gray-600">{archivo.columnas}</span>
                </p>
              )}
            </div>
            {archivo && (
              <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-3 space-y-2" data-testid="columnas-detectadas">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-800">
                  <b>Así se leyó el archivo</b>
                  {!archivo.conEncabezado && <span className="text-red-700 font-semibold">Sin encabezado: verificá que sean las columnas correctas.</span>}
                  <button type="button" onClick={() => setCambiandoColumnas(v => !v)} className="ml-auto h-8 px-3 rounded-lg border border-orange-300 bg-white text-xs font-semibold text-orange-800">
                    {cambiandoColumnas ? 'Listo' : 'Cambiar columnas'}
                  </button>
                </div>
                {archivo.ejemplos.length > 0 && (
                  <ul className="text-xs text-gray-800 space-y-0.5">
                    {archivo.ejemplos.map((e, i) => (
                      <li key={i} className="flex gap-2"><span className="font-mono">{e.sku}</span><span className="truncate flex-1 text-gray-600">{e.descripcion || '—'}</span><b className="tabular-nums">{fmt$(e.precio)}</b></li>
                    ))}
                  </ul>
                )}
                {cambiandoColumnas && (
                  <div className="grid sm:grid-cols-3 gap-2">
                    {([['sku', 'Código'], ['precio', 'Precio (costo)'], ['desc', 'Descripción']] as const).map(([k, l]) => {
                      const n = Math.max(archivo.tabla.reduce((m, r) => Math.max(m, r.length), 0), 1);
                      return (
                        <label key={k} className="text-[11px] font-bold text-gray-800">{l}
                          <select value={archivo.elegidas[k]} onChange={e => elegirColumnas({ [k]: Number(e.target.value) })} className={cn(sel, 'w-full mt-1 font-normal text-xs')}>
                            {k === 'desc' && <option value={-1}>— ninguna —</option>}
                            {Array.from({ length: n }, (_, i) => (
                              <option key={i} value={i}>{archivo.encabezados[i] ? archivo.encabezados[i] : `Columna ${i + 1}`}</option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                )}
                {archivo.duplicados.length > 0 && (
                  <p className="text-xs text-yellow-900 bg-yellow-100 rounded-lg px-2 py-1">
                    <AlertTriangle size={12} className="inline mr-1" />{archivo.duplicados.length} código(s) repetidos ({archivo.duplicados.slice(0, 4).join(', ')}{archivo.duplicados.length > 4 ? '…' : ''}): se usa la última fila de cada uno.
                  </p>
                )}
              </div>
            )}
          </div>
        ) : (
          <label className="text-xs font-bold text-gray-800 flex items-center gap-2">2. Aumento del proveedor
            <input type="number" step="0.5" value={pct} onChange={e => { setPct(Number(e.target.value)); reiniciar(); }} className="h-10 w-24 px-2 rounded-lg border border-gray-300 text-sm font-normal" /> % sobre el costo de sus {prov?.[1].n ?? 0} productos
          </label>
        ))}

        {proveedorId && (
          <button type="button" onClick={() => analizar()} disabled={cargando || (modo === 'archivo' && !archivo)}
            className="h-10 px-5 rounded-lg bg-orange-600 text-white text-sm font-bold hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2">
            {cargando && !res && <Loader2 size={15} className="animate-spin" />} 3. Analizar solo los productos de {prov?.[1].nombre}
          </button>
        )}
      </div>

      {res && (
        <>
          <div className="flex flex-wrap gap-2 text-xs">
            {(['sube', 'igual', 'baja'] as const).map(e => (
              <span key={e} className={cn('px-2.5 py-1 rounded-full font-bold', ESTADO[e].cls)}>{ESTADO[e].l}: {res.coincidencias.filter(c => c.estado === e).length}</span>
            ))}
            <span className="px-2.5 py-1 rounded-full font-bold bg-yellow-100 text-yellow-900">A revisar: {res.coincidencias.filter(c => c.revisar).length}</span>
            {modo === 'archivo' && <span className="px-2.5 py-1 rounded-full font-bold bg-gray-100 text-gray-800">Códigos nuevos: {res.sin_enlazar.length}</span>}
            {modo === 'archivo' && <span className="px-2.5 py-1 rounded-full font-bold bg-gray-100 text-gray-800">No vinieron: {res.faltantes.length}</span>}
          </div>

          <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center gap-3 text-xs">
              <b className="text-gray-800">Productos de {res.proveedor.nombre} en la lista ({res.coincidencias.length})</b>
              <label className="ml-auto inline-flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={actualizarVenta} onChange={e => setActualizarVenta(e.target.checked)} />
                Actualizar también el precio de venta (mantiene el recargo, o lo lleva al objetivo si estaba por debajo)
              </label>
            </div>
            {res.coincidencias.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-600">Ningún producto del catálogo coincide con los códigos de la lista. Enlazalos abajo.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[55dvh] overflow-y-auto">
                {res.coincidencias.map(c => (
                  <div key={c.producto_id} className="px-4 py-2.5 grid grid-cols-[1fr_auto] lg:grid-cols-[minmax(0,2fr)_12.5rem_12.5rem_5rem_minmax(0,13rem)] gap-x-3 gap-y-1 items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{c.nombre}
                        {c.precio_manual && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-200 text-gray-700">precio manual</span>}
                      </p>
                      <p className="text-[11px] text-gray-600 truncate">{[c.sku && `SKU ${c.sku}`, c.codigo, c.familia, `renovado ${fmtFecha(c.precio_actualizado_at)}`].filter(Boolean).join(' · ')}</p>
                    </div>
                    <div className="lg:text-right leading-tight">
                      <p className="text-[11px] text-gray-600">costo</p>
                      <p className="text-sm tabular-nums whitespace-nowrap"><span className="text-gray-600">{fmt$(c.costo_actual)}</span> → <b>{fmt$(c.costo_nuevo)}</b></p>
                    </div>
                    <div className="lg:text-right leading-tight">
                      <p className="text-[11px] text-gray-600">venta</p>
                      <p className="text-sm tabular-nums whitespace-nowrap"><span className="text-gray-600">{fmt$(c.precio_actual)}</span> → <b className="text-orange-800">{fmt$(actualizarVenta ? c.precio_nuevo : c.precio_actual)}</b></p>
                    </div>
                    <div className="flex lg:justify-end gap-1 items-center">
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', ESTADO[c.estado].cls)}>{fmtPct(c.variacion)}</span>
                      {c.revisar && <AlertTriangle size={13} className="text-yellow-600" aria-label="Variación a revisar" />}
                    </div>
                    <select value={acciones[c.producto_id] ?? 'nada'} disabled={soloLectura} aria-label={`Qué hacer con ${c.nombre}`}
                      onChange={e => setAcciones(prev => ({ ...prev, [c.producto_id]: e.target.value as Accion }))}
                      className="h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs">
                      <option value="actualizar">Actualizar costo{actualizarVenta ? ' y precio' : ''}</option>
                      <option value="renovar">Solo renovar validez</option>
                      <option value="nada">No tocar</option>
                    </select>
                    {c.revisar && c.motivo_revisar && (
                      <p className="col-span-full -mt-0.5 text-[11px] font-semibold text-yellow-900 bg-yellow-50 rounded px-2 py-0.5" data-testid="motivo-revisar">⚠ Revisar: {c.motivo_revisar}. No se preselecciona.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {res.sin_enlazar.length > 0 && (
            <div className="rounded-2xl border border-gray-300 bg-white overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-800 flex items-center gap-2">
                <Link2 size={14} /> <b>Códigos de la lista que no están enlazados a ningún producto ({res.sin_enlazar.length})</b>
                <span className="text-gray-600">— enlazalos con un producto de {res.proveedor.nombre} y volvé a analizar; si son productos nuevos, se guardan en la lista del proveedor.</span>
              </div>
              <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
                {res.sin_enlazar.map(f => (
                  <div key={f.sku} className="px-4 py-2 grid grid-cols-1 md:grid-cols-[8rem_minmax(0,1fr)_7rem_minmax(0,16rem)] gap-2 items-center text-sm">
                    <span className="font-mono text-xs">{f.sku}</span>
                    <span className="truncate text-gray-700">{f.descripcion || '—'}</span>
                    <span className="tabular-nums md:text-right">{fmt$(f.precio)}</span>
                    <select value={enlaces[f.sku] ?? ''} onChange={e => setEnlaces(prev => ({ ...prev, [f.sku]: e.target.value }))}
                      className="h-9 px-2 rounded-lg border border-gray-300 bg-white text-xs" aria-label={`Enlazar ${f.sku}`}>
                      <option value="">Enlazar con…</option>
                      {res.faltantes.map(p => <option key={p.producto_id} value={p.producto_id}>{p.nombre}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {Object.values(enlaces).some(Boolean) && (
                <div className="px-4 py-2 border-t border-gray-200">
                  <button type="button" onClick={() => analizar()} disabled={cargando} className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-bold">
                    Volver a analizar con los enlaces
                  </button>
                </div>
              )}
            </div>
          )}

          {res.faltantes.length > 0 && modo === 'archivo' && (
            <details className="rounded-2xl border border-gray-300 bg-white">
              <summary className="px-4 py-2 text-xs text-gray-800 cursor-pointer flex items-center gap-2">
                <PackageX size={14} /> <b>Productos de {res.proveedor.nombre} que no vinieron en la lista ({res.faltantes.length})</b>
                <span className="text-gray-600">— posible baja o cambio de código</span>
              </summary>
              <ul className="divide-y divide-gray-100 text-sm">
                {res.faltantes.map(p => (
                  <li key={p.producto_id} className="px-4 py-1.5 flex gap-3"><span className="flex-1 truncate">{p.nombre}</span>
                    <span className="text-xs text-gray-600">{p.sku ? `SKU ${p.sku}` : 'sin SKU'}</span><span className="tabular-nums text-xs">{fmt$(p.costo_actual)}</span></li>
                ))}
              </ul>
            </details>
          )}

          {!soloLectura && (
            <div className="sticky bottom-2 flex justify-end">
              <button type="button" onClick={aplicar} disabled={cargando || (!cuenta('actualizar') && !cuenta('renovar') && modo !== 'archivo')}
                className="h-11 px-5 rounded-xl bg-orange-600 text-white text-sm font-bold shadow-lg hover:bg-orange-700 disabled:opacity-50 inline-flex items-center gap-2">
                {cargando ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                Aplicar: {cuenta('actualizar')} actualizan, {cuenta('renovar')} renuevan{modo === 'archivo' ? ' y se guarda la lista' : ''}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
